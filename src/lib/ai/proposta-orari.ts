/**
 * Quali orari mostrare al cliente, e in che forma darli al modello.
 *
 * ----------------------------------------------------------------------
 * IL PROBLEMA, visto dal vivo il 19/09/2026.
 *
 * Il salone di prova ha il passo a 15 minuti. Per una manicure di mezz'ora,
 * `verifica_disponibilita` restituisce una quarantina di slot: 08:00, 08:15,
 * 08:30, 08:45, 09:00... Nessuno puo' mostrarne quaranta in una chat, e
 * infatti il modello non l'ha fatto: ha scritto una lista oraria tonda
 * (8:00, 9:00, 10:00, 11:00) che nello strumento non c'era, e al giro dopo
 * ne ha inventata un'altra con dentro la pausa pranzo.
 *
 * La tentazione e' dire che il modello ha sbagliato. Ma gli avevamo dato
 * quaranta timestamp ISO e il compito implicito di riassumerli: **il difetto
 * e' nostro, perche' gli abbiamo chiesto di trasformare dei dati invece di
 * consegnarglieli gia' pronti da dire.**
 *
 * Ogni trasformazione che chiediamo al modello e' un punto in cui puo'
 * sbagliare. Formattare un ISO in "8:00", scegliere quali mostrare,
 * accorciare una lista lunga: sono tre occasioni di inventare, e le abbiamo
 * create noi. Qui le togliamo tutte e tre -- il modello riceve le stringhe
 * esatte da scrivere, e il suo unico compito torna a essere quello che sa
 * fare: metterci intorno una frase in italiano.
 */

/** Da un ISO in pseudo-UTC a "HH:MM", che e' la forma in cui si dice un'ora. */
export function oraDaIso(iso: string): string | null {
  const m = /T([01]\d|2[0-3]):([0-5]\d)/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * I confini delle fasce, scelti su come parla un cliente e non su come divide
 * la giornata un orologio.
 *
 * "Mattina" finisce alle 13: un appuntamento alle 12:30 uno lo chiama
 * mattina, non pomeriggio. "Sera" comincia alle 18, che e' l'ora in cui si
 * dice "passo dopo il lavoro". Un salone che chiude alle 18 non avra' mai la
 * fascia sera, e va benissimo: le fasce vuote non si mostrano.
 */
const FINE_MATTINA = "13:00";
const INIZIO_SERA = "18:00";

export interface OrariPerFascia {
  mattina: string[];
  pomeriggio: string[];
  sera: string[];
}

/**
 * Gli stessi orari, divisi in tre gruppi.
 *
 * Serve a una cosa sola: rendere leggibile un elenco lungo. Trentatre orari
 * di fila sono un muro che nessuno legge; gli stessi trentatre su tre righe
 * con un'etichetta davanti si scorrono in due secondi. Il raggruppamento lo
 * facciamo noi perche' e' l'ennesima trasformazione che non vogliamo chiedere
 * al modello -- vedi il commento in testa a questo file.
 */
export function raggruppaPerFascia(orari: string[]): OrariPerFascia {
  const gruppi: OrariPerFascia = { mattina: [], pomeriggio: [], sera: [] };
  for (const o of [...new Set(orari)].sort()) {
    if (o < FINE_MATTINA) gruppi.mattina.push(o);
    else if (o < INIZIO_SERA) gruppi.pomeriggio.push(o);
    else gruppi.sera.push(o);
  }
  return gruppi;
}

export interface SlotGrezzo {
  inizio: string;
  operatoreId: string;
}

export interface OrariPerIlModello {
  /**
   * TUTTI gli orari liberi, gia' come stringhe pronte da scrivere.
   *
   * Tutti, non una selezione: e' una richiesta esplicita di Gabriel del
   * 19/09/2026 ("voglio che dica tutti gli orari liberi, no riassunti"), e ha
   * ragione lui. Un cliente che chiede quando c'e' posto vuole sapere quando
   * c'e' posto, e una selezione di sei orari lo costringe a chiedere ancora
   * -- cioe' a spendere un altro messaggio per avere una cosa che poteva
   * ricevere subito.
   */
  tutti_gli_orari_liberi: string[];
  /** Gli stessi, divisi in mattina/pomeriggio/sera per poterli scrivere leggibili. */
  orari_per_fascia: OrariPerFascia;
  /** Quanti sono in tutto. Se si dice un numero al cliente, si dice questo. */
  quanti_in_tutto: number;
  /** Il primo libero della giornata, per chi chiede "quando prima?". */
  primo_libero: string | null;
}

export function preparaOrariPerIlModello(slot: SlotGrezzo[]): OrariPerIlModello {
  const orari = [...new Set(slot.map((s) => oraDaIso(s.inizio)).filter((o): o is string => o !== null))].sort();
  return {
    tutti_gli_orari_liberi: orari,
    orari_per_fascia: raggruppaPerFascia(orari),
    quanti_in_tutto: orari.length,
    primo_libero: orari[0] ?? null,
  };
}
