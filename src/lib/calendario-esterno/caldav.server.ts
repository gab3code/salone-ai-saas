import "server-only";

/**
 * Client CalDAV minimale (protocollo standard, usato per Apple/iCloud e
 * qualunque altro provider CalDAV -- Fastmail, Nextcloud, ecc.) -- vedi
 * PIANO.md "Fase 6bis". Nessuna libreria esterna: solo `fetch` + un
 * parsing XML tollerante via espressioni regolari, sufficiente per i pochi
 * tag DAV che servono qui (href, current-user-principal, calendar-home-set,
 * resourcetype, calendar-data). Una vera libreria XML sarebbe più robusta,
 * ma per la superficie ridotta di risposte CalDAV che dobbiamo leggere
 * aggiunge una dipendenza per un problema già risolvibile in poche righe.
 *
 * Ogni chiamata di rete ha un timeout esplicito: questo client viene
 * interrogato durante il calcolo di disponibilità di una prenotazione vera
 * (punto 9), un calendario esterno lento o giù non deve mai far restare
 * appesa la prenotazione di un cliente -- fail-open, stesso principio già
 * usato per il tetto prenotazioni (src/lib/piani.ts).
 */

const TIMEOUT_MS = 8_000;

export interface RisultatoCaldav<T> {
  ok: true;
  valore: T;
}
export interface ErroreCaldav {
  ok: false;
  errore: string;
}

function decodificaEntitaXml(testo: string): string {
  return testo
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, codice) => String.fromCharCode(Number(codice)))
    .replace(/&amp;/g, "&");
}

