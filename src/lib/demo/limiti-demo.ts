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
 * ALZATO da 600 a 3.000 il 17/09/2026, e il motivo e' che ha cambiato
 * mestiere. Quando era l'unico tetto, doveva essere basso. Adesso il limite
 * che fa il lavoro e' quello per connessione (venti al mese, in
 * `limiti-ip.ts`), e questo e' tornato a essere quello che deve essere: il
 * MURO ESTERNO.
 *
 * Gabriel: "non puo' essere bloccata tutta la demo". Con 600 e venti a testa
 * bastavano trenta connessioni diverse per spegnerla per tutti -- cioe'
 * proprio nel mese in cui la demo avesse cominciato a funzionare. Con 3.000
 * ne servono centocinquanta, e a quel punto saremmo contenti di pagare gli
 * ~8$ che costano.
 *
 * Esaurito il tetto la demo NON si rompe: la pagina resta navigabile e la
 * chat spiega che riparte il primo del mese. Meglio una demo muta per qualche
 * giorno che una bolletta a sorpresa.
 */
export const MESSAGGI_DEMO_AL_MESE = 3000;

/**
 * Dopo quanti turni consecutivi FUORI TEMA l'assistente chiude.
 *
 * Severo sulla demo (scelta di Gabriel del 17/09/2026): al primo fuori tema
 * riporta al discorso, al secondo chiude. Sui saloni veri il limite
 * equivalente e' piu' alto (3, in `ai/limiti.ts`) perche' li' dall'altra
 * parte c'e' un cliente che paga quel salone, e cacciarlo per un giudizio
 * sbagliato costa molto di piu' di qualche messaggio sprecato.
 *
 * "Fuori tema" non e' giudicato da un secondo passaggio di AI, che
 * costerebbe quanto il problema che risolve: si usa lo stesso indizio del
 * prodotto vero -- una conversazione che prenota chiama quasi sempre uno
 * strumento entro pochi turni, una che chiacchiera non lo fa mai.
 */
export const TURNI_FUORI_TEMA_DEMO = 2;

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
