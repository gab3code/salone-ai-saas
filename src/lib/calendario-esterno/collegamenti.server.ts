import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
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
 */

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
  supabase: SupabaseClient,
  tenantId: string
): Promise<CollegamentoCalendario[]> {
  const { data, error } = await supabase
    .from("collegamenti_calendario_esterni")
    .select("id, operatore_id, provider, stato, ultimo_errore, caldav_url, caldav_username")
    .eq("tenant_id", tenantId);
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
  supabase: SupabaseClient,
  tenantId: string,
  params: CollegaCaldavParams
): Promise<{ ok: true } | { ok: false; errore: string }> {
  const verifica = await verificaCredenzialiCaldav(params.serverUrl, params.username, params.password);
  if (!verifica.ok) {
    return { ok: false, errore: `Impossibile collegarsi con queste credenziali: ${verifica.errore}` };
  }
  // Il primo calendario trovato -- se l'operatore ne ha più di uno e vuole
  // sceglierne un altro, è un miglioramento futuro (selezione calendario),
  // non blocca la funzione principale di collegare quello di default.
  const calendarioDefault = verifica.valore.calendari[0];

  const { error } = await supabase.from("collegamenti_calendario_esterni").upsert(
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
  supabase: SupabaseClient,
  tenantId: string,
  collegamentoId: string
): Promise<{ ok: true } | { ok: false; errore: string }> {
  const { error } = await supabase
    .from("collegamenti_calendario_esterni")
    .delete()
    .eq("id", collegamentoId)
    .eq("tenant_id", tenantId);
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
  supabase: SupabaseClient,
  tenantId: string,
  operatoreIds: string[],
  da: Date,
  a: Date,
  fusoOrario: string
): Promise<AppuntamentoEsistente[]> {
  if (operatoreIds.length === 0) return [];

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
