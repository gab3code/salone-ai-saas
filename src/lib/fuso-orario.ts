/**
 * Conversione tra "pseudo-UTC" e tempo reale -- il pezzo mancante segnalato
 * come problema noto #1 in PROJECT_STATUS.md.
 *
 * Tutto il booking engine (booking-engine.ts, booking-engine.server.ts,
 * parsaOrarioLocale, la costruzione del system prompt dell'AI, tutta la UI
 * della dashboard) usa una convenzione deliberata: i campi UTC di un
 * `Date` (getUTCHours, getUTCDate, ecc.) sono trattati come se fossero
 * direttamente l'ora civile del salone -- "pseudo-UTC" in questi commenti,
 * mai un termine che troverai altrove nel codice. Funziona perfettamente
 * per qualunque confronto FRA valori che rispettano questa stessa
 * convenzione (sia l'aritmetica su minuti-del-giorno del motore puro, sia i
 * confronti su .getTime() epoca-assoluta di verificaConflitto), perché in
 * quel caso l'offset di fuso è semplicemente lo stesso "errore" su
 * entrambi i lati e si cancella.
 *
 * Il problema nasce ai DUE confini dove il tempo deve invece essere
 * davvero assoluto: la colonna `timestamptz` di Postgres (appuntamenti.
 * inizio/fine) e le API di calendario esterne (Google Calendar, CalDAV).
 * Le funzioni qui sotto convertono esattamente in quei due punti -- il
 * motore puro, `parsaOrarioLocale` e tutta la UI restano invariati, perché
 * continuano a ricevere/produrre valori nella stessa convenzione pseudo-UTC
 * di sempre; cambia solo COSA arriva loro dal database/dai calendari
 * esterni una volta passato da qui.
 *
 * Nessuna libreria esterna: `Intl.DateTimeFormat` con `timeZone` legge già
 * l'ora civile di qualunque fuso IANA a partire da un istante reale, che è
 * tutto ciò che serve per entrambe le direzioni.
 */

interface OrologioCivile {
  anno: number;
  mese: number; // 1-12
  giorno: number;
  ore: number;
  minuti: number;
  secondi: number;
}

function orologioNelFuso(dataReale: Date, fusoOrario: string): OrologioCivile {
  const parti = new Intl.DateTimeFormat("en-US", {
    timeZone: fusoOrario,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(dataReale);
  const leggi = (tipo: string) => Number(parti.find((p) => p.type === tipo)?.value ?? "0");
  return {
    anno: leggi("year"),
    mese: leggi("month"),
    giorno: leggi("day"),
    ore: leggi("hour"),
    minuti: leggi("minute"),
    secondi: leggi("second"),
  };
}

/**
 * Istante REALE (es. `appuntamenti.inizio` letto dal database, o l'orario di
 * un evento Google/CalDAV) -> Date "pseudo-UTC" i cui campi getUTC*
 * corrispondono all'ora civile del salone in quell'istante. Da chiamare su
 * ogni valore che entra nel booking engine da uno dei due confini reali.
 */
export function realeAPseudoUtc(dataReale: Date, fusoOrario: string): Date {
  const c = orologioNelFuso(dataReale, fusoOrario);
  return new Date(
    Date.UTC(c.anno, c.mese - 1, c.giorno, c.ore, c.minuti, c.secondi, dataReale.getUTCMilliseconds())
  );
}

/**
 * Inversa: Date "pseudo-UTC" (es. l'orario scelto da un cliente/dall'AI,
 * già validato da parsaOrarioLocale) -> istante REALE da salvare su
 * `appuntamenti` o da inviare a un'API di calendario esterno.
 *
 * Trucco standard senza libreria tz: si parte da una stima (l'istante che
 * avrebbe quei campi UTC se il fuso fosse UTC), si legge che ora civile
 * avrebbe DAVVERO nel fuso richiesto, e si corregge la stima dello
 * scarto -- al massimo 2 iterazioni bastano sempre, anche nell'istante di
 * un cambio ora legale/solare (nel peggiore dei casi il primo giro sceglie
 * uno dei due istanti reali possibili, comunque validi).
 */
export function pseudoUtcAReale(dataPseudo: Date, fusoOrario: string): Date {
  let stima = new Date(dataPseudo.getTime());
  for (let i = 0; i < 2; i++) {
    const civileStima = orologioNelFuso(stima, fusoOrario);
    const civileStimaComeUtc = Date.UTC(
      civileStima.anno,
      civileStima.mese - 1,
      civileStima.giorno,
      civileStima.ore,
      civileStima.minuti,
      civileStima.secondi,
      stima.getUTCMilliseconds()
    );
    const delta = dataPseudo.getTime() - civileStimaComeUtc;
    if (delta === 0) break;
    stima = new Date(stima.getTime() + delta);
  }
  return stima;
}

export const FUSO_ORARIO_PREDEFINITO = "Europe/Rome";
