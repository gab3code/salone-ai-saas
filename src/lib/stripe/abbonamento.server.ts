import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { pianoPerPriceId, type PianoPagante } from "./piani";

/**
 * Traduce lo status di una Subscription Stripe nel vocabolario già presente
 * in tenants.stato_abbonamento (migrazione 0001): trialing | attivo | scaduto
 * | cancellato. Stripe ha più stati di quanti ce ne servano (incomplete,
 * incomplete_expired, unpaid, paused...) -- raggruppati dove il
 * comportamento per il cliente è lo stesso (niente accesso pagato finché
 * non risolve/riattiva).
 */
export function statoAbbonamentoDaStripe(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "attivo";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "scaduto";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "cancellato";
    default:
      return "scaduto";
  }
}

/**
 * Aggiorna tenants a partire da una Subscription Stripe reale. Non fidarsi
 * MAI del piano che pensavamo fosse valido prima: il prezzo attivo
 * sull'abbonamento Stripe in questo momento è la fonte di verità, copre
 * anche i cambi piano fatti dal cliente stesso nel customer portal (non
 * solo quelli passati dal nostro checkout).
 *
 * Client Supabase passato come parametro (mai creato qui dentro), stesso
 * pattern di dependency injection già usato in booking-engine.server.ts --
 * rende la funzione testabile con il client finto (src/test/supabase-finto)
 * senza un database vero. Il chiamante (il webhook) passa sempre il client
 * admin/service_role: qui non c'è un utente loggato dietro la richiesta.
 */
export async function sincronizzaAbbonamento(supabase: SupabaseClient, subscription: Stripe.Subscription) {
  // Da quando Pro può avere un secondo line item ("operatore extra", vedi
  // priceIdOperatoreExtraPro in piani.ts, Fase 5+SMS 14/09/2026), leggere solo
  // items.data[0] non basta più: Stripe non garantisce che il Price base sia
  // il primo dell'array. Si cerca in TUTTI gli item quello che corrisponde a
  // un piano riconosciuto -- l'item dell'operatore extra non è mai in
  // pianoPerPriceId, quindi non può mai essere scambiato per un piano.
  const piano =
    subscription.items.data
      .map((item): PianoPagante | null => pianoPerPriceId(item.price.id))
      .find((p): p is PianoPagante => p !== null) ?? null;
  const stato = statoAbbonamentoDaStripe(subscription.status);

  // Un abbonamento cancellato/scaduto riporta il tenant a Free -- mai
  // lasciarlo bloccato su un piano che non sta più pagando. Per gli altri
  // stati, il piano si aggiorna solo se riconosciamo il Price ID attivo
  // (altrimenti si lascia quello che c'era, invece di azzerarlo per un
  // prezzo che magari non abbiamo ancora mappato in env).
  const nuovoPiano = stato === "cancellato" ? "free" : piano;

  await supabase
    .from("tenants")
    .update({
      stato_abbonamento: stato,
      ...(nuovoPiano ? { piano: nuovoPiano } : {}),
    })
    .eq("stripe_subscription_id", subscription.id);
}
