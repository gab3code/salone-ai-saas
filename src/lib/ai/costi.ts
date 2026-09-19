/**
 * Quanto costa DAVVERO una risposta dell'assistente.
 *
 * Nasce il 19/09/2026 da una domanda di Gabriel sui tetti dei piani, e dalla
 * scoperta che non c'era modo di rispondere: il conto scritto in DECISIONS.md
 * il 02/09 ("prenotazione completa ~$0,02") e' risultato ottimistico di circa
 * due volte e mezzo quando l'ho rifatto, e il conto rifatto e' a sua volta una
 * stima. Due stime che non vanno d'accordo non fanno un numero: fanno capire
 * che serve una misura.
 *
 * L'API Anthropic restituisce `usage` su OGNI risposta -- token in ingresso,
 * in uscita, scritti in cache e letti dalla cache -- e fino a oggi non lo
 * leggeva nessuno.
 *
 * ----------------------------------------------------------------------
 * PERCHE' IL COSTO SI CONGELA AL MOMENTO DELLA CHIAMATA, invece di
 * ricalcolarlo dopo dai token.
 *
 * I prezzi delle API cambiano. Se domani Haiku costasse meta', ricalcolare
 * oggi il costo di una conversazione di settembre con i prezzi di domani
 * darebbe un numero che non e' mai stato vero, e la storia dei margini
 * diventerebbe una finzione retroattiva. Quindi in ogni riga finiscono
 * ENTRAMBI: i token grezzi (che non invecchiano mai) e il costo calcolato con
 * il listino in vigore in quel momento, piu' il nome del listino usato.
 *
 * ----------------------------------------------------------------------
 * PERCHE' MICRO-DOLLARI INTERI e non euro con la virgola.
 *
 * Una chiamata costa qualche millesimo di dollaro. In virgola mobile,
 * sommarne centomila accumula un errore che nessuno si accorge di avere
 * finche' non deve difendere un numero. Un intero in milionesimi di dollaro
 * regge fino a oltre 2.000 dollari su un `int` a 32 bit e non perde niente
 * nella somma. La conversione in euro si fa alla fine, una volta, quando si
 * guarda il totale.
 */

/** Prezzi in dollari per MILIONE di token. */
export interface ListinoModello {
  /** Nome del listino, scritto in ogni riga: serve a rileggere i dati vecchi. */
  nome: string;
  input: number;
  output: number;
  scritturaCache: number;
  letturaCache: number;
}

/**
 * Listino di Claude Haiku 4.5, verificato su platform.claude.com il
 * 19/09/2026. Il modello e' quello in `agente.ts`.
 *
 * CHI CAMBIA QUESTI NUMERI cambi anche `nome`: e' l'unica cosa che permette,
 * fra sei mesi, di sapere con quale listino e' stata calcolata una riga
 * vecchia. Un listino aggiornato che tiene il nome vecchio rende i dati
 * storici indistinguibili da quelli nuovi, che e' esattamente il problema che
 * questo modulo esiste per evitare.
 */
export const LISTINO_HAIKU_4_5: ListinoModello = {
  nome: "haiku-4.5@2026-09-19",
  input: 1.0,
  output: 5.0,
  scritturaCache: 1.25,
  letturaCache: 0.1,
};

/** I quattro numeri che l'API restituisce in `usage`. */
export interface UsoToken {
  input: number;
  output: number;
  scritturaCache: number;
  letturaCache: number;
}

const MICRO_PER_DOLLARO = 1_000_000;

/**
 * Il costo di una chiamata, in milionesimi di dollaro, arrotondato per
 * eccesso.
 *
 * Per eccesso e non al piu' vicino: fra sottostimare e sovrastimare il costo
 * di un piano, l'errore che fa male e' il primo -- e' quello che fa sembrare
 * sano un margine che non lo e'. L'arrotondamento per eccesso su una singola
 * chiamata vale meno di un milionesimo di dollaro; su centomila chiamate vale
 * dieci centesimi. E' un prezzo onesto per non sbagliare mai dalla parte
 * sbagliata.
 */
export function costoMicroDollari(uso: UsoToken, listino: ListinoModello = LISTINO_HAIKU_4_5): number {
  const dollari =
    (uso.input * listino.input +
      uso.output * listino.output +
      uso.scritturaCache * listino.scritturaCache +
      uso.letturaCache * listino.letturaCache) /
    1_000_000;
  return Math.ceil(dollari * MICRO_PER_DOLLARO);
}

/** Da micro-dollari a dollari, per quando il numero va letto da una persona. */
export function microDollariADollari(micro: number): number {
  return micro / MICRO_PER_DOLLARO;
}

/**
 * Legge `usage` da una risposta dell'API senza fidarsi della sua forma.
 *
 * I campi della cache sono opzionali e sono `null` quando la cache non e'
 * stata usata; un campo nuovo o rinominato in una versione futura dell'SDK
 * non deve far esplodere una conversazione con un cliente vero. Tutto cio'
 * che non e' un numero finito e non negativo diventa zero: una misura
 * mancante vale zero, mai NaN, che si propagherebbe silenziosamente in ogni
 * somma successiva.
 */
export function leggiUso(grezzo: unknown): UsoToken {
  const u = (grezzo ?? {}) as Record<string, unknown>;
  const numero = (v: unknown): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };
  return {
    input: numero(u.input_tokens),
    output: numero(u.output_tokens),
    scritturaCache: numero(u.cache_creation_input_tokens),
    letturaCache: numero(u.cache_read_input_tokens),
  };
}

/** I canali da cui puo' arrivare una chiamata al modello. */
export type CanaleUsoApi =
  | "chat_web"
  | "whatsapp"
  | "demo_landing"
  | "prova_assistente"
  | "onboarding"
  | "follow_up"
  | "report"
  | "import_clienti";
