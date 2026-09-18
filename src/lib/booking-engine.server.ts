import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcolaSlotDisponibili,
  calcolaSlotServiziConsecutivi,
  diagnosticaOperatori,
  giornoChiuso,
  type MotivoOperatoriMancanti,
  verificaConflitto,
  type AppuntamentoEsistente,
  type Chiusura,
  type ModalitaRiempimento,
  type Operatore,
  type OrarioGiorno,
  type SlotDisponibile,
} from "@/lib/booking-engine";
import { limiteMensilePrenotazioni, pianoHaListaAttesaAutomatica } from "@/lib/piani";
import { caricaImpegniEsterni } from "@/lib/calendario-esterno/collegamenti.server";
import {
  pseudoUtcAReale,
  realeAPseudoUtc,
  inizioGiornoUTC,
  fineGiornoUTC,
  FUSO_ORARIO_PREDEFINITO,
} from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import {
  trovaOCreaCliente as trovaOCreaClienteInRubrica,
  trovaClientePerTelefono,
} from "@/lib/clienti.server";
import { inviaNotificheNuovoAppuntamento, escapeHtml, formattaOrario, urlBaseSito } from "@/lib/email/notifiche.server";
import { inviaEmail } from "@/lib/email/mailjet.server";
import { inviaSmsSeInclusoNelPiano } from "@/lib/sms/invio.server";
import { programmaRichiestaRecensione } from "@/lib/recensioni.server";

/**
 * Livello di collegamento tra il motore puro (booking-engine.ts, già testato
 * in isolamento) e il database vero. Qui vivono SOLO le query e la
 * conversione dei dati -- zero logica di disponibilità, che resta
 * interamente nel file puro (stessa regola descritta lì: unica fonte di
 * verità, letta sia dal calendario manuale sia -- in Fase 2 -- dai tool
 * dell'AI).
 *
 * NOTA fuso orario: il motore puro e tutto ciò che gli arriva da qui dentro
 * (orari, appuntamenti, impegni esterni) usa la convenzione "pseudo-UTC"
 * descritta in dettaglio in src/lib/fuso-orario.ts -- i campi getUTC* di un
 * Date rappresentano direttamente l'ora civile del salone, mai un istante
 * reale. I DUE punti dove serve invece un istante reale sono isolati qui:
 * la colonna timestamptz di "appuntamenti" (scritta/letta con
 * pseudoUtcAReale/realeAPseudoUtc) e la finestra passata a
 * caricaImpegniEsterni (Google/CalDAV, anch'esse tempo reale). Il motore
 * puro stesso NON cambia: continua a ricevere solo valori pseudo-UTC.
 */

/** "HH:MM:SS" (formato time di Postgres) -> "HH:MM" (formato atteso dal motore puro). */
function troncaOra(valore: string | null): string | undefined {
  return valore ? valore.slice(0, 5) : undefined;
}

// "YYYY-MM-DDTHH:MM"[":SS"][".sss"], con o senza fuso esplicito -- usato per
// ogni orario che arriva da fuori (input utente della dashboard, input
// dell'AI, e -- punto rotto trovato testando dal vivo il flusso di
// prenotazione pubblico il 13/09/2026 -- gli `inizioIso` che
// `cercaSlotPubblici` produce con `Date.toISOString()`, che include SEMPRE i
// millisecondi, es. "2026-09-14T09:00:00.000Z"): validazione RIGIDA del
// formato prima di toccare `new Date()`, perché il parser lenient di V8
// accetta ed "interpreta" stringhe non-ISO senza senso invece di restituire
// NaN (es. `new Date("boh:00Z")` torna una data valida del 2000). Un formato
// sbagliato deve fallire in modo esplicito, mai produrre silenziosamente una
// data a caso. Nessun fuso esplicito indicato -> trattato come UTC, stessa
// semplificazione consapevole descritta sopra per tutto il resto del
// booking engine.
//
// BUG CRITICO chiuso qui: prima di questa correzione la regex NON ammetteva
// i millisecondi, quindi OGNI chiamata a `prenotaPubblico`/
// `avviaPagamentoCaparra` (src/app/s/[slug]/azioni.ts) falliva sempre con
// "Orario non valido, riprova la ricerca." -- il flusso di prenotazione
// diretta (senza passare dalla chat AI) era completamente inutilizzabile in
// produzione per qualunque cliente reale. Non causava perdita di dati (la
// prenotazione semplicemente non veniva mai creata, l'utente vedeva
// l'errore), ma bloccava silenziosamente un intero canale di prenotazione.
// Scoperto SOLO perché testato dal vivo end-to-end su un tenant di prova
// dedicato (vedi PROJECT_STATUS.md) -- nessun test automatico copriva questo
// percorso perché i test esistenti di `parsaOrarioLocale` non includevano un
// input con millisecondi.
const FORMATO_ORARIO_SENZA_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;
const FORMATO_ORARIO_CON_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function parsaOrarioLocale(valore: string): Date | null {
  let conFuso: string;
  if (FORMATO_ORARIO_CON_FUSO.test(valore)) {
    conFuso = valore;
  } else if (FORMATO_ORARIO_SENZA_FUSO.test(valore)) {
    // length 16 = "YYYY-MM-DDTHH:MM" (mancano i secondi), 19 = già con ":SS".
    conFuso = valore.length === 16 ? `${valore}:00Z` : `${valore}Z`;
  } else {
    return null;
  }
  const data = new Date(conFuso);
  return Number.isNaN(data.getTime()) ? null : data;
}



/**
 * Le regole con cui QUESTO salone riempie la propria agenda (migrazione 0056).
 * Non sono un dettaglio tecnico: due saloni con gli stessi orari e gli stessi
 * servizi possono volere due agende diverse.
 */
export interface RegoleAgenda {
  passoMinuti: number;
  bufferMinuti: number;
  modalitaRiempimento: ModalitaRiempimento;
}

/** Il comportamento storico, quello che vale per chi non ha mai toccato niente. */
export const REGOLE_AGENDA_PREDEFINITE: RegoleAgenda = {
  passoMinuti: 15,
  bufferMinuti: 0,
  modalitaRiempimento: "griglia",
};

export interface ContestoBooking {
  orari: OrarioGiorno[];
  chiusure: Chiusura[];
  operatori: Operatore[];
  appuntamenti: AppuntamentoEsistente[];
  regole: RegoleAgenda;
}

/**
 * Fuso orario e regole d'agenda in UNA query sola: erano due letture della
 * stessa riga di `tenants` a ogni ricerca di slot.
 *
 * Fail-open deliberato: se la riga manca o la lettura fallisce si usano i
 * default. Le regole d'agenda sono una PREFERENZA -- perdere la preferenza
 * vuol dire proporre orari col passo di prima, perdere l'intero calendario
 * per una preferenza illeggibile sarebbe molto peggio.
 */
async function caricaImpostazioniTenant(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ fusoOrario: string; regole: RegoleAgenda }> {
  const { data } = await supabase
    .from("tenants")
    .select("fuso_orario, passo_slot_minuti, buffer_minuti, riempimento_agenda")
    .eq("id", tenantId)
    .maybeSingle();

  const riga = (data ?? {}) as {
    fuso_orario?: string | null;
    passo_slot_minuti?: number | null;
    buffer_minuti?: number | null;
    riempimento_agenda?: string | null;
  };

  return {
    fusoOrario: riga.fuso_orario || FUSO_ORARIO_PREDEFINITO,
    regole: {
      passoMinuti: riga.passo_slot_minuti ?? REGOLE_AGENDA_PREDEFINITE.passoMinuti,
      bufferMinuti: riga.buffer_minuti ?? REGOLE_AGENDA_PREDEFINITE.bufferMinuti,
      modalitaRiempimento:
        riga.riempimento_agenda === "attaccato"
          ? "attaccato"
          : REGOLE_AGENDA_PREDEFINITE.modalitaRiempimento,
    },
  };
}

