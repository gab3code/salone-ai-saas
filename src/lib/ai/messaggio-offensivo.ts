/**
 * Riconoscere un messaggio offensivo PRIMA di pagare una chiamata al modello.
 *
 * Nasce da una prova dal vivo di Gabriel sulla demo (17/09/2026): a un
 * insulto secco l'assistente ha risposto "Mi dispiace, ma non ho capito
 * bene. Puoi ripetere?". Ha chiesto di RIPETERE un insulto. Il taglio dopo
 * N turni fuori tema c'era gia' e ha funzionato -- la conversazione si e'
 * chiusa al secondo turno -- ma quello che l'assistente dice DURANTE quei
 * turni non lo decideva nessuno, e su un salone vero i turni sono tre, con
 * il nome del salone sopra la chat.
 *
 * Qui non si fa moderazione dei contenuti e non si giudica nessuno: si
 * riconosce il caso ovvio per non sprecarci una chiamata al modello e per
 * garantire la risposta anche quando il modello sbaglia. Il caso non ovvio
 * (provocazione senza parolacce, sgarbo sottile) resta al system prompt,
 * che ha la sua regola, e al contatore dei turni, che chiude comunque.
 *
 * ----------------------------------------------------------------------
 * PERCHE' DUE LIVELLI E NON UNA LISTA SOLA
 *
 * Una lista sola avrebbe un difetto grave in un salone vero: "scusa, ho
 * fatto una cazzata, posso spostare l'appuntamento di domani?" e' un
 * cliente VERO con una richiesta VERA. Bloccarlo sarebbe peggio del
 * problema che stiamo risolvendo.
 *
 * Quindi:
 *
 * - TERMINI_ODIO -- insulti che in italiano non hanno nessun altro uso.
 *   Scattano sempre, anche dentro una frase lunga.
 * - TERMINI_VOLGARI -- volgarita' e insulti generici. Scattano SOLO quando
 *   il messaggio e' in sostanza solo quello (tolti i termini, resta quasi
 *   niente). "frocio" scatta; "ho fatto una cazzata, posso spostare?" no,
 *   e va al modello come qualunque altro messaggio.
 *
 * In TERMINI_VOLGARI stanno di proposito anche parole ambigue come "negro"
 * e "troia": da sole sono un insulto, dentro una frase ("sono il signor
 * Negro", "sono di Troia") non lo sono, ed e' esattamente la distinzione
 * che fa la regola dei due livelli.
 */

/** Cosa risponde l'assistente. Una volta, senza morale e senza scusarsi. */
export const RISPOSTA_MESSAGGIO_OFFENSIVO =
  "Su questo non posso aiutarti. Se vuoi prenotare, spostare o disdire un appuntamento dimmelo pure.";

/** Nessun altro uso in italiano: scattano anche dentro una frase lunga. */
const TERMINI_ODIO: readonly RegExp[] = [
  /\bfroci(?:o|a|e|i)?\b/,
  /\bricchion(?:e|i)\b/,
  /\bculatton(?:e|i)\b/,
  /\bmongoloid(?:e|i)\b/,
  /\bterron(?:e|i|a)\b/,
  /\bvaffan?[cg]ul(?:o|i)\b/,
  /\bfaggot(?:s)?\b/,
  /\bnigger(?:s)?\b/,
];

/**
 * Volgarita' e insulti generici: scattano solo se il messaggio e' in
 * sostanza solo quello.
 */
const TERMINI_VOLGARI: readonly RegExp[] = [
  /\bcazz(?:o|i|one|oni|ata|ate|aro)\b/,
  /\bstronz(?:o|a|i|e|ate|ata)\b/,
  /\bcoglion(?:e|i|a)\b/,
  /\bputtan(?:a|e)\b/,
  /\btroi(?:a|e)\b/,
  /\bnegr(?:o|a|i|e)\b/,
  /\bmerd(?:a|e|oso|osa)\b/,
  /\bbastard(?:o|a|i|e)\b/,
  /\bidiot(?:a|i|e)\b/,
  /\bcretin(?:o|a|i|e)\b/,
  /\bimbecill(?:e|i)\b/,
  /\bdeficient(?:e|i)\b/,
  /\bscem(?:o|a|i|e)\b/,
  /\bpirla\b/,
  /\bsfigat(?:o|a|i|e)\b/,
  /\bminchi(?:a|e)\b/,
  /\b(?:af)?fancul(?:o|i)\b/,
  /\bzingar(?:o|a|i|e)\b/,
  /\bporcodio\b/,
  /\bdiocane\b/,
  /\bdioporco\b/,
  /\bfuck(?:ing|ed|er|ers)?\b/,
  /\bshit\b/,
  /\bbitch(?:es)?\b/,
  /\basshole(?:s)?\b/,
];

