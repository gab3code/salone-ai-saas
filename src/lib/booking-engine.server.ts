import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcolaSlotDisponibili,
  calcolaSlotServiziConsecutivi,
  verificaConflitto,
  type AppuntamentoEsistente,
  type Chiusura,
  type Operatore,
  type OrarioGiorno,
  type SlotDisponibile,
} from "@/lib/booking-engine";

/**
 * Livello di collegamento tra il motore puro (booking-engine.ts, già testato
 * in isolamento) e il database vero. Qui vivono SOLO le query e la
 * conversione dei dati -- zero logica di disponibilità, che resta
 * interamente nel file puro (stessa regola descritta lì: unica fonte di
 * verità, letta sia dal calendario manuale sia -- in Fase 2 -- dai tool
 * dell'AI).
 *
 * NOTA fuso orario (semplificazione consapevole per questa fase): tutte le
 * date/ore sono trattate come se l'ora del salone coincidesse con UTC (stesso
 * approccio già usato in booking-engine.ts con Date.UTC). Corretto solo per
 * saloni in un fuso orario che in quel momento coincide con UTC -- va risolto
 * con un campo fuso_orario su "tenants" prima della Fase 7 (vedi PIANO.md).
 */

/** "HH:MM:SS" (formato time di Postgres) -> "HH:MM" (formato atteso dal motore puro). */
function troncaOra(valore: string | null): string | undefined {
  return valore ? valore.slice(0, 5) : undefined;
}

// "YYYY-MM-DDTHH:MM"[":SS"], con o senza fuso esplicito -- usato per ogni
// orario che arriva da fuori (input utente della dashboard, input
// dell'AI): validazione RIGIDA del formato prima di toccare `new Date()`,
// perché il parser lenient di V8 accetta ed "interpreta" stringhe non-ISO
// senza senso invece di restituire NaN (es. `new Date("boh:00Z")` torna una
// data valida del 2000). Un formato sbagliato deve fallire in modo
// esplicito, mai produrre silenziosamente una data a caso. Nessun fuso
// esplicito indicato -> trattato come UTC, stessa semplificazione
// consapevole descritta sopra per tutto il resto del booking engine.
const FORMATO_ORARIO_SENZA_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const FORMATO_ORARIO_CON_FUSO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;

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

function inizioGiornoUTC(data: Date): Date {
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

function fineGiornoUTC(data: Date): Date {
  return new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 23, 59, 59, 999)
  );
}

export interface ContestoBooking {
  orari: OrarioGiorno[];
  chiusure: Chiusura[];
  operatori: Operatore[];
  appuntamenti: AppuntamentoEsistente[];
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

  const [orariRes, chiusureRes, operatoriRes, opServiziRes, appuntamentiRes] = await Promise.all([
    supabase.from("orari_apertura").select("*").eq("tenant_id", tenantId),
    supabase
      .from("chiusure")
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("data", daStr)
      .lte("data", aStr),
    supabase.from("operatori").select("id, attivo").eq("tenant_id", tenantId),
    // Nessun tenant_id diretto su operatori_servizi: RLS la isola comunque
    // tramite l'operatore collegato (vedi migrazione 0001).
    supabase.from("operatori_servizi").select("operatore_id, servizio_id"),
    supabase
      .from("appuntamenti")
      .select("operatore_id, inizio, fine, stato")
      .eq("tenant_id", tenantId)
      .gte("inizio", inizioGiornoUTC(da).toISOString())
      .lte("inizio", fineGiornoUTC(a).toISOString())
      .not("operatore_id", "is", null),
  ]);

