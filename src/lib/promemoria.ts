import { pianoHaPromemoria, pianoHaSms } from "@/lib/piani";

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

/**
 * Un cliente inattivo non riceve il follow-up ogni singolo giorno finché
 * resta inattivo: al massimo una volta ogni tot giorni, altrimenti sarebbe
 * spam vero e proprio.
 *
 * Dal 17/09/2026 la SOGLIA di inattività è configurabile dal salone
 * (`tenants.follow_up_inattivi_giorni`, migrazione 0040), ma questa finestra
 * NO, ed è un pavimento: `finestraRipetizione` sotto non scende mai sotto
 * questi 60 giorni. Sono due assi diversi -- il titolare decide quando uno
 * dei suoi clienti è "sparito", non quanto spesso gli si può riscrivere --
 * e senza il pavimento un salone che imposta 14 giorni finirebbe per
 * scrivere alla stessa persona ventisei volte l'anno credendo di fare
 * fidelizzazione.
 */
export const GIORNI_RIPETIZIONE_PROMEMORIA_INATTIVITA = 60;

/** Paletti della soglia configurabile (stesso `check` della migrazione 0040). */
export const GIORNI_INATTIVITA_MIN = 14;
export const GIORNI_INATTIVITA_MAX = 365;
export const GIORNI_INATTIVITA_PREDEFINITI = 60;

/** Quanti giorni devono passare prima di riscrivere allo stesso cliente. */
export function finestraRipetizioneGiorni(giorniInattivita: number): number {
  return Math.max(GIORNI_RIPETIZIONE_PROMEMORIA_INATTIVITA, giorniInattivita);
}

/**
 * Soglia valida, normalizzata: un valore assente o fuori dai paletti ricade
 * sul predefinito invece di far fallire il job notturno. Il `check` sul
 * database impedisce già di salvarne uno storto dalla UI -- questa è la rete
 * per i dati che arrivano da altrove (un ripristino, una riga toccata a
 * mano).
 */
export function giorniInattivitaValidi(valore: number | null | undefined): number {
  if (typeof valore !== "number" || !Number.isInteger(valore)) return GIORNI_INATTIVITA_PREDEFINITI;
  if (valore < GIORNI_INATTIVITA_MIN || valore > GIORNI_INATTIVITA_MAX) {
    return GIORNI_INATTIVITA_PREDEFINITI;
  }
  return valore;
}

/** Testo predefinito del follow-up, quando il salone non ne scrive uno suo. */
export const MESSAGGIO_FOLLOW_UP_PREDEFINITO =
  "Ciao {nome}, è passato un po' dal tuo ultimo appuntamento — ti aspettiamo!";

export const LUNGHEZZA_MASSIMA_MESSAGGIO_FOLLOW_UP = 300;

/**
 * Compone il messaggio sostituendo `{nome}`. Stessa identica meccanica di
 * `comporreMessaggioCompleanno` (src/lib/compleanno.ts): un cliente senza
 * nome non deve produrre "Ciao , è passato un po'", quindi dopo la
 * sostituzione gli spazi doppi si richiudono.
 */
export function comporreMessaggioFollowUp(template: string | null, nomeCliente: string | null): string {
  const base = template && template.trim() ? template : MESSAGGIO_FOLLOW_UP_PREDEFINITO;
  const nome = nomeCliente && nomeCliente.trim() ? nomeCliente.trim() : "";
  return base.replace(/\{nome\}/gi, nome).replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
}

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
  /** Canale di fallback quando il cliente non ha lasciato un'email (SMS su
   * Pro/Enterprise, vedi pianoHaSms in piani.ts) -- MAI usato in aggiunta
   * all'email, solo in sua sostituzione: un cliente con email riceve
   * sempre e solo l'email. */
  clienteTelefono: string | null;
  tenantPiano: string;
  /** Id delle regole (RegolaPromemoria.id) già inviate per QUESTO appuntamento -- una per ognuna
   * delle eventuali più regole attive sul tenant, non un singolo booleano. */
  regoleGiaInviate: Set<string>;
}

/**
 * Appuntamenti a cui mandare il reminder di UNA specifica regola ORA:
 * confermati, sul piano giusto, nella finestra di preavviso di quella
 * regola, con un modo di contattare il cliente (email, o telefono SOLO se
 * il piano include l'SMS -- deciso con Gabriel il 14/09/2026, vedi
 * DECISIONS.md: l'SMS costa soldi veri, quindi anche qui, come per
 * pianoHaPromemoria, si ricontrolla il piano invece di fidarsi che il
 * chiamante l'abbia già fatto), e quella regola specifica non ancora
 * inviata per quell'appuntamento (tabella `promemoria_appuntamento_inviati`,
 * migrazione 0017 -- evita di rimandare lo stesso avviso a ogni giro del
 * cron, e permette a più regole di scattare indipendentemente per lo stesso
 * appuntamento).
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
      (!!r.clienteEmail || (!!r.clienteTelefono && pianoHaSms(r.tenantPiano))) &&
      !r.regoleGiaInviate.has(regola.id) &&
      r.inizio >= inizioFinestra &&
      r.inizio < fineFinestra
  );
}

export interface ClientePerPromemoriaInattivita {
  id: string;
  email: string | null;
  /** Stesso fallback SMS del reminder pre-appuntamento sopra -- vedi il
   * docblock di AppuntamentoPerPromemoria.clienteTelefono. */
  telefono: string | null;
  tenantPiano: string;
  promemoriaInattivitaInviatoAt: Date | null;
}

/**
 * Clienti a cui mandare il follow-up "ci manchi" ORA: fa parte dell'insieme
 * "inattivo da 60 giorni" già calcolato da `elencaClientiInattivi`
 * (src/lib/metriche.ts -- stessa identica definizione di "inattivo" usata
 * dalla card in dashboard e dal filtro `/dashboard/clienti?filtro=inattivi`,
 * non una seconda regola scritta qui), sul piano giusto, con un modo di
 * contattarlo (email, o telefono solo se il piano include l'SMS -- stesso
 * principio del reminder pre-appuntamento sopra), e non avvisato negli
 * ultimi `finestraRipetizioneGiorni(giorniInattivita)` giorni.
 *
 * 17/09/2026: `giorniInattivita` arriva dal salone
 * (`tenants.follow_up_inattivi_giorni`) e non è più 60 fisso. Chi decide
 * l'insieme degli inattivi resta però `elencaClientiInattivi`, chiamata dal
 * layer server con LA STESSA soglia usata dalla card della dashboard e dal
 * filtro della rubrica: se qui si usasse un numero e là un altro, un salone
 * vedrebbe scritto "3 clienti non prenotano da 90 giorni" e riceverebbe
 * email partite su un insieme diverso.
 */
export function clientiDaAvvisarePerInattivita(
  clienti: ClientePerPromemoriaInattivita[],
  clientiInattivi: Set<string>,
  adesso: Date,
  giorniInattivita: number = GIORNI_INATTIVITA_PREDEFINITI
): ClientePerPromemoriaInattivita[] {
  const sogliaRipetizione = new Date(
    adesso.getTime() - finestraRipetizioneGiorni(giorniInattivita) * 24 * 60 * 60 * 1000
  );

  return clienti.filter(
    (c) =>
      clientiInattivi.has(c.id) &&
      pianoHaPromemoria(c.tenantPiano) &&
      (!!c.email || (!!c.telefono && pianoHaSms(c.tenantPiano))) &&
      (c.promemoriaInattivitaInviatoAt === null || c.promemoriaInattivitaInviatoAt < sogliaRipetizione)
  );
}
