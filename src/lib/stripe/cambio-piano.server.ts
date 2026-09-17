import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientStripe } from "./server";
import {
  pianoEPagante,
  priceIdOperatoreExtra,
  priceIdPerPiano,
  tuttiPriceIdOperatoreExtra,
  type PianoPagante,
} from "./piani";

/**
 * Cambio piano fatto dal pannello admin CON allineamento di Stripe
 * (richiesta di Gabriel del 16/09/2026: "decidere io se modificare Stripe
 * quando modifico l'abbonamento, così non devo cancellarlo o aprire
 * Stripe").
 *
 * Tre principi, e nessuno è negoziabile.
 *
 * 1. **Non si tocca il denaro di nascosto.** Prima di qualunque scrittura
 *    esiste un'anteprima (`anteprimaCambioPiano`) che dice riga per riga
 *    cosa paga adesso quel salone e cosa pagherebbe dopo, con le cifre lette
 *    DA STRIPE e non dal listino salvato in `admin.ts` -- se i due non
 *    coincidessero, quello che il cliente vede addebitato è il primo.
 *
 * 2. **Aumentare il prezzo non è una modifica come le altre.** Tecnicamente
 *    è la stessa chiamata API, contrattualmente no: un aumento va concordato
 *    col cliente prima, non applicato da un pannello. Il codice non può
 *    impedirlo (e non deve: una correzione concordata al telefono è
 *    legittima), ma `aumenta` marca il caso e la UI lo dice a chiare
 *    lettere. Un abbassamento e un allineamento a quanto il cliente sta già
 *    usando non hanno lo stesso problema.
 *
 * 3. **Niente cancellazioni immediate.** Portare un'attività a Free o a
 *    Enterprise significa che il suo abbonamento a listino non esiste più:
 *    si imposta `cancel_at_period_end`, mai una cancellazione secca. Il
 *    cliente ha pagato fino a una certa data e fino a quella data il
 *    servizio resta suo; e se è un errore, si annulla riattivando prima
 *    della scadenza invece di dover ricreare tutto.
 */

/** Cosa fare su Stripe insieme al cambio piano. */
export const AZIONI_STRIPE = ["nessuna", "subito", "prossimo_rinnovo"] as const;
export type AzioneStripe = (typeof AZIONI_STRIPE)[number];

export function azioneStripeValida(valore: string): valore is AzioneStripe {
  return (AZIONI_STRIPE as readonly string[]).includes(valore);
}

export type RigaFattura = { descrizione: string; quantita: number; centesimiMese: number };

export type AnteprimaCambioPiano = {
  /** false = su Stripe non si può fare niente, e `motivo` dice perché. */
  possibile: boolean;
  motivo: string | null;
  righeAttuali: RigaFattura[];
  righeFuture: RigaFattura[];
  totaleAttualeCentesimi: number;
  totaleFuturoCentesimi: number;
  /** true = il piano di destinazione non ha un prezzo: l'abbonamento va chiuso a fine periodo. */
  chiudeAbbonamento: boolean;
  /** true = il cliente finirebbe per pagare di più. Richiede il suo consenso, non un click. */
  aumenta: boolean;
  /** Operatori configurati adesso: è la quantità con cui si calcola l'add-on. */
  operatori: number;
};

function centesimiDiRiga(prezzo: Stripe.Price | null, quantita: number): number {
  return (prezzo?.unit_amount ?? 0) * quantita;
}

function descriviPrezzo(prezzo: Stripe.Price | string | null | undefined): string {
  if (!prezzo) return "riga sconosciuta";
  if (typeof prezzo === "string") return prezzo;
  const prodotto = typeof prezzo.product === "string" ? null : (prezzo.product as Stripe.Product);
  return prodotto?.name ?? prezzo.nickname ?? prezzo.id;
}

async function leggiTenantPerStripe(supabase: SupabaseClient, tenantId: string) {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, nome, piano, stripe_subscription_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return null;

  const { count } = await supabase
    .from("operatori")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  return { tenant, operatori: count ?? 0 };
}

/**
 * Cosa succederebbe su Stripe. Sola lettura: non scrive niente, né su
 * Stripe né sul database.
 */
