/**
 * Un orario che l'assistente scrive al cliente deve venire da uno strumento.
 * Mai dalla sua memoria.
 *
 * ----------------------------------------------------------------------
 * IL CASO VERO, 19/09/2026.
 *
 *   cliente:     hai solo questi orari?
 *   assistente:  No, ho molti altri. Ti ho elencato solo alcuni per non fare
 *                un messaggio troppo lungo.
 *   cliente:     dimmi tutti gli orari
 *   assistente:  8:00, 9:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00,
 *                16:00, 17:00, 18:00
 *
 * Quel salone chiude per pausa dalle 12:00 alle 14:00. Le 12:00 e le 13:00
 * non sono mai esistite, e nemmeno il resto: in quel turno il modello non ha
 * chiamato nessuno strumento. Ha scritto una lista plausibile.
 *
 * Il danno e' doppio e arriva dopo: il cliente ne sceglie uno, la creazione
 * fallisce o -- peggio -- riesce su un orario in cui il salone e' chiuso.
 *
 * ----------------------------------------------------------------------
 * LA REGOLA GIA' SCRITTA IN QUESTO PROGETTO: "i numeri li contiamo noi, le
 * parole le scrive il modello". Vale per i prezzi (verifica-numeri.ts), per i
 * giorni della settimana (giorni-settimana.ts), per le azioni
 * (verifica-azioni.ts). **Un orario e' un numero.**
 *
 * ----------------------------------------------------------------------
 * COME FUNZIONA, e perche' e' costruito per NON dare falsi allarmi.
 *
 * Un orario nel testo e' lecito se compare in almeno uno di questi posti:
 *   1. i risultati degli strumenti chiamati in questo turno (gli slot liberi,
 *      gli orari di apertura, le prenotazioni trovate);
 *   2. quello che ha scritto IL CLIENTE -- se dice "prenoto alle 9:30",
 *      l'assistente deve poter rispondere "alle 9:30" senza richiamare uno
 *      strumento per il gusto di farlo.
 *
 * **I messaggi dell'assistente non contano come fonte, ed e' una correzione
 * del 19/09/2026.** All'inizio contavano, e il modello ha trovato il buco: il
 * cliente chiede gli orari di mercoledi', poi "martedi' invece?", e lui
 * ripete la stessa identica lista senza ricontrollare. Il controllo la
 * lasciava passare perche' quegli orari "c'erano gia' nella conversazione" --
 * scritti da lui un attimo prima. Risultato: le 08:00 di martedi' proposte
 * come libere mentre erano gia' occupate.
 *
 * Un orario scritto dall'assistente non e' una fonte: e' la cosa di cui
 * stiamo dubitando. **Una verifica che accetta come prova l'affermazione da
 * verificare non e' una verifica.**
 *
 * Nel testo dell'assistente si cercano solo gli orari scritti con i due punti
 * (8:00, 14:30): li' l'ambiguita' costa cara, perche' un falso allarme
 * sostituisce una risposta buona con una scusa.
 *
 * Nei messaggi del CLIENTE invece si leggono anche le ore secche -- "alle 16",
 * "verso le 9 e mezza". Correzione del 19/09/2026: il cliente aveva scritto
 * "alle 16", l'assistente ha risposto "16:00" ed e' stato fermato come se se
 * lo fosse inventato. Il cliente non e' la fonte di cui dubitiamo: se ha
 * chiesto le 16, ripetergliele scritte bene non e' inventare niente. Il
 * risultato del falso allarme era la frase peggiore possibile -- "non riesco a
 * dirti gli orari liberi" -- proprio mentre il cliente stava dicendo l'ora che
 * voleva.
 */

import { formattaGiornoEsteso } from "@/lib/data-italiana";

/** Ogni HH:MM del testo, normalizzato a due cifre. */
export function orariNelTesto(testo: string): string[] {
  const trovati: string[] = [];
  const re = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo)) !== null) {
    trovati.push(`${m[1].padStart(2, "0")}:${m[2]}`);
  }
  return trovati;
}

/**
 * Gli orari che il CLIENTE ha chiesto, comprese le ore senza minuti.
 *
 * Solo per i suoi messaggi: qui riconoscere in modo largo non apre nessun
 * buco (il cliente non puo' "inventare" un orario, puo' solo chiederlo), e
 * riconoscere in modo stretto produceva falsi allarmi.
 *
 * Si accetta un'ora secca solo dopo una parola che la rende un orario
 * ("alle 16", "verso le 9", "dalle 10"): cosi' "ho 16 anni" o "siamo in 4"
 * non entrano. "e mezza" e "e un quarto" si portano dietro i minuti, e se il
 * messaggio parla di pomeriggio o sera si accetta anche la lettura sulle 24
 * ore ("alle 4 del pomeriggio" -> 04:00 e 16:00).
 */
