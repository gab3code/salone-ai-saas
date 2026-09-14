import { pianoHaPromemoria } from "@/lib/piani";

/**
 * Logica pura del motore di "Promemoria automatici" (Fase 6, trovato nel
 * controllo promesse del sito 13/09/2026, costruito il 14/09/2026):
 * `Funzionalita.tsx` promette due cose distinte sotto questa voce --
 * "Reminder prima dell'appuntamento e follow-up ai clienti inattivi" -- e
 * questo file decide SOLO "chi va avvisato adesso", zero query, stesso
 * principio di separazione già seguito da booking-engine.ts/metriche.ts:
 * testabile senza database, il layer di connessione (promemoria.server.ts)
 * carica i dati grezzi e delega sempre qui la decisione, poi manda le email
 * e segna gli invii.
 *
 * --- Perché una finestra di 24-48 ore, non "esattamente 24 ore prima" ---
 * Il job gira una volta al giorno (Vercel Cron sul piano Hobby: al momento
 * non è nemmeno tecnicamente possibile andare più spesso di 1 volta/giorno,
 * vedi DECISIONS.md). Con un cron che scatta una volta sola al giorno a
 * un'ora FISSA, una finestra stretta (es. "tra 23 e 25 ore prima") mancherebbe
 * sistematicamente metà degli appuntamenti: la finestra si sposta insieme
 * all'orario dell'appuntamento, ma il cron no, quindi per metà degli orari
 * possibili i due semplicemente non si incontrerebbero mai. Una finestra
 * larga ESATTAMENTE 24 ore (qui 24-48h prima) garantisce invece che il cron,
 * qualunque sia la sua ora fissa, ci passi dentro per OGNI appuntamento,
 * indipendentemente dall'orario -- a costo di un preavviso che varia da 1 a
 * 2 giorni invece di essere fisso, più che sufficiente per la promessa
 * scritta ("reminder prima dell'appuntamento", nessun orario specifico
 * garantito). Se in futuro Gabriel passa a Vercel Pro (cron più frequenti),
 * si può stringere la finestra senza toccare questa funzione: bastano nuove
 * costanti.
 */
export const FINESTRA_PROMEMORIA_ORE_MIN = 24;
export const FINESTRA_PROMEMORIA_ORE_MAX = 48;

/** Un cliente inattivo non riceve il follow-up ogni singolo giorno finché resta inattivo:
 * al massimo una volta ogni tot giorni, altrimenti sarebbe spam vero e proprio. */
export const GIORNI_RIPETIZIONE_PROMEMORIA_INATTIVITA = 60;

export interface AppuntamentoPerPromemoria {
  id: string;
  inizio: Date;
  stato: string; // confermato | cancellato | completato | no_show
  promemoriaInviatoAt: Date | null;
  clienteEmail: string | null;
  tenantPiano: string;
}

/**
 * Appuntamenti a cui mandare il reminder ORA: confermati, sul piano giusto,
 * nella finestra di preavviso, con un'email del cliente da usare, e non
 * ancora avvisati (colonna `promemoria_inviato_at`, migrazione 0017 --
 * evita di rimandare la stessa email a ogni giro del cron).
 */
export function appuntamentiDaAvvisare(
  righe: AppuntamentoPerPromemoria[],
  adesso: Date
): AppuntamentoPerPromemoria[] {
  const inizioFinestra = new Date(adesso.getTime() + FINESTRA_PROMEMORIA_ORE_MIN * 60 * 60 * 1000);
  const fineFinestra = new Date(adesso.getTime() + FINESTRA_PROMEMORIA_ORE_MAX * 60 * 60 * 1000);

  return righe.filter(
    (r) =>
      r.stato === "confermato" &&
      pianoHaPromemoria(r.tenantPiano) &&
      r.promemoriaInviatoAt === null &&
      !!r.clienteEmail &&
      r.inizio >= inizioFinestra &&
      r.inizio < fineFinestra
  );
}

export interface ClientePerPromemoriaInattivita {
  id: string;
  email: string | null;
  tenantPiano: string;
  promemoriaInattivitaInviatoAt: Date | null;
}

/**
 * Clienti a cui mandare il follow-up "ci manchi" ORA: fa parte dell'insieme
 * "inattivo da 60 giorni" già calcolato da `elencaClientiInattivi`
 * (src/lib/metriche.ts -- stessa identica definizione di "inattivo" usata
 * dalla card in dashboard e dal filtro `/dashboard/clienti?filtro=inattivi`,
 * non una seconda regola scritta qui), sul piano giusto, con un'email da
 * usare, e non avvisato negli ultimi `GIORNI_RIPETIZIONE_PROMEMORIA_INATTIVITA`
 * giorni.
 */
export function clientiDaAvvisarePerInattivita(
  clienti: ClientePerPromemoriaInattivita[],
  clientiInattivi: Set<string>,
  adesso: Date
): ClientePerPromemoriaInattivita[] {
  const sogliaRipetizione = new Date(
    adesso.getTime() - GIORNI_RIPETIZIONE_PROMEMORIA_INATTIVITA * 24 * 60 * 60 * 1000
  );

  return clienti.filter(
    (c) =>
      clientiInattivi.has(c.id) &&
      pianoHaPromemoria(c.tenantPiano) &&
      !!c.email &&
      (c.promemoriaInattivitaInviatoAt === null || c.promemoriaInattivitaInviatoAt < sogliaRipetizione)
  );
}
