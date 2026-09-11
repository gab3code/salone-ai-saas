import "server-only";

/**
 * Google Calendar API v3 via OAuth2 per-operatore (Fase 6bis, deciso il
 * 02/09/2026: ogni operatore autorizza il collegamento al SUO calendario
 * personale con il proprio consenso -- non un service account condiviso
 * dalla piattaforma). Nessun SDK Google ufficiale: sono 3 chiamate HTTP
 * dirette (authorize URL, token exchange/refresh, events.list), non vale la
 * pena della dipendenza `googleapis` (pesante) per così poco.
 *
 * Stesso timeout/fail-open già applicato al client CalDAV
 * (caldav.server.ts): un errore o una lentezza di Google non deve mai far
 * fallire un calcolo di disponibilità o una prenotazione vera.
 */

const TIMEOUT_MS = 8_000;
const SCOPE_CALENDARIO = "https://www.googleapis.com/auth/calendar.events";
const URL_AUTORIZZAZIONE = "https://accounts.google.com/o/oauth2/v2/auth";
const URL_TOKEN = "https://oauth2.googleapis.com/token";
const URL_EVENTI = "https://www.googleapis.com/calendar/v3/calendars";

function credenziali() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Calendar non configurato: mancano GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI in .env.local."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/** L'indirizzo a cui mandare l'operatore per il consenso Google -- vedi la route /api/calendario/google/connect. */
export function costruisciUrlAutorizzazione(state: string): string {
  const { clientId, redirectUri } = credenziali();
  const parametri = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE_CALENDARIO,
    access_type: "offline", // serve il refresh_token, non solo l'access_token
    prompt: "consent", // forza il refresh_token anche se l'operatore aveva già autorizzato prima
    state,
  });
  return `${URL_AUTORIZZAZIONE}?${parametri.toString()}`;
}

export interface TokenGoogle {
  accessToken: string;
  refreshToken: string | null; // presente solo al primo consenso, vedi prompt=consent sopra
  scadenza: Date;
}

async function richiestaToken(corpo: Record<string, string>): Promise<TokenGoogle> {
  const { clientId, clientSecret } = credenziali();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const risposta = await fetch(URL_TOKEN, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...corpo }).toString(),
    });
    const dati = await risposta.json();
    if (!risposta.ok) {
      throw new Error(dati.error_description || dati.error || `HTTP ${risposta.status}`);
    }
    return {
      accessToken: dati.access_token,
      refreshToken: dati.refresh_token ?? null,
      scadenza: new Date(Date.now() + dati.expires_in * 1000),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Scambia il "code" ricevuto nel redirect di Google per i token veri (solo alla prima autorizzazione). */
export async function scambiaCodiceGoogle(code: string): Promise<TokenGoogle> {
  const { redirectUri } = credenziali();
  return richiestaToken({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

/** Rinnova l'access_token (scaduto dopo ~1h) usando il refresh_token salvato -- non richiede altro consenso. */
export async function rinnovaTokenGoogle(refreshToken: string): Promise<TokenGoogle> {
  return richiestaToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

export interface ImpegnoGoogle {
  id: string;
  inizio: Date;
  fine: Date;
}

/**
 * Eventi occupati nella finestra [da, a] -- `singleEvents=true` fa espandere
 * a Google stesso le ricorrenze (RRULE) in occorrenze singole: molto più
 * semplice di quanto abbiamo dovuto fare a mano per CalDAV/ICS
 * (src/lib/calendario-esterno/ics.ts), perché qui lo fa direttamente l'API.
 */
export async function recuperaImpegniGoogle(
  accessToken: string,
  calendarId: string,
  da: Date,
  a: Date
): Promise<ImpegnoGoogle[]> {
  const parametri = new URLSearchParams({
    timeMin: da.toISOString(),
    timeMax: a.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const risposta = await fetch(`${URL_EVENTI}/${encodeURIComponent(calendarId)}/events?${parametri}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!risposta.ok) {
      throw new Error(`Google Calendar API -> HTTP ${risposta.status}`);
    }
    const dati = await risposta.json();
    const eventi: ImpegnoGoogle[] = [];
    for (const item of dati.items ?? []) {
      if (item.status === "cancelled") continue;
      // Un evento "tutto il giorno" ha .date invece di .dateTime.
      const inizioStr = item.start?.dateTime ?? item.start?.date;
      const fineStr = item.end?.dateTime ?? item.end?.date;
      if (!inizioStr || !fineStr) continue;
      eventi.push({ id: item.id, inizio: new Date(inizioStr), fine: new Date(fineStr) });
    }
    return eventi;
  } finally {
    clearTimeout(timeout);
  }
}