export function orariChiestiDalCliente(testo: string): string[] {
  const trovati = new Set<string>(orariNelTesto(testo));
  const pomeridiano = /\b(?:pomeriggio|sera|serata|pomeridian)/i.test(testo);

  const re =
    /\b(?:alle|all'|dalle|entro\s+le|verso\s+le|per\s+le|intorno\s+alle|ore|le)\s*([01]?\d|2[0-3])(?![:.\d])(\s*e\s*(mezza|mezzo|un\s+quarto))?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(testo)) !== null) {
    const ora = Number(m[1]);
    const minuti = m[3] ? (/quarto/i.test(m[3]) ? "15" : "30") : "00";
    trovati.add(`${String(ora).padStart(2, "0")}:${minuti}`);
    if (pomeridiano && ora >= 1 && ora <= 11) {
      trovati.add(`${String(ora + 12).padStart(2, "0")}:${minuti}`);
    }
  }
  return [...trovati];
}

/**
 * Gli orari leciti, presi da qualunque testo di riferimento: i risultati
 * degli strumenti (dove gli orari viaggiano come ISO, es.
 * "2026-09-22T08:00:00.000Z", oppure come "08:00:00") e i messaggi gia'
 * scambiati.
 */
export function orariConsentiti(
  testiDiRiferimento: string[],
  messaggiDelCliente: string[] = []
): Set<string> {
  const consentiti = new Set<string>();
  for (const messaggio of messaggiDelCliente) {
    for (const orario of orariChiestiDalCliente(messaggio)) consentiti.add(orario);
  }
  for (const testo of [...testiDiRiferimento, ...messaggiDelCliente]) {
    for (const orario of orariNelTesto(testo)) consentiti.add(orario);
    // Gli ISO hanno la T davanti all'ora e la regex sopra li prende gia',
    // ma un "T08:00" a inizio riga senza spazio prima non ha il confine di
    // parola: questa seconda passata li recupera.
    const reIso = /T([01]\d|2[0-3]):([0-5]\d)/g;
    let m: RegExpExecArray | null;
    while ((m = reIso.exec(testo)) !== null) consentiti.add(`${m[1]}:${m[2]}`);
  }
  return consentiti;
}

/**
 * Il problema da contestare al modello, o null se ogni orario del testo ha
 * una fonte. Stessa forma degli altri controlli: una frase che gli viene
 * rimandata perche' si corregga da solo.
 */
export function trovaOrarioInventato(testo: string, consentiti: Set<string>): string | null {
  const inventati = [...new Set(orariNelTesto(testo))].filter((o) => !consentiti.has(o));
  if (inventati.length === 0) return null;
  return `ATTENZIONE: nel tuo messaggio hai scritto ${
    inventati.length === 1 ? "un orario che non risulta" : "orari che non risultano"
  } da nessuno strumento: ${inventati.join(", ")}. Non hai modo di sapere se sono liberi, e proporre un orario inesistente manda il cliente a prenotare qualcosa che non c'e'. Chiama verifica_disponibilita adesso e riporta SOLO gli orari che ti restituisce, senza aggiungerne e senza arrotondarli.`;
}

/**
 * Cosa dire se il modello, anche dopo essere stato corretto, continua a
 * scrivere orari che non esistono.
 *
 * Non contiene nessun orario, di proposito: e' l'unico modo di essere sicuri
 * di non ripetere l'invenzione. E non chiude la conversazione -- chiede al
 * cliente di ripetere il giorno, cosi' il turno dopo riparte pulito e con lo
 * strumento chiamato davvero.
 */
export const FRASE_ORARI_NON_VERIFICATI =
  "Scusa, non riesco a dirti gli orari liberi in questo momento. Dimmi di nuovo che giorno ti interesserebbe e li controllo.";

/**
 * Dire "siamo chiusi" o "non c'e' disponibilita'" e' un dato verificabile
 * quanto un orario, e va trattato allo stesso modo.
 *
 * IL CASO VERO, 19/09/2026. Il cliente chiede "oggi invece?" e l'assistente
 * risponde: "Oggi e' sabato 19 settembre, ma siamo chiusi oggi". Il salone
 * quel sabato era APERTO dalle 07:00 alle 12:00. Il cliente ha dovuto
 * contraddirlo per ottenere gli orari veri -- e un cliente vero non lo fa:
 * legge "chiuso", chiude la chat e il salone perde una prenotazione senza
 * sapere di averla persa.
 *
 * E' il danno piu' silenzioso di tutti. Un appuntamento inventato prima o poi
 * qualcuno lo scopre; un cliente mandato via non lascia traccia da nessuna
 * parte.
 */
