import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { creaClientServer } from "@/lib/supabase/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientStripe } from "@/lib/stripe/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoGestireFatturazione, ERRORE_PERMESSO_NEGATO } from "@/lib/ruoli";
import { pianoEPagante, priceIdPerPiano, priceIdOperatoreExtra, giorniDiProva } from "@/lib/stripe/piani";

/**
 * Crea una Checkout Session Stripe per il tenant dell'utente loggato
 * (chiamata da Prezzi.tsx via /registrati?piano=... o dalla dashboard dopo
 * conferma email, vedi AvviaCheckoutSeNecessario).
 *
 * Il tenant_id si legge SEMPRE dal profilo dell'utente autenticato via
 * cookie di sessione (creaClientServer, RLS attiva), mai da un valore
 * passato dal client -- altrimenti un client malevolo potrebbe far
 * addebitare/associare l'abbonamento al tenant di qualcun altro.
 */
export async function POST(request: NextRequest) {
  const supabase = await creaClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ errore: "Devi accedere prima di scegliere un piano." }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ errore: "Corpo della richiesta non valido." }, { status: 400 });
  }
  const { piano } = (corpo ?? {}) as Record<string, unknown>;
  if (typeof piano !== "string" || !pianoEPagante(piano)) {
    return NextResponse.json({ errore: "Piano non valido." }, { status: 400 });
  }

  // Solo il titolare paga: un dipendente con accesso staff (Fase 5,
  // migrazione 0027) non deve poter aprire un checkout a nome dell'attività.
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) {
    return NextResponse.json({ errore: "Nessuna attività trovata per questo utente." }, { status: 404 });
  }
  if (!puoGestireFatturazione(sessione.ruolo)) {
    return NextResponse.json({ errore: ERRORE_PERMESSO_NEGATO }, { status: 403 });
  }
  const profilo = { tenant_id: sessione.tenantId };

  // Da qui in poi client ADMIN: serve scrivere stripe_customer_id, un campo
  // che il tenant owner non può toccare direttamente via RLS (di proposito,
  // per non permettere a un client di spoofare il proprio ID Stripe). Sicuro
  // perché il tenant_id sopra viene dalla sessione verificata, non dal
  // client -- si scrive sempre e solo il PROPRIO tenant.
  const admin = creaClientAdmin();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, nome, stripe_customer_id, stripe_subscription_id")
    .eq("id", profilo.tenant_id)
    .single();
  if (!tenant) {
    return NextResponse.json({ errore: "Attività non trovata." }, { status: 404 });
  }

  const stripe = creaClientStripe();

  // Chi ha già un abbonamento vivo NON passa da qui: cambia piano dal
  // Customer Portal, che sostituisce l'abbonamento invece di affiancargliene
  // un secondo.
  //
  // Senza questo controllo bastava tornare su /dashboard?piano=<altro> --
  // cosa che succede da sola: il link di conferma email della registrazione
  // riporta lì con il piano nell'URL, e `AvviaCheckoutSeNecessario` apre il
  // checkout appena vede un piano diverso da quello attuale. Il risultato
  // erano due abbonamenti attivi sullo stesso Customer, per esempio Starter
  // 19,90 + Pro 89,90 = 109,80 al mese, di cui il tenant ne conosce uno solo:
  // il primo diventa invisibile al prodotto (gli eventi non trovano più il
  // tenant) e non verrebbe cancellato nemmeno cancellando l'attività.
  if (tenant.stripe_subscription_id) {
    try {
      const esistente = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id as string);
      const viva = !["canceled", "incomplete_expired"].includes(esistente.status);
      if (viva) {
        return NextResponse.json(
          {
            errore:
              "Hai già un abbonamento attivo. Per cambiare piano usa 'Gestisci abbonamento' in Impostazioni: così quello attuale viene sostituito invece di affiancargliene un secondo. Se non trovi il cambio piano lì dentro, scrivici e lo facciamo noi.",
          },
          { status: 409 }
        );
      }
    } catch {
      // Abbonamento non più leggibile su Stripe (cancellato e ripulito,
      // account diverso): si prosegue col checkout, che è il comportamento
      // giusto per un tenant che di fatto non ha più niente.
    }
  }

  // Un solo Customer Stripe per tenant, riusato tra checkout successivi
  // (upgrade/downgrade) invece di crearne uno nuovo ogni volta -- altrimenti
  // customer portal e cronologia pagamenti si spezzano su più "clienti"
  // Stripe distinti per lo stesso salone.
  let stripeCustomerId = tenant.stripe_customer_id as string | null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: tenant.nome,
      metadata: { tenant_id: tenant.id },
    });
    stripeCustomerId = customer.id;
    await admin.from("tenants").update({ stripe_customer_id: stripeCustomerId }).eq("id", tenant.id);
  }

  const origin = request.nextUrl.origin;
  const trialDays = giorniDiProva(piano);

  // Su tutti e tre i piani a pagamento il prezzo base include 1 operatore,
  // ognuno oltre il primo costa una quota fissa in più: 10€ su Starter, 15€
  // su Growth, 20€ su Pro (deciso con Gabriel il 16/09/2026, estendendo a
  // Starter/Growth la regola che dal 14/09/2026 valeva solo su Pro -- vedi
  // `priceIdOperatoreExtra` in stripe/piani.ts e DECISIONS.md).
  // Secondo line item aggiunto SOLO se il salone ha già più di un operatore
  // configurato al momento del checkout (tipicamente 0 se sta ancora facendo
  // l'onboarding, ma un tenant che cambia piano può già averne). `count`
  // conta sul client ADMIN (non RLS-limitato, stesso client già in uso qui
  // sopra per leggere/scrivere il tenant).
  // `priceIdOperatoreExtra` può restituire null finché Gabriel non ha creato
  // il Price su Stripe per quel piano: in quel caso il checkout parte senza
  // add-on invece di fallire, e la sincronizzazione lo aggiungerà da sé
  // appena la variabile d'ambiente esiste.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceIdPerPiano(piano), quantity: 1 },
  ];
  const priceIdExtra = priceIdOperatoreExtra(piano);
  if (priceIdExtra) {
    const { count } = await admin
      .from("operatori")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);
    const operatoriExtra = Math.max(0, (count ?? 0) - 1);
    if (operatoriExtra > 0) {
      lineItems.push({ price: priceIdExtra, quantity: operatoriExtra });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    // Solo carte, esplicitamente (17/09/2026, dopo aver guardato la
    // schermata vera). Senza questa riga la sessione eredita tutti i metodi
    // accesi sull'account, e su un abbonamento B2B da 39,90 € al mese si
    // vedeva offrire Klarna, Satispay e Amazon Pay accanto alla carta.
    //
    // Non è una questione di gusto. Un abbonamento ricorrente vuole uno
    // strumento che si possa riaddebitare per mesi senza che il cliente
    // rifaccia niente, e la carta è quello: i wallet e i "paga a rate" su un
    // canone mensile o non rinnovano bene o creano stati intermedi che il
    // nostro webhook dovrebbe gestire uno per uno. In più una schermata di
    // pagamento con quattro opzioni per un gestionale da usare in salone
    // sembra un e-commerce, non un contratto di servizio.
    //
    // La caparra è un caso diverso -- pagamento singolo di pochi euro fatto
    // dal cliente finale del salone -- e ha la sua scelta separata in
    // caparra.server.ts.
    payment_method_types: ["card"],
    line_items: lineItems,
    success_url: `${origin}/dashboard?checkout=successo`,
    cancel_url: `${origin}/#prezzi`,
    client_reference_id: tenant.id,
    // --- Dati di fatturazione (decisione del 17/09/2026) ---
    //
    // Si raccolgono QUI e non alla registrazione: l'iscrizione è il punto più
    // fragile dell'imbuto, e un campo fiscale prima ancora di aver visto il
    // prodotto funzionare è il posto peggiore dove metterlo. Chi sta in prova
    // o su Free non ha nessuna fattura da ricevere. Al checkout invece la
    // persona ha già deciso di pagare, e i dati glieli chiede Stripe con la
    // sua interfaccia, non noi.
    // `tax_id_collection` mostra un campo partita IVA OPZIONALE: chi non ce
    // l'ha semplicemente non lo compila e paga lo stesso. L'indirizzo invece
    // è obbligatorio, e non è una nostra scelta: una fattura senza indirizzo
    // del destinatario non è una fattura.
    tax_id_collection: { enabled: true },
    billing_address_collection: "required",
    customer_update: { name: "auto", address: "auto" },
    // Partita IVA e indirizzo non bastano per lo SdI: serve il codice
    // destinatario (7 caratteri) oppure la PEC, e Stripe non li conosce.
    // Sono due dei tre campi personalizzati che una sessione consente.
    // Entrambi opzionali di proposito: un cliente che non sa cosa sia il
    // codice destinatario non deve restare bloccato davanti al pagamento --
    // glielo si chiede dopo, dalla dashboard. Meglio un dato mancante che un
    // abbonamento non sottoscritto.
    custom_fields: [
      {
        key: "codice_destinatario",
        label: { type: "custom", custom: "Codice destinatario SDI (7 caratteri)" },
        type: "text",
        optional: true,
        // Solo il massimo, nessun minimo: su un campo opzionale una
        // lunghezza minima è un rischio che non vale la pena correre -- se
        // venisse applicata anche al campo lasciato vuoto bloccherebbe il
        // pagamento di chiunque non abbia un codice SdI, cioè esattamente le
        // persone per cui il campo è opzionale. Il formato lo controlla il
        // modulo nelle impostazioni, dove sbagliare non costa un abbonamento.
        text: { maximum_length: 7 },
      },
      {
        key: "pec",
        label: { type: "custom", custom: "PEC per la fattura (se non hai il codice)" },
        type: "text",
        optional: true,
        text: { maximum_length: 100 },
      },
    ],
    subscription_data: {
      metadata: { tenant_id: tenant.id, piano },
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
    metadata: { tenant_id: tenant.id, piano },
  });

  if (!session.url) {
    return NextResponse.json({ errore: "Stripe non ha restituito un URL di checkout." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
