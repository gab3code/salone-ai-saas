/**
 * L'unica meta' del tono che il codice puo' garantire: le emoji.
 *
 * "Suona amichevole" non e' verificabile da codice -- e' un giudizio, e resta
 * affidato agli esempi nel prompt. "C'e' un'emoji" invece e' un fatto, e due
 * dei tre stili dicono esplicitamente di non usarne nessuna. Quindi quella
 * meta' smette di dipendere dalla buona volonta' del modello: se lo stile
 * scelto dal titolare e' "professionale" o "amichevole" e nel messaggio
 * compare un'emoji, la togliamo prima di mandarlo.
 *
 * Nell'altra direzione non si puo' fare la stessa cosa: aggiungere un'emoji a
 * un testo che non ne ha vuol dire sceglierla e piazzarla, e finirebbe
 * addosso anche al messaggio che dice "quello slot si e' appena occupato".
 * Un'emoji messa dal codice nel posto sbagliato fa piu' danni di una mancante
 * -- quindi li' restano gli esempi, ed e' scritto che e' probabilistico.
 */

// Intervalli standard: simboli e pittogrammi, emoticon, trasporti, bandiere,
// simboli supplementari, piu' i selettori di variante e i modificatori di
// tono della pelle che li accompagnano.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{200D}\u{20E3}]/gu;

export function contieneEmoji(testo: string): boolean {
  EMOJI.lastIndex = 0;
  return EMOJI.test(testo);
}

/**
 * Toglie le emoji e ricuce la punteggiatura: "Ecco cosa facciamo 💅 manicure"
 * non deve diventare "Ecco cosa facciamo  manicure" con due spazi, ne'
 * lasciare uno spazio prima di un punto.
 */
export function rimuoviEmoji(testo: string): string {
  return testo
    .replace(EMOJI, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,!?;:])/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

/**
 * Applica la meta' verificabile del tono: se lo stile scelto dal titolare non
 * prevede emoji, il messaggio esce senza.
 *
 * `import type` (non un import normale) perche' `StileTonoAI` vive in
 * agente.ts, che a sua volta importa questo file: un tipo si cancella in
 * compilazione e non crea nessun ciclo a runtime.
 */
export function pulisciEmojiFuoriTono(testo: string, stile: StileTono | undefined): string {
  if (stile === "informale_con_emoji") return testo;
  return contieneEmoji(testo) ? rimuoviEmoji(testo) : testo;
}

type StileTono = import("./agente").StileTonoAI;
