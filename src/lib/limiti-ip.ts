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
 * La demo: numeri tarati su una persona che prova.
 *
 * Una prenotazione completa sta in cinque o sei messaggi, quindi 30 all'ora
 * sono cinque prove di fila senza mai sfiorare il tetto. 60 al giorno sono il
 * doppio: chi ne vuole di piu' non sta provando il prodotto.
 */
export const TETTI_DEMO: TettiIp = { perOra: 30, perGiorno: 60 };

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
export function chiaveLimiteIp(ambito: "demo" | "chat", improntaIp: string): string {
  return `${ambito}:${improntaIp}`;
}
