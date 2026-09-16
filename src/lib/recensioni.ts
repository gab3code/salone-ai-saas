/**
 * Logica pura della Raccolta recensioni post-appuntamento (Fase 3, deciso
 * con Gabriel il 16/09/2026 -- vedi DECISIONS.md e 0026_recensioni.sql per
 * il resto delle decisioni di scope). Zero query qui, stesso principio di
 * separazione già seguito da compleanno.ts/promemoria.ts/booking-engine.ts:
 * il layer server (recensioni.server.ts) carica/scrive i dati grezzi e
 * delega sempre qui le decisioni pure.
 */

export const VALUTAZIONE_MINIMA = 1;
export const VALUTAZIONE_MASSIMA = 5;
export const LUNGHEZZA_MASSIMA_COMMENTO = 1000;
export const LUNGHEZZA_MASSIMA_RISPOSTA_TITOLARE = 1000;

/**
 * Attesa tra la fine dell'appuntamento e l'invio della richiesta di
 * recensione (deciso con Gabriel il 16/09/2026: "invece del giorno dopo io
 * farei una/due ore dopo che è piu nel vivo no?" -- 2 ore, non 1, per dare
 * comunque il tempo al cliente di uscire dal salone/tornare a casa prima di
 * ricevere l'email). Un solo numero da cambiare se l'esperienza reale
 * suggerisse un valore diverso, stesso spirito onesto già dichiarato per le
 * altre soglie "prima stima" del progetto (es. QUOTA_MENSILE_MESSAGGI_PER_PIANO
 * in ai/limiti.ts).
 */
export const ORE_ATTESA_RICHIESTA_RECENSIONE = 2;

export function valutazioneValida(valore: number): boolean {
  return Number.isInteger(valore) && valore >= VALUTAZIONE_MINIMA && valore <= VALUTAZIONE_MASSIMA;
}

/**
 * Nome mostrato pubblicamente sulla pagina del salone: nome di battesimo +
 * iniziale del cognome (es. "Giulia R."), MAI il nome completo -- stesso
 * standard di settore di Google/Fresha/Booksy, un compromesso ragionevole
 * tra credibilità (non anonimo) e privacy del cliente (che ha lasciato il
 * nome completo in fase di prenotazione, non pensando che sarebbe finito su
 * una pagina pubblica). Un nome di una sola parola resta invariato (nessuna
 * iniziale da mostrare); nessun nome -> "Cliente".
 */
export function nomePubblicoRecensione(nomeCompleto: string | null): string {
  const pulito = (nomeCompleto ?? "").trim();
  if (!pulito) return "Cliente";
  const parti = pulito.split(/\s+/);
  if (parti.length === 1) return parti[0];
  const nome = parti[0];
  const iniziale = parti[parti.length - 1].charAt(0).toUpperCase();
  return `${nome} ${iniziale}.`;
}

export interface RecensioneMedia {
  media: number | null; // null = nessuna recensione ancora
  totale: number;
}

export function calcolaMediaRecensioni(valutazioni: number[]): RecensioneMedia {
  if (valutazioni.length === 0) return { media: null, totale: 0 };
  const somma = valutazioni.reduce((acc, v) => acc + v, 0);
  // Arrotondata a 1 decimale, come qualunque prodotto consumer (4.7, non
  // 4.6666666666666).
  return { media: Math.round((somma / valutazioni.length) * 10) / 10, totale: valutazioni.length };
}