const SOSTITUZIONI: Record<string, string> = {
  "0": "o",
  "1": "i",
  "!": "i",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  $: "s",
  "7": "t",
};

/** Minuscole, via gli accenti, spazi ridotti a uno solo. Niente altro. */
export function normalizzaPerConfronto(testo: string): string {
  return testo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Le sostituzioni da tastiera ("c4zz0" -> "cazzo", "sh!t" -> "shit").
 *
 * Tenuta SEPARATA dalla normalizzazione, e non fusa dentro, per un motivo
 * trovato da un test rosso: "MERDA!!!" diventava "merdaiii" e non veniva
 * piu' riconosciuto, perche' il punto esclamativo finale veniva letto come
 * una "i". La punteggiatura finale e' punteggiatura, non una lettera
 * travestita. Per questo le due forme si provano entrambe, invece di
 * sostituire e basta.
 */
export function applicaSostituzioni(testo: string): string {
  return testo.replace(/[0-9!@$]/g, (c) => SOSTITUZIONI[c] ?? c);
}

/**
 * Le forme da provare: con e senza sostituzioni, e per ognuna le due
 * riduzioni delle lettere ripetute -- a una sola ("frooocio" -> "frocio") e
 * a due ("cazzzzo" -> "cazzo"). Due riduzioni e non una perche' nessuna
 * delle due da sola copre entrambi i casi.
 */
function varianti(normalizzato: string): string[] {
  const basi = [normalizzato, applicaSostituzioni(normalizzato)];
  return basi.flatMap((b) => [b, b.replace(/(.)\1{1,}/g, "$1"), b.replace(/(.)\1{2,}/g, "$1$1")]);
}


/** Solo lettere, tutto attaccato: smonta "f.r.o.c.i.o" e "f r o c i o". */
function compattato(normalizzato: string): string {
  return normalizzato.replace(/[^a-z]/g, "");
}

function qualcheVariante(testi: string[], termini: readonly RegExp[]): boolean {
  return testi.some((t) => termini.some((r) => r.test(t)));
}

/**
 * Tolti i termini riconosciuti e la punteggiatura, quante parole restano?
 * Serve a distinguere l'insulto secco da una frase vera che contiene una
 * volgarita'.
 */
function paroleRestanti(normalizzato: string, termini: readonly RegExp[]): number {
  let residuo = normalizzato;
  for (const r of termini) {
    residuo = residuo.replace(new RegExp(r.source, "g"), " ");
  }
  return residuo
    .replace(/[^a-z ]/g, " ")
    .split(" ")
    .filter((p) => p.length > 1).length;
}

/**
 * Oltre questa soglia il messaggio e' una frase vera, non un insulto secco,
 * e va trattato come qualunque altro messaggio. Due parole lasciano passare
 * "ma vaffanculo va" senza lasciar passare una richiesta di spostamento.
 */
const PAROLE_RESIDUE_MASSIME = 2;

export type MotivoOffensivo = "odio" | "volgare";

export interface EsitoOffensivo {
  offensivo: boolean;
  motivo?: MotivoOffensivo;
}

export function analizzaMessaggioOffensivo(testo: string): EsitoOffensivo {
  if (typeof testo !== "string" || testo.trim() === "") return { offensivo: false };

  const normalizzato = normalizzaPerConfronto(testo);
  const forme = varianti(normalizzato);

  // Livello 1: scatta sempre. Anche sulla forma compattata, perche' questi
  // termini non compaiono dentro nessuna parola italiana legittima e
  // "f r o c i o" e' lo stesso messaggio con dentro degli spazi.
  const compatte = forme.map(compattato);
  if (
    qualcheVariante(forme, TERMINI_ODIO) ||
    TERMINI_ODIO.some((r) => compatte.some((c) => new RegExp(r.source.replace(/\\b/g, "")).test(c)))
  ) {
    return { offensivo: true, motivo: "odio" };
  }

  // Livello 2: solo se il messaggio e' in sostanza solo quello.
  if (qualcheVariante(forme, TERMINI_VOLGARI)) {
    const restano = Math.min(...forme.map((f) => paroleRestanti(f, TERMINI_VOLGARI)));
    if (restano <= PAROLE_RESIDUE_MASSIME) return { offensivo: true, motivo: "volgare" };
  }

  return { offensivo: false };
}

export function eMessaggioOffensivo(testo: string): boolean {
  return analizzaMessaggioOffensivo(testo).offensivo;
}
