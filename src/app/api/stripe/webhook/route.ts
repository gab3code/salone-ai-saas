import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { creaClientStripe } from "@/lib/stripe/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { sincronizzaAbbonamento, statoAbbonamentoDaStripe } from "@/lib/stripe/abbonamento.server";
import { sincronizzaQuantitaOperatoriStripe } from "@/lib/stripe/operatori.server";
import { completaPagamentoCaparra } from "@/lib/stripe/caparra-webhook.server";

/**
 * Webhook Stripe: unica fonte di verità per aggiornare piano/stato reale
 * dell'abbonamento nel nostro DB. Non fidarsi MAI del client per questo --
 * un browser potrebbe dire "ho pagato" senza averlo fatto, o il redirect di
 * successo del checkout potrebbe non arrivare mai (tab chiusa, rete
 * caduta). La firma (header "stripe-signature") garantisce che la
 * richiesta venga davvero da Stripe -- va verificata SEMPRE prima di
 * leggere il corpo come JSON, per questo si legge come testo grezzo.
 *
 * Configurazione lato Stripe Dashboard (Gabriel, non automatizzabile da
 * qui): Developer -> Webhooks -> aggiungi endpoint
 * "https://<dominio>/api/stripe/webhook", eventi da ascoltare:
 * checkout.session.completed, customer.subscription.created,
 * customer.subscription.updated, customer.subscription.deleted. Il
 * "Signing secret" mostrato lì va in STRIPE_WEBHOOK_SECRET.
 *
 * Stesso endpoint gestisce anche il pagamento della caparra (Fase 6, mode
 * "payment" invece di "subscription", riconosciuto da
 * `session.metadata.tipo === "caparra"`) -- un solo webhook, non uno per
 * flusso, coerente con l'unico "Signing secret" configurato sopra.
 */

