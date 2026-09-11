/**
 * Parser ICS (RFC 5545) puro -- nessuna rete, nessun database. Prende il
 * testo di un calendario (esportato da Google/Apple via CalDAV) e restituisce
 * gli intervalli "occupato" da usare per bloccare gli slot nel motore di
 * disponibilità (src/lib/booking-engine.ts), esattamente come si fa oggi per
 * gli appuntamenti interni -- stessa logica di sottrazione intervalli, mai
 * una seconda implementazione (punto 9).
 *
 * Limitazioni consapevoli (documentate qui, non nascoste):
 * - RRULE: espande solo FREQ=DAILY e FREQ=WEEKLY (con BYDAY opzionale), che
 *   coprono la stragrande maggioranza degli impegni personali ricorrenti
 *   (palestra, corsi settimanali, riunioni fisse). FREQ=MONTHLY/YEARLY non
 *   sono espanse: l'evento viene comunque incluso come singola occorrenza
 *   alla sua DTSTART originale (fail-safe: meglio un impegno mostrato una
 *   volta sola che un impegno perso del tutto), mai un crash.
 * - TZID: risolto con Intl.DateTimeFormat (nessuna libreria tz esterna) --
 *   corretto per la stragrande maggioranza dei fusi orari IANA standard,
 *   compreso il cambio ora legale/solare.
 * - EXDATE: rispettato per rimuovere singole occorrenze escluse.
 */

export interface VeventGrezzo {
  uid: string;
  dtStart: Date;
  dtEnd: Date;
  interoGiorno: boolean;
  stato: string | null; // CONFIRMED | CANCELLED | TENTATIVE | null se assente
  rrule: Record<string, string> | null;
  exdate: Date[];
}

export interface IntervalloOccupatoEsterno {
  uid: string;
  inizio: Date;
  fine: Date;
}

/** Le righe ICS possono essere "foldate" su più righe fisiche (RFC 5545 §3.1). */
function despiegaLinee(testo: string): string[] {
  const normalizzato = testo.replace(/\r\n/g, "\n");
  const righeGrezze = normalizzato.split("\n");
  const righe: string[] = [];
  for (const riga of righeGrezze) {
    if ((riga.startsWith(" ") || riga.startsWith("\t")) && righe.length > 0) {
      righe[righe.length - 1] += riga.slice(1);
    } else if (riga.trim() !== "") {
      righe.push(riga);
    }
  }
  return righe;
}

/** "PROP;PARAM=X;PARAM2=Y:valore" -> { nome, parametri, valore }. */
function parsaProprieta(riga: string): { nome: string; parametri: Record<string, string>; valore: string } {
  const indiceDuePunti = riga.indexOf(":");
  const testata = indiceDuePunti === -1 ? riga : riga.slice(0, indiceDuePunti);
  const valore = indiceDuePunti === -1 ? "" : riga.slice(indiceDuePunti + 1);
  const [nome, ...parti] = testata.split(";");
  const parametri: Record<string, string> = {};
  for (const parte of parti) {
    const idx = parte.indexOf("=");
    if (idx === -1) continue;
    parametri[parte.slice(0, idx).toUpperCase()] = parte.slice(idx + 1);
  }
  return { nome: nome.toUpperCase(), parametri, valore };
}

/** Scostamento (minuti) di un fuso IANA rispetto a UTC nell'istante indicato. */
function scostamentoMinuti(istante: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parti = Object.fromEntries(dtf.formatToParts(istante).map((p) => [p.type, p.value]));
  const comeUTC = Date.UTC(
    Number(parti.year),
    Number(parti.month) - 1,
    Number(parti.day),
    Number(parti.hour),
    Number(parti.minute),
    Number(parti.second)
  );
  return (comeUTC - istante.getTime()) / 60_000;
}

/** Componenti wall-clock in un fuso IANA -> istante UTC reale (2 iterazioni, gestisce l'ora legale). */
function localeAUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const tentativo = Date.UTC(y, mo - 1, d, h, mi, s);
  const scostamento1 = scostamentoMinuti(new Date(tentativo), tz);
  const scostamento2 = scostamentoMinuti(new Date(tentativo - scostamento1 * 60_000), tz);
  return new Date(tentativo - scostamento2 * 60_000);
}

/**
 * "YYYYMMDD" o "YYYYMMDDTHHMMSS"(Z) -> Date. Con TZID esplicito, risolve il
 * fuso; con "Z" finale è già UTC; senza nessuno dei due, stessa
 * semplificazione "trattato come UTC" già usata nel resto del progetto
 * (vedi booking-engine.server.ts).
 */
