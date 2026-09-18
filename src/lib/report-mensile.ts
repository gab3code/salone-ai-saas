/**
 * Il report mensile (Pro): parte pura.
 *
 * Una volta al mese il salone riceve, senza doverlo chiedere, il riassunto
 * di com'e' andato e cosa converrebbe guardare. E' la cosa che nessun
 * titolare ha tempo di fare da solo: aprire i numeri, confrontarli col mese
 * prima, accorgersi che una decina di clienti non si vede piu'.
 *
 * LA REGOLA DI FONDO, che vale piu' di tutto il resto di questo file:
 * **i numeri li calcoliamo noi, le parole le scrive il modello.**
 *
 * L'email mostra le cifre che abbiamo contato, non quelle che il modello
 * ricorda di aver letto. Al modello si chiede solo il commento, e gli si
 * vieta di scrivere cifre: un commento con dentro un numero viene scartato
 * e si manda il report senza commento. Cosi' l'errore peggiore possibile --
 * un titolare che prende una decisione su un numero inventato -- non puo'
 * proprio succedere, invece di dipendere da quanto e' bravo il modello.
 */

export interface DatiReportMensile {
  nomeSalone: string;
  /** "settembre 2026", gia' in italiano. */
  mese: string;
  appuntamenti: number;
  appuntamentiMesePrecedente: number;
  noShow: number;
  cancellati: number;
  clientiNuovi: number;
  clientiCheNonTornano: number;
  /** I piu' prenotati del mese, al massimo tre. */
  serviziPiuRichiesti: { nome: string; quante: number }[];
}

export const MAX_CARATTERI_COMMENTO = 700;

export const SYSTEM_REPORT = `Commenti i numeri del mese di un salone, scrivendo al titolare.

Regole, tutte non negoziabili:
- due o tre frasi brevi, mai piu' di ${MAX_CARATTERI_COMMENTO} caratteri;
- in italiano, concreto e diretto, come un collega che ha guardato i numeri con lui;
- NON SCRIVERE MAI CIFRE, in nessuna forma: ne' numeri ne' percentuali ne' numeri scritti in lettere. Le cifre le mostra gia' la tabella sopra il tuo commento, e ripeterle male sarebbe peggio che non dirle;
- non inventare cause che i dati non mostrano ("forse per il maltempo"): puoi dire cos'e' cambiato, non perche';
- se qualcosa e' peggiorato dillo chiaramente, senza addolcirlo: un report che dice sempre che va tutto bene non serve a niente;
- chiudi con UNA cosa concreta da fare questo mese, scelta fra quelle che i numeri suggeriscono davvero;
- niente emoji, niente saluti, niente firma.`;

export function promptReport(dati: DatiReportMensile): string {
  const righe = [
    `Salone: ${dati.nomeSalone}`,
    `Mese: ${dati.mese}`,
    `Appuntamenti del mese: ${dati.appuntamenti}`,
    `Appuntamenti del mese precedente: ${dati.appuntamentiMesePrecedente}`,
    `Clienti nuovi: ${dati.clientiNuovi}`,
    `Cancellati: ${dati.cancellati}`,
    `Non presentati: ${dati.noShow}`,
    `Clienti che non tornano da un po': ${dati.clientiCheNonTornano}`,
  ];
  if (dati.serviziPiuRichiesti.length > 0) {
    righe.push(
      `Servizi piu' richiesti: ${dati.serviziPiuRichiesti.map((s) => `${s.nome} (${s.quante})`).join(", ")}`
    );
  }
  return righe.join("\n");
}

/**
 * Il commento e' spedibile solo se non contiene cifre. Niente riparazioni:
 * un commento a cui si tolgono i numeri diventa una frase monca, e una frase
 * monca in un'email che parla di soldi e' peggio di nessuna frase.
 */
export function commentoAccettabile(grezzo: unknown): string | null {
  if (typeof grezzo !== "string") return null;
  const testo = grezzo.trim();
  if (testo.length < 30) return null;
  if (testo.length > MAX_CARATTERI_COMMENTO) return null;
  if (/\d/.test(testo)) return null;
  if (/%/.test(testo)) return null;
  if (/https?:\/\/|www\./i.test(testo)) return null;
  return testo;
}

/** Il mese precedente a `adesso`, come primo e ultimo istante e come nome. */
export function meseDaRaccontare(adesso: Date): { inizio: Date; fine: Date; nome: string; chiave: string } {
  const inizio = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth() - 1, 1));
  const fine = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), 1));
  const nomi = [
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
  ];
  return {
    inizio,
    fine,
    nome: `${nomi[inizio.getUTCMonth()]} ${inizio.getUTCFullYear()}`,
    chiave: `${inizio.getUTCFullYear()}-${String(inizio.getUTCMonth() + 1).padStart(2, "0")}`,
  };
}

/** true il giorno in cui il report va spedito: il primo del mese. */
export function eGiornoDelReport(adesso: Date): boolean {
  return adesso.getUTCDate() === 1;
}
