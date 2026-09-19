/**
 * Tetti all'uso dell'AI per singolo chiamante, riconosciuto dall'IP.
 *
 * E' il primo limite del progetto che NON si aggira cambiando qualcosa nel
 * client. Tutti gli altri (intervallo minimo fra messaggi, tetto per
 * conversazione, turni fuori tema) sono agganciati a
 * `identificatore_sessione`, che pero' lo sceglie chi chiama: basta
 * generarne uno nuovo a ogni richiesta per ripartire da zero. L'IP no: lo
 * mette la piattaforma.
 *
 * Vale per la demo E per la chat dei saloni veri, perche' il problema e' lo
 * stesso visto da due lati -- sulla demo uno insistente consuma il tetto
 * mensile condiviso di tutti gli altri, su un salone vero brucia la quota
 * che quel salone ha pagato e la toglie ai suoi clienti.
 */

export interface TettiIp {
  perOra: number;
  perGiorno: number;
}

/**
 * La demo: un tetto MENSILE per connessione, non orario.
 *
 * Scelta di Gabriel del 17/09/2026: "ogni connessione che usa la demo deve
 * avere un limite davvero stretto, che basta a provarla, e poi non puo' piu'
 * provarla entro un mese".
 *
 * Il ragionamento e' diverso da quello della chat dei saloni. Li' un tetto
 * orario ha senso perche' la stessa persona puo' avere bisogno di scrivere di
 * nuovo domani: e' un cliente. Qui no -- chi prova la demo la prova, e se
 * dopo venti messaggi non ha capito se il prodotto gli serve, altri venti non
 * lo aiuteranno. Un tetto orario sarebbe solo un modo per farlo tornare ogni
 * ora.
 *
 * VENTI, e non meno: una prenotazione completa sta in cinque o sei messaggi,
 * quindi sono circa tre prove intere. Bastano a provarla, a riprovarla con
 * una domanda diversa e a farla vedere a un socio -- e coprono il caso di due
 * persone dietro la stessa connessione (il wi-fi di un ufficio, una rete
 * mobile che condivide l'uscita) senza che una blocchi l'altra.
 */
export const MESSAGGI_DEMO_PER_CONNESSIONE_AL_MESE = 20;

/** Chiave del contatore mensile per connessione, in `contatori_globali`. */
export function chiaveDemoPerConnessione(improntaIp: string): string {
  return `demo_ip:${improntaIp}`;
}

/**
 * La chat pubblica di un salone vero: numeri piu' alti, e di proposito.
 *
 * Qui dall'altra parte c'e' un CLIENTE VERO che sta prenotando, e bloccarlo
 * costa al salone molto piu' di quanto costi a noi qualche messaggio in piu'.
 * 40 all'ora e 120 al giorno stanno larghissimi per una persona (una
 * prenotazione sono dieci messaggi) e restano un muro contro uno script.
 *
 * Il caso da non rompere: piu' clienti dietro lo stesso indirizzo -- il wi-fi
 * di un ufficio, una rete mobile che condivide l'uscita. Per questo il tetto
 * giornaliero e' dodici volte una conversazione tipica e non due.
 */
export const TETTI_CHAT_SALONE: TettiIp = { perOra: 40, perGiorno: 120 };

/**
 * Il form pubblico di prenotazione (19/09/2026). Era l'ultima porta pubblica
 * senza un tetto per indirizzo: c'erano l'anti-bot silenzioso (campo trappola
 * e tempo di compilazione) e le finestre per tenant (troppe prenotazioni in
 * poco tempo, stesso telefono), tutte aggirabili cambiando telefono o salone.
 *
 * Numeri larghi, e PER SALONE (vedi `chiaveLimiteIp`): venti scritture in
 * un'ora dallo stesso indirizzo allo stesso salone non sono un cliente, sono
 * uno script -- ma una famiglia sullo stesso Wi-Fi che prenota quattro
 * persone e sbaglia il numero due volte ci deve stare comoda, e un picco
 * dopo un post social (la preoccupazione di Gabriel del 14/09/2026 sui tetti
 * di volume) arriva da indirizzi diversi e non lo tocca. Vale per
 * prenotazione, caparra e lista d'attesa insieme: e' la stessa mano.
 */
export const TETTI_PRENOTAZIONE_PUBBLICA: TettiIp = { perOra: 20, perGiorno: 60 };

/**
 * Estrae l'indirizzo di chi chiama dalle intestazioni della richiesta.
 *
 * Su Vercel `x-forwarded-for` e' scritto dalla piattaforma e il PRIMO valore
 * e' il client; i successivi sono i proxy attraversati. Si prende il primo.
 *
 * Fuori da Vercel (sviluppo in locale) l'intestazione puo' mancare: in quel
 * caso si ritorna null e chi chiama decide. Non si inventa un valore: un
 * finto "sconosciuto" diverso a ogni richiesta non limiterebbe niente, e uno
 * uguale per tutti metterebbe il mondo intero in un secchiello solo.
 */
export function ipDaIntestazioni(intestazioni: { get(nome: string): string | null }): string | null {
  const inoltrato = intestazioni.get("x-forwarded-for");
  if (inoltrato) {
    const primo = inoltrato.split(",")[0]?.trim();
    if (primo) return primo;
  }
  const reale = intestazioni.get("x-real-ip")?.trim();
  return reale || null;
}

/**
 * La chiave del contatore: ambito + impronta dell'indirizzo.
 *
 * L'ambito tiene separati demo e chat dei saloni, cosi' una persona che ha
 * provato la demo non si ritrova con meno messaggi disponibili quando poi
 * prenota davvero da un salone.
 */
export type AmbitoLimiteIp = "demo" | "chat" | "prenotazione";

/**
 * `qualificatore` restringe la finestra a un sotto-insieme: per le
 * prenotazioni pubbliche e' il tenant, cosi' il tetto e' "per indirizzo, per
 * salone". Il motivo e' il CGNAT degli operatori mobili italiani: migliaia di
 * telefoni escono con lo stesso indirizzo, e un tetto per indirizzo su
 * TUTTA la piattaforma crescerebbe di falsi positivi a ogni salone in piu'.
 * Per salone, invece, venti prenotazioni in un'ora dallo stesso indirizzo
 * allo stesso salone non sono un operatore mobile: sono uno script.
 */
export function chiaveLimiteIp(ambito: AmbitoLimiteIp, improntaIp: string, qualificatore?: string): string {
  return qualificatore ? `${ambito}:${qualificatore}:${improntaIp}` : `${ambito}:${improntaIp}`;
}
