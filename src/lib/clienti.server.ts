import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { filtroRicercaClienti } from "@/lib/ricerca";

/**
 * L'UNICO posto da cui si leggono e si scrivono i clienti di un salone.
 *
 * Nasce da una falla dichiarata nel PIANO e mai chiusa: uno staff legge
 * legittimamente i clienti dentro il prodotto, quindi nessuna policy RLS
 * puo' distinguere "guardarne uno" da "scaricarli tutti". In SQL quella
 * differenza non e' esprimibile. L'unico modo di chiuderla e' togliere ad
 * `authenticated` il permesso di leggere la tabella e far passare ogni
 * lettura da qui, dove il controllo lo fa il codice.
 *
 * ----------------------------------------------------------------------
 * IL PERICOLO DI QUESTO FILE, detto chiaramente
 *
 * Usando il client admin si perde la rete di RLS: se una query qui dentro
 * dimenticasse il filtro sul tenant, un salone vedrebbe i clienti di un
 * altro, e nessuno strato sotto lo fermerebbe. E' un rischio REALE, ed e'
 * il motivo per cui tutte le query stanno in un file solo invece che
 * sparse per la dashboard: cosi' il filtro si scrive una volta, si legge in
 * una schermata, e un test puo' verificarlo su ogni funzione.
 *
 * Due regole, e valgono anche per chi aggiungera' funzioni qui domani:
 *   1. `tenantId` e' sempre il PRIMO parametro, e passa da `esigiTenant`.
 *   2. Ogni query ha `.eq("tenant_id", tenantId)`. Sempre. Anche quando
 *      sembra ridondante perche' si filtra gia' per id.
 *
 * Il client si puo' passare dall'esterno solo per i test: in produzione e'
 * sempre quello admin creato qui.
 */

const CAMPI_ELENCO = "id, nome, telefono, email, tag, creato_da_ai, created_at";
const CAMPI_EXPORT = "id, nome, telefono, email, tag, creato_da_ai, created_at";
const CAMPI_SCHEDA = "id, nome, telefono, email, note, tag, data_nascita, creato_da_ai, created_at";

function db(client?: SupabaseClient): SupabaseClient {
  return client ?? creaClientAdmin();
}

/**
 * Un tenantId vuoto qui sarebbe la peggiore delle query: senza filtro
 * tornerebbe la rubrica di tutti i saloni. Meglio un errore rumoroso che
 * un risultato sbagliato.
 */
function esigiTenant(tenantId: string): string {
  if (typeof tenantId !== "string" || tenantId.trim() === "") {
    throw new Error("clienti.server: tenantId mancante -- nessuna query sui clienti puo' partire senza.");
  }
  return tenantId;
}

export interface ClienteElenco {
  id: string;
  nome: string | null;
  telefono: string | null;
  email: string | null;
  tag: string[] | null;
  creato_da_ai: boolean | null;
  created_at: string;
}

export interface ClienteScheda extends ClienteElenco {
  note: string | null;
  data_nascita: string | null;
}

export async function elencaClienti(
  tenantId: string,
  opzioni: { termine?: string | null; perExport?: boolean } = {},
  client?: SupabaseClient
): Promise<{ clienti: ClienteElenco[]; errore: string | null }> {
  esigiTenant(tenantId);

  let query = db(client)
    .from("clienti")
    .select(opzioni.perExport ? CAMPI_EXPORT : CAMPI_ELENCO)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  // Il termine arriva gia' ripulito da `terminoRicercaSicuro`: qui non si
  // ripulisce una seconda volta, si da' per scontato che chi chiama lo
  // abbia fatto (lo fanno entrambi i chiamanti, pagina ed export).
  if (opzioni.termine) query = query.or(filtroRicercaClienti(opzioni.termine));

  const { data, error } = await query;
  if (error) return { clienti: [], errore: error.message };
  return { clienti: (data ?? []) as unknown as ClienteElenco[], errore: null };
}

export async function caricaCliente(
  tenantId: string,
  clienteId: string,
  client?: SupabaseClient
): Promise<ClienteScheda | null> {
  esigiTenant(tenantId);

  const { data } = await db(client)
    .from("clienti")
    .select(CAMPI_SCHEDA)
    .eq("id", clienteId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return (data as unknown as ClienteScheda) ?? null;
}

export async function aggiornaCliente(
  tenantId: string,
  clienteId: string,
  campi: Record<string, unknown>,
  client?: SupabaseClient
): Promise<{ errore: string | null }> {
  esigiTenant(tenantId);

  const { error } = await db(client)
    .from("clienti")
    .update(campi)
    .eq("id", clienteId)
    .eq("tenant_id", tenantId);

  return { errore: error?.message ?? null };
}

/**
 * Inserisce piu' clienti in una volta (import della rubrica, Fase 6ter).
 *
 * Una insert sola invece di trecento: il percorso e' quello di chi sta
 * guardando una barra di avanzamento, e trecento andate e ritorni sarebbero
 * un minuto di attesa invece di un secondo.
 *
 * `creato_da_ai` resta false anche quando le righe sono passate dal modello:
 * quel campo dice "questo cliente e' nato da una conversazione con
 * l'assistente", e un import fatto dal titolare non lo e'. Usarlo per due
 * significati diversi renderebbe inutili le metriche che ci stanno sopra.
 */
export async function creaClientiInBlocco(
  tenantId: string,
  clienti: { nome: string | null; telefono: string; email: string | null; note: string | null }[],
  client?: SupabaseClient
): Promise<{ creati: number; errore: string | null }> {
  esigiTenant(tenantId);
  if (clienti.length === 0) return { creati: 0, errore: null };

  const righe = clienti.map((c) => ({
    tenant_id: tenantId,
    nome: c.nome,
    telefono: c.telefono,
    email: c.email,
    note: c.note,
    creato_da_ai: false,
  }));

  const { data, error } = await db(client).from("clienti").insert(righe).select("id");
  if (error) return { creati: 0, errore: `Errore importando i clienti: ${error.message}` };
  return { creati: (data ?? []).length, errore: null };
}

export async function cancellaCliente(
  tenantId: string,
  clienteId: string,
  client?: SupabaseClient
): Promise<{ errore: string | null }> {
  esigiTenant(tenantId);

  const { error } = await db(client)
    .from("clienti")
    .delete()
    .eq("id", clienteId)
    .eq("tenant_id", tenantId);

  return { errore: error?.message ?? null };
}

/**
 * Per la card della dashboard: servono solo id e data di creazione.
 *
 * Lancia invece di restituire l'errore perche' e' quello che facevano gia'
 * i due chiamanti (metriche.server.ts e analytics.server.ts): una metrica
 * calcolata su una rubrica tornata a meta' non e' una metrica, e' un numero
 * sbagliato mostrato con sicurezza.
 */
export async function clientiPerMetriche(
  tenantId: string,
  client?: SupabaseClient
): Promise<{ id: string; created_at: string }[]> {
  esigiTenant(tenantId);

  const { data, error } = await db(client)
    .from("clienti")
    .select("id, created_at")
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`Errore caricando i clienti: ${error.message}`);
  return (data ?? []) as { id: string; created_at: string }[];
}

