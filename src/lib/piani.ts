/**
 * Tetto di prenotazioni mensili per piano (punto 20 di CLAUDE.md: "il sistema
 * deve tecnicamente applicare i limiti") -- decisione presa con Gabriel il
 * 02/09/2026, vedi DECISIONS.md per il ragionamento completo. Leva di
 * prodotto/upsell, non di costo: una prenotazione costa quasi zero da
 * salvare (una riga nel database), quindi qui SOLO il piano Free ha un
 * tetto -- tutti gli altri piani restano deliberatamente illimitati su
 * questo fronte (diverso dalla quota AI in `src/lib/ai/limiti.ts`, che
 * invece esiste per una vera ragione di costo/abuso).
 *
 * Vive in `src/lib/` (non sotto `ai/`) perché si applica a OGNI creazione di
 * prenotazione -- dashboard o AI, stessa regola, stesso posto (punto 9 di
 * CLAUDE.md: "AI e calendario devono utilizzare la stessa booking engine").
 *
 * Conta le prenotazioni CREATE nel mese corrente (`created_at`), non quelle
 * il cui appuntamento CADE nel mese corrente (`inizio`) -- coerente con
 * un'idea di "quota di utilizzo mensile della piattaforma", stessa
 * impostazione già usata per la quota di messaggi AI.
 */
const TETTO_PRENOTAZIONI_MENSILI_PER_PIANO: Record<string, number> = {
  free: 60,
};

export function limiteMensilePrenotazioni(piano: string): number {
  return TETTO_PRENOTAZIONI_MENSILI_PER_PIANO[piano] ?? Infinity;
}

/**
 * "1 operatore" sul piano Free (Fase 5, trovato nel controllo promesse del
 * sito 13/09/2026): `Prezzi.tsx` elenca questo limite tra le caratteristiche
 * del piano Free, ma finché questa funzione non esisteva nessun codice lo
 * applicava davvero -- un tenant Free poteva creare operatori illimitati da
 * `/dashboard/configura`, una promessa scritta e mai controllata. Stessa
 * forma di `limiteMensilePrenotazioni` sopra (Record + fallback Infinity),
 * usata da `creaOperatore` in `dashboard/configura/azioni.ts`.
 */
const LIMITE_OPERATORI_PER_PIANO: Record<string, number> = {
  free: 1,
};

export function limiteOperatori(piano: string): number {
  return LIMITE_OPERATORI_PER_PIANO[piano] ?? Infinity;
}