  for (const [nome, res] of Object.entries({
    orari: orariRes,
    chiusure: chiusureRes,
    operatori: operatoriRes,
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

  const operatori: Operatore[] = (operatoriRes.data ?? []).map((r) => ({
    id: r.id,
    attivo: r.attivo,
    servizioIds: servizioIdsPerOperatore.get(r.id) ?? [],
  }));

  const appuntamenti: AppuntamentoEsistente[] = (appuntamentiRes.data ?? []).map((r) => ({
    operatoreId: r.operatore_id as string,
    inizio: new Date(r.inizio),
    fine: new Date(r.fine),
    stato: r.stato,
  }));

  return { orari, chiusure, operatori, appuntamenti };
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
  bufferMinuti?: number;
  passoMinuti?: number;
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
  if (params.servizioIds.length === 0) return [];

  const [contesto, servizi] = await Promise.all([
    caricaContestoBooking(supabase, tenantId, params.data, params.data),
    caricaServizi(supabase, tenantId, params.servizioIds),
  ]);

  if (servizi.length !== params.servizioIds.length) return []; // servizio inesistente/di un altro tenant

  const paramsBase = {
    data: params.data,
    operatoreId: params.operatoreId,
    operatori: contesto.operatori,
    orari: contesto.orari,
    chiusure: contesto.chiusure,
    appuntamentiEsistenti: contesto.appuntamenti,
    bufferMinuti: params.bufferMinuti,
    passoMinuti: params.passoMinuti,
  };

  if (servizi.length === 1) {
    return calcolaSlotDisponibili({ ...paramsBase, durataMinuti: servizi[0].durataMinuti, servizioId: servizi[0].id });
  }
  return calcolaSlotServiziConsecutivi(paramsBase, servizi);
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
    .gte("inizio", inizioGiornoUTC(params.inizio).toISOString())
    .lte("inizio", fineGiornoUTC(params.fine).toISOString());

  if (error) throw new Error(`Errore verificando conflitti: ${error.message}`);

  const appuntamentiRilevanti: AppuntamentoEsistente[] = (data ?? [])
    .filter((r) => r.id !== params.ignoraAppuntamentoId)
    .map((r) => ({
      operatoreId: r.operatore_id as string,
      inizio: new Date(r.inizio),
      fine: new Date(r.fine),
      stato: r.stato,
    }));

  return verificaConflitto(
    params.inizio,
    params.fine,
    params.operatoreId,
    appuntamentiRilevanti,
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

/** Trova un cliente per telefono o lo crea -- stesso cliente non duplicato tra canali. */
async function trovaOCreaCliente(
  supabase: SupabaseClient,
  tenantId: string,
  nome: string | null,
  telefono: string,
  creatoDaAi: boolean
): Promise<{ id: string } | { errore: string }> {
  const { data: esistente } = await supabase
    .from("clienti")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("telefono", telefono)
    .maybeSingle();

  if (esistente) return { id: esistente.id };

  const { data: nuovo, error } = await supabase
    .from("clienti")
    .insert({ tenant_id: tenantId, nome: nome || null, telefono, creato_da_ai: creatoDaAi })
    .select("id")
    .single();
  if (error) return { errore: `Errore creando il cliente: ${error.message}` };
  return { id: nuovo.id };
}

export interface CreaAppuntamentoParams {
  operatoreId: string;
  servizioId: string;
  inizio: Date;
  clienteNome?: string;
  clienteTelefono?: string;
  creatoDa: "manuale" | "ai";
  note?: string;
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
  const { data: servizio } = await supabase
    .from("servizi")
    .select("durata_minuti")
    .eq("id", params.servizioId)
    .eq("tenant_id", tenantId)
    .single();
  if (!servizio) return { ok: false, errore: "Servizio non trovato." };

  const fine = new Date(params.inizio.getTime() + servizio.durata_minuti * 60_000);

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
      params.creatoDa === "ai"
    );
    if ("errore" in risultato) return { ok: false, errore: risultato.errore };
    clienteId = risultato.id;
  }

  const { data: appuntamento, error } = await supabase
    .from("appuntamenti")
    .insert({
      tenant_id: tenantId,
      operatore_id: params.operatoreId,
      servizio_id: params.servizioId,
      cliente_id: clienteId,
      inizio: params.inizio.toISOString(),
      fine: fine.toISOString(),
      stato: "confermato",
      creato_da: params.creatoDa,
      note: params.note ?? null,
    })
    .select("id")
    .single();

  if (error) {
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

  return { ok: true, appuntamentoId: appuntamento.id };
}

export interface ModificaAppuntamentoParams {
  operatoreId: string;
  inizio: Date;
}

export async function modificaAppuntamentoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  appuntamentoId: string,
  params: ModificaAppuntamentoParams
): Promise<RisultatoScrittura> {
  const { data: appuntamentoAttuale } = await supabase
    .from("appuntamenti")
    .select("servizio_id")
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

  const { error } = await supabase
    .from("appuntamenti")
    .update({ operatore_id: params.operatoreId, inizio: params.inizio.toISOString(), fine: fine.toISOString() })
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

export async function cancellaAppuntamentoTenant(
  supabase: SupabaseClient,
  tenantId: string,
  appuntamentoId: string
): Promise<RisultatoScrittura> {
  // .select("id") dopo .update() fa tornare le righe modificate -- se
  // l'array è vuoto, l'id non esisteva (o non era di questo tenant): più
  // affidabile di un conteggio HEAD, che qui su questa versione di
  // postgrest-js è disponibile solo sul .select() iniziale, non dopo update.
  const { data, error } = await supabase
    .from("appuntamenti")
    .update({ stato: "cancellato" })
    .eq("id", appuntamentoId)
    .eq("tenant_id", tenantId)
    .select("id");

  if (error) return { ok: false, errore: `Errore cancellando l'appuntamento: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, errore: "Appuntamento non trovato." };
  return { ok: true };
}