export async function anteprimaCambioPiano(
  supabase: SupabaseClient,
  tenantId: string,
  pianoTarget: string
): Promise<AnteprimaCambioPiano | { errore: string }> {
  const letto = await leggiTenantPerStripe(supabase, tenantId);
  if (!letto) return { errore: "Attività non trovata." };
  const { tenant, operatori } = letto;

  const vuoto: AnteprimaCambioPiano = {
    possibile: false,
    motivo: null,
    righeAttuali: [],
    righeFuture: [],
    totaleAttualeCentesimi: 0,
    totaleFuturoCentesimi: 0,
    chiudeAbbonamento: false,
    aumenta: false,
    operatori,
  };

  if (!tenant.stripe_subscription_id) {
    return {
      ...vuoto,
      motivo:
        "Questa attività non ha un abbonamento Stripe: il piano si può cambiare solo qui. Per farla pagare davvero deve passare dal checkout.",
    };
  }

  let subscription: Stripe.Subscription;
  try {
    subscription = await creaClientStripe().subscriptions.retrieve(tenant.stripe_subscription_id, {
      expand: ["items.data.price.product"],
    });
  } catch (errore) {
    return {
      ...vuoto,
      motivo: `Abbonamento non leggibile su Stripe: ${(errore as Error).message}`,
    };
  }

  if (subscription.status === "canceled") {
    return {
      ...vuoto,
      motivo: "L'abbonamento su Stripe è già cancellato: non c'è più niente da modificare.",
    };
  }

  const righeAttuali: RigaFattura[] = subscription.items.data.map((item) => ({
    descrizione: descriviPrezzo(item.price),
    quantita: item.quantity ?? 1,
    centesimiMese: centesimiDiRiga(item.price, item.quantity ?? 1),
  }));
  const totaleAttualeCentesimi = righeAttuali.reduce((somma, r) => somma + r.centesimiMese, 0);

  // Piano senza prezzo di listino (free, enterprise): l'abbonamento va
  // chiuso, non riprezzato.
  if (!pianoEPagante(pianoTarget)) {
    return {
      possibile: true,
      motivo: null,
      righeAttuali,
      righeFuture: [],
      totaleAttualeCentesimi,
      totaleFuturoCentesimi: 0,
      chiudeAbbonamento: true,
      aumenta: false,
      operatori,
    };
  }

  const stripe = creaClientStripe();
  let prezzoBase: Stripe.Price;
  try {
    prezzoBase = await stripe.prices.retrieve(priceIdPerPiano(pianoTarget), { expand: ["product"] });
  } catch (errore) {
    return { ...vuoto, motivo: `Prezzo del piano ${pianoTarget} non configurato: ${(errore as Error).message}` };
  }

  const righeFuture: RigaFattura[] = [
    { descrizione: descriviPrezzo(prezzoBase), quantita: 1, centesimiMese: centesimiDiRiga(prezzoBase, 1) },
  ];

  // Il prezzo base include sempre il primo operatore.
  const operatoriExtra = Math.max(0, operatori - 1);
  const priceExtra = priceIdOperatoreExtra(pianoTarget);
  if (operatoriExtra > 0 && priceExtra) {
    try {
      const prezzoExtra = await stripe.prices.retrieve(priceExtra, { expand: ["product"] });
      righeFuture.push({
        descrizione: descriviPrezzo(prezzoExtra),
        quantita: operatoriExtra,
        centesimiMese: centesimiDiRiga(prezzoExtra, operatoriExtra),
      });
    } catch {
      // Add-on non configurato su Stripe: l'anteprima lo omette, e
      // `allineaPianoSuStripe` farà lo stesso. Meglio un abbonamento senza
      // quota operatori che un cambio piano che si rifiuta di partire.
    }
  }

  const totaleFuturoCentesimi = righeFuture.reduce((somma, r) => somma + r.centesimiMese, 0);

  return {
    possibile: true,
    motivo: null,
    righeAttuali,
    righeFuture,
    totaleAttualeCentesimi,
    totaleFuturoCentesimi,
    chiudeAbbonamento: false,
    aumenta: totaleFuturoCentesimi > totaleAttualeCentesimi,
    operatori,
  };
}

export type EsitoAllineamento = {
  descrizione: string;
  totalePrimaCentesimi: number;
  totaleDopoCentesimi: number;
  chiusoAFinePeriodo: boolean;
  /** Stato Stripe dopo la modifica: è lui, non il menu del pannello, a decidere `stato_abbonamento`. */
  statoStripe: string;
};

/**
 * Applica il cambio piano su Stripe. Da chiamare solo dopo aver mostrato
 * l'anteprima: questa funzione non chiede conferme, le esegue.
 */