export async function POST(request: NextRequest) {
  const firma = request.headers.get("stripe-signature");
  const segreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!firma || !segreto) {
    return NextResponse.json({ errore: "Webhook non configurato (STRIPE_WEBHOOK_SECRET mancante)." }, { status: 500 });
  }

  const corpoGrezzo = await request.text();
  const stripe = creaClientStripe();

  let evento: Stripe.Event;
  try {
    evento = stripe.webhooks.constructEvent(corpoGrezzo, firma, segreto);
  } catch (errore) {
    return NextResponse.json({ errore: `Firma non valida: ${(errore as Error).message}` }, { status: 400 });
  }

  const admin = creaClientAdmin();

  // Scritture fallite durante la lavorazione di questo evento.
  //
  // Serve perche' questo endpoint risponde 200 in fondo, e per Stripe 200
  // vuol dire "ricevuto e lavorato": non ritenta MAI piu'. Fino al
  // 17/09/2026 gli update qui sotto non controllavano l'errore, quindi una
  // scrittura fallita su un pagamento gia' incassato spariva in silenzio e
  // il salone restava con il piano vecchio dopo aver pagato -- senza che
  // nessuno, da nessuna parte, potesse accorgersene.
  //
  // Con un 500 Stripe ritenta per giorni, che e' esattamente il
  // comportamento voluto per un errore passeggero del database.
  let scritturaFallita: string | null = null;

  switch (evento.type) {
    case "checkout.session.completed": {
      const session = evento.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.tipo === "caparra") {
        // Una scrittura fallita qui deve far rispondere 500 come nel ramo
        // dell'abbonamento: l'appuntamento potrebbe gia' esistere, e il
        // tentativo successivo lo ritrova dal payment intent (vedi il file).
        const esito = await completaPagamentoCaparra(admin, stripe, session);
        if ("errore" in esito) scritturaFallita = esito.errore;
        break;
      }
      if (session.mode === "subscription" && session.subscription) {
        const tenantId = session.metadata?.tenant_id ?? session.client_reference_id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        if (tenantId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          // Piano gestito a mano dal pannello admin (migrazione 0028): si
          // salva comunque l'id della subscription -- serve al Customer
          // Portal e alla sincronizzazione futura -- ma piano e stato
          // restano quelli decisi da Gabriel.
          const { data: tenantEsistente } = await admin
            .from("tenants")
            .select("piano_manuale")
            .eq("id", tenantId)
            .maybeSingle();

          const { error: erroreTenant } = await admin
            .from("tenants")
            .update({
              stripe_subscription_id: subscription.id,
              // La prova gratuita finisce qui: da adesso il piano lo decide
              // l'abbonamento. Lasciarla accesa vorrebbe dire che il cron
              // notturno, un giorno, proverebbe a declassare un cliente che
              // paga (non lo farebbe -- guarda anche stripe_subscription_id
              // -- ma una data che non significa piu' niente e' esattamente
              // il genere di cosa che un domani inganna chi legge).
              prova_growth_fino_al: null,
              ...(tenantEsistente?.piano_manuale
                ? {}
                : {
                    stato_abbonamento: statoAbbonamentoDaStripe(subscription.status),
                    ...(session.metadata?.piano ? { piano: session.metadata.piano } : {}),
                  }),
            })
            .eq("id", tenantId);
          if (erroreTenant) {
            // Soldi gia' incassati e piano non applicato: e' il caso in cui
            // il silenzio costa di piu'.
            scritturaFallita = `tenants (${tenantId}): ${erroreTenant.message}`;
          }
        }
      }
      break;
    }

    // Metodi di pagamento a notifica differita (addebito SEPA, Bancontact,
    // Klarna): la sessione si chiude subito, i soldi arrivano dopo. Il primo
    // evento conferma l'incasso vero ed è lì che la prenotazione va creata;
    // gli altri due chiudono la richiesta invece di lasciarla "in attesa"
    // per sempre.
    case "checkout.session.async_payment_succeeded": {
      const esito = await completaPagamentoCaparra(admin, stripe, evento.data.object as Stripe.Checkout.Session);
      if ("errore" in esito) scritturaFallita = esito.errore;
      break;
    }

    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const sessione = evento.data.object as Stripe.Checkout.Session;
      if (sessione.metadata?.tipo === "caparra") {
        const { error: erroreCaparra } = await admin
          .from("richieste_caparra")
          .update({ stato: "annullata" })
          .eq("stripe_checkout_session_id", sessione.id)
          .eq("stato", "in_attesa");
        if (erroreCaparra) {
          // Senza questa chiusura la richiesta resta "in_attesa" per sempre,
          // e nessuno la guarda mai piu'.
          scritturaFallita = `richieste_caparra (${sessione.id}): ${erroreCaparra.message}`;
        }
      }
      break;
    }

    // VIES: Stripe interroga il registro europeo da sé quando creiamo un tax
    // id, ma lo fa in modo ASINCRONO -- al momento della creazione lo stato è
    // `pending` e diventa `verified` o `unverified` quando VIES risponde,
    // qualche secondo o minuto dopo. Questo evento è l'unico momento in cui
    // l'esito si può leggere senza mettersi a interrogare Stripe a
    // intervalli, quindi è qui che lo si salva.
    case "customer.tax_id.created":
    case "customer.tax_id.updated": {
      const taxId = evento.data.object as Stripe.TaxId;
      const customerId =
        typeof taxId.customer === "string" ? taxId.customer : (taxId.customer?.id ?? null);
      if (!customerId) break;

      const { error } = await admin
        .from("tenants")
        .update({
          partita_iva_verifica: taxId.verification?.status ?? null,
          partita_iva_nome_verificato: taxId.verification?.verified_name ?? null,
        })
        .eq("stripe_customer_id", customerId);
      if (error) {
        console.error("[stripe] Esito verifica partita IVA non salvato", {
          customerId,
          errore: error.message,
        });
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const daEvento = evento.data.object as Stripe.Subscription;
      // Si RILEGGE la subscription da Stripe invece di fidarsi dello
      // snapshot dentro l'evento.
      //
      // Stripe non garantisce l'ordine di consegna e ritenta per giorni:
      // un `updated` vecchio rimasto in coda, consegnato dopo un `deleted`,
      // riporterebbe il tenant su un piano a pagamento che nessuno paga più
      // -- e nessun evento futuro lo correggerebbe, perché quella
      // subscription è morta. Rileggendo, l'handler diventa idempotente e
      // insensibile all'ordine: qualunque evento arrivi, scrive lo stato di
      // ADESSO. Se la rilettura fallisce si usa lo snapshot, che è comunque
      // meglio di non aggiornare niente.
      let aggiornata = daEvento;
      try {
        aggiornata = await stripe.subscriptions.retrieve(daEvento.id);
      } catch (errore) {
        console.error("[stripe] Rilettura subscription fallita, uso lo snapshot dell'evento", {
          subscription: daEvento.id,
          errore: (errore as Error).message,
        });
      }
      await sincronizzaAbbonamento(admin, aggiornata);

      // Riallinea la quota "operatore extra" al piano appena fatturato.
      //
      // Serve perché un cambio piano può arrivare da fuori dal nostro
      // codice: dal Customer Portal di Stripe, o da una modifica fatta a
      // mano sulla dashboard di Stripe. In quei casi cambia il price della
      // riga base e nessuno tocca l'add-on, che resterebbe quello del piano
      // vecchio -- il salone passato da Starter a Growth continuerebbe a
      // pagare 10 € per operatore invece di 15. È lo stesso difetto che ha
      // tenuto in ostaggio lo Scenario 17 per due giorni, e questa è la sua
      // chiusura definitiva: qualunque sia la strada da cui il piano cambia,
      // subito dopo l'add-on viene riportato in riga.
      //
      // Non si avvita: la sincronizzazione scrive su Stripe solo quando
      // trova qualcosa da correggere, quindi l'evento che essa stessa genera
      // al giro dopo non trova più niente da fare e si ferma.
      const { data: tenantAggiornato } = await admin
        .from("tenants")
        .select("id")
        .eq("stripe_subscription_id", aggiornata.id)
        .maybeSingle();
      if (tenantAggiornato) {
        await sincronizzaQuantitaOperatoriStripe(admin, tenantAggiornato.id as string);
      }
      break;
    }

    // invoice.payment_failed non è gestito qui apposta: Stripe porta la
    // subscription a "past_due"/"unpaid" quando un pagamento fallisce, ed è
    // customer.subscription.updated (sopra) -- non questo evento -- la
    // fonte di verità sullo stato che finisce in stato_abbonamento.
    default:
      break;
  }

  if (scritturaFallita) {
    console.error(`[stripe/webhook] ${evento.type}: scrittura fallita --`, scritturaFallita);
    // 500 e non 200: Stripe ritenta, e il lavoro non si perde. Il dettaglio
    // resta nei log e non esce nella risposta.
    return NextResponse.json({ errore: "Scrittura fallita, riprovare." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
