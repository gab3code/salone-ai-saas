/**
 * Difese anti-bot "silenziose" per i form pubblici di prenotazione/lista
 * d'attesa (richiesta di Gabriel il 14/09/2026: il tetto di volume esistente
 * in booking-engine.server.ts "può causare problemi" -- ha ragione: bloccare
 * scritture DOPO che sono state tentate rischia di bloccare anche clienti
 * veri durante un picco di richieste legittime (es. dopo un post social),
 * cioè esattamente il momento in cui un salone ha più bisogno che le
 * prenotazioni arrivino, non meno.
 *
 * Queste due difese, applicate PRIMA di quel tetto, non hanno questo
 * rischio: non possono mai dare un falso positivo su un cliente reale che
 * usa il sito normalmente, quindi il tetto di volume può restare più alto
 * (vedi il commento su LIMITE_VOLUME_PUBBLICO_PER_FINESTRA) ed essere solo
 * la rete di sicurezza finale contro un attacco vero e proprio.
 *
 * 1. Campo trappola ("honeypot"): un campo del form nascosto via CSS a un
 *    visitatore umano (e saltato da tab/screen reader) ma che un bot che
 *    compila tutti gli <input> trovati nel DOM riempie comunque. Se arriva
 *    compilato, quasi certamente un bot -- tecnica usata da vent'anni dai
 *    plugin anti-spam (Akismet e simili).
 * 2. Tempo minimo di compilazione: il componente registra il proprio istante
 *    di montaggio (`Date.now()`) e lo manda al server con la richiesta. Un
 *    umano che ha già scelto servizio, giorno e slot (più passaggi, ognuno
 *    con una chiamata di rete verso `cercaSlotPubblici`) non può mai
 *    arrivare a "conferma" a pochi secondi dal caricamento della pagina. Un
 *    bot che chiama la server action direttamente saltando l'interfaccia lo
 *    fa invece in pochi millisecondi.
 *
 * Nessuna delle due richiede un CAPTCHA (deliberatamente rimandato, vedi
 * PIANO.md Gruppo D) e nessuna può bloccare un cliente reale: un valore
 * `iniziatoAlleMs` assente (client vecchio, JS parzialmente bloccato) non
 * blocca mai, per lo stesso principio "fail-open" di tutte le altre difese
 * anti-abuso di questo progetto.
 */
export const SOGLIA_MINIMA_MS_COMPILAZIONE_FORM_PUBBLICO = 3_000;

export function campoTrappolaCompilato(trappola: string | undefined): boolean {
  return !!trappola && trappola.trim().length > 0;
}

export function formPubblicoCompilatoTroppoVeloce(iniziatoAlleMs: number | undefined, adesso: number = Date.now()): boolean {
  if (iniziatoAlleMs === undefined) return false;
  return adesso - iniziatoAlleMs < SOGLIA_MINIMA_MS_COMPILAZIONE_FORM_PUBBLICO;
}