/**
 * Carica dal database tutti i dati grezzi necessari al motore per il tenant
 * loggato (RLS fa comunque da rete di sicurezza finale se per errore si
 * passasse un tenantId sbagliato: le query restituirebbero comunque solo le
 * righe del tenant dell'utente autenticato), in una finestra [da, a] incluse.
 * Una query per tabella, non una per giorno: resta veloce anche per una
 * vista calendario settimanale.
 */
export async function caricaContestoBooking(
  supabase: SupabaseClient,
  tenantId: string,
  da: Date,
  a: Date
): Promise<ContestoBooking> {
  const daStr = inizioGiornoUTC(da).toISOString().slice(0, 10);
  const aStr = inizioGiornoUTC(a).toISOString().slice(0, 10);

  const { fusoOrario, regole } = await caricaImpostazioniTenant(supabase, tenantId);
  // I confini del giorno sono calcolati in pseudo-UTC (coerenti con `da`/`a`,
  // che arrivano già in quella convenzione da chi chiama), poi convertiti in
  // istanti reali: SOLO da qui in giù si parla con il database (colonna
  // timestamptz) e con i calendari esterni, entrambi tempo reale.
  const inizioFinestraReale = pseudoUtcAReale(inizioGiornoUTC(da), fusoOrario);
  const fineFinestraReale = pseudoUtcAReale(fineGiornoUTC(a), fusoOrario);

  const [orariRes, chiusureRes, operatoriRes, orariOperatoreRes, opServiziRes, appuntamentiRes] =
    await Promise.all([
    supabase.from("orari_apertura").select("*").eq("tenant_id", tenantId),
    supabase
      .from("chiusure")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("data", daStr)
      .lte("data", aStr),
    supabase.from("operatori").select("id, attivo").eq("tenant_id", tenantId),
    // Orari propri dello staff (migrazione 0057). Nessuna riga = tutti
    // seguono gli orari del salone, che e' il caso di ogni salone esistente.
    supabase.from("orari_operatore").select("*").eq("tenant_id", tenantId),
    // Nessun tenant_id diretto su operatori_servizi: RLS la isola comunque
    // tramite l'operatore collegato (vedi migrazione 0001).
    supabase.from("operatori_servizi").select("operatore_id, servizio_id"),
    supabase
      .from("appuntamenti")
      .select("operatore_id, inizio, fine, stato")
      .eq("tenant_id", tenantId)
      .gte("inizio", inizioFinestraReale.toISOString())
      .lte("inizio", fineFinestraReale.toISOString())
      .not("operatore_id", "is", null),
  ]);

  for (const [nome, res] of Object.entries({
    orari: orariRes,
    chiusure: chiusureRes,
    operatori: operatoriRes,
    orari_operatore: orariOperatoreRes,
    operatori_servizi: opServiziRes,
    appuntamenti: appuntamentiRes,
  })) {
    if (res.error) {
      throw new Error(`Errore caricando "${nome}" per il booking engine: ${res.error.message}`);
    }
  }

  const servizioIdsPerOperatore = new Map<string, string[]>();
  for (const riga of opServiziRes.data ?? []) {
    const lista = servizioIdsPerOperatore.get(riga.operatore_id) ?? [];
    lista.push(riga.servizio_id);
    servizioIdsPerOperatore.set(riga.operatore_id, lista);
  }

  const orari: OrarioGiorno[] = (orariRes.data ?? []).map((r) => ({
    giornoSettimana: r.giorno_settimana,
    chiuso: r.chiuso,
    apertura: troncaOra(r.apertura),
    chiusura: troncaOra(r.chiusura),
    pausaInizio: troncaOra(r.pausa_inizio),
    pausaFine: troncaOra(r.pausa_fine),
  }));

  const chiusure: Chiusura[] = (chiusureRes.data ?? []).map((r) => ({
    operatoreId: r.operatore_id,
    data: r.data,
    giornoIntero: r.giorno_intero,
    oraInizio: troncaOra(r.ora_inizio),
    oraFine: troncaOra(r.ora_fine),
  }));

  const orariPerOperatore = new Map<string, OrarioGiorno[]>();
  for (const r of (orariOperatoreRes.data ?? []) as Record<string, never>[]) {
    const riga = r as unknown as {
      operatore_id: string;
      giorno_settimana: number;
      chiuso: boolean;
      apertura: string | null;
      chiusura: string | null;
      pausa_inizio: string | null;
      pausa_fine: string | null;
    };
    const lista = orariPerOperatore.get(riga.operatore_id) ?? [];
    lista.push({
      giornoSettimana: riga.giorno_settimana,
      chiuso: riga.chiuso,
      apertura: troncaOra(riga.apertura),
      chiusura: troncaOra(riga.chiusura),
      pausaInizio: troncaOra(riga.pausa_inizio),
      pausaFine: troncaOra(riga.pausa_fine),
    });
    orariPerOperatore.set(riga.operatore_id, lista);
  }

  const operatori: Operatore[] = (operatoriRes.data ?? []).map((r) => ({
    id: r.id,
    attivo: r.attivo,
    servizioIds: servizioIdsPerOperatore.get(r.id) ?? [],
    orari: orariPerOperatore.get(r.id),
  }));

  const appuntamenti: AppuntamentoEsistente[] = (appuntamentiRes.data ?? []).map((r) => ({
    operatoreId: r.operatore_id as string,
    inizio: realeAPseudoUtc(new Date(r.inizio), fusoOrario),
    fine: realeAPseudoUtc(new Date(r.fine), fusoOrario),
    stato: r.stato,
  }));

  // Impegni sui calendari personali collegati (Google/Apple, Fase 6bis):
  // stessa forma "AppuntamentoEsistente", concatenati qui così il motore
  // puro li tratta come uno qualunque degli appuntamenti interni -- mai una
  // seconda logica di conflitto separata (punto 9). Fail-open per
  // collegamento (vedi caricaImpegniEsterni): un calendario esterno
  // irraggiungibile non deve mai impedire di vedere/prenotare gli slot
  // liberi, solo far perdere il blocco di QUELL'impegno specifico. Finestra
  // e fuso passati qui sono tempo reale: la conversione a pseudo-UTC degli
  // eventi restituiti avviene dentro caricaImpegniEsterni stessa.
  const impegniEsterni = await caricaImpegniEsterni(
    supabase,
    tenantId,
    operatori.map((o) => o.id),
    inizioFinestraReale,
    fineFinestraReale,
    fusoOrario
  );

  return { orari, chiusure, operatori, regole, appuntamenti: [...appuntamenti, ...impegniEsterni] };
}

/**
 * Somma delle durate di uno o più servizi (per i servizi consecutivi, punto
 * 12) -- letta dal database vero, non passata a mano da chi chiama.
 */
async function caricaServizi(
  supabase: SupabaseClient,
  tenantId: string,
  servizioIds: string[]
): Promise<{ id: string; durataMinuti: number }[]> {
  const { data, error } = await supabase
    .from("servizi")
    .select("id, durata_minuti")
    .eq("tenant_id", tenantId)
    .in("id", servizioIds);
  if (error) throw new Error(`Errore caricando i servizi: ${error.message}`);
  return (data ?? []).map((r) => ({ id: r.id, durataMinuti: r.durata_minuti }));
}

