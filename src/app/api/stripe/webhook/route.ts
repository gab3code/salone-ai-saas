import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { creaClientStripe } from "@/lib/stripe/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { sincronizzaAbbonamento, statoAbbonamentoDaStripe } from "@/lib/stripe/abbonamento.server";
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

          await admin
            .from("tenants")
            .update({
              stripe_subscription_id: subscription.id,
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

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await sincronizzaAbbonamento(admin, evento.data.object as Stripe.Subscription);
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
