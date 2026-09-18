import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { pseudoUtcAReale } from "@/lib/fuso-orario";
import { cifra, decifra } from "@/lib/cifratura";
import { costruisciEventoGoogle } from "./evento-google";
import {
  aggiornaEventoGoogle,
  cancellaEventoGoogle,
  creaEventoGoogle,
  rinnovaTokenGoogle,
} from "./google.server";

/**
 * Scrive gli appuntamenti del salone nel calendario personale
 * dell'operatore (Fase 6bis, direzione export, 18/09/2026).
 *
 * TUTTO QUESTO FILE E' FAIL-OPEN, E NON E' UNA COMODITA'.
 *
 * Queste funzioni vengono chiamate DOPO che l'appuntamento e' gia' stato
 * scritto nel nostro database, cioe' quando la prenotazione e' gia' un
 * fatto: il cliente ha ricevuto la conferma, lo slot e' occupato, il salone
 * lo vede in agenda. Se a quel punto Google non risponde, l'unica cosa
 * ragionevole e' registrarlo nei log e andare avanti. Far fallire una
 * prenotazione vera perche' un calendario di terze parti e' lento sarebbe
 * un danno reale per evitare un fastidio.
 *
 * La conseguenza va detta, perche' e' il prezzo di questa scelta: il
 * calendario personale puo' restare temporaneamente indietro rispetto al
 * prodotto. La verita' e' sempre e solo la nostra agenda; quello su Google
 * e' un riflesso, comodo ma non autoritativo. La modifica successiva dello
 * stesso appuntamento riallinea.
 *
 * L'altra meta' della sicurezza sta in evento-google.ts: i nostri eventi
 * sono marcati e vengono saltati in lettura, se no rientrerebbero come
 * impegni esterni e occuperebbero due volte lo stesso slot.
 */

interface CollegamentoEsportabile {
  id: string;
  calendarId: string;
  accessToken: string;
  refreshToken: string;
  scadenza: string | null;
}

/** Il collegamento Google dell'operatore, solo se l'export e' acceso. */
async function collegamentoPerOperatore(
  admin: SupabaseClient,
  tenantId: string,
  operatoreId: string
): Promise<CollegamentoEsportabile | null> {
  const { data } = await admin
    .from("collegamenti_calendario_esterni")
    .select("id, provider, esporta_appuntamenti, google_calendar_id, google_access_token, google_refresh_token, google_token_scadenza, stato")
    .eq("tenant_id", tenantId)
    .eq("operatore_id", operatoreId)
    .eq("provider", "google")
    .maybeSingle();

  if (!data || data.esporta_appuntamenti !== true) return null;
  const accessToken = decifra(data.google_access_token);
  const refreshToken = decifra(data.google_refresh_token);
  if (!accessToken || !refreshToken || !data.google_calendar_id) return null;

  return {
    id: data.id as string,
    calendarId: data.google_calendar_id as string,
    accessToken,
    refreshToken,
    scadenza: (data.google_token_scadenza as string | null) ?? null,
  };
}

/**
 * Token valido, rinnovandolo se serve. Il token rinnovato si riscrive
 * cifrato: se non lo si salvasse, ogni appuntamento pagherebbe un giro di
 * rinnovo in piu' sul percorso della prenotazione.
 */
async function tokenValido(
  admin: SupabaseClient,
  collegamento: CollegamentoEsportabile
): Promise<string> {
  const scaduto = !collegamento.scadenza || new Date(collegamento.scadenza).getTime() <= Date.now() + 60_000;
  if (!scaduto) return collegamento.accessToken;

  const rinnovato = await rinnovaTokenGoogle(collegamento.refreshToken);
  await admin
    .from("collegamenti_calendario_esterni")
    .update({
      google_access_token: cifra(rinnovato.accessToken),
      google_token_scadenza: rinnovato.scadenza.toISOString(),
    })
    .eq("id", collegamento.id);
  return rinnovato.accessToken;
}