export interface RicercaSlotParams {
  data: Date;
  servizioIds: string[]; // 1 elemento = servizio singolo, più elementi = catena consecutiva
  operatoreId?: string;
  // Lasciati vuoti (il caso normale) valgono le regole del salone, caricate
  // dal database: un valore qui le sovrascrive solo per questa ricerca.
  bufferMinuti?: number;
  passoMinuti?: number;
  modalitaRiempimento?: ModalitaRiempimento;
}

export interface RisultatoRicercaSlot {
  slot: SlotDisponibile[];
  // true se il salone è chiuso in questo giorno (vedi `giornoChiuso` nel
  // motore puro) -- indipendente dagli slot: un giorno può essere chiuso
  // (slot sempre vuoto) o aperto ma pieno (slot vuoto solo per quel motivo).
  giornoChiuso: boolean;
  // Perche' nessun operatore puo' fare questi servizi, quando e' cosi'.
  // `null` vuol dire "gli operatori non sono il problema" -- vedi
  // `diagnosticaOperatori`. Serve a non rispondere "prova un'altra data"
  // quando la data non c'entra niente.
  motivoOperatori: MotivoOperatoriMancanti | null;
}

/**
 * Implementazione condivisa da `trovaSlotDisponibiliTenant` (solo gli slot,
 * per chi non ha bisogno di distinguere "chiuso" da "pieno": dashboard e
 * tool dell'AI) e `trovaSlotEStatoGiornoTenant` (slot + stato del giorno, per
 * il flusso pubblico -- vedi `cercaSlotPubblici` in
 * src/app/s/[slug]/azioni.ts): un solo caricamento del contesto per
 * entrambe, mai due query duplicate per la stessa ricerca.
 */
async function trovaSlotEContestoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  params: RicercaSlotParams
): Promise<RisultatoRicercaSlot> {
  if (params.servizioIds.length === 0) return { slot: [], giornoChiuso: false, motivoOperatori: null };

  const [contesto, servizi] = await Promise.all([
    caricaContestoBooking(supabase, tenantId, params.data, params.data),
    caricaServizi(supabase, tenantId, params.servizioIds),
  ]);

  const chiuso = giornoChiuso(contesto.orari, params.data);

  const motivoOperatori = diagnosticaOperatori(contesto.operatori, params.servizioIds, params.operatoreId);

  if (servizi.length !== params.servizioIds.length) {
    // servizio inesistente/di un altro tenant
    return { slot: [], giornoChiuso: chiuso, motivoOperatori };
  }

  const paramsBase = {
    data: params.data,
    operatoreId: params.operatoreId,
    operatori: contesto.operatori,
    orari: contesto.orari,
    chiusure: contesto.chiusure,
    appuntamentiEsistenti: contesto.appuntamenti,
    bufferMinuti: params.bufferMinuti ?? contesto.regole.bufferMinuti,
    passoMinuti: params.passoMinuti ?? contesto.regole.passoMinuti,
    modalitaRiempimento: params.modalitaRiempimento ?? contesto.regole.modalitaRiempimento,
  };

  const slot =
    servizi.length === 1
      ? calcolaSlotDisponibili({ ...paramsBase, durataMinuti: servizi[0].durataMinuti, servizioId: servizi[0].id })
      : calcolaSlotServiziConsecutivi(paramsBase, servizi);

  return { slot, giornoChiuso: chiuso, motivoOperatori };
}

/**
 * Punto di ingresso da usare da qualunque schermata/tool voglia sapere gli
 * slot liberi per il tenant loggato: carica i dati veri e delega SEMPRE al
 * motore puro per la decisione (mai reimplementata qui).
 */
export async function trovaSlotDisponibiliTenant(
  supabase: SupabaseClient,
  tenantId: string,
  params: RicercaSlotParams
): Promise<SlotDisponibile[]> {
  const { slot } = await trovaSlotEContestoTenant(supabase, tenantId, params);
  return slot;
}

/**
 * Come `trovaSlotDisponibiliTenant`, ma include anche se il giorno cercato è
 * di chiusura per il salone -- usata dal flusso di prenotazione pubblico per
 * decidere se ha senso proporre la lista d'attesa quando non c'è nessuno
 * slot: iscriversi in lista d'attesa per un giorno di chiusura non ha senso
 * (nessuno slot si libererà mai lì), a differenza di un giorno aperto ma
 * pieno (una cancellazione può liberare un posto). Bug UX segnalato da
 * Gabriel il 14/09/2026: prima di questa funzione i due casi erano
 * indistinguibili dal chiamante, che vedeva sempre e solo un array vuoto.
 */
export async function trovaSlotEStatoGiornoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  params: RicercaSlotParams
): Promise<RisultatoRicercaSlot> {
  return trovaSlotEContestoTenant(supabase, tenantId, params);
}

/**
 * Solo "il salone e' chiuso in questo giorno?", senza caricare tutto il
 * contesto di booking.
 *
 * Serve al calendario della dashboard, che deve poterlo dire anche quando non
 * e' stato scelto nessun servizio: una giornata vuota va spiegata comunque,
 * altrimenti resta un "nessun appuntamento" che sembra un guasto.
 */
export async function giornoDiChiusuraTenant(
  supabase: SupabaseClient,
  tenantId: string,
  data: Date
): Promise<boolean> {
  const { data: righe, error } = await supabase
    .from("orari_apertura")
    .select("giorno_settimana, chiuso, apertura, chiusura, pausa_inizio, pausa_fine")
    .eq("tenant_id", tenantId)
    .eq("giorno_settimana", data.getUTCDay());

  // Fail-open: se la lettura non riesce non si dichiara "chiuso" un giorno che
  // magari e' aperto -- si resta zitti e si mostra il messaggio generico.
  if (error) return false;

  const orari: OrarioGiorno[] = (righe ?? []).map((r) => ({
    giornoSettimana: r.giorno_settimana,
    chiuso: r.chiuso,
    apertura: troncaOra(r.apertura),
    chiusura: troncaOra(r.chiusura),
    pausaInizio: troncaOra(r.pausa_inizio),
    pausaFine: troncaOra(r.pausa_fine),
  }));

  return giornoChiuso(orari, data);
}

export interface VerificaConflittoParams {
  inizio: Date;
  fine: Date;
  operatoreId: string;
  bufferMinuti?: number;
  ignoraAppuntamentoId?: string; // per la modifica: non contare l'appuntamento che si sta spostando
}

/**
 * Controllo anti-conflitto applicativo PRIMA di tentare la scrittura, per un
 * messaggio d'errore chiaro subito -- il vincolo `niente_sovrapposizioni` a
 * livello di database resta comunque la difesa reale contro le race
 * condition (due richieste concorrenti che passano entrambe questo
 * controllo prima che l'altra abbia scritto).
 */
