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

/** Quanti orari mostrare in un messaggio di chat prima che diventi un elenco illeggibile. */
export const MAX_ORARI_DA_PROPORRE = 6;

/**
 * Sceglie gli orari da proporre per primi: il PRIMO libero, l'ULTIMO, e gli
 * altri distribuiti in mezzo.
 *
 * Perche' distribuiti e non i primi sei: i primi sei di una giornata con
 * passo 15 sono 08:00, 08:15, 08:30, 08:45, 09:00, 09:15 -- cioe' un'ora e
 * un quarto di mattina presto, che per un cliente equivale a non avere
 * scelta. Sei orari sparsi sulla giornata rispondono alla domanda vera, che
 * non e' "quali sono i primi" ma "a che ora posso venire".
 *
 * Il primo c'e' sempre perche' e' quello che serve a chi ha fretta;
 * l'ultimo perche' e' quello che serve a chi lavora fino a tardi. I due casi
 * che una selezione centrata taglierebbe fuori entrambi.
 */
export function selezionaOrariDaProporre(orari: string[], quanti = MAX_ORARI_DA_PROPORRE): string[] {
  const unici = [...new Set(orari)].sort();
  if (unici.length <= quanti) return unici;
  if (quanti <= 1) return unici.slice(0, Math.max(0, quanti));

  const scelti: string[] = [];
  const passo = (unici.length - 1) / (quanti - 1);
  for (let i = 0; i < quanti; i++) {
    scelti.push(unici[Math.round(i * passo)]);
  }
  return [...new Set(scelti)];
}

export interface SlotGrezzo {
  inizio: string;
  operatoreId: string;
}

export interface OrariPerIlModello {
  /** Ogni orario libero, come stringa gia' pronta da scrivere. */
  tutti_gli_orari_liberi: string[];
  /** I pochi da mostrare subito, ben distribuiti sulla giornata. */
  orari_da_mostrare: string[];
  /** Quanti ce ne sono in tutto: serve a dire "ho anche altri orari" senza inventare. */
  quanti_in_tutto: number;
}

export function preparaOrariPerIlModello(slot: SlotGrezzo[]): OrariPerIlModello {
  const orari = [...new Set(slot.map((s) => oraDaIso(s.inizio)).filter((o): o is string => o !== null))].sort();
  return {
    tutti_gli_orari_liberi: orari,
    orari_da_mostrare: selezionaOrariDaProporre(orari),
    quanti_in_tutto: orari.length,
  };
}
