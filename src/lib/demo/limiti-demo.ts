/**
 * I tetti della demo pubblica.
 *
 * La demo non scrive niente da nessuna parte, quindi l'unico modo in cui puo'
 * costarci qualcosa e' la bolletta del modello. Le difese sono quattro e
 * lavorano su scale diverse: una ferma l'abuso di massa, tre fermano il
 * singolo che insiste.
 *
 * Il conto della spesa nel caso PEGGIORE va fatto sui turni, non sui
 * messaggi: un messaggio del cliente puo' costare piu' di una chiamata al
 * modello, perche' il ciclo degli strumenti ne fa una per giro.
 */

/** Chiave della riga in `contatori_globali` (migrazione 0045). */
export const CHIAVE_CONTATORE_DEMO = "demo_messaggi";

/**
 * Messaggi al mese su tutta la demo, per tutti i visitatori messi insieme.
 *
 * E' il tetto che conta, perche' e' l'unico che un aggressore non puo'
 * aggirare aprendo una scheda nuova: vive nel database, su una riga sola.
 * Una conversazione di prenotazione completa sta in cinque o sei messaggi,
 * quindi 600 sono un centinaio di prove complete al mese -- molte piu' di
 * quante ne servano a una landing che non ha ancora traffico, e poche
 * abbastanza da restare una spesa da pochi euro anche nel caso peggiore.
 *
 * Esaurito il tetto la demo NON si rompe: la pagina resta navigabile e la
 * chat spiega che riparte il primo del mese. Meglio una demo muta per
 * qualche giorno che una bolletta a sorpresa.
 */
export const MESSAGGI_DEMO_AL_MESE = 600;

/**
 * Messaggi in una singola conversazione.
 *
 * Basso di proposito, come il limite equivalente dei saloni veri: una
 * prenotazione, anche complicata, raramente supera i dieci scambi. Oltre, la
 * conversazione non sta piu' prenotando niente.
 */
export const MESSAGGI_PER_CONVERSAZIONE_DEMO = 12;

/** Caratteri di un singolo messaggio. Un messaggio lungo costa piu' token. */
export const LUNGHEZZA_MASSIMA_MESSAGGIO_DEMO = 400;

/**
 * Appuntamenti che una sessione puo' prendere.
 *
 * Serve a due cose: evitare che qualcuno riempia l'agenda finta per far
 * sembrare la demo piena, e tenere corto lo stato che viaggia avanti e
 * indietro a ogni richiesta.
 */
export const APPUNTAMENTI_MASSIMI_DEMO = 5;

export interface EsitoValidazioneDemo {
  ok: boolean;
  errore?: string;
}

/**
 * Lo stato della demo viaggia nel corpo della richiesta, quindi arriva dal
 * browser e **non e' affidabile**: chiunque puo' mandarci quello che vuole.
 * Non e' un problema di sicurezza (non c'e' niente da proteggere: sono dati
 * finti, e il peggio che uno ottiene e' una demo sbagliata per se stesso) ma
 * E' un problema di costo, perche' uno storico gonfiato si paga in token.
 * Per questo il controllo vero non e' sulla forma dello stato, ma sulla
 * DIMENSIONE di quello che arriva.
 */
export function validaRichiestaDemo(p: {
  messaggio: unknown;
  numeroMessaggiStorico: number;
  numeroAppuntamenti: number;
}): EsitoValidazioneDemo {
  if (typeof p.messaggio !== "string" || p.messaggio.trim() === "") {
    return { ok: false, errore: "Scrivi un messaggio." };
  }
  if (p.messaggio.length > LUNGHEZZA_MASSIMA_MESSAGGIO_DEMO) {
    return { ok: false, errore: "Messaggio troppo lungo per la demo." };
  }
  if (p.numeroMessaggiStorico > MESSAGGI_PER_CONVERSAZIONE_DEMO * 2) {
    // Per due: lo storico contiene sia i messaggi del cliente sia le
    // risposte dell'assistente.
    return { ok: false, errore: "Questa conversazione di prova è finita. Ricaricando la pagina se ne apre una nuova." };
  }
  if (p.numeroAppuntamenti > APPUNTAMENTI_MASSIMI_DEMO) {
    return { ok: false, errore: "Hai già preso tutti gli appuntamenti di prova." };
  }
  return { ok: true };
}