export async function verificaConflittoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  params: VerificaConflittoParams
): Promise<boolean> {
  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
  const inizioFinestraReale = pseudoUtcAReale(inizioGiornoUTC(params.inizio), fusoOrario);
  const fineFinestraReale = pseudoUtcAReale(fineGiornoUTC(params.fine), fusoOrario);

  // Query dedicata (non caricaContestoBooking) perché qui serve anche la
  // colonna "id" -- per escludere l'appuntamento stesso quando si sta
  // modificando un orario già esistente, altrimenti risulterebbe sempre in
  // conflitto con se stesso.
  const { data, error } = await supabase
    .from("appuntamenti")
    .select("id, operatore_id, inizio, fine, stato")
    .eq("tenant_id", tenantId)
    .eq("operatore_id", params.operatoreId)
    .eq("stato", "confermato")
    .gte("inizio", inizioFinestraReale.toISOString())
    .lte("inizio", fineFinestraReale.toISOString());

  if (error) throw new Error(`Errore verificando conflitti: ${error.message}`);

  const appuntamentiRilevanti: AppuntamentoEsistente[] = (data ?? [])
    .filter((r) => r.id !== params.ignoraAppuntamentoId)
    .map((r) => ({
      operatoreId: r.operatore_id as string,
      inizio: realeAPseudoUtc(new Date(r.inizio), fusoOrario),
      fine: realeAPseudoUtc(new Date(r.fine), fusoOrario),
      stato: r.stato,
    }));

  // Stesso principio di caricaContestoBooking: un impegno sul calendario
  // personale collegato dell'operatore blocca la scrittura tanto quanto un
  // appuntamento interno (Fase 6bis, punto 9 -- unica fonte di verità).
  const impegniEsterni = await caricaImpegniEsterni(
    supabase,
    tenantId,
    [params.operatoreId],
    inizioFinestraReale,
    fineFinestraReale,
    fusoOrario
  );

  return verificaConflitto(
    params.inizio,
    params.fine,
    params.operatoreId,
    [...appuntamentiRilevanti, ...impegniEsterni],
    params.bufferMinuti
  );
}

// ---------------------------------------------------------------------
// Scrittura appuntamenti -- condivisa tra dashboard (client autenticato,
// scope RLS) e tool AI (client admin/service_role, nessun utente Supabase
// dietro un visitatore anonimo). Stessa unica fonte di verità per entrambi
// (CLAUDE.md punto 9: "AI e calendario devono utilizzare la stessa booking
// engine, non voglio due sistemi separati") -- prima vivevano duplicate
// dentro le server action della dashboard, ora vivono solo qui.
// ---------------------------------------------------------------------

export type RisultatoScrittura<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; errore: string };

/**
 * Verifica che l'operatore appartenga davvero a questo tenant, sia attivo e
 * offra questo servizio -- PRIMA di scrivere un appuntamento, mai dopo.
 * Bug di isolamento multi-tenant trovato in un audit del 15/09/2026 (mai dal
 * vivo, mai segnalato da Gabriel): `creaAppuntamentoTenant`/
 * `modificaAppuntamentoTenant` validavano `servizio_id` con `tenant_id`
 * (sopra), ma scrivevano `operatore_id` così com'era arrivato, senza mai
 * verificare che appartenesse allo stesso tenant. Un FK semplice
 * (`operatori(id)`, non un vincolo composto su tenant+id) e RLS che passa
 * comunque `tenant_id` della RIGA scritta (sempre quello giusto) non
 * bloccano un `operatore_id` preso da un ALTRO tenant -- e il client
 * admin/service_role usato dai tool AI ignora comunque RLS. Concretamente:
 * un `operatore_id` di un salone concorrente (leggibile dalla sua pagina
 * pubblica) passato per errore o con un prompt malevolo avrebbe creato un
 * appuntamento reale nel calendario di QUESTO tenant ma intestato a un
 * dipendente di un ALTRO salone -- mai bloccato prima da nessun livello.
 * Stessa idea già applicata a `servizio_id`, qui estesa a `operatore_id` +
 * al controllo "questo operatore esegue davvero questo servizio"
 * (`operatori_servizi`, già applicato SOLO in fase di ricerca slot in
 * `booking-engine.ts`, mai in scrittura: chi chiama `crea_prenotazione`
 * senza prima passare da `verifica_disponibilita` -- o con un input diverso
 * da quello restituito -- non veniva mai fermato).
 */
async function verificaOperatoreCompatibile(
  supabase: SupabaseClient,
  tenantId: string,
  operatoreId: string,
  servizioId: string | string[]
): Promise<{ ok: true } | { ok: false; errore: string }> {
  const { data: operatore } = await supabase
    .from("operatori")
    .select("id, attivo")
    .eq("id", operatoreId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!operatore) return { ok: false, errore: "Operatore non trovato." };
  if (!operatore.attivo) return { ok: false, errore: "Questo operatore non è più disponibile." };

  // Servizi consecutivi (punto 12): l'operatore deve saper erogare OGNI
  // servizio della catena, non solo il primo -- stessa regola già applicata
  // dal motore puro in calcolaSlotServiziConsecutivi, replicata qui perché la
  // scrittura passa da una funzione diversa (questa) da quella di sola
  // lettura (trovaSlotEContestoTenant).
  const servizioIds = Array.isArray(servizioId) ? servizioId : [servizioId];
  for (const id of servizioIds) {
    const { data: compatibile } = await supabase
      .from("operatori_servizi")
      .select("operatore_id")
      .eq("operatore_id", operatoreId)
      .eq("servizio_id", id)
      .maybeSingle();
    if (!compatibile) return { ok: false, errore: "Questo operatore non esegue il servizio richiesto." };
  }

  return { ok: true };
}

/**
 * Trova un cliente per telefono o lo crea.
 *
 * Il corpo vive in clienti.server.ts (17/09/2026): questa funzione viene
 * chiamata anche dal calendario della dashboard, quindi con il client
 * AUTENTICATO del titolare -- e dalla migrazione 0051 quel client su
 * `clienti` non ha piu' nessun permesso. Il `supabase` ricevuto qui non si
 * usa piu' per la rubrica: ci pensa il gateway col client admin, che pero'
 * il filtro sul tenant lo mette sempre (vedi il file).
 */
async function trovaOCreaCliente(
  _supabase: SupabaseClient,
  tenantId: string,
  nome: string | null,
  telefono: string,
  creatoDaAi: boolean,
  email?: string | null
): Promise<{ id: string } | { errore: string }> {
  return trovaOCreaClienteInRubrica(tenantId, { nome, telefono, creatoDaAi, email });
}

export interface CreaAppuntamentoParams {
  operatoreId: string;
  // Più di un id = servizi consecutivi (punto 12): stesso operatore, in
  // sequenza senza buchi, nell'ordine dato -- una riga `appuntamenti` per
  // servizio (schema invariato altrove, vedi migrazione 0025), collegate da
  // `gruppo_prenotazione_id`. Un solo id = comportamento identico a prima.
  servizioId: string | string[];
  inizio: Date;
  clienteNome?: string;
  clienteTelefono?: string;
  // Raccolta oggi solo dal flusso pubblico (FlussoPrenotazione.tsx) --
  // se presente, abilita l'email di conferma al cliente (vedi
  // src/lib/email/notifiche.server.ts) e viene salvata su clienti.email.
  clienteEmail?: string;
  // "manuale" = da dashboard (staff), "ai" = chat/WhatsApp AI, "pubblico" =
  // il cliente prenota da solo dalla pagina pubblica del salone senza
  // passare dall'AI (Fase 4) -- tre canali distinti, stessa unica funzione
  // di scrittura (punto 9 di CLAUDE.md).
  creatoDa: "manuale" | "ai" | "pubblico";
  note?: string;
}

/**
 * Controllo del tetto di prenotazioni mensili (solo Free = 60/mese, vedi
 * `src/lib/piani.ts` per il perché) -- count/head: non serve scaricare le
 * righe, solo il numero. Non riuscire a leggere piano/conteggio non deve mai
 * bloccare una prenotazione reale: fail-open, coerente con `piani.ts`.
 */
