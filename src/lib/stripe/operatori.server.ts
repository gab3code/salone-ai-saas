import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientStripe } from "./server";
import { priceIdOperatoreExtraPro } from "./piani";

/**
 * Tiene allineata la quantità del line item "operatore extra" su Stripe
 * (vedi priceIdOperatoreExtraPro in piani.ts) ogni volta che il numero di
 * operatori di un tenant Pro cambia -- chiamata da creaOperatore ed
 * eliminaOperatore in dashboard/configura/azioni.ts, DOPO che la scrittura
 * su Supabase è già andata a buon fine (mai prima: un fallimento Stripe non
 * deve mai impedire di creare/eliminare un operatore vero, vedi fail-open
 * sotto).
 *
 * Non tocca il checkout iniziale (quello aggiunge già il line item giusto,
 * vedi /api/stripe/checkout/route.ts) -- questa funzione gestisce SOLO i
 * cambi successivi al primo abbonamento: un salone Pro che assume un nuovo
 * operatore o ne licenzia uno mentre è già abbonato.
 *
 * Fail-open totale: se il tenant non è Pro, non ha un abbonamento Stripe
 * attivo (piano appena scelto, checkout non ancora completato), o qualsiasi
 * chiamata Stripe fallisce (rete, subscription cancellata nel frattempo,
 * ecc.), la funzione logga e torna senza lanciare -- stesso principio già
 * seguito da mailjet.server.ts e skebby.server.ts. Il caso "Stripe e
 * Supabase finiscono disallineati" esiste comunque (nessuna vera transazione
 * distribuita tra i due sistemi), ma è lo stesso compromesso già accettato
 * altrove nel progetto: il prossimo webhook di sincronizzaAbbonamento, o un
 * controllo manuale, lo riallinea. Bloccare la creazione di un operatore per
 * un problema di fatturazione sarebbe un danno peggiore per Gabriel e per i
 * suoi clienti.
 */
export async function sincronizzaQuantitaOperatoriStripe(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("piano, stripe_subscription_id")
      .eq("id", tenantId)
      .single();
    if (!tenant || tenant.piano !== "pro" || !tenant.stripe_subscription_id) return;

    const { count } = await supabase
      .from("operatori")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    const quantitaVoluta = Math.max(0, (count ?? 0) - 1);

    const stripe = creaClientStripe();
    const priceIdExtra = priceIdOperatoreExtraPro();
    const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
    const itemEsistente = subscription.items.data.find((item) => item.price.id === priceIdExtra);

    if (quantitaVoluta === 0) {
      if (itemEsistente) {
        await stripe.subscriptionItems.del(itemEsistente.id, { proration_behavior: "create_prorations" });
      }
      return;
    }

    if (itemEsistente) {
      if (itemEsistente.quantity !== quantitaVoluta) {
        await stripe.subscriptionItems.update(itemEsistente.id, {
          quantity: quantitaVoluta,
          proration_behavior: "create_prorations",
        });
      }
    } else {
      await stripe.subscriptions.update(tenant.stripe_subscription_id, {
        items: [{ price: priceIdExtra, quantity: quantitaVoluta }],
        proration_behavior: "create_prorations",
      });
    }
  } catch (errore) {
    console.error("[stripe] Errore sincronizzando la quantità di operatori extra:", errore);
  }
}