/** Tutte le occorrenze di un tag DAV, indipendentemente dal prefisso del namespace (es. "D:href" o "href"). */
function estraiTag(xml: string, tagLocale: string): string[] {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tagLocale}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tagLocale}>`, "gi");
  const risultati: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    risultati.push(decodificaEntitaXml(match[1]));
  }
  return risultati;
}

async function richiestaDav(
  url: string,
  metodo: "PROPFIND" | "REPORT",
  username: string,
  password: string,
  corpo: string,
  depth: 0 | 1
): Promise<{ testo: string; urlFinale: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const risposta = await fetch(url, {
      method: metodo,
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        "Content-Type": "application/xml; charset=utf-8",
        Depth: String(depth),
      },
      body: corpo,
    });
    if (!risposta.ok) {
      // Il corpo della risposta spesso contiene il motivo vero (es. il testo
      // d'errore XML di Apple) -- senza questo un 400/401 generico non dice
      // nulla di utile per capire se è un problema di credenziali, di
      // formato della richiesta o di blocco anti-abuso lato server.
      const corpoErrore = await risposta.text().catch(() => "");
      const estratto = corpoErrore.trim().slice(0, 300);
      throw new Error(
        `${metodo} ${url} -> HTTP ${risposta.status}${estratto ? `: ${estratto}` : ""}`
      );
    }
    return { testo: await risposta.text(), urlFinale: risposta.url || url };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verifica credenziali + scopre l'indirizzo dei calendari dell'account
 * (current-user-principal -> calendar-home-set), seguendo eventuali
 * redirect del server (es. iCloud smista ogni account su un "pod" diverso,
 * tipo p03-caldav.icloud.com -- `fetch` segue il redirect da solo e
 * `response.url` ci dà l'indirizzo vero su cui continuare).
 */
export async function scopriHomeCalendari(
  serverUrl: string,
  username: string,
  password: string
): Promise<RisultatoCaldav<string> | ErroreCaldav> {
  try {
    const { testo: rispostaPrincipal, urlFinale } = await richiestaDav(
      serverUrl,
      "PROPFIND",
      username,
      password,
      `<?xml version="1.0" encoding="utf-8" ?>
       <D:propfind xmlns:D="DAV:"><D:prop><D:current-user-principal/></D:prop></D:propfind>`,
      0
    );
    const principalHref = estraiTag(rispostaPrincipal, "href")[0];
    if (!principalHref) {
      return { ok: false, errore: "Il server non ha restituito un principal utente valido." };
    }
    const principalUrl = new URL(principalHref, urlFinale).toString();

    const { testo: rispostaHome, urlFinale: urlFinalePrincipal } = await richiestaDav(
      principalUrl,
      "PROPFIND",
      username,
      password,
      `<?xml version="1.0" encoding="utf-8" ?>
       <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
         <D:prop><C:calendar-home-set/></D:prop>
       </D:propfind>`,
      0
    );
    const homeHref = estraiTag(rispostaHome, "href")[0];
    if (!homeHref) {
      return { ok: false, errore: "Il server non ha restituito l'indirizzo dei calendari (calendar-home-set)." };
    }
    return { ok: true, valore: new URL(homeHref, urlFinalePrincipal).toString() };
  } catch (errore) {
    return { ok: false, errore: erroreLeggibile(errore) };
  }
}

export interface CalendarioCaldav {
  href: string;
  nome: string;
}

/** Elenca le collezioni-calendario dentro l'home scoperta sopra (una persona può averne più di uno). */
export async function elencaCalendari(
  homeUrl: string,
  username: string,
  password: string
): Promise<RisultatoCaldav<CalendarioCaldav[]> | ErroreCaldav> {
  try {
    const { testo, urlFinale } = await richiestaDav(
      homeUrl,
      "PROPFIND",
      username,
      password,
      `<?xml version="1.0" encoding="utf-8" ?>
       <D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
         <D:prop><D:displayname/><D:resourcetype/></D:prop>
       </D:propfind>`,
      1
    );
    // Un <D:response> per risorsa: teniamo solo quelle il cui resourcetype contiene <calendar/>.
    const risposte = testo.split(/<(?:[\w-]+:)?response(?:\s[^>]*)?>/gi).slice(1);
    const calendari: CalendarioCaldav[] = [];
    for (const blocco of risposte) {
      if (!/calendar/i.test(estraiTag(blocco, "resourcetype")[0] ?? "")) continue;
      const href = estraiTag(blocco, "href")[0];
      if (!href) continue;
      const nome = estraiTag(blocco, "displayname")[0] || href;
      calendari.push({ href: new URL(href, urlFinale).toString(), nome });
    }
    return { ok: true, valore: calendari };
  } catch (errore) {
    return { ok: false, errore: erroreLeggibile(errore) };
  }
}

/**
 * Scarica gli eventi in [da, a] da UNA collezione-calendario e restituisce
 * il testo ICS grezzo di ciascuno concatenato -- da passare a
 * `estraiIntervalliOccupati` (src/lib/calendario-esterno/ics.ts), mai una
 * seconda logica di interpretazione qui.
 */
export async function recuperaIcsGrezzo(
  calendarUrl: string,
  username: string,
  password: string,
  da: Date,
  a: Date
): Promise<RisultatoCaldav<string> | ErroreCaldav> {
  const formatta = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  try {
    const { testo } = await richiestaDav(
      calendarUrl,
      "REPORT",
      username,
      password,
      `<?xml version="1.0" encoding="utf-8" ?>
       <C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
         <D:prop><C:calendar-data/></D:prop>
         <C:filter>
           <C:comp-filter name="VCALENDAR">
             <C:comp-filter name="VEVENT">
               <C:time-range start="${formatta(da)}" end="${formatta(a)}"/>
             </C:comp-filter>
           </C:comp-filter>
         </C:filter>
       </C:calendar-query>`,
      1
    );
    const blocchi = estraiTag(testo, "calendar-data");
    return { ok: true, valore: blocchi.join("\n") };
  } catch (errore) {
    return { ok: false, errore: erroreLeggibile(errore) };
  }
}

/** Usata dalla UI di collegamento: prova davvero le credenziali prima di salvarle. */
export async function verificaCredenzialiCaldav(
  serverUrl: string,
  username: string,
  password: string
): Promise<RisultatoCaldav<{ homeUrl: string; calendari: CalendarioCaldav[] }> | ErroreCaldav> {
  const home = await scopriHomeCalendari(serverUrl, username, password);
  if (!home.ok) return home;
  const calendari = await elencaCalendari(home.valore, username, password);
  if (!calendari.ok) return calendari;
  if (calendari.valore.length === 0) {
    return { ok: false, errore: "Nessun calendario trovato per questo account." };
  }
  return { ok: true, valore: { homeUrl: home.valore, calendari: calendari.valore } };
}

function erroreLeggibile(errore: unknown): string {
  if (errore instanceof Error) {
    if (errore.name === "AbortError") return "Il server del calendario non ha risposto in tempo.";
    return errore.message;
  }
  return "Errore sconosciuto collegandosi al calendario.";
}