async function superatoTettoPrenotazioniMensile(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data: tenant, error: erroreTenant } = await supabase
    .from("tenants")
    .select("piano")
    .eq("id", tenantId)
    .single();
  if (erroreTenant || !tenant) return false;

  const limite = limiteMensilePrenotazioni(tenant.piano);
  if (limite === Infinity) return false;

  const adesso = new Date();
  const inizioMese = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), 1));
  const { count, error } = await supabase
    .from("appuntamenti")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", inizioMese.toISOString());
  if (error) return false;

  return (count ?? 0) >= limite;
}

// ---------------------------------------------------------------------
// Anti-abuso sul canale pubblico (Gruppo D punto 1 di PIANO.md, chiesto
// esplicitamente da Gabriel il 13/09/2026: "come evitiamo che il canale
// pubblico, senza nessun login, venga usato per riempire il calendario di un
// salone con prenotazioni finte?"). Prima di questo, l'unica difesa era il
// tetto mensile del piano Free (superatoTettoPrenotazioniMensile sopra) --
// che non protegge affatto un tenant a pagamento, e comunque non impedisce
// una raffica concentrata in pochi minuti.
//
// Stesso principio già applicato alla chat AI in ai/limiti.ts: anti-burst
// (lo stesso cliente non prenota due volte a raffica) + un tetto di volume
// sul canale pubblico in una finestra breve (uno script che ruota numeri di
// telefono diversi non aggira questo secondo controllo, a differenza del
// primo). Si applica SOLO a creatoDa === "pubblico": il canale "manuale"
// (dashboard, sempre dietro login) non ne ha bisogno, "ai" ha già i suoi
// propri limiti dedicati. Zero nuove tabelle/migrazioni: entrambi i
// controlli leggono `created_at`/`creato_da`, colonne che esistono già su
// "appuntamenti" e "lista_attesa" fin dalla migrazione 0001/0013.
//
// Fail-open ovunque (stesso principio di superatoTettoPrenotazioniMensile):
// un errore nel CONTROLLO anti-abuso non deve mai far sembrare fallita una
// prenotazione vera.
// ---------------------------------------------------------------------

// Un vero cliente non prenota due volte a distanza di pochi secondi dalla
// stessa pagina -- una cadenza più fitta è quasi certamente un doppio invio
// accidentale o uno script, non una persona che sceglie di nuovo servizio e
// orario a mano.
const INTERVALLO_MINIMO_MS_STESSO_TELEFONO_PUBBLICO = 20_000;
// Rivisto il 14/09/2026 (osservazione di Gabriel: il valore originale di 8
// rischiava di bloccare clienti VERI durante un picco di richieste
// legittime, es. dopo un post social o una promozione -- esattamente il
// momento in cui un salone ha più bisogno che le prenotazioni arrivino, non
// meno). Da quando esistono anche il campo trappola e il tempo minimo di
// compilazione (`src/lib/anti-bot.ts`, controllati PRIMA di questo, in
// s/[slug]/azioni.ts), la maggior parte dei bot viene già fermata senza
// nessun rischio di falso positivo: questo tetto resta solo come ultima
// rete di sicurezza contro un attacco vero e proprio, quindi può stare più
// alto. Restano numeri di partenza, facili da cambiare (stessa nota onesta
// di ai/limiti.ts).
const FINESTRA_MS_VOLUME_PUBBLICO = 10 * 60_000;
const LIMITE_VOLUME_PUBBLICO_PER_FINESTRA = 25;

async function contaRecentiCanalePubblico(
  supabase: SupabaseClient,
  tabella: "appuntamenti" | "lista_attesa",
  tenantId: string,
  daData: Date
): Promise<number> {
  const { count, error } = await supabase
    .from(tabella)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("creato_da", "pubblico")
    .gte("created_at", daData.toISOString());
  if (error) return 0; // fail-open: un errore qui non deve mai bloccare una prenotazione vera
  return count ?? 0;
}

async function volumePubblicoTroppoAlto(
  supabase: SupabaseClient,
  tabella: "appuntamenti" | "lista_attesa",
  tenantId: string
): Promise<boolean> {
  const daData = new Date(Date.now() - FINESTRA_MS_VOLUME_PUBBLICO);
  const conteggio = await contaRecentiCanalePubblico(supabase, tabella, tenantId, daData);
  return conteggio >= LIMITE_VOLUME_PUBBLICO_PER_FINESTRA;
}

/**
 * true se questo stesso numero di telefono ha già un appuntamento pubblico
 * troppo recente per QUESTO tenant. Query in due passi (cliente poi
 * appuntamento) invece di un join: `trovaOCreaCliente` non è ancora stato
 * chiamato a questo punto (di proposito -- se il controllo blocca, meglio
 * non aver già scritto un cliente nuovo per niente), quindi qui si legge
 * solo, senza mai creare nulla.
 */
async function stessoTelefonoTroppoRecentePubblico(
  supabase: SupabaseClient,
  tenantId: string,
  telefono: string
): Promise<boolean> {
  const cliente = await trovaClientePerTelefono(tenantId, telefono);
  if (!cliente) return false; // primo appuntamento di questo cliente: non può essere "troppo recente"

  const { data: ultimo } = await supabase
    .from("appuntamenti")
    .select("created_at")
    .eq("tenant_id", tenantId)
    .eq("cliente_id", cliente.id)
    .eq("creato_da", "pubblico")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ultimo) return false;
  return Date.now() - new Date(ultimo.created_at).getTime() < INTERVALLO_MINIMO_MS_STESSO_TELEFONO_PUBBLICO;
}

/**
 * Crea un appuntamento con la doppia difesa anti-conflitto: controllo
 * applicativo qui (messaggio chiaro), vincolo `niente_sovrapposizioni` a
 * livello Postgres come rete di sicurezza finale contro le race condition.
 */
