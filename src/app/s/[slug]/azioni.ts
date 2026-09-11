"use server";

import { creaClientAdmin } from "@/lib/supabase/admin";
import { risolviTenantIdDaSlug } from "@/lib/ai/tools";
import { trovaSlotDisponibiliTenant, creaAppuntamentoTenant, parsaOrarioLocale } from "@/lib/booking-engine.server";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";

/**
 * Server action pubbliche di prenotazione (Fase 4, punto 15) -- chiamate dal
 * componente client del flusso di prenotazione sulla pagina `/s/[slug]`, MAI
 * autenticate: chi le chiama è un visitatore anonimo del sito. Stesso
 * ragionamento di sicurezza di `/api/chat/[slug]`:
 *
 * - Si riceve sempre lo `slug`, MAI un `tenantId` dal client -- risolto qui
 *   dentro con `risolviTenantIdDaSlug` (client admin), così un payload
 *   manomesso non può mai far scrivere/leggere un altro salone.
 * - `creaAppuntamentoTenant` è la STESSA funzione di scrittura usata dalla
 *   dashboard e dai tool dell'AI (punto 9 di CLAUDE.md: unica fonte di
 *   verità) -- qui passiamo solo `creatoDa: "pubblico"` per distinguere il
 *   canale nello storico cliente (vedi dashboard/clienti/[id]/page.tsx).
 * - Le stesse due difese anti-conflitto (controllo applicativo + vincolo
 *   Postgres) e il tetto di prenotazioni mensili Free si applicano quindi
 *   automaticamente anche qui, senza bisogno di duplicarli.
 *
 * NOTA onestamente segnalata: a differenza di `/api/chat/[slug]` (che ha
 * anti-burst + quota mensile perché ogni messaggio ha un costo Anthropic
 * reale), qui non c'è ancora nessun anti-abuso specifico oltre al tetto
 * mensile del piano Free -- una prenotazione costa quasi zero da salvare, ma
 * uno script potrebbe comunque riempire il calendario di un salone con
 * prenotazioni finte. Accettabile per il primo rilascio (nessun salone reale
 * ancora pubblico), ma da rivedere prima del lancio pubblico -- vedi
 * PROJECT_STATUS.md.
 */

const FORMATO_DATA_YMD = /^\d{4}-\d{2}-\d{2}$/;
// E.164-ish, permissivo: cifre, spazi, +() - purché almeno 6 cifre in tutto --
// stessa tolleranza già implicita nella colonna `telefono` (testo libero, la
// chiave di riconoscimento cliente WhatsApp/chat è comunque il testo esatto).
const FORMATO_TELEFONO = /^[0-9+()\-\s]{6,30}$/;

export interface SlotPubblico {
  operatoreId: string;
  inizioIso: string; // ISO "pseudo-UTC" (vedi src/lib/fuso-orario.ts) -- da mostrare così com'è, mai riconvertito lato client
}

export type RisultatoAzionePubblica<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; errore: string };

/** Cerca gli slot liberi di un giorno per un servizio, per la pagina pubblica. */
export async function cercaSlotPubblici(
  slug: string,
  servizioId: string,
  dataYMD: string
): Promise<RisultatoAzionePubblica<{ slot: SlotPubblico[] }>> {
  if (!servizioId || !FORMATO_DATA_YMD.test(dataYMD)) {
    return { ok: false, errore: "Richiesta non valida." };
  }

  const supabase = creaClientAdmin();
  const tenantId = await risolviTenantIdDaSlug(supabase, slug);
  if (!tenantId) return { ok: false, errore: "Attività non trovata." };

  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);

  const slotGrezzi = await trovaSlotDisponibiliTenant(supabase, tenantId, {
    data: new Date(`${dataYMD}T00:00:00Z`),
    servizioIds: [servizioId],
  });

  // Il motore puro non conosce "adesso" (calcola solo apertura meno
  // occupato): per un cliente che prenota da solo, mai proporre uno slot
  // già passato se il giorno scelto è oggi. Confronto nella stessa
  // convenzione pseudo-UTC di `slot.inizio` -- vedi fuso-orario.ts.
  const adessoPseudo = realeAPseudoUtc(new Date(), fusoOrario);
  const slot = slotGrezzi
    .filter((s) => s.inizio.getTime() > adessoPseudo.getTime())
    .map((s) => ({ operatoreId: s.operatoreId, inizioIso: s.inizio.toISOString() }));

  return { ok: true, slot };
}

export interface DatiPrenotazionePubblica {
  servizioId: string;
  operatoreId: string;
  inizioIso: string; // uno degli `inizioIso` restituiti da cercaSlotPubblici, invariato
  clienteNome: string;
  clienteTelefono: string;
}

/** Crea la prenotazione scelta dal cliente sulla pagina pubblica. */
export async function prenotaPubblico(
  slug: string,
  dati: DatiPrenotazionePubblica
): Promise<RisultatoAzionePubblica<{ appuntamentoId: string }>> {
  const clienteNome = dati.clienteNome.trim().slice(0, 200);
  const clienteTelefono = dati.clienteTelefono.trim();

  if (!dati.servizioId || !dati.operatoreId || !dati.inizioIso) {
    return { ok: false, errore: "Scegli servizio, operatore e orario." };
  }
  if (!clienteNome) return { ok: false, errore: "Inserisci il tuo nome." };
  if (!FORMATO_TELEFONO.test(clienteTelefono)) {
    return { ok: false, errore: "Inserisci un numero di telefono valido." };
  }

  // Validazione rigida dell'orario con lo stesso parser usato ovunque nel
  // booking engine -- non ci si fida di un `new Date(stringa)` diretto su un
  // valore arrivato dal client, anche se qui dovrebbe sempre essere un
  // `inizioIso` restituito invariato da `cercaSlotPubblici`.
  const inizio = parsaOrarioLocale(dati.inizioIso);
  if (!inizio) return { ok: false, errore: "Orario non valido, riprova la ricerca." };

  const supabase = creaClientAdmin();
  const tenantId = await risolviTenantIdDaSlug(supabase, slug);
  if (!tenantId) return { ok: false, errore: "Attività non trovata." };

  const risultato = await creaAppuntamentoTenant(supabase, tenantId, {
    operatoreId: dati.operatoreId,
    servizioId: dati.servizioId,
    inizio,
    clienteNome,
    clienteTelefono,
    creatoDa: "pubblico",
  });

  if (!risultato.ok) return { ok: false, errore: risultato.errore };
  return { ok: true, appuntamentoId: risultato.appuntamentoId };
}
