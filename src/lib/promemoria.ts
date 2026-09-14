import { pianoHaPromemoria } from "@/lib/piani";

/**
 * Logica pura del motore di "Promemoria automatici" (Fase 6, trovato nel
 * controllo promesse del sito 13/09/2026, costruito il 14/09/2026,
 * RESO CONFIGURABILE lo stesso giorno su richiesta di Gabriel: "vorrei che
 * lo staff possa decidere quanto tempo prima mandare il promemoria e anche
 * se averne più di uno"). `Funzionalita.tsx` promette due cose distinte
 * sotto questa voce -- "Reminder prima dell'appuntamento e follow-up ai
 * clienti inattivi" -- e questo file decide SOLO "chi va avvisato adesso",
 * zero query, stesso principio di separazione già seguito da
 * booking-engine.ts/metriche.ts: testabile senza database, il layer di
 * connessione (promemoria.server.ts) carica i dati grezzi e delega sempre
 * qui la decisione, poi manda le email e segna gli invii.
 *
 * --- Perché ogni regola ha una finestra larga ESATTAMENTE 24 ore ---
 * Il job gira una volta al giorno (Vercel Cron sul piano Hobby di Gabriel:
 * al momento non è nemmeno tecnicamente possibile andare più spesso di
 * 1 volta/giorno, vedi DECISIONS.md). Con un cron che scatta una volta sola
 * al giorno a un'ora FISSA, una finestra stretta (es. "tra 23 e 25 ore
 * prima") mancherebbe sistematicamente metà degli appuntamenti: la finestra
 * si sposta insieme all'orario dell'appuntamento, ma il cron no, quindi per
 * metà degli orari possibili i due semplicemente non si incontrerebbero
 * mai. Una finestra larga ESATTAMENTE 24 ore garantisce invece che il cron,
 * qualunque sia la sua ora fissa, ci passi dentro per OGNI appuntamento,
 * indipendentemente dall'orario -- a costo di un preavviso che varia di
 * ±12 ore rispetto al valore scelto invece di essere fisso al minuto, più
 * che sufficiente per la promessa scritta ("reminder prima
 * dell'appuntamento", nessun orario specifico garantito). Sotto le 24 ore
 * di preavviso questa garanzia non regge più (il cron potrebbe non passarci
 * mai dentro) -- l'interfaccia in dashboard avvisa lo staff se sceglie un
 * valore così basso, ma non lo impedisce: se in futuro Gabriel passa a
 * Vercel Pro (cron più frequenti), quei valori diventano affidabili senza
 * toccare questa funzione.
 */
export const LARGHEZZA_FINESTRA_ORE = 24;

/** Un cliente inattivo non riceve il follow-up ogni singolo giorno finché resta inattivo:
 * al massimo una volta ogni tot giorni, altrimenti sarebbe spam vero e proprio. */
export const GIORNI_RIPETIZIONE_PROMEMORIA_INATTIVITA = 60;

/** Tetto di regole per tenant (dashboard, vedi azioni.ts): oltre un certo numero di promemoria per
 * lo stesso appuntamento si scade nello spam anche con la migliore delle intenzioni. */
export const MAX_REGOLE_PROMEMORIA_PER_TENANT = 5;

export interface RegolaPromemoria {
  id: string;
  orePreavviso: number;
}

export interface AppuntamentoPerPromemoria {
  id: string;
  inizio: Date;
  stato: string; // confermato | cancellato | completato | no_show
  clienteEmail: string | null;
  tenantPiano: string;
  /** Id delle regole (RegolaPromemoria.id) già inviate per QUESTO appuntamento -- una per ognuna
   * delle eventuali più regole attive sul tenant, non un singolo booleano. */
  regoleGiaInviate: Set<string>;
}

/**
 * Appuntamenti a cui mandare il reminder di UNA specifica regola ORA:
 * confermati, sul piano giusto, nella finestra di preavviso di quella
 * regola, con un'email del cliente da usare, e quella regola specifica non
 * ancora inviata per quell'appuntamento (tabella
 * `promemoria_appuntamento_inviati`, migrazione 0017 -- evita di rimandare
 * la stessa email a ogni giro del cron, e permette a più regole di
 * scattare indipendentemente per lo stesso appuntamento).
 */
export function appuntamentiDaAvvisarePerRegola(
  righe: AppuntamentoPerPromemoria[],
  regola: RegolaPromemoria,
  adesso: Date
): AppuntamentoPerPromemoria[] {
  const inizioFinestra = new Date(adesso.getTime() + regola.orePreavviso * 60 * 60 * 1000);
  const fineFinestra = new Date(inizioFinestra.getTime() + LARGHEZZA_FINESTRA_ORE * 60 * 60 * 1000);

  return righe.filter(
    (r) =>
      r.stato === "confermato" &&
      pianoHaPromemoria(r.tenantPiano) &&
      !!r.clienteEmail &&
      !r.regoleGiaInviate.has(regola.id) &&
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
 * giorni. A differenza del reminder pre-appuntamento sopra, questo NON è
 * configurabile in numero/distanza (Gabriel non l'ha chiesto: "quanto tempo
 * prima" non ha senso per un'inattività, è un asse diverso).
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