export async function creaAppuntamentoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  params: CreaAppuntamentoParams
): Promise<RisultatoScrittura<{ appuntamentoId: string }>> {
  if (await superatoTettoPrenotazioniMensile(supabase, tenantId)) {
    return {
      ok: false,
      errore:
        "Limite di prenotazioni del piano Free raggiunto per questo mese. Passa a un piano superiore per prenotazioni illimitate.",
    };
  }

  if (params.creatoDa === "pubblico") {
    if (await volumePubblicoTroppoAlto(supabase, "appuntamenti", tenantId)) {
      return {
        ok: false,
        errore: "Troppe prenotazioni in poco tempo per questa attività. Riprova tra qualche minuto o contattala direttamente.",
      };
    }
    if (params.clienteTelefono && (await stessoTelefonoTroppoRecentePubblico(supabase, tenantId, params.clienteTelefono))) {
      return {
        ok: false,
        errore: "Hai appena effettuato una prenotazione. Attendi qualche istante prima di riprovare.",
      };
    }
  }

  const servizioIds = Array.isArray(params.servizioId) ? params.servizioId : [params.servizioId];
  if (servizioIds.length === 0) return { ok: false, errore: "Nessun servizio specificato." };

  const servizi = await caricaServizi(supabase, tenantId, servizioIds);
  if (servizi.length !== servizioIds.length) return { ok: false, errore: "Servizio non trovato." };
  const durataPerServizio = new Map(servizi.map((s) => [s.id, s.durataMinuti]));

  const operatoreCompatibile = await verificaOperatoreCompatibile(supabase, tenantId, params.operatoreId, servizioIds);
  if (!operatoreCompatibile.ok) return operatoreCompatibile;

  // Durata sommata in spazio pseudo-UTC (timezone-invariante: è
  // un'aritmetica su millisecondi, non su ore civili) -- `fine` resta
  // pseudo qui, coerente con `params.inizio` e con verificaConflittoTenant
  // (che converte in reale internamente). Solo appena prima di scrivere su
  // Postgres (sotto) i due vengono convertiti nell'istante reale. Per i
  // servizi consecutivi il conflitto si verifica sull'intero blocco (dal
  // primo servizio all'ultimo), non riga per riga -- stesso principio del
  // motore puro (calcolaSlotServiziConsecutivi tratta la catena come un
  // unico slot con un operatore libero ininterrottamente).
  const durataTotaleMinuti = servizioIds.reduce((somma, id) => somma + (durataPerServizio.get(id) ?? 0), 0);
  const fine = new Date(params.inizio.getTime() + durataTotaleMinuti * 60_000);

  const conflitto = await verificaConflittoTenant(supabase, tenantId, {
    inizio: params.inizio,
    fine,
    operatoreId: params.operatoreId,
  });
  if (conflitto) {
    return {
      ok: false,
      errore: "Questo operatore ha già un appuntamento in quell'orario. Scegli un altro slot.",
    };
  }

  let clienteId: string | null = null;
  if (params.clienteTelefono) {
    const risultato = await trovaOCreaCliente(
      supabase,
      tenantId,
      params.clienteNome ?? null,
      params.clienteTelefono,
      params.creatoDa === "ai",
      params.clienteEmail ?? null
    );
    if ("errore" in risultato) return { ok: false, errore: risultato.errore };
    clienteId = risultato.id;
  }

  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);

  // Una riga `appuntamenti` per servizio, in sequenza senza buchi
  // nell'ordine dato da chi chiama (l'ordine con cui il cliente li ha
  // chiesti, non riordinato qui). Un solo servizio = esattamente il
  // comportamento di sempre (gruppo_prenotazione_id resta null, una sola
  // riga). Nessuna vera transazione multi-riga a livello Postgres qui (il
  // client Supabase via PostgREST non la espone): se una riga successiva
  // fallisce (es. race condition intercettata dal vincolo
  // niente_sovrapposizioni), le righe già scritte di questo stesso gruppo
  // vengono cancellate a mano prima di restituire l'errore, così non resta
  // mai una catena parziale/rotta in calendario.
  const gruppoId = servizioIds.length > 1 ? crypto.randomUUID() : null;
  const idRigheCreate: string[] = [];
  let cursoreMinuti = 0;

  for (const servizioId of servizioIds) {
    const durataMinuti = durataPerServizio.get(servizioId) ?? 0;
    const inizioServizio = new Date(params.inizio.getTime() + cursoreMinuti * 60_000);
    const fineServizio = new Date(inizioServizio.getTime() + durataMinuti * 60_000);
    cursoreMinuti += durataMinuti;

    const { data: appuntamento, error } = await supabase
      .from("appuntamenti")
      .insert({
        tenant_id: tenantId,
        operatore_id: params.operatoreId,
        servizio_id: servizioId,
        cliente_id: clienteId,
        inizio: pseudoUtcAReale(inizioServizio, fusoOrario).toISOString(),
        fine: pseudoUtcAReale(fineServizio, fusoOrario).toISOString(),
        stato: "confermato",
        creato_da: params.creatoDa,
        note: params.note ?? null,
        gruppo_prenotazione_id: gruppoId,
      })
      .select("id")
      .single();

    if (error) {
      if (idRigheCreate.length > 0) {
        await supabase.from("appuntamenti").delete().in("id", idRigheCreate);
      }
      // 23P01 = exclusion_violation: il vincolo "niente_sovrapposizioni" ha
      // bloccato una race condition sfuggita al controllo applicativo sopra.
      if (error.code === "23P01") {
        return {
          ok: false,
          errore: "Questo slot è appena stato occupato da un altro appuntamento. Scegli un altro orario.",
        };
      }
      return { ok: false, errore: `Errore salvando l'appuntamento: ${error.message}` };
    }

    idRigheCreate.push(appuntamento.id);
  }

  // Notifiche email (Fase 6, Gruppo B-bis #1): l'appuntamento è già scritto
  // con successo qui sopra -- fail-open totale, un problema di invio non
  // deve mai far tornare questa funzione come se la prenotazione fosse
  // fallita (la funzione stessa non lancia mai, il try/catch qui è solo
  // difesa in profondità). Per servizi consecutivi: una notifica per riga
  // (una per servizio della catena), non una sola email cumulativa -- scelta
  // di scope deliberata per non toccare il sistema di notifiche in questo
  // giro (vedi DECISIONS.md), il cliente riceve più email invece di una,
  // ognuna corretta sul proprio servizio/orario.
  for (const id of idRigheCreate) {
    try {
      await inviaNotificheNuovoAppuntamento(tenantId, id);
    } catch (erroreNotifica) {
      console.error("[email] Errore inatteso propagato dalle notifiche di nuovo appuntamento:", erroreNotifica);
    }
  }

  // Raccolta recensioni post-appuntamento (Fase 3, 16/09/2026): programmata
  // qui, non dentro le notifiche sopra, perché riguarda l'INTERO
  // appuntamento/catena di servizi consecutivi (una recensione per
  // appuntamento, non una per servizio) -- una sola richiesta ancorata alla
  // fine reale dell'ultimo servizio della catena (`fine`, calcolato sopra),
  // sulla prima riga del gruppo (stesso `appuntamentoId` restituito al
  // chiamante). Fail-open già garantito dentro programmaRichiestaRecensione
  // stessa: un problema qui non deve mai far sembrare fallita questa
  // prenotazione già scritta con successo.
  await programmaRichiestaRecensione(tenantId, idRigheCreate[0], pseudoUtcAReale(fine, fusoOrario));

  return { ok: true, appuntamentoId: idRigheCreate[0] };
}

export interface ModificaAppuntamentoParams {
  operatoreId: string;
  inizio: Date;
  // Solo per lo spostamento self-service del cliente (gestisci/[id]/azioni.ts,
  // Fase 4): incrementa `spostamenti_effettuati`, il contatore usato dal
  // limite anti-abuso "massimo 1 spostamento online" (vedi
  // finestra-spostamento.ts). Di proposito un flag esplicito e non il
  // comportamento di default: dashboard e AI possono spostare un
  // appuntamento tutte le volte che serve (è il titolare/l'AI per suo conto
  // a deciderlo, non un cliente anonimo da un link), quindi NON devono mai
  // consumare il tetto pensato solo per l'abuso lato cliente.
  incrementaSpostamentiEffettuati?: boolean;
}

