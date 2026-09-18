/**
 * Date in italiano, scritte come le scrive una persona.
 *
 * Il calendario mostrava "2026-09-21": e' il formato con cui la data viaggia
 * nell'URL e nel database, non quello in cui si legge. Un titolare italiano
 * legge 21/09/2026, e leggendo "2026-09-21" il primo dubbio e' se 09 sia il
 * mese o il giorno -- dubbio che in un'agenda non deve esistere.
 *
 * Tutto parte dalla stringa `AAAA-MM-GG` e non da un `Date`: convertire in
 * `Date` e poi formattare significa passare da un fuso orario, e a mezzanotte
 * un fuso sbagliato sposta il giorno. Qui il giorno non si sposta perche' non
 * viene mai interpretato come un istante.
 */

export const NOMI_GIORNI_SETTIMANA = [
  "domenica",
  "lunedi'",
  "martedi'",
  "mercoledi'",
  "giovedi'",
  "venerdi'",
  "sabato",
] as const;

const NOMI_MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;

interface PartiData {
  anno: number;
  mese: number; // 1-12
  giorno: number;
}

function leggiYMD(ymd: string): PartiData | null {
  const corrispondenza = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!corrispondenza) return null;

  const anno = Number(corrispondenza[1]);
  const mese = Number(corrispondenza[2]);
  const giorno = Number(corrispondenza[3]);
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;

  // Un 31 novembre passa il controllo qui sopra ma non esiste: lo scopre solo
  // il calendario vero, che lo farebbe scivolare al 1 dicembre.
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  if (data.getUTCMonth() !== mese - 1 || data.getUTCDate() !== giorno) return null;

  return { anno, mese, giorno };
}

/** Il giorno della settimana (0 = domenica), come `getUTCDay`. */
export function giornoSettimanaDaYMD(ymd: string): number | null {
  const parti = leggiYMD(ymd);
  if (!parti) return null;
  return new Date(Date.UTC(parti.anno, parti.mese - 1, parti.giorno)).getUTCDay();
}

/** "21/09/2026". Per le tabelle e i posti stretti. */
export function formattaDataItaliana(ymd: string): string {
  const parti = leggiYMD(ymd);
  if (!parti) return ymd; // meglio la stringa grezza di un "Invalid Date"
  return `${String(parti.giorno).padStart(2, "0")}/${String(parti.mese).padStart(2, "0")}/${parti.anno}`;
}

/** "lunedi' 21 settembre 2026". Per l'intestazione di una giornata. */
export function formattaGiornoEsteso(ymd: string): string {
  const parti = leggiYMD(ymd);
  if (!parti) return ymd;
  const giornoSettimana = NOMI_GIORNI_SETTIMANA[giornoSettimanaDaYMD(ymd) ?? 0];
  return `${giornoSettimana} ${parti.giorno} ${NOMI_MESI[parti.mese - 1]} ${parti.anno}`;
}