function parsaDataIcs(valore: string, tzid: string | undefined, soloData: boolean): Date {
  if (soloData) {
    const y = Number(valore.slice(0, 4));
    const mo = Number(valore.slice(4, 6));
    const d = Number(valore.slice(6, 8));
    return tzid ? localeAUtc(y, mo, d, 0, 0, 0, tzid) : new Date(Date.UTC(y, mo - 1, d));
  }
  const z = valore.endsWith("Z");
  const base = z ? valore.slice(0, -1) : valore;
  const y = Number(base.slice(0, 4));
  const mo = Number(base.slice(4, 6));
  const d = Number(base.slice(6, 8));
  const h = Number(base.slice(9, 11));
  const mi = Number(base.slice(11, 13));
  const s = Number(base.slice(13, 15)) || 0;
  if (z) return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  if (tzid) return localeAUtc(y, mo, d, h, mi, s, tzid);
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

function parsaRrule(valore: string): Record<string, string> {
  const risultato: Record<string, string> = {};
  for (const coppia of valore.split(";")) {
    const [chiave, val] = coppia.split("=");
    if (chiave && val !== undefined) risultato[chiave.toUpperCase()] = val;
  }
  return risultato;
}

/** Estrae tutti i VEVENT da un testo ICS grezzo (risposta CalDAV o feed .ics). */
export function parsaIcs(testoIcs: string): VeventGrezzo[] {
  const righe = despiegaLinee(testoIcs);
  const eventi: VeventGrezzo[] = [];

  let dentroEvento = false;
  let uid = "";
  let dtStartRaw: { valore: string; tzid?: string; soloData: boolean } | null = null;
  let dtEndRaw: { valore: string; tzid?: string; soloData: boolean } | null = null;
  let durataRaw: string | null = null;
  let stato: string | null = null;
  let rrule: Record<string, string> | null = null;
  const exdate: Date[] = [];

  for (const riga of righe) {
    if (riga === "BEGIN:VEVENT") {
      dentroEvento = true;
      uid = "";
      dtStartRaw = null;
      dtEndRaw = null;
      durataRaw = null;
      stato = null;
      rrule = null;
      exdate.length = 0;
      continue;
    }
    if (riga === "END:VEVENT") {
      dentroEvento = false;
      if (uid && dtStartRaw) {
        const soloDataInizio = dtStartRaw.soloData;
        const dtStart = parsaDataIcs(dtStartRaw.valore, dtStartRaw.tzid, soloDataInizio);
        let dtEnd: Date;
        if (dtEndRaw) {
          dtEnd = parsaDataIcs(dtEndRaw.valore, dtEndRaw.tzid, dtEndRaw.soloData);
        } else if (durataRaw) {
          dtEnd = new Date(dtStart.getTime() + parsaDurataIso(durataRaw));
        } else if (soloDataInizio) {
          dtEnd = new Date(dtStart.getTime() + 24 * 60 * 60_000);
        } else {
          dtEnd = dtStart; // nessuna durata indicata: evento puntiforme, non blocca nulla
        }
        eventi.push({
          uid,
          dtStart,
          dtEnd,
          interoGiorno: soloDataInizio,
          stato,
          rrule,
          exdate: [...exdate],
        });
      }
      continue;
    }
    if (!dentroEvento) continue;

    const { nome, parametri, valore } = parsaProprieta(riga);
    if (nome === "UID") uid = valore;
    else if (nome === "STATUS") stato = valore.toUpperCase();
    else if (nome === "RRULE") rrule = parsaRrule(valore);
    else if (nome === "DTSTART") {
      dtStartRaw = { valore, tzid: parametri.TZID, soloData: parametri.VALUE === "DATE" };
    } else if (nome === "DTEND") {
      dtEndRaw = { valore, tzid: parametri.TZID, soloData: parametri.VALUE === "DATE" };
    } else if (nome === "DURATION") {
      durataRaw = valore;
    } else if (nome === "EXDATE") {
      for (const parte of valore.split(",")) {
        exdate.push(parsaDataIcs(parte, parametri.TZID, parametri.VALUE === "DATE"));
      }
    }
  }

  return eventi;
}

/** "PT1H30M" / "P1D" (sottoinsieme comune di ISO 8601 duration) -> millisecondi. */
function parsaDurataIso(valore: string): number {
  const match = /^([+-])?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(valore);
  if (!match) return 0;
  const segno = match[1] === "-" ? -1 : 1;
  const [, , giorni, ore, minuti, secondi] = match;
  const ms =
    (Number(giorni) || 0) * 86_400_000 +
    (Number(ore) || 0) * 3_600_000 +
    (Number(minuti) || 0) * 60_000 +
    (Number(secondi) || 0) * 1_000;
  return segno * ms;
}

const GIORNI_RRULE = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const MASSIMO_OCCORRENZE_PER_EVENTO = 500; // limite di sicurezza, mai un ciclo infinito

/**
 * Espande un singolo VEVENT (con eventuale RRULE) nelle occorrenze che
 * ricadono nella finestra [finestraDa, finestraA]. Eventi CANCELLED sono
 * esclusi a monte (non chiamare questa funzione per quelli).
 */
function espandiOccorrenze(evento: VeventGrezzo, finestraDa: Date, finestraA: Date): IntervalloOccupatoEsterno[] {
  const durataMs = evento.dtEnd.getTime() - evento.dtStart.getTime();
  const exdateMs = new Set(evento.exdate.map((d) => d.getTime()));

  if (!evento.rrule) {
    if (evento.dtEnd <= finestraDa || evento.dtStart >= finestraA) return [];
    return [{ uid: evento.uid, inizio: evento.dtStart, fine: evento.dtEnd }];
  }

  const freq = evento.rrule.FREQ;
  const intervallo = Math.max(1, Number(evento.rrule.INTERVAL) || 1);
  const until = evento.rrule.UNTIL ? parsaDataIcs(evento.rrule.UNTIL, undefined, evento.rrule.UNTIL.length === 8) : null;
  const count = evento.rrule.COUNT ? Number(evento.rrule.COUNT) : null;
  const byDay = evento.rrule.BYDAY ? evento.rrule.BYDAY.split(",") : null;

  if (freq !== "DAILY" && freq !== "WEEKLY") {
    // FREQ non ancora espansa (MONTHLY/YEARLY, vedi commento in testa al file):
    // fail-safe, mostra almeno l'occorrenza originale se ricade nella finestra.
    return espandiOccorrenze({ ...evento, rrule: null }, finestraDa, finestraA);
  }

  const risultato: IntervalloOccupatoEsterno[] = [];
  let occorrenze = 0;
  let cursore = new Date(evento.dtStart);
  const passoMs = freq === "DAILY" ? intervallo * 86_400_000 : intervallo * 7 * 86_400_000;

  for (let i = 0; i < MASSIMO_OCCORRENZE_PER_EVENTO; i++) {
    if (until && cursore > until) break;
    if (count !== null && occorrenze >= count) break;
    if (cursore > finestraA) break;

    const candidati: Date[] = [];
    if (freq === "WEEKLY" && byDay) {
      // Stessa settimana del cursore, un'occorrenza per ogni giorno richiesto.
      const inizioSettimana = new Date(cursore);
      inizioSettimana.setUTCDate(inizioSettimana.getUTCDate() - inizioSettimana.getUTCDay());
      for (const giorno of byDay) {
        const indice = GIORNI_RRULE.indexOf(giorno.replace(/^[+-]?\d*/, ""));
        if (indice === -1) continue;
        const data = new Date(inizioSettimana);
        data.setUTCDate(data.getUTCDate() + indice);
        data.setUTCHours(cursore.getUTCHours(), cursore.getUTCMinutes(), cursore.getUTCSeconds());
        if (data >= evento.dtStart) candidati.push(data);
      }
    } else {
      candidati.push(new Date(cursore));
    }

    for (const inizio of candidati.sort((a, b) => a.getTime() - b.getTime())) {
      if (count !== null && occorrenze >= count) break;
      if (until && inizio > until) continue;
      occorrenze++;
      if (exdateMs.has(inizio.getTime())) continue;
      const fine = new Date(inizio.getTime() + durataMs);
      if (fine <= finestraDa || inizio >= finestraA) continue;
      risultato.push({ uid: `${evento.uid}#${inizio.toISOString()}`, inizio, fine });
    }

    cursore = new Date(cursore.getTime() + passoMs);
  }

  return risultato;
}

/**
 * Punto di ingresso: dal testo ICS grezzo agli intervalli "occupato" nella
 * finestra richiesta, pronti per essere trattati come appuntamenti dal
 * motore di disponibilità (stesso principio di `appuntamentiEsistenti`).
 */
export function estraiIntervalliOccupati(
  testoIcs: string,
  finestraDa: Date,
  finestraA: Date
): IntervalloOccupatoEsterno[] {
  const eventi = parsaIcs(testoIcs).filter((e) => e.stato !== "CANCELLED");
  const risultato: IntervalloOccupatoEsterno[] = [];
  for (const evento of eventi) {
    risultato.push(...espandiOccorrenze(evento, finestraDa, finestraA));
  }
  return risultato;
}
