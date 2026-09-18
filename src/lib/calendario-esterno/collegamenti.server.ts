import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientAdmin } from "@/lib/supabase/admin";
import type { AppuntamentoEsistente } from "@/lib/booking-engine";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { estraiIntervalliOccupati } from "./ics";
import { recuperaIcsGrezzo, verificaCredenzialiCaldav } from "./caldav.server";
import { recuperaImpegniGoogle, rinnovaTokenGoogle } from "./google.server";
import { cifra, decifra } from "@/lib/cifratura";

/**
 * Livello DB per i collegamenti calendario esterni (Fase 6bis) -- stesso
 * ruolo che booking-engine.server.ts ha per gli appuntamenti: query e
 * conversione, zero logica di disponibilità qui (quella resta nel motore
 * puro, punto 9).
 *
 * DA 18/09/2026 QUESTO MODULO E' L'UNICA PORTA sulla tabella
 * `collegamenti_calendario_esterni`, e si costruisce il client da solo
 * invece di riceverlo. E' la stessa mossa fatta sulla rubrica clienti con la
 * migrazione 0051, per lo stesso motivo e con lo stesso prezzo.
 *
 * Il motivo: in quella tabella ci sono la password CalDAV e il refresh token
 * Google di una persona. Sono cifrati a riposo (vedi cifratura.ts), ma
 * finché `authenticated` aveva la SELECT, qualunque membro del salone poteva
 * scaricarsi quelle righe con una chiamata diretta a PostgREST, senza
 * passare dal prodotto. Cifrate o no, non sono righe che un collaboratore
 * debba poter leggere. La migrazione 0065 revoca quei permessi.
 *
 * Il prezzo, da non dimenticare: con la service_role le policy RLS non
 * proteggono più niente. Il filtro `tenant_id` su ogni query smette di
 * essere una seconda difesa e diventa L'UNICA. Per questo c'è `esigiTenant`
 * e per questo il test di questo modulo verifica ogni query una per una.
 */

/** Il client admin, o quello finto quando lo passa un test. */
function db(client?: SupabaseClient): SupabaseClient {
  return client ?? creaClientAdmin();
}

/**
 * Senza tenant non parte nessuna query: senza filtro tornerebbero i
 * collegamenti di tutti i saloni, e con la service_role non c'e' nessuna
 * policy dietro a fermarli. Meglio un errore rumoroso di un risultato
 * sbagliato.
 */
function esigiTenant(tenantId: string): string {
  if (typeof tenantId !== "string" || tenantId.trim() === "") {
    throw new Error(
      "collegamenti.server: tenantId mancante -- nessuna query sui calendari puo' partire senza."
    );
  }
  return tenantId;
}

export interface CollegamentoCalendario {
  id: string;
  operatoreId: string;
  provider: "google" | "apple";
  stato: string;
  ultimoErrore: string | null;
  caldavUrl: string | null;
  caldavUsername: string | null;
}

