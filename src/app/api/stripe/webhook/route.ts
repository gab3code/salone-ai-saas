import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { creaClientStripe } from "@/lib/stripe/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { sincronizzaAbbonamento, statoAbbonamentoDaStripe } from "@/lib/stripe/abbonamento.server";

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

  switch (evento.type) {
    case "checkout.session.completed": {
      const session = evento.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const tenantId = session.metadata?.tenant_id ?? session.client_reference_id;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        if (tenantId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await admin
            .from("tenants")
            .update({
              stripe_subscription_id: subscription.id,
              stato_abbonamento: statoAbbonamentoDaStripe(subscription.status),
              ...(session.metadata?.piano ? { piano: session.metadata.piano } : {}),
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