export async function modificaAppuntamentoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  appuntamentoId: string,
  params: ModificaAppuntamentoParams
): Promise<RisultatoScrittura> {
  const { data: appuntamentoAttuale } = await supabase
    .from("appuntamenti")
    .select("servizio_id, spostamenti_effettuati")
    .eq("id", appuntamentoId)
    .eq("tenant_id", tenantId)
    .single();
  if (!appuntamentoAttuale) return { ok: false, errore: "Appuntamento non trovato." };

  const { data: servizio } = await supabase
    .from("servizi")
    .select("durata_minuti")
    .eq("id", appuntamentoAttuale.servizio_id)
    .single();
  if (!servizio) return { ok: false, errore: "Servizio dell'appuntamento non trovato." };

  // Stesso controllo di creaAppuntamentoTenant (vedi commento su
  // verificaOperatoreCompatibile): spostare un appuntamento su un nuovo
  // operatore ha lo stesso rischio di isolamento multi-tenant di crearlo.
  const operatoreCompatibile = await verificaOperatoreCompatibile(
    supabase,
    tenantId,
    params.operatoreId,
    appuntamentoAttuale.servizio_id
  );
  if (!operatoreCompatibile.ok) return operatoreCompatibile;

  const fine = new Date(params.inizio.getTime() + servizio.durata_minuti * 60_000);

  const conflitto = await verificaConflittoTenant(supabase, tenantId, {
    inizio: params.inizio,
    fine,
    operatoreId: params.operatoreId,
    ignoraAppuntamentoId: appuntamentoId,
  });
  if (conflitto) {
    return {
      ok: false,
      errore: "Questo operatore ha già un appuntamento in quell'orario. Scegli un altro slot.",
    };
  }

  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
  const { error } = await supabase
    .from("appuntamenti")
    .update({
      operatore_id: params.operatoreId,
      inizio: pseudoUtcAReale(params.inizio, fusoOrario).toISOString(),
      fine: pseudoUtcAReale(fine, fusoOrario).toISOString(),
      ...(params.incrementaSpostamentiEffettuati
        ? { spostamenti_effettuati: (appuntamentoAttuale.spostamenti_effettuati ?? 0) + 1 }
        : {}),
    })
    .eq("id", appuntamentoId)
    .eq("tenant_id", tenantId);

  if (error) {
    if (error.code === "23P01") {
      return {
        ok: false,
        errore: "Questo slot è appena stato occupato da un altro appuntamento. Scegli un altro orario.",
      };
    }
    return { ok: false, errore: `Errore spostando l'appuntamento: ${error.message}` };
  }

  return { ok: true };
}

export interface ListaAttesaAvvisata {
  id: string;
  clienteNome: string | null;
  clienteTelefono: string;
}

/**
 * Lista d'attesa automatica alla cancellazione (Fase 6, PIANO.md Gruppo B
 * punto 3): dopo aver cancellato l'appuntamento, cerca il primo cliente in
 * coda (FIFO su created_at) per lo STESSO servizio che accetta anche questo
 * operatore ("operatore_id" null in lista_attesa = va bene qualunque) e
 * questo giorno ("data_preferita" null = va bene qualunque giorno). Nessuna
 * notifica diretta al cliente qui (zero provider email/SMS oggi, vedi
 * PIANO.md "Gruppo B-bis" punto 1): la riga passa solo a stato "proposto",
 * il titolare la vede in /dashboard/lista-attesa e contatta il cliente a
 * mano. Fail-open per qualunque errore qui dentro: una lista d'attesa che
 * non risponde non deve MAI far fallire la cancellazione vera, che è già
 * andata a buon fine quando questa funzione viene chiamata.
 */
/**
 * Contatta subito il cliente proposto (Fase 1, 14/09/2026 -- decisione con
 * Gabriel: toggle unico per tenant, default manuale, disponibile Growth in
 * su, stessa email->SMS fallback usata per le notifiche di prenotazione).
 * Fail-open totale in un try/catch interno separato: un problema qui non
 * deve mai far sparire il match già scritto sopra (che il titolare deve
 * comunque vedere in dashboard anche se il contatto automatico fallisce).
 */
async function contattaClienteListaAttesaSeAutomatico(
  supabase: SupabaseClient,
  tenantId: string,
  voce: { clienteNome: string | null; clienteTelefono: string; clienteEmail: string | null },
  servizioId: string,
  inizioRealeIso: string,
  fusoOrario: string
): Promise<void> {
  try {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nome, piano, lista_attesa_contatto_automatico")
      .eq("id", tenantId)
      .single();
    if (!tenant || !tenant.lista_attesa_contatto_automatico || !pianoHaListaAttesaAutomatica(tenant.piano)) return;

    const { data: servizio } = await supabase.from("servizi").select("nome").eq("id", servizioId).single();
    const nomeServizio = servizio?.nome ?? "il servizio richiesto";
    const nomeCliente = voce.clienteNome ?? "Cliente";
    const quando = formattaOrario(new Date(inizioRealeIso), fusoOrario);
    const base = await urlBaseSito();
    const rigaPrenota = base ? `<p><a href="${base}">Prenota subito qui</a></p>` : "";

    if (voce.clienteEmail) {
      await inviaEmail({
        a: voce.clienteEmail,
        oggetto: `Si è liberato un posto - ${tenant.nome}`,
        nomeMittente: tenant.nome,
        html: `
          <p>Ciao ${escapeHtml(nomeCliente)},</p>
          <p>si è liberato un posto per <strong>${escapeHtml(nomeServizio)}</strong> da ${escapeHtml(tenant.nome)}, ${quando}.</p>
          <p>Il posto va a chi conferma per primo -- contattaci o prenota direttamente.</p>
          ${rigaPrenota}
        `,
      });
    } else if (voce.clienteTelefono) {
      await inviaSmsSeInclusoNelPiano(
        supabase,
        tenantId,
        tenant.piano,
        voce.clienteTelefono,
        `${tenant.nome}: si è liberato un posto per ${nomeServizio}, ${quando}. Contattaci per confermare, il posto va a chi risponde per primo.`
      );
    }
  } catch (errore) {
    console.error("[lista-attesa] Errore nel contatto automatico del cliente:", errore);
  }
}

async function trovaEAvvisaListaAttesa(
  supabase: SupabaseClient,
  tenantId: string,
  appuntamentoCancellato: {
    servizio_id?: string | null;
    operatore_id?: string | null;
    inizio?: string | null;
  }
): Promise<ListaAttesaAvvisata | null> {
  const { servizio_id: servizioId, operatore_id: operatoreId, inizio } = appuntamentoCancellato;
  // I punti di uscita qui sotto dicono chi sono stati (18/09/2026): prima
  // ritornavano tutti null indistinguibili, e una cancellazione che non
  // avvisava nessuno era impossibile da spiegare da fuori.
  if (!servizioId || !operatoreId || !inizio) {
    console.error("[lista-attesa] esco subito: dati mancanti sull'appuntamento cancellato", {
      servizioId,
      operatoreId,
      inizio,
    });
    return null;
  }

  try {
    const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
    // "Giorno civile" dello slot liberato, nella stessa convenzione con cui
    // viene salvata data_preferita (colonna "date", scelta dal cliente/AI
    // guardando un calendario -- mai un istante reale).
    const giornoLiberatoYMD = realeAPseudoUtc(new Date(inizio), fusoOrario).toISOString().slice(0, 10);

    const { data: candidati, error } = await supabase
      .from("lista_attesa")
      .select("id, cliente_nome, cliente_telefono, cliente_email, operatore_id, data_preferita")
      .eq("tenant_id", tenantId)
      .eq("servizio_id", servizioId)
      .eq("stato", "in_attesa")
      .order("created_at", { ascending: true });
    if (error || !candidati) {
      console.error("[lista-attesa] query dei candidati fallita", { errore: error?.message });
      return null;
    }

    // Filtro in JS, non nella query: l'OR "operatore_id è null OPPURE è
    // questo" (idem per data_preferita) è più chiaro qui che con `.or(...)`
    // di PostgREST, e la lista per un singolo tenant/servizio resta piccola.
    const match = (
      candidati as {
        id: string;
        cliente_nome: string | null;
        cliente_telefono: string;
        cliente_email: string | null;
        operatore_id: string | null;
        data_preferita: string | null;
      }[]
    ).find(
      (c) =>
        (c.operatore_id === null || c.operatore_id === operatoreId) &&
        (c.data_preferita === null || c.data_preferita === giornoLiberatoYMD)
    );
    // Nessun candidato compatibile e' il caso NORMALE -- la maggior parte
    // dei saloni non ha nessuno in lista d'attesa -- quindi qui non si
    // logga niente: sarebbe una riga di rumore a ogni cancellazione.
    if (!match) return null;

    const { error: erroreUpdate } = await supabase
      .from("lista_attesa")
      .update({
        stato: "proposto",
        slot_liberato_inizio: inizio,
        slot_liberato_operatore_id: operatoreId,
      })
      .eq("id", match.id)
      .eq("tenant_id", tenantId);
    if (erroreUpdate) {
      console.error("[lista-attesa] update a 'proposto' fallito", { errore: erroreUpdate.message });
      return null;
    }

    await contattaClienteListaAttesaSeAutomatico(
      supabase,
      tenantId,
      { clienteNome: match.cliente_nome, clienteTelefono: match.cliente_telefono, clienteEmail: match.cliente_email },
      servizioId,
      inizio,
      fusoOrario
    );

    return { id: match.id, clienteNome: match.cliente_nome, clienteTelefono: match.cliente_telefono };
  } catch (errore) {
    // Il fail-open resta (un problema qui non deve impedire una
    // cancellazione), ma smette di essere MUTO: prima questo catch
    // ingoiava la causa e da fuori il match sembrava semplicemente non
    // esistere. Se il candidato resta "in_attesa" senza nessuna delle
    // righe di log qui sopra, l'eccezione e' finita qui.
    console.error("[lista-attesa] eccezione durante il match", errore);
    return null;
  }
}

