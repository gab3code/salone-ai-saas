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
import { limiteMensilePrenotazioni } from "@/lib/piani";
import { caricaImpegniEsterni } from "@/lib/calendario-esterno/collegamenti.server";
import { pseudoUtcAReale, realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";

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

  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
  // I confini del giorno sono calcolati in pseudo-UTC (coerenti con `da`/`a`,
  // che arrivano già in quella convenzione da chi chiama), poi convertiti in
  // istanti reali: SOLO da qui in giù si parla con il database (colonna
  // timestamptz) e con i calendari esterni, entrambi tempo reale.
  const inizioFinestraReale = pseudoUtcAReale(inizioGiornoUTC(da), fusoOrario);
  const fineFinestraReale = pseudoUtcAReale(fineGiornoUTC(a), fusoOrario);

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
      .gte("inizio", inizioFinestraReale.toISOString())
      .lte("inizio", fineFinestraReale.toISOString())
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

  return { orari, chiusure, operatori, appuntamenti: [...appuntamenti, ...impegniEsterni] };
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

  const { data: servizio } = await supabase
    .from("servizi")
    .select("durata_minuti")
    .eq("id", params.servizioId)
    .eq("tenant_id", tenantId)
    .single();
  if (!servizio) return { ok: false, errore: "Servizio non trovato." };

  // Durata sommata in spazio pseudo-UTC (timezone-invariante: è
  // un'aritmetica su millisecondi, non su ore civili) -- `fine` resta
  // pseudo qui, coerente con `params.inizio` e con verificaConflittoTenant
  // (che converte in reale internamente). Solo appena prima di scrivere su
  // Postgres (sotto) i due vengono convertiti nell'istante reale.
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

  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
  const { data: appuntamento, error } = await supabase
    .from("appuntamenti")
    .insert({
      tenant_id: tenantId,
      operatore_id: params.operatoreId,
      servizio_id: params.servizioId,
      cliente_id: clienteId,
      inizio: pseudoUtcAReale(params.inizio, fusoOrario).toISOString(),
      fine: pseudoUtcAReale(fine, fusoOrario).toISOString(),
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

  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
  const { error } = await supabase
    .from("appuntamenti")
    .update({
      operatore_id: params.operatoreId,
      inizio: pseudoUtcAReale(params.inizio, fusoOrario).toISOString(),
      fine: pseudoUtcAReale(fine, fusoOrario).toISOString(),
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
  if (!servizioId || !operatoreId || !inizio) return null;

  try {
    const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
    // "Giorno civile" dello slot liberato, nella stessa convenzione con cui
    // viene salvata data_preferita (colonna "date", scelta dal cliente/AI
    // guardando un calendario -- mai un istante reale).
    const giornoLiberatoYMD = realeAPseudoUtc(new Date(inizio), fusoOrario).toISOString().slice(0, 10);

    const { data: candidati, error } = await supabase
      .from("lista_attesa")
      .select("id, cliente_nome, cliente_telefono, operatore_id, data_preferita")
      .eq("tenant_id", tenantId)
      .eq("servizio_id", servizioId)
      .eq("stato", "in_attesa")
      .order("created_at", { ascending: true });
    if (error || !candidati) return null;

    // Filtro in JS, non nella query: l'OR "operatore_id è null OPPURE è
    // questo" (idem per data_preferita) è più chiaro qui che con `.or(...)`
    // di PostgREST, e la lista per un singolo tenant/servizio resta piccola.
    const match = (
      candidati as { id: string; cliente_nome: string | null; cliente_telefono: string; operatore_id: string | null; data_preferita: string | null }[]
    ).find(
      (c) =>
        (c.operatore_id === null || c.operatore_id === operatoreId) &&
        (c.data_preferita === null || c.data_preferita === giornoLiberatoYMD)
    );
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
    if (erroreUpdate) return null;

    return { id: match.id, clienteNome: match.cliente_nome, clienteTelefono: match.cliente_telefono };
  } catch {
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
  dataPreferitaYMD?: string; // "YYYY-MM-DD", assente = va bene qualunque giorno
  note?: string;
  creatoDa: "manuale" | "ai";
}

/** Iscrive un cliente alla lista d'attesa per un servizio (Fase 6). */
export async function aggiungiListaAttesaTenant(
  supabase: SupabaseClient,
  tenantId: string,
  params: AggiungiListaAttesaParams
): Promise<RisultatoScrittura<{ listaAttesaId: string }>> {
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
      data_preferita: params.dataPreferitaYMD ?? null,
      note: params.note ?? null,
      creato_da: params.creatoDa,
    })
    .select("id")
    .single();

  if (error) return { ok: false, errore: `Errore aggiungendo alla lista d'attesa: ${error.message}` };
  return { ok: true, listaAttesaId: data.id };
}