const FRASI_CHIUSURA: RegExp[] = [
  /\bsiamo\s+chius/i,
  /\b(?:e'|è)\s+chiuso\b/i,
  /\bil\s+salone\s+(?:e'|è)\s+chius/i,
  /\bnon\s+(?:siamo|e'|è)\s+apert/i,
  /\bnon\s+(?:c'e'|c'è|ci\s+sono)\s+(?:piu'\s+)?(?:disponibilit|posti?\b|orari\s+liber)/i,
  /\bnon\s+ho\s+(?:piu'\s+)?(?:disponibilit|posti?\b|orari\s+liber|niente\s+liber)/i,
  /\b(?:siamo|e'|è)\s+(?:tutto\s+)?pieno\b/i,
];

/** true se il testo afferma che il salone e' chiuso o che non c'e' posto. */
export function dichiaraChiusuraOPieno(testo: string): boolean {
  return FRASI_CHIUSURA.some((r) => r.test(testo));
}

/**
 * Il problema da contestare, o null. Vale solo se in questo turno NESSUNO
 * strumento ha guardato calendario o orari: se lo strumento e' stato
 * chiamato, "siamo chiusi" e' una risposta legittima e va lasciata passare.
 */
export function trovaChiusuraNonVerificata(testo: string, haControllato: boolean): string | null {
  if (haControllato || !dichiaraChiusuraOPieno(testo)) return null;
  return `ATTENZIONE: hai detto al cliente che siamo chiusi o che non c'e' posto, ma in questo turno non hai chiamato nessuno strumento che l'abbia verificato. Se sbagli, quel cliente se ne va e non torna, e nessuno sapra' mai che e' successo. Chiama adesso verifica_disponibilita o info_orari e rispondi con quello che dicono.`;
}

/**
 * L'ORA CONFERMATA DEVE ESSERE L'ORA PRENOTATA.
 *
 * IL CASO VERO, 19/09/2026. Nel database: `2026-09-22 07:00:00+00`, cioe' le
 * **09:00** di Roma. Nel messaggio al cliente: "alle 09:30". Lo strumento era
 * stato chiamato davvero, l'appuntamento esisteva davvero, e nessuno dei
 * controlli scattava: le 09:30 erano uno slot libero vero, quindi per la rete
 * sugli orari inventati erano legittime, e per la rete sulle azioni
 * l'appuntamento c'era.
 *
 * E' il difetto piu' insidioso della serie, perche' tutto e' vero tranne
 * l'unica cosa che il cliente segnera' sul calendario. Si presenta mezz'ora
 * dopo, il posto e' andato, e sia lui sia il salone hanno la prova scritta di
 * avere ragione.
 *
 * Qui non c'e' niente da chiedere al modello: l'ora giusta la sappiamo noi,
 * e' quella che abbiamo passato a `crea_prenotazione`.
 */
/** "2026-09-22T09:00" -> "09:00". Null se non c'e' nessuna prenotazione. */
export function oraDiInizioPrenotata(inizioLocaleIso: string | null): string | null {
  if (!inizioLocaleIso) return null;
  const ora = inizioLocaleIso.split("T")[1]?.slice(0, 5);
  return ora && /^([01]\d|2[0-3]):[0-5]\d$/.test(ora) ? ora : null;
}

export function trovaOrarioConfermatoSbagliato(testo: string, orarioPrenotato: string | null): string | null {
  if (!orarioPrenotato) return null;
  const diversi = [...new Set(orariNelTesto(testo))].filter((o) => o !== orarioPrenotato);
  if (diversi.length === 0) return null;
  return `ATTENZIONE: l'appuntamento risulta creato alle ${orarioPrenotato}, ma nel tuo messaggio compare ${diversi.join(
    ", "
  )}. Il cliente si segnera' l'ora che gli scrivi tu: se e' diversa da quella prenotata si presenta quando il posto non c'e' piu'. Riscrivi la conferma indicando ESCLUSIVAMENTE le ${orarioPrenotato}, senza nessun altro orario.`;
}

/**
 * La conferma scritta da noi, quando il modello continua a sbagliare l'ora.
 *
 * Non e' un messaggio di errore: l'appuntamento c'e' davvero ed e' giusto:
 * l'unica cosa sbagliata era la frase. Quindi si sostituisce la frase, con
 * una costruita dai dati veri -- data e ora sono quelle passate allo
 * strumento, non quelle ricordate dal modello.
 */
export function confermaConOrarioVero(inizioLocaleIso: string): string {
  const [ymd, oraCompleta] = inizioLocaleIso.split("T");
  const ora = (oraCompleta ?? "").slice(0, 5);
  return `È confermato: ${formattaGiornoEsteso(ymd)} alle ${ora}. Ci vediamo lì!`;
}
