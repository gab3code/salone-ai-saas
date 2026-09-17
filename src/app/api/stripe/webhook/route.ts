import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { creaClientStripe } from "@/lib/stripe/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { sincronizzaAbbonamento, statoAbbonamentoDaStripe } from "@/lib/stripe/abbonamento.server";
import { sincronizzaQuantitaOperatoriStripe } from "@/lib/stripe/operatori.server";
import { creaAppuntamentoTenant, parsaOrarioLocale } from "@/lib/booking-engine.server";

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

/**
 * Completa il pagamento di una caparra: crea l'appuntamento vero (STESSA
 * funzione di scrittura di sempre, punto 9 di CLAUDE.md) e aggiorna la riga
 * `richieste_caparra`. Se nel frattempo lo slot è stato preso da un'altra
 * prenotazione (limite onestamente segnalato in 0011_deposito_caparra.sql:
 * lo slot non resta bloccato durante il pagamento), rimborsa automaticamente
 * il cliente invece di trattenere un pagamento per una prenotazione che non
 * esisterà mai -- e marca la riga "fallita_conflitto" così Gabriel la vede
 * in dashboard invece che sparire nel nulla.
 */
async function completaPagamentoCaparra(
  admin: ReturnType<typeof creaClientAdmin>,
  stripe: Stripe,
  session: Stripe.Checkout.Session
) {
  const { data: richiesta } = await admin
    .from("richieste_caparra")
    .select("*")
    .eq("stripe_checkout_session_id", session.id)
    .single();
  if (!richiesta) {
    console.error("Webhook caparra: nessuna richiesta trovata per la sessione", session.id);
    return;
  }
  // Idempotenza: Stripe può reinviare lo stesso evento più di una volta.
  if (richiesta.stato !== "in_attesa") return;

  // La sessione è "completata" anche quando i soldi NON sono ancora arrivati.
  // Succede con ogni metodo a notifica differita (addebito SEPA, Bancontact,
  // Klarna): basta accenderne uno dalla Dashboard di Stripe, zero righe di
  // codice, e `checkout.session.completed` comincia ad arrivare con
  // `payment_status: "unpaid"`. Senza questo controllo la caparra sarebbe
  // presa per buona, l'appuntamento confermato e lo slot occupato -- e
  // giorni dopo l'addebito fallirebbe senza che nessuno se ne accorga. Cioè
  // esattamente il no-show che la caparra dovrebbe impedire, pagato da noi.
  //
  // Si esce SENZA toccare lo stato: la richiesta resta "in_attesa" e verrà
  // completata dal `checkout.session.async_payment_succeeded` che Stripe
  // manda quando l'incasso va a buon fine davvero.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    console.info("[stripe] Caparra non ancora incassata, appuntamento non creato", {
      sessione: session.id,
      stato_pagamento: session.payment_status,
    });
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  const inizio = parsaOrarioLocale(richiesta.inizio_iso);
  const risultato = inizio
    ? await creaAppuntamentoTenant(admin, richiesta.tenant_id, {
        operatoreId: richiesta.operatore_id,
        servizioId: richiesta.servizio_id,
        inizio,
        clienteNome: richiesta.cliente_nome,
        clienteTelefono: richiesta.cliente_telefono,
        clienteEmail: richiesta.cliente_email ?? undefined,
        creatoDa: "pubblico",
      })
    : { ok: false as const, errore: "Orario della richiesta non valido." };

  if (risultato.ok) {
    await Promise.all([
      admin
        .from("richieste_caparra")
        .update({ stato: "completata", stripe_payment_intent_id: paymentIntentId, appuntamento_id: risultato.appuntamentoId })
        .eq("id", richiesta.id),
      admin
        .from("appuntamenti")
        .update({ caparra_importo_centesimi: richiesta.importo_centesimi, caparra_stripe_payment_intent_id: paymentIntentId })
        .eq("id", risultato.appuntamentoId),
    ]);
    return;
  }

  // Conflitto (o altro errore di scrittura): rimborso automatico, mai
  // trattenere i soldi di un cliente per una prenotazione che non esiste.
  if (paymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId });
    } catch (erroreRimborso) {
      console.error("Webhook caparra: rimborso automatico fallito per", paymentIntentId, erroreRimborso);
    }
  }
  await admin
    .from("richieste_caparra")
    .update({ stato: "fallita_conflitto", stripe_payment_intent_id: paymentIntentId, errore: risultato.errore })
    .eq("id", richiesta.id);
}

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

  switch (evento.type) {
    case "checkout.session.completed": {
      const session = evento.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.tipo === "caparra") {
        await completaPagamentoCaparra(admin, stripe, session);
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

          // Dati per la fattura elettronica raccolti dalla schermata di
          // pagamento (migrazione 0031). Partita IVA e indirizzo restano sul
          // Customer di Stripe, che li ha raccolti: qui si salva solo quello
          // che Stripe non ha, cioè i due campi che servono allo SdI.
          const campi = session.custom_fields ?? [];
          const valoreCampo = (chiave: string) =>
            campi.find((c) => c.key === chiave)?.text?.value?.trim() || null;
          const codiceDestinatario = valoreCampo("codice_destinatario");
          const pec = valoreCampo("pec");

          await admin
            .from("tenants")
            .update({
              stripe_subscription_id: subscription.id,
              // Solo se valorizzati: un secondo checkout in cui il cliente
              // lascia il campo vuoto non deve cancellare un dato corretto
              // dato la volta prima.
              ...(codiceDestinatario ? { codice_destinatario: codiceDestinatario } : {}),
              ...(pec ? { pec_fatturazione: pec } : {}),
              ...(tenantEsistente?.piano_manuale
                ? {}
                : {
                    stato_abbonamento: statoAbbonamentoDaStripe(subscription.status),
                    ...(session.metadata?.piano ? { piano: session.metadata.piano } : {}),
                  }),
            })
            .eq("id", tenantId);
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
      await completaPagamentoCaparra(admin, stripe, evento.data.object as Stripe.Checkout.Session);
      break;
    }

    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const sessione = evento.data.object as Stripe.Checkout.Session;
      if (sessione.metadata?.tipo === "caparra") {
        await admin
          .from("richieste_caparra")
          .update({ stato: "annullata" })
          .eq("stripe_checkout_session_id", sessione.id)
          .eq("stato", "in_attesa");
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

  return NextResponse.json({ received: true });
}
