/**
 * Il salone dimostrativo (Fase 6ter, 17/09/2026).
 *
 * Un salone finto a un indirizzo fisso, che chiunque puo' aprire e provare a
 * prenotare parlando con l'assistente vero. Esiste perche' "non c'e' un solo
 * cliente vero da mostrare e la landing promette senza provare", ed e' anche
 * la risposta a una domanda di Gabriel che ha scoperto un buco: un titolare
 * Starter non ha mai visto la chat, perche' sulla SUA pagina pubblica il
 * widget non viene proprio disegnato.
 *
 * Due saloni, non uno: lo stesso identico salone su Growth e su Pro. La
 * differenza fra i due piani smette di essere una riga in una tabella prezzi
 * e diventa una cosa che si prova.
 *
 * ----------------------------------------------------------------------
 * UNA DEMO PUBBLICA E' UN ENDPOINT A PAGAMENTO APERTO A INTERNET
 *
 * Ogni messaggio della chat lo paghiamo noi, e qui non c'e' nessun cliente
 * che paga un abbonamento a coprirlo. Le difese sono tre, e due esistevano
 * gia':
 *
 * 1. TETTO MENSILE STRETTO, qui sotto. Le difese di `limiti.ts` (quota
 *    mensile per tenant, intervallo minimo fra messaggi, tetto di messaggi
 *    per conversazione, stop ai turni fuori tema) valgono gia' per ogni
 *    tenant: la demo usa le stesse, solo con un numero molto piu' basso di
 *    quello di un salone pagante.
 * 2. NESSUN INVIO REALE. Nessuna email, nessun SMS parte da un salone
 *    dimostrativo. Non e' una questione di costo per messaggio: e' che
 *    manderemmo posta a indirizzi scritti da chiunque su una pagina
 *    pubblica, e la reputazione del dominio si brucia una volta sola --
 *    portandosi dietro le email dei clienti veri. Quello che il visitatore
 *    deve vedere (la conferma con il link per disdire) glielo mostriamo a
 *    schermo, con il testo vero.
 * 3. NIENTE RICERCA DELLE PRENOTAZIONI ALTRUI. `cerca_prenotazioni_cliente`
 *    trova gli appuntamenti a partire da un numero di telefono. Su un salone
 *    vero e' giusto: chi scrive e' il cliente e cerca i propri. Su una demo
 *    pubblica diventa un modo per pescare nome e orario di uno sconosciuto
 *    provando numeri -- e la gente nella demo il proprio numero vero lo
 *    scrive davvero. Tolto, usando lo stesso meccanismo `strumentiConsentiti`
 *    costruito per la prova dell'assistente.
 *
 * E i dati che i visitatori lasciano non restano li' per sempre: il giro
 * notturno li cancella (vedi `GIORNI_CONSERVAZIONE_DATI_DEMO`).
 */

import { STRUMENTI_AI } from "./ai/tools-nomi";

/** Il salone su Growth: l'indirizzo fisso da mettere ovunque. */
export const SLUG_DEMO_GROWTH = "demo";
/** Lo stesso salone su Pro, per il confronto affiancato. */
export const SLUG_DEMO_PRO = "demo-pro";

export const SLUG_DEMO: readonly string[] = [SLUG_DEMO_GROWTH, SLUG_DEMO_PRO];

export function eSlugDemo(slug: string): boolean {
  return SLUG_DEMO.includes(slug);
}

/**
 * Messaggi AI al mese PER SALONE dimostrativo, non per visitatore.
 *
 * I saloni sono due, quindi il totale che possiamo pagare in un mese e' il
 * doppio di questo numero -- detto qui perche' la prima versione diceva
 * "su TUTTA la demo" e non era vero.
 *
 * Basso di proposito. Una conversazione di prenotazione completa sta in
 * cinque o sei messaggi, quindi 250 per salone sono circa ottanta prove
 * complete al mese fra i due: abbastanza per la landing, per le
 * dimostrazioni a un cliente e per un titolare Starter che vuole capire
 * cosa compra, e non abbastanza perche' qualcuno ci costruisca sopra
 * qualcosa a spese nostre. Se il tetto si esaurisce la chat lo dice e la
 * pagina resta navigabile: meglio una demo muta per qualche giorno che una
 * bolletta a sorpresa.
 *
 * ATTENZIONE, il numero non e' il costo. Un messaggio del cliente puo'
 * costare piu' di una chiamata al modello, perche' il ciclo degli strumenti
 * ne fa una per giro (vedi MAX_ITERAZIONI_TOOL in agente.ts). Il conto va
 * fatto sul peggio, non sulla media.
 */
export const QUOTA_MENSILE_MESSAGGI_DEMO = 250;

/**
 * Dopo quanti giorni si cancellano i dati lasciati dai visitatori.
 *
 * Due giorni: abbastanza perche' chi ha prenotato ieri ritrovi il suo
 * appuntamento se torna, abbastanza poco perche' non si accumuli un archivio
 * di nomi e numeri di telefono veri che nessuno ha chiesto di conservare.
 * Nella demo non c'e' nessun dato seminato da noi in `clienti`, quindi la
 * regola e' semplice e non rischia di cancellare il salone: tutto quello che
 * sta li' dentro l'ha scritto un visitatore.
 */
export const GIORNI_CONSERVAZIONE_DATI_DEMO = 2;

/**
 * Gli strumenti concessi all'assistente su un salone dimostrativo.
 *
 * Tutto tranne `cerca_prenotazioni_cliente` (vedi il punto 3 in testa al
 * file). In particolare `crea_prenotazione` C'E': prenotare davvero e'
 * esattamente il punto della demo -- una prenotazione finta si sente, e
 * varrebbe meno di niente.
 *
 * Elencati per esclusione e non per inclusione, al contrario di
 * `STRUMENTI_DEMO` della prova dell'assistente, perche' qui l'intento e'
 * opposto: li' si mostra la voce senza la capacita', e uno strumento nuovo
 * deve nascere fuori; qui si mostra il prodotto intero, e uno strumento
 * nuovo deve entrarci da solo.
 */
export const STRUMENTI_VIETATI_DEMO: readonly string[] = ["cerca_prenotazioni_cliente"];

export function strumentiPerDemo(): readonly string[] {
  return STRUMENTI_AI.filter((nome) => !STRUMENTI_VIETATI_DEMO.includes(nome));
}