export async function cancellaAppuntamentoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  appuntamentoId: string
): Promise<RisultatoScrittura<{ listaAttesaAvvisata?: ListaAttesaAvvisata }>> {
  // .select(...) dopo .update() fa tornare le righe modificate -- se l'array
  // è vuoto, l'id non esisteva (o non era di questo tenant): più affidabile
  // di un conteggio HEAD, che qui su questa versione di postgrest-js è
  // disponibile solo sul .select() iniziale, non dopo update. servizio_id/
  // operatore_id/inizio servono SOLO per il controllo lista d'attesa sotto.
  const { data, error } = await supabase
    .from("appuntamenti")
    .update({ stato: "cancellato" })
    .eq("id", appuntamentoId)
    .eq("tenant_id", tenantId)
    .select("id, servizio_id, operatore_id, inizio");

  if (error) return { ok: false, errore: `Errore cancellando l'appuntamento: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, errore: "Appuntamento non trovato." };

  const listaAttesaAvvisata = await trovaEAvvisaListaAttesa(supabase, tenantId, data[0]);
  return listaAttesaAvvisata ? { ok: true, listaAttesaAvvisata } : { ok: true };
}

export interface AggiungiListaAttesaParams {
  servizioId: string;
  operatoreId?: string; // assente = va bene qualunque operatore
  clienteNome?: string;
  clienteTelefono: string;
  // Raccolta oggi solo dal flusso pubblico (vedi iscrivitiListaAttesaPubblico
  // in src/app/s/[slug]/azioni.ts) -- se presente, abilita il contatto
  // automatico via email quando si libera un posto (Fase 1, contatto
  // automatico lista d'attesa, 14/09/2026, vedi trovaEAvvisaListaAttesa
  // sotto). Dashboard/AI non la raccolgono ancora.
  clienteEmail?: string;
  dataPreferitaYMD?: string; // "YYYY-MM-DD", assente = va bene qualunque giorno
  note?: string;
  creatoDa: "manuale" | "ai" | "pubblico";
}

/** Iscrive un cliente alla lista d'attesa per un servizio (Fase 6). */
export async function aggiungiListaAttesaTenant(
  supabase: SupabaseClient,
  tenantId: string,
  params: AggiungiListaAttesaParams
): Promise<RisultatoScrittura<{ listaAttesaId: string }>> {
  // Stesso tetto di volume del canale pubblico usato per gli appuntamenti
  // sopra (vedi commento lì): niente anti-burst per telefono qui, una lista
  // d'attesa finta è meno dannosa di un appuntamento finto (non occupa uno
  // slot reale), ma vale comunque proteggerla da uno script che la riempie.
  if (params.creatoDa === "pubblico" && (await volumePubblicoTroppoAlto(supabase, "lista_attesa", tenantId))) {
    return {
      ok: false,
      errore: "Troppe richieste in poco tempo per questa attività. Riprova tra qualche minuto o contattala direttamente.",
    };
  }

  // Difesa in profondità (bug UX dal vivo 15/09/2026, vedi DECISIONS.md):
  // una data_preferita che cade in un giorno di chiusura settimanale non ha
  // senso in lista d'attesa -- nessuno slot si libererà mai lì, a differenza
  // di un giorno aperto ma pieno. Le singole UI (widget AI, dashboard) sono
  // già state istruite/vincolate a non proporlo, ma questo controllo qui è
  // l'unica vera fonte di verità: vale per tutti e tre i canali
  // (manuale/ai/pubblico) qualunque cosa la UI a monte lasci passare.
  if (params.dataPreferitaYMD) {
    const { data: orariRows, error: erroreOrari } = await supabase
      .from("orari_apertura")
      .select("giorno_settimana, chiuso, apertura, chiusura, pausa_inizio, pausa_fine")
      .eq("tenant_id", tenantId);
    if (erroreOrari) return { ok: false, errore: `Errore verificando gli orari: ${erroreOrari.message}` };

    const orari: OrarioGiorno[] = (orariRows ?? []).map((r) => ({
      giornoSettimana: r.giorno_settimana,
      chiuso: r.chiuso,
      apertura: troncaOra(r.apertura),
      chiusura: troncaOra(r.chiusura),
      pausaInizio: troncaOra(r.pausa_inizio),
      pausaFine: troncaOra(r.pausa_fine),
    }));
    const dataPreferita = new Date(`${params.dataPreferitaYMD}T00:00:00Z`);
    if (!Number.isNaN(dataPreferita.getTime()) && giornoChiuso(orari, dataPreferita)) {
      return {
        ok: false,
        errore: "L'attività è chiusa in quel giorno della settimana: non ha senso mettersi in lista d'attesa per quella data precisa, nessuno slot si libererà mai lì. Scegli un'altra data (o lascia la data libera per essere ricontattati per qualunque giorno).",
      };
    }
  }

  const { data: servizio } = await supabase
    .from("servizi")
    .select("id")
    .eq("id", params.servizioId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!servizio) return { ok: false, errore: "Servizio non trovato." };

  const { data, error } = await supabase
    .from("lista_attesa")
    .insert({
      tenant_id: tenantId,
      servizio_id: params.servizioId,
      operatore_id: params.operatoreId ?? null,
      cliente_nome: params.clienteNome ?? null,
      cliente_telefono: params.clienteTelefono,
      cliente_email: params.clienteEmail ?? null,
      data_preferita: params.dataPreferitaYMD ?? null,
      note: params.note ?? null,
      creato_da: params.creatoDa,
    })
    .select("id")
    .single();

  if (error) return { ok: false, errore: `Errore aggiungendo alla lista d'attesa: ${error.message}` };
  return { ok: true, listaAttesaId: data.id };
}