interface RigaAppuntamento {
  id: string;
  operatore_id: string | null;
  inizio: string;
  fine: string;
  evento_esterno_id: string | null;
  servizi: { nome: string } | { nome: string }[] | null;
  clienti: { nome: string | null } | { nome: string | null }[] | null;
}

function primo<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

async function leggiAppuntamento(admin: SupabaseClient, appuntamentoId: string): Promise<RigaAppuntamento | null> {
  const { data } = await admin
    .from("appuntamenti")
    .select("id, operatore_id, inizio, fine, evento_esterno_id, servizi(nome), clienti(nome)")
    .eq("id", appuntamentoId)
    .maybeSingle();
  return (data as RigaAppuntamento | null) ?? null;
}

/**
 * Crea o aggiorna l'evento corrispondente a un appuntamento. Idempotente:
 * se l'appuntamento ha gia' un `evento_esterno_id` si aggiorna quello,
 * altrimenti se ne crea uno nuovo e l'id si salva.
 */
export async function esportaAppuntamento(
  tenantId: string,
  appuntamentoId: string,
  fusoOrario: string,
  client?: SupabaseClient
): Promise<void> {
  try {
    const admin = client ?? creaClientAdmin();
    const appuntamento = await leggiAppuntamento(admin, appuntamentoId);
    if (!appuntamento?.operatore_id) return;

    const collegamento = await collegamentoPerOperatore(admin, tenantId, appuntamento.operatore_id);
    if (!collegamento) return;

    const token = await tokenValido(admin, collegamento);
    const evento = costruisciEventoGoogle({
      appuntamentoId: appuntamento.id,
      nomeServizio: primo(appuntamento.servizi)?.nome ?? "Appuntamento",
      nomeCliente: primo(appuntamento.clienti)?.nome ?? null,
      // Nel database gli orari sono pseudo-UTC (vedi fuso-orario.ts): Google
      // parla solo tempo reale, quindi si converte qui e in un posto solo.
      inizio: pseudoUtcAReale(new Date(appuntamento.inizio), fusoOrario),
      fine: pseudoUtcAReale(new Date(appuntamento.fine), fusoOrario),
      fusoOrario,
    });

    if (appuntamento.evento_esterno_id) {
      await aggiornaEventoGoogle(token, collegamento.calendarId, appuntamento.evento_esterno_id, evento);
      return;
    }

    const eventoId = await creaEventoGoogle(token, collegamento.calendarId, evento);
    await admin.from("appuntamenti").update({ evento_esterno_id: eventoId }).eq("id", appuntamento.id);
  } catch (errore) {
    console.error(
      "[calendari] export non riuscito, la prenotazione resta valida:",
      appuntamentoId,
      errore instanceof Error ? errore.message : errore
    );
  }
}

/**
 * Toglie l'evento dal calendario personale quando l'appuntamento viene
 * cancellato. L'id si azzera solo se la cancellazione e' andata a buon fine:
 * tenerlo permette di riprovare, perderlo lascerebbe il fantasma per sempre.
 */
export async function rimuoviEsportazione(
  tenantId: string,
  appuntamentoId: string,
  client?: SupabaseClient
): Promise<void> {
  try {
    const admin = client ?? creaClientAdmin();
    const appuntamento = await leggiAppuntamento(admin, appuntamentoId);
    if (!appuntamento?.evento_esterno_id || !appuntamento.operatore_id) return;

    const collegamento = await collegamentoPerOperatore(admin, tenantId, appuntamento.operatore_id);
    if (!collegamento) return;

    const token = await tokenValido(admin, collegamento);
    await cancellaEventoGoogle(token, collegamento.calendarId, appuntamento.evento_esterno_id);
    await admin.from("appuntamenti").update({ evento_esterno_id: null }).eq("id", appuntamento.id);
  } catch (errore) {
    console.error(
      "[calendari] rimozione dell'evento esterno non riuscita:",
      appuntamentoId,
      errore instanceof Error ? errore.message : errore
    );
  }
}
