import type Stripe from "stripe";
import { creaClientStripeTest } from "./stripe-webhook";
import { priceIdPerPiano, type PianoPagante } from "@/lib/stripe/piani";

/**
 * Abbonamento Stripe VERO (test-mode) per gli scenari che verificano la
 * fatturazione per operatore (16 e 17, aggiunti il 16/09/2026).
 *
 * A differenza dello Scenario 14 -- che si accontenta di un
 * `stripe_subscription_id` finto perché gli basta vedere come reagisce il
 * nostro webhook -- qui serve un abbonamento che esista davvero su Stripe:
 * `sincronizzaQuantitaOperatoriStripe` legge i suoi line item, ne aggiunge,
 * ne aggiorna la quantità e ne cancella. Con un id inventato ogni chiamata
 * fallirebbe e il test passerebbe per il motivo sbagliato (la funzione è
 * fail-open: inghiotte gli errori e non lancia mai).
 *
 * `payment_behavior: "default_incomplete"` è il punto chiave: crea un
 * abbonamento completo di line item SENZA bisogno di un metodo di pagamento
 * e senza muovere un centesimo, nemmeno finto. Resta in stato "incomplete",
 * che va benissimo -- nessuna parte del codice sotto test guarda lo stato,
 * solo gli item.
 */
export interface AbbonamentoDiProva {
  customerId: string;
  subscriptionId: string;
  /** Rilegge da Stripe i line item attuali: è l'asserzione vera di questi scenari. */
  leggiItem(): Promise<{ priceId: string; quantita: number | undefined }[]>;
  pulisci(): Promise<void>;
}

export async function creaAbbonamentoDiProva(
  piano: PianoPagante,
  nome: string
): Promise<AbbonamentoDiProva> {
  const stripe = creaClientStripeTest();

  const customer = await stripe.customers.create({
    name: `E2E ${nome}`,
    // Dominio non instradabile apposta: nessuna email di Stripe può partire
    // davvero verso una casella vera, nemmeno per sbaglio in test-mode.
    email: `e2e-${Date.now()}@example.com`,
    metadata: { e2e: "true" },
  });

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceIdPerPiano(piano), quantity: 1 }],
    payment_behavior: "default_incomplete",
    metadata: { e2e: "true" },
  });

  async function leggiItem() {
    const aggiornato = await stripe.subscriptions.retrieve(subscription.id);
    return aggiornato.items.data.map((item: Stripe.SubscriptionItem) => ({
      priceId: item.price.id,
      quantita: item.quantity,
    }));
  }

  async function pulisci() {
    // Best-effort in entrambi i passaggi: un oggetto di test rimasto su
    // Stripe non deve far fallire un test che ha già verificato quello che
    // doveva verificare.
    await stripe.subscriptions.cancel(subscription.id).catch(() => {});
    await stripe.customers.del(customer.id).catch(() => {});
  }

  return { customerId: customer.id, subscriptionId: subscription.id, leggiItem, pulisci };
}
