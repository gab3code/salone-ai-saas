import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientStripe } from "./server";
import {
  pianoEPagante,
  pianoPerPriceId,
  priceIdOperatoreExtra,
  tuttiPriceIdOperatoreExtra,
} from "./piani";

/**
 * Tiene allineato il line item "operatore extra" su Stripe (vedi
 * `priceIdOperatoreExtra` in piani.ts) ogni volta che il numero di operatori
 * di un tenant cambia -- chiamata da creaOperatore ed eliminaOperatore in
 * dashboard/configura/azioni.ts, DOPO che la scrittura su Supabase è già
 * andata a buon fine (mai prima: un fallimento Stripe non deve mai impedire
 * di creare/eliminare un operatore vero, vedi fail-open sotto).
 *
 * Non tocca il checkout iniziale (quello aggiunge già il line item giusto,
 * vedi /api/stripe/checkout/route.ts) -- questa funzione gestisce SOLO i
 * cambi successivi al primo abbonamento: un salone che assume un nuovo
 * operatore o ne licenzia uno mentre è già abbonato.
 *
 * **Cambio piano (16/09/2026)**: da quando la quota per operatore esiste su
 * tutti e tre i piani a pagamento con cifre diverse (10/15/20€), non basta
 * più cercare UN solo price id. Un salone che passa da Starter a Growth con 4
 * operatori si porta dietro la riga "operatore extra Starter" a 10€: va
 * riconosciuta (`tuttiPriceIdOperatoreExtra`) e SOSTITUITA con quella di
 * Growth, non affiancata. Senza, quel salone continuerebbe a pagare la quota
 * del piano vecchio oppure si ritroverebbe due add-on sulla stessa fattura --
 * il tipo di bug di fatturazione che un cliente scopre prima di te.
 *
 * Fail-open totale: se il tenant non è su un piano pagante, non ha un
 * abbonamento Stripe attivo (piano appena scelto, checkout non ancora
 * completato), il Price dell'add-on non è ancora configurato in env, o
 * qualsiasi chiamata Stripe fallisce (rete, subscription cancellata nel
 * frattempo, ecc.), la funzione logga e torna senza lanciare -- stesso
 * principio già seguito da mailjet.server.ts e skebby.server.ts. Il caso
 * "Stripe e Supabase finiscono disallineati" esiste comunque (nessuna vera
 * transazione distribuita tra i due sistemi), ma è lo stesso compromesso già
 * accettato altrove nel progetto: il prossimo webhook di
 * sincronizzaAbbonamento, o un controllo manuale, lo riallinea. Bloccare la
 * creazione di un operatore per un problema di fatturazione sarebbe un danno
 * peggiore per Gabriel e per i suoi clienti.
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
    if (!tenant || !tenant.stripe_subscription_id) return;

    const { count } = await supabase
      .from("operatori")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    // Il prezzo base include sempre il primo operatore.
    const quantitaVoluta = Math.max(0, (count ?? 0) - 1);

    const stripe = creaClientStripe();
    const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);

    // Il piano su cui calcolare la quota è quello DAVVERO FATTURATO, letto
    // dalla riga base dell'abbonamento -- non `tenants.piano`.
    //
    // I due possono legittimamente non coincidere, e quando succede è il
    // database ad avere torto ai fini della fattura: il pannello admin
    // permette di cambiare piano senza toccare Stripe (`azioneStripe:
    // "nessuna"`, migrazione 0028), e in quel caso leggere `tenants.piano`
    // significherebbe attaccare la quota da 15€ di Growth a un abbonamento
    // che fattura la base Starter da 19,90 -- una combinazione che non esiste
    // in nessun listino, che nessuno noterebbe (questa funzione è fail-open)
    // e che il cliente scoprirebbe da una fattura.
    //
    // La stessa scelta spegne anche una intermittenza degli E2E: qualunque
    // sfasamento temporaneo fra database e Stripe (un webhook che deve ancora
    // arrivare, uno arrivato fuori ordine) smette di poter cambiare il PREZZO
    // che si applica. L'invariante diventa semplice e verificabile a occhio
    // sulla fattura: la riga "operatore extra" appartiene sempre allo stesso
    // piano della riga base che le sta sopra.
    const pianoFatturato =
      subscription.items.data
        .map((item) => pianoPerPriceId(item.price.id))
        .find((piano) => piano !== null) ?? null;

    // Nessun price base riconosciuto (env non configurato, prezzo creato a
    // mano su Stripe): si ripiega su quello che dice il database, che è
    // comunque meglio di non fare niente.
    const piano = pianoFatturato ?? tenant.piano;
    if (!pianoEPagante(piano)) return;

    const priceIdVoluto = priceIdOperatoreExtra(piano);
    const priceIdNoti = new Set(tuttiPriceIdOperatoreExtra());

    console.info("[stripe] Sincronizzo operatori extra", {
      tenantId,
      piano,
      pianoSulDatabase: tenant.piano,
      quantitaVoluta,
      priceIdVoluto,
    });
    // Qualunque add-on "operatore extra" già presente, anche di un altro
    // piano: sono quelli da rimuovere o sostituire.
    const addOnPresenti = subscription.items.data.filter((item) => priceIdNoti.has(item.price.id));
    const itemDelPianoAttuale = priceIdVoluto
      ? addOnPresenti.find((item) => item.price.id === priceIdVoluto)
      : undefined;
    const itemDiAltriPiani = addOnPresenti.filter((item) => item.id !== itemDelPianoAttuale?.id);

    // Prima si puliscono le righe dei piani vecchi, sempre: che il salone
    // abbia 0 o 5 operatori extra, una quota di un piano che non ha più non
    // deve restare sulla fattura.
    for (const item of itemDiAltriPiani) {
      await stripe.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
    }

    // Price non ancora creato su Stripe per questo piano (Starter e Growth
    // finché Gabriel non li crea): niente add-on, e quello eventualmente
    // ereditato è già stato tolto sopra.
    if (!priceIdVoluto) return;

    if (quantitaVoluta === 0) {
      if (itemDelPianoAttuale) {
        await stripe.subscriptionItems.del(itemDelPianoAttuale.id, {
          proration_behavior: "create_prorations",
        });
      }
      return;
    }

    if (itemDelPianoAttuale) {
      if (itemDelPianoAttuale.quantity !== quantitaVoluta) {
        await stripe.subscriptionItems.update(itemDelPianoAttuale.id, {
          quantity: quantitaVoluta,
          proration_behavior: "create_prorations",
        });
      }
    } else {
      await stripe.subscriptions.update(tenant.stripe_subscription_id, {
        items: [{ price: priceIdVoluto, quantity: quantitaVoluta }],
        proration_behavior: "create_prorations",
      });
    }
  } catch (errore) {
    // Contesto nel log, non solo il messaggio: questa funzione è fail-open
    // per scelta (un problema di fatturazione non deve mai impedire di
    // creare un operatore vero), il che significa che quando sbaglia non
    // succede NIENTE di visibile -- solo un cliente che paga la cifra
    // sbagliata. Senza sapere quale tenant, quale piano e quale price stava
    // trattando, quel silenzio è anche indiagnosticabile.
    console.error("[stripe] Errore sincronizzando la quantità di operatori extra:", {
      tenantId,
      errore: (errore as Error).message,
    });
  }
}
