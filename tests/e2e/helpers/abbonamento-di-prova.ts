import type Stripe from "stripe";
import { creaClientStripeTest } from "./stripe-webhook";
import { priceIdOperatoreExtra, priceIdPerPiano, type PianoPagante } from "@/lib/stripe/piani";

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
 * Il punto chiave è come si crea un abbonamento manovrabile senza un metodo
 * di pagamento e senza muovere un centesimo: **con un trial**.
 * Il primo tentativo (16/09/2026) usava `payment_behavior:
 * "default_incomplete"`, e i tre scenari fallivano tutti con lo stesso
 * errore di Stripe: "You cannot update a subscription in `incomplete` status
 * in a way that results in a new invoice or invoice items". Giusto così: su
 * un abbonamento incompleto Stripe vieta proprio l'operazione che questi
 * test devono verificare, cioè aggiungere e togliere line item.
 * Un abbonamento in prova invece è `trialing`, accetta modifiche agli item, e
 * con `trial_settings.end_behavior.missing_payment_method: "cancel"` si crea
 * senza alcun metodo di pagamento associato.
 */
export interface AbbonamentoDiProva {
  customerId: string;
  subscriptionId: string;
  /** Rilegge da Stripe i line item attuali: è l'asserzione vera di questi scenari. */
  leggiItem(): Promise<{ priceId: string; quantita: number | undefined }[]>;
  /**
   * Cambia il price della riga BASE, come fa un upgrade vero dal Customer
   * Portal. Serve allo Scenario 17: da quando la quota per operatore si
   * sceglie in base al piano davvero fatturato (vedi il commento in
   * `sincronizzaQuantitaOperatoriStripe`), cambiare solo `tenants.piano`
   * non è più un cambio piano -- è un disallineamento, e il prodotto lo
   * tratta come tale apposta.
   */
  cambiaPianoBase(piano: PianoPagante): Promise<void>;
  pulisci(): Promise<void>;
}

/**
 * Quante quote "operatore extra" attaccare all'abbonamento appena creato
 * (aggiunto il 17/09/2026).
 *
 * PERCHÉ ESISTE, ed è la cosa importante da sapere prima di scrivere un
 * altro scenario che usa questo helper.
 *
 * Il webhook Stripe della sandbox punta al deploy di PRODUZIONE, che parla
 * con lo stesso progetto Supabase su cui girano questi test. Quindi ogni
 * abbonamento creato qui fa partire un `customer.subscription.created` vero,
 * che un secondo dopo arriva al nostro webhook, che chiama
 * `sincronizzaQuantitaOperatoriStripe`: se il salone ha più operatori di
 * quanti l'abbonamento ne fatturi, il prodotto **aggiunge la quota da sé**.
 * È il suo mestiere, non un bug -- è la funzione che impedisce a un salone
 * di crescere senza che la fattura lo segua.
 *
 * Conseguenza pratica: un fixture che lascia l'abbonamento disallineato con
 * il numero di operatori è instabile per costruzione. Non fallisce sempre,
 * fallisce quando il webhook arriva prima dell'asserzione -- ed è
 * esattamente il modo in cui lo Scenario 22 si è rotto il 17/09/2026, dopo
 * essere passato più volte.
 *
 * Regola: **un fixture deve partire già nello stato su cui la
 * sincronizzazione converge.** Se uno scenario ha bisogno di verificare un
 * disallineamento, non può crearlo qui e sperare: deve crearlo in un modo
 * che non faccia partire nessun evento Stripe, e comunque non può poi
 * asserire su uno stato che la sincronizzazione ha il diritto di correggere.
 */
export async function creaAbbonamentoDiProva(
  piano: PianoPagante,
  nome: string,
  opzioni: { operatoriExtra?: number } = {}
): Promise<AbbonamentoDiProva> {
  const stripe = creaClientStripeTest();
  const pianoIniziale = piano;
  const operatoriExtra = opzioni.operatoriExtra ?? 0;

  const customer = await stripe.customers.create({
    name: `E2E ${nome}`,
    // Dominio non instradabile apposta: nessuna email di Stripe può partire
    // davvero verso una casella vera, nemmeno per sbaglio in test-mode.
    email: `e2e-${Date.now()}@example.com`,
    metadata: { e2e: "true" },
  });

  const priceExtra = priceIdOperatoreExtra(piano);
  if (operatoriExtra > 0 && !priceExtra) {
    throw new Error(
      `Manca il price "operatore extra" per il piano ${piano} in .env.local: questo fixture non può allinearsi al numero di operatori.`
    );
  }

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [
      { price: priceIdPerPiano(piano), quantity: 1 },
      ...(operatoriExtra > 0 && priceExtra ? [{ price: priceExtra, quantity: operatoriExtra }] : []),
    ],
    trial_period_days: 30,
    trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
    metadata: { e2e: "true" },
  });

  async function leggiItem() {
    const aggiornato = await stripe.subscriptions.retrieve(subscription.id);
    return aggiornato.items.data.map((item: Stripe.SubscriptionItem) => ({
      priceId: item.price.id,
      quantita: item.quantity,
    }));
  }

  async function cambiaPianoBase(piano: PianoPagante) {
    const attuale = await stripe.subscriptions.retrieve(subscription.id);
    const rigaBase = attuale.items.data.find((item) => item.price.id === priceIdPerPiano(pianoIniziale));
    if (!rigaBase) throw new Error("Riga base non trovata sull'abbonamento di prova");
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: rigaBase.id, price: priceIdPerPiano(piano) }],
      proration_behavior: "none",
    });
  }

  async function pulisci() {
    // Best-effort in entrambi i passaggi: un oggetto di test rimasto su
    // Stripe non deve far fallire un test che ha già verificato quello che
    // doveva verificare.
    await stripe.subscriptions.cancel(subscription.id).catch(() => {});
    await stripe.customers.del(customer.id).catch(() => {});
  }

  return { customerId: customer.id, subscriptionId: subscription.id, leggiItem, cambiaPianoBase, pulisci };
}
