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
 *   2. quello che si sono gia' detti cliente e assistente -- se il cliente
 *      scrive "prenoto alle 8", l'assistente deve poter rispondere "alle
 *      8:00" senza richiamare uno strumento per il gusto di farlo.
 *
 * Tutto il resto e' inventato. Una lista di undici orari che non compare
 * da nessuna parte non supera nessuno dei due controlli; un "confermo le
 * 8:00" dopo che il cliente ha detto "alle 8" li supera entrambi.
 *
 * Si guardano SOLO gli orari scritti con i due punti (8:00, 14:30). "alle 8"
 * senza minuti resta fuori di proposito: e' ambiguo, e un controllo che
 * sbaglia a riconoscere fa piu' danni di uno che copre un po' meno.
 */

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
 * Gli orari leciti, presi da qualunque testo di riferimento: i risultati
 * degli strumenti (dove gli orari viaggiano come ISO, es.
 * "2026-09-22T08:00:00.000Z", oppure come "08:00:00") e i messaggi gia'
 * scambiati.
 */
export function orariConsentiti(testiDiRiferimento: string[]): Set<string> {
  const consentiti = new Set<string>();
  for (const testo of testiDiRiferimento) {
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
