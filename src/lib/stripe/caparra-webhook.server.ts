import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaAppuntamentoTenant, parsaOrarioLocale, type RisultatoScrittura } from "@/lib/booking-engine.server";

/**
 * Completa il pagamento di una caparra: crea l'appuntamento vero (STESSA
 * funzione di scrittura di sempre, punto 9 di CLAUDE.md) e aggiorna la riga
 * `richieste_caparra`. Se nel frattempo lo slot e' stato preso da un'altra
 * prenotazione (limite dichiarato in 0011_deposito_caparra.sql: lo slot non
 * resta bloccato durante il pagamento), rimborsa il cliente invece di
 * trattenere un pagamento per una prenotazione che non esistera' mai, e marca
 * la riga "fallita_conflitto" cosi' il titolare la vede in dashboard.
 *
 * ----------------------------------------------------------------------
 * PERCHE' E' UN FILE A SE', E NON PIU' UNA FUNZIONE DENTRO route.ts
 * (19/09/2026, revisione notturna).
 *
 * La versione precedente aveva due difetti nello stesso posto, entrambi con
 * lo stesso esito: **un cliente che ha pagato e ha il posto riceve anche un
 * rimborso**, e in dashboard la richiesta risulta "fallita (conflitto)".
 *
 * 1. L'idempotenza era un `if (stato !== "in_attesa") return` -- leggi, poi
 *    agisci. Due consegne dello stesso evento che corrono insieme (Stripe
 *    puo' reinviare, e reinvia anche mentre la prima e' ancora in
 *    lavorazione) leggono tutte e due "in_attesa": la prima crea
 *    l'appuntamento, la seconda va in conflitto sul vincolo
 *    niente_sovrapposizioni, e il ramo "conflitto" rimborsa.
 * 2. Gli update DOPO la creazione non erano controllati: se la scrittura di
 *    "completata" falliva, la route rispondeva comunque 200, Stripe non
 *    ritentava mai piu', e la richiesta restava "in attesa" per sempre con
 *    l'appuntamento gia' in agenda. Stesso difetto corretto il 17/09 sul ramo
 *    dell'abbonamento, lasciato identico su quello della caparra.
 *
 * La cura NON e' un lock (un lock che sopravvive a un crash lascia una riga
 * bloccata e un cliente senza posto). E' rendere la funzione idempotente per
 * costruzione: l'appuntamento porta con se' il payment intent fin dalla
 * INSERT, e ogni ramo che potrebbe rimborsare prima controlla se un
 * appuntamento con quell'intent esiste gia'. Se esiste, non c'e' nessun
 * conflitto: c'e' un altro worker che ha gia' fatto il lavoro.
 *
 * E ogni scrittura fallita torna come `{ errore }`: la route risponde 500,
 * Stripe ritenta, e il tentativo successivo trova l'appuntamento dall'intent
 * e chiude la richiesta. Si ripara da solo.
 */

export interface DipendenzeCaparra {
  creaAppuntamento: typeof creaAppuntamentoTenant;
}

export type EsitoCaparra = { ok: true } | { errore: string };