/** Per Analytics: serve solo quando ciascun cliente e' arrivato. */
export async function dateCreazioneClienti(
  tenantId: string,
  client?: SupabaseClient
): Promise<{ created_at: string }[]> {
  esigiTenant(tenantId);

  const { data, error } = await db(client)
    .from("clienti")
    .select("created_at")
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`Errore caricando i clienti: ${error.message}`);
  return (data ?? []) as { created_at: string }[];
}

/**
 * I nomi (e i telefoni) dei clienti che compaiono dentro un'altra lista:
 * gli appuntamenti del giorno in calendario, le recensioni in dashboard.
 *
 * Prima erano un embed PostgREST (`clienti(nome, telefono)`) dentro la
 * query degli appuntamenti. Un embed e' comodo ma e' comunque una lettura
 * della tabella `clienti` fatta col JWT di chi guarda: tolto il permesso,
 * l'embed non torna piu' niente e la riga resta senza nome. Due query al
 * posto di una, e la rubrica resta chiusa.
 *
 * Gli id arrivano da righe gia' filtrate per tenant, ma il filtro si mette
 * lo stesso: e' la regola 2 di questo file, e qui la lista di id viene da
 * una query diversa, quindi fidarsi sarebbe fidarsi di un'altra query.
 */
export async function nomiClientiPerId(
  tenantId: string,
  ids: readonly (string | null | undefined)[],
  client?: SupabaseClient
): Promise<Map<string, { nome: string | null; telefono: string | null }>> {
  esigiTenant(tenantId);

  const distinti = [...new Set(ids.filter((id): id is string => typeof id === "string" && id !== ""))];
  const mappa = new Map<string, { nome: string | null; telefono: string | null }>();
  if (distinti.length === 0) return mappa;

  const { data } = await db(client)
    .from("clienti")
    .select("id, nome, telefono")
    .eq("tenant_id", tenantId)
    .in("id", distinti);

  for (const riga of (data ?? []) as { id: string; nome: string | null; telefono: string | null }[]) {
    mappa.set(riga.id, { nome: riga.nome, telefono: riga.telefono });
  }
  return mappa;
}

/** Il cliente con questo numero, se il salone ce l'ha gia' in rubrica. */
export async function trovaClientePerTelefono(
  tenantId: string,
  telefono: string,
  client?: SupabaseClient
): Promise<{ id: string; email: string | null } | null> {
  esigiTenant(tenantId);

  const { data } = await db(client)
    .from("clienti")
    .select("id, email")
    .eq("tenant_id", tenantId)
    .eq("telefono", telefono)
    .maybeSingle();

  return (data as unknown as { id: string; email: string | null }) ?? null;
}

/**
 * Trova un cliente per telefono o lo crea -- stesso cliente non duplicato
 * tra canali (stava in booking-engine.server.ts, e' arrivata qui quando
 * `clienti` e' diventata leggibile solo da questo file).
 *
 * Un'email nuova si aggiunge solo se il cliente non ne aveva gia' una: una
 * gia' presente puo' essere stata corretta a mano dal salone, e una
 * prenotazione non e' un buon motivo per sovrascriverla.
 */
export async function trovaOCreaCliente(
  tenantId: string,
  dati: { nome?: string | null; telefono: string; creatoDaAi: boolean; email?: string | null },
  client?: SupabaseClient
): Promise<{ id: string } | { errore: string }> {
  esigiTenant(tenantId);

  const esistente = await trovaClientePerTelefono(tenantId, dati.telefono, client);
  if (esistente) {
    if (dati.email && !esistente.email) {
      await aggiornaCliente(tenantId, esistente.id, { email: dati.email }, client);
    }
    return { id: esistente.id };
  }

  const { data, error } = await db(client)
    .from("clienti")
    .insert({
      tenant_id: tenantId,
      nome: dati.nome || null,
      telefono: dati.telefono,
      creato_da_ai: dati.creatoDaAi,
      email: dati.email || null,
    })
    .select("id")
    .single();

  if (error) return { errore: `Errore creando il cliente: ${error.message}` };
  return { id: (data as unknown as { id: string }).id };
}