export async function allineaPianoSuStripe(
  supabase: SupabaseClient,
  tenantId: string,
  pianoTarget: string,
  conguaglio: Exclude<AzioneStripe, "nessuna">
): Promise<EsitoAllineamento | { errore: string }> {
  const anteprima = await anteprimaCambioPiano(supabase, tenantId, pianoTarget);
  if ("errore" in anteprima) return anteprima;
  if (!anteprima.possibile) return { errore: anteprima.motivo ?? "Modifica non possibile su Stripe." };

  const letto = await leggiTenantPerStripe(supabase, tenantId);
  if (!letto?.tenant.stripe_subscription_id) return { errore: "Abbonamento Stripe non trovato." };

  const stripe = creaClientStripe();
  const subscriptionId = letto.tenant.stripe_subscription_id as string;
  const prorationBehavior: Stripe.SubscriptionUpdateParams.ProrationBehavior =
    conguaglio === "subito" ? "create_prorations" : "none";

  try {
    if (anteprima.chiudeAbbonamento) {
      // Mai `subscriptions.cancel`: il cliente ha pagato fino a una data e
      // fino a lì il servizio è suo. E questa è l'unica forma di
      // cancellazione che si annulla da sola, riattivando prima della
      // scadenza.
      const aggiornata = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      return {
        descrizione: "Abbonamento impostato per chiudersi alla fine del periodo già pagato.",
        totalePrimaCentesimi: anteprima.totaleAttualeCentesimi,
        totaleDopoCentesimi: 0,
        chiusoAFinePeriodo: true,
        statoStripe: aggiornata.status,
      };
    }

    const piano = pianoTarget as PianoPagante;
    const priceBase = priceIdPerPiano(piano);
    const priceExtra = priceIdOperatoreExtra(piano);
    const priceExtraNoti = new Set(tuttiPriceIdOperatoreExtra());
    const operatoriExtra = Math.max(0, anteprima.operatori - 1);

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const voci: Stripe.SubscriptionUpdateParams.Item[] = [];
    let baseGiaPresente = false;
    let extraGiaPresente = false;

    for (const item of subscription.items.data) {
      const eAddOn = priceExtraNoti.has(item.price.id);

      if (eAddOn) {
        if (priceExtra && operatoriExtra > 0) {
          // Una sola riga add-on, quella del piano nuovo: le altre spariscono.
          if (!extraGiaPresente) {
            voci.push({ id: item.id, price: priceExtra, quantity: operatoriExtra });
            extraGiaPresente = true;
          } else {
            voci.push({ id: item.id, deleted: true });
          }
        } else {
          voci.push({ id: item.id, deleted: true });
        }
        continue;
      }

      // Riga del piano base: la prima diventa il piano nuovo, eventuali
      // altre (non dovrebbero esistere) vengono tolte invece che lasciate a
      // fatturare un piano che il cliente non ha più.
      if (!baseGiaPresente) {
        voci.push({ id: item.id, price: priceBase, quantity: 1 });
        baseGiaPresente = true;
      } else {
        voci.push({ id: item.id, deleted: true });
      }
    }

    if (!baseGiaPresente) voci.push({ price: priceBase, quantity: 1 });
    if (!extraGiaPresente && priceExtra && operatoriExtra > 0) {
      voci.push({ price: priceExtra, quantity: operatoriExtra });
    }

    const aggiornata = await stripe.subscriptions.update(subscriptionId, {
      items: voci,
      proration_behavior: prorationBehavior,
      // Un abbonamento programmato per chiudersi che viene riportato su un
      // piano a pagamento non deve restare programmato per chiudersi.
      cancel_at_period_end: false,
    });

    return {
      descrizione:
        conguaglio === "subito"
          ? "Abbonamento aggiornato su Stripe, con conguaglio sulla prossima fattura."
          : "Abbonamento aggiornato su Stripe: nessun conguaglio, la cifra nuova parte dal prossimo rinnovo.",
      totalePrimaCentesimi: anteprima.totaleAttualeCentesimi,
      totaleDopoCentesimi: anteprima.totaleFuturoCentesimi,
      chiusoAFinePeriodo: false,
      statoStripe: aggiornata.status,
    };
  } catch (errore) {
    // Qui NON si va fail-open, al contrario di
    // `sincronizzaQuantitaOperatoriStripe`: là un errore Stripe non doveva
    // impedire di creare un operatore vero, qui l'intera azione ERA toccare
    // Stripe. Fingere che sia andata bene e scrivere il piano nuovo sul
    // database lascerebbe i due sistemi disallineati proprio sul numero che
    // il cliente paga.
    console.error("[stripe] Allineamento piano fallito", {
      tenantId,
      pianoTarget,
      errore: (errore as Error).message,
    });
    return { errore: `Stripe non ha accettato la modifica: ${(errore as Error).message}` };
  }
}