export async function completaPagamentoCaparra(
  admin: SupabaseClient,
  stripe: Pick<Stripe, "refunds">,
  session: Stripe.Checkout.Session,
  dipendenze: DipendenzeCaparra = { creaAppuntamento: creaAppuntamentoTenant }
): Promise<EsitoCaparra> {
  const { data: richiesta, error: erroreLettura } = await admin
    .from("richieste_caparra")
    .select("*")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();
  if (erroreLettura) return { errore: `richieste_caparra (${session.id}): ${erroreLettura.message}` };
  if (!richiesta) {
    // Non e' un errore da ritentare: una sessione che non conosciamo non
    // diventera' nostra al prossimo tentativo.
    console.error("Webhook caparra: nessuna richiesta trovata per la sessione", session.id);
    return { ok: true };
  }

  // Gia' chiusa, in un senso o nell'altro: nulla da fare.
  if (richiesta.stato !== "in_attesa") return { ok: true };

  // La sessione e' "completata" anche quando i soldi NON sono ancora arrivati
  // (metodi a notifica differita). Si esce senza toccare lo stato: la
  // richiesta verra' completata da `checkout.session.async_payment_succeeded`.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    console.info("[stripe] Caparra non ancora incassata, appuntamento non creato", {
      sessione: session.id,
      stato_pagamento: session.payment_status,
    });
    return { ok: true };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  // RIPRESA: l'appuntamento esiste gia' con questo intent (un tentativo
  // precedente l'ha creato e poi non e' riuscito a chiudere la richiesta, o
  // un'altra consegna dello stesso evento ha gia' finito). Si chiude la
  // richiesta e basta, senza creare e senza rimborsare.
  const giaCreato = await appuntamentoConIntent(admin, richiesta.tenant_id, paymentIntentId);
  if ("errore" in giaCreato) return giaCreato;
  if (giaCreato.id) {
    return chiudiComeCompletata(admin, richiesta.id, giaCreato.id, paymentIntentId);
  }

  const inizio = parsaOrarioLocale(richiesta.inizio_iso);
  const risultato: RisultatoScrittura<{ appuntamentoId: string }> = inizio
    ? await dipendenze.creaAppuntamento(admin, richiesta.tenant_id, {
        operatoreId: richiesta.operatore_id,
        servizioId: richiesta.servizio_id,
        inizio,
        clienteNome: richiesta.cliente_nome,
        clienteTelefono: richiesta.cliente_telefono,
        clienteEmail: richiesta.cliente_email ?? undefined,
        creatoDa: "pubblico",
        caparra: { importoCentesimi: richiesta.importo_centesimi, stripePaymentIntentId: paymentIntentId },
      })
    : { ok: false, errore: "Orario della richiesta non valido." };

  if (risultato.ok) {
    return chiudiComeCompletata(admin, richiesta.id, risultato.appuntamentoId, paymentIntentId);
  }

  // Prima di rimborsare: il "conflitto" potrebbe essere l'altra consegna
  // dello stesso evento che ha appena creato QUESTO appuntamento. Se c'e' un
  // appuntamento con il nostro intent, il cliente ha il posto e i soldi
  // restano dove sono.
  const creatoDaAltri = await appuntamentoConIntent(admin, richiesta.tenant_id, paymentIntentId);
  if ("errore" in creatoDaAltri) return creatoDaAltri;
  if (creatoDaAltri.id) {
    return chiudiComeCompletata(admin, richiesta.id, creatoDaAltri.id, paymentIntentId);
  }

  // Conflitto vero (o altro errore di scrittura): rimborso, mai trattenere i
  // soldi di un cliente per una prenotazione che non esiste.
  if (paymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: paymentIntentId });
    } catch (erroreRimborso) {
      console.error("Webhook caparra: rimborso automatico fallito per", paymentIntentId, erroreRimborso);
    }
  }
  const { error: erroreFallita } = await admin
    .from("richieste_caparra")
    .update({ stato: "fallita_conflitto", stripe_payment_intent_id: paymentIntentId, errore: risultato.errore })
    .eq("id", richiesta.id);
  if (erroreFallita) return { errore: `richieste_caparra (${richiesta.id}): ${erroreFallita.message}` };
  return { ok: true };
}

/** L'appuntamento gia' creato per questo pagamento, se c'e'. */
async function appuntamentoConIntent(
  admin: SupabaseClient,
  tenantId: string,
  paymentIntentId: string | null
): Promise<{ id: string | null } | { errore: string }> {
  if (!paymentIntentId) return { id: null };
  const { data, error } = await admin
    .from("appuntamenti")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("caparra_stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) return { errore: `appuntamenti (intent ${paymentIntentId}): ${error.message}` };
  return { id: (data?.id as string | undefined) ?? null };
}

async function chiudiComeCompletata(
  admin: SupabaseClient,
  richiestaId: string,
  appuntamentoId: string,
  paymentIntentId: string | null
): Promise<EsitoCaparra> {
  const { error } = await admin
    .from("richieste_caparra")
    .update({ stato: "completata", stripe_payment_intent_id: paymentIntentId, appuntamento_id: appuntamentoId })
    .eq("id", richiestaId);
  if (error) return { errore: `richieste_caparra (${richiestaId}): ${error.message}` };
  return { ok: true };
}