export async function elencaCollegamentiTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<CollegamentoCalendario[]> {
  const { data, error } = await db(client)
    .from("collegamenti_calendario_esterni")
    .select("id, operatore_id, provider, stato, ultimo_errore, caldav_url, caldav_username")
    .eq("tenant_id", esigiTenant(tenantId));
  if (error) throw new Error(`Errore leggendo i collegamenti calendario: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    operatoreId: r.operatore_id,
    provider: r.provider,
    stato: r.stato,
    ultimoErrore: r.ultimo_errore,
    caldavUrl: r.caldav_url,
    caldavUsername: r.caldav_username,
  }));
}

export interface CollegaCaldavParams {
  operatoreId: string;
  serverUrl: string;
  username: string;
  password: string;
}

/**
 * Collega il calendario Apple/iCloud (o qualunque CalDAV) di un operatore:
 * verifica DAVVERO le credenziali collegandosi al server prima di salvarle
 * (mai salvare "a scatola chiusa" -- stessa filosofia "verifica dal vivo" di
 * tutto il resto del progetto), poi le persiste. Password in chiaro per ora,
 * vedi la nota di sicurezza nella migrazione 0008.
 */
export async function collegaCaldav(
  tenantId: string,
  params: CollegaCaldavParams,
  client?: SupabaseClient
): Promise<{ ok: true } | { ok: false; errore: string }> {
  esigiTenant(tenantId);
  const verifica = await verificaCredenzialiCaldav(params.serverUrl, params.username, params.password);
  if (!verifica.ok) {
    return { ok: false, errore: `Impossibile collegarsi con queste credenziali: ${verifica.errore}` };
  }
  // Il primo calendario trovato -- se l'operatore ne ha più di uno e vuole
  // sceglierne un altro, è un miglioramento futuro (selezione calendario),
  // non blocca la funzione principale di collegare quello di default.
  const calendarioDefault = verifica.valore.calendari[0];

  const { error } = await db(client).from("collegamenti_calendario_esterni").upsert(
    {
      tenant_id: tenantId,
      operatore_id: params.operatoreId,
      provider: "apple",
      stato: "connesso",
      ultimo_errore: null,
      caldav_url: calendarioDefault.href,
      caldav_username: params.username,
      // Cifrata a riposo (vedi cifratura.ts): non e' una password nostra, e'
      // quella del calendario personale di un'operatrice.
      caldav_password: cifra(params.password),
      aggiornato_il: new Date().toISOString(),
    },
    { onConflict: "operatore_id,provider" }
  );
  if (error) return { ok: false, errore: `Errore salvando il collegamento: ${error.message}` };
  return { ok: true };
}

export async function scollegaCalendario(
  tenantId: string,
  collegamentoId: string,
  client?: SupabaseClient
): Promise<{ ok: true } | { ok: false; errore: string }> {
  const { error } = await db(client)
    .from("collegamenti_calendario_esterni")
    .delete()
    .eq("id", collegamentoId)
    .eq("tenant_id", esigiTenant(tenantId));
  if (error) return { ok: false, errore: `Errore scollegando il calendario: ${error.message}` };
  return { ok: true };
}

/**
 * Il pezzo che collega questo modulo al motore di disponibilità: per gli
 * operatori indicati, scarica gli impegni dei loro calendari CalDAV connessi
 * nella finestra [da, a] e li restituisce nella STESSA forma di
 * `AppuntamentoEsistente` usata per gli appuntamenti interni -- così
 * `booking-engine.server.ts` li può semplicemente concatenare all'array
 * esistente e passarli al motore puro, senza una seconda logica di
 * conflitto (punto 9).
 *
 * Fail-open per collegamento: se UN calendario esterno non risponde o dà
 * errore, quell'operatore risulta semplicemente "senza impegni esterni
 * noti in questo momento" -- non deve mai bloccare la disponibilità degli
 * ALTRI operatori, né far fallire l'intera richiesta di prenotazione.
 * L'errore viene comunque salvato su `ultimo_errore` per essere visibile
 * nelle impostazioni.
 *
 * NOTA fuso orario: `da`/`a` qui sono istanti REALI (il chiamante li
 * converte da pseudo-UTC prima di passarli, vedi booking-engine.server.ts)
 * -- Google/CalDAV parlano solo tempo reale. `fusoOrario` serve invece qui
 * dentro per la conversione INVERSA: gli orari degli eventi che Google/
 * CalDAV restituiscono sono anch'essi reali, e vanno riportati a
 * pseudo-UTC prima di tornare come `AppuntamentoEsistente`, la stessa
 * convenzione degli appuntamenti interni (mai mischiare le due).
 */
export async function caricaImpegniEsterni(
  tenantId: string,
  operatoreIds: string[],
  da: Date,
  a: Date,
  fusoOrario: string,
  client?: SupabaseClient
): Promise<AppuntamentoEsistente[]> {
  if (operatoreIds.length === 0) return [];

  // Il tenant si esige SEMPRE e rumorosamente, anche prima del client: una
  // finestra di disponibilita' calcolata sul salone sbagliato e' peggio di
  // un errore.
  esigiTenant(tenantId);

  // Il client invece e' FAIL-OPEN, ed e' una differenza voluta.
  //
  // Prima del 18/09/2026 questa funzione riceveva il client dall'esterno e
  // non poteva fallire nel costruirlo. Adesso se lo costruisce da sola
  // (migrazione 0065), e `creaClientAdmin()` lancia quando manca
  // SUPABASE_SERVICE_ROLE_KEY. Senza questa rete, un ambiente configurato a
  // meta' non farebbe "perdere gli impegni esterni": farebbe fallire il
  // calcolo degli orari liberi, cioe' spegnerebbe le prenotazioni.
  //
  // Stessa regola gia' scritta piu' sotto per il singolo collegamento che
  // non risponde: un calendario esterno che non si raggiunge fa perdere il
  // blocco di quell'impegno, mai la disponibilita' di tutti.
  let supabase: SupabaseClient;
  try {
    supabase = db(client);
  } catch (errore) {
    console.error(
      "[calendari] client non disponibile: procedo senza impegni esterni.",
      errore instanceof Error ? errore.message : errore
    );
    return [];
  }

  const { data, error } = await supabase
    .from("collegamenti_calendario_esterni")
    .select(
      "id, operatore_id, provider, caldav_url, caldav_username, caldav_password, google_access_token, google_refresh_token, google_token_scadenza, google_calendar_id"
    )
    .eq("tenant_id", tenantId)
    .in("operatore_id", operatoreIds);
  if (error || !data || data.length === 0) return [];

  const risultati = await Promise.all(
    data.map((collegamento) =>
      collegamento.provider === "apple"
        ? impegniDaCaldav(supabase, collegamento, da, a, fusoOrario)
        : impegniDaGoogle(supabase, collegamento, da, a, fusoOrario)
    )
  );

  return risultati.flat();
}

interface RigaCollegamento {
  id: string;
  operatore_id: string;
  caldav_url: string | null;
  caldav_username: string | null;
  caldav_password: string | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_scadenza: string | null;
  google_calendar_id: string | null;
}

async function impegniDaCaldav(
  supabase: SupabaseClient,
  collegamento: RigaCollegamento,
  da: Date,
  a: Date,
  fusoOrario: string
): Promise<AppuntamentoEsistente[]> {
  // Le righe salvate prima della cifratura tornano com'erano: vedi la nota in
  // cifratura.ts, e' quello che evita di spegnere tutti i calendari gia'
  // collegati nel momento del deploy.
  const password = decifra(collegamento.caldav_password);
  if (!collegamento.caldav_url || !collegamento.caldav_username || !password) {
    return [];
  }
  const grezzo = await recuperaIcsGrezzo(collegamento.caldav_url, collegamento.caldav_username, password, da, a);
  if (!grezzo.ok) {
    // Best-effort: registra l'errore per la UI, ma non propagarlo -- fail-open, vedi commento della funzione sopra.
    await supabase
      .from("collegamenti_calendario_esterni")
      .update({ stato: "errore", ultimo_errore: grezzo.errore })
      .eq("id", collegamento.id);
    return [];
  }
  return estraiIntervalliOccupati(grezzo.valore, da, a).map(
    (i): AppuntamentoEsistente => ({
      operatoreId: collegamento.operatore_id,
      inizio: realeAPseudoUtc(i.inizio, fusoOrario),
      fine: realeAPseudoUtc(i.fine, fusoOrario),
      stato: "confermato",
    })
  );
}

/**
 * Come impegniDaCaldav ma per Google: rinnova l'access_token PRIMA di usarlo
 * se è scaduto o sta per scadere (i token Google durano circa un'ora), e
 * salva il nuovo access_token per la prossima volta -- senza questo,
 * ogni richiesta dopo la prima ora fallirebbe con 401. Stesso fail-open:
 * un errore Google (rete, refresh_token revocato dall'operatore, ecc.) non
 * blocca mai la disponibilità, solo perde il blocco di QUELL'operatore.
 */
async function impegniDaGoogle(
  supabase: SupabaseClient,
  collegamento: RigaCollegamento,
  da: Date,
  a: Date,
  fusoOrario: string
): Promise<AppuntamentoEsistente[]> {
  if (!collegamento.google_refresh_token || !collegamento.google_calendar_id) return [];

  let accessToken = decifra(collegamento.google_access_token);
  const scadenza = collegamento.google_token_scadenza ? new Date(collegamento.google_token_scadenza) : null;
  const scaduto = !accessToken || !scadenza || scadenza.getTime() - Date.now() < 60_000;

  try {
    if (scaduto) {
      const rinnovato = await rinnovaTokenGoogle(decifra(collegamento.google_refresh_token)!);
      accessToken = rinnovato.accessToken;
      await supabase
        .from("collegamenti_calendario_esterni")
        .update({
          google_access_token: cifra(rinnovato.accessToken),
          google_token_scadenza: rinnovato.scadenza.toISOString(),
          stato: "connesso",
          ultimo_errore: null,
        })
        .eq("id", collegamento.id);
    }
    const eventi = await recuperaImpegniGoogle(accessToken!, collegamento.google_calendar_id, da, a);
    return eventi.map(
      (e): AppuntamentoEsistente => ({
        operatoreId: collegamento.operatore_id,
        inizio: realeAPseudoUtc(e.inizio, fusoOrario),
        fine: realeAPseudoUtc(e.fine, fusoOrario),
        stato: "confermato",
      })
    );
  } catch (errore) {
    await supabase
      .from("collegamenti_calendario_esterni")
      .update({
        stato: "errore",
        ultimo_errore: errore instanceof Error ? errore.message : "Errore sconosciuto",
      })
      .eq("id", collegamento.id);
    return [];
  }
}
