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

/**
 * Gate di piano per Analytics (Fase 3, trovato nel controllo promesse del
 * sito 13/09/2026, costruito il 14/09/2026): `Prezzi.tsx`/`Funzionalita.tsx`
 * pubblicizzano "Analytics -- Andamento prenotazioni e clienti nel tempo"
 * incluso da Growth in su. Stessa forma di `pianoHaTonoPersonalizzato` in
 * `src/lib/ai/limiti.ts` (Set + funzione dedicata), qui in `piani.ts` e non
 * in `ai/limiti.ts` perché non ha nulla a che fare con l'assistente AI.
 */
export const PIANI_CON_ANALYTICS = new Set(["growth", "pro", "enterprise"]);

export function pianoHaAnalytics(piano: string): boolean {
  return PIANI_CON_ANALYTICS.has(piano);
}

/**
 * Gate di piano per i Promemoria automatici (Fase 6, trovato nel controllo
 * promesse del sito 13/09/2026, costruito il 14/09/2026): `Prezzi.tsx`
 * elenca "Promemoria automatici" da Growth in su, `Funzionalita.tsx` lo
 * descrive esplicitamente come due cose ("Reminder prima dell'appuntamento
 * e follow-up ai clienti inattivi") -- entrambe usano questo stesso gate,
 * un solo posto invece di duplicare il controllo piano nel job schedulato
 * per ciascuna delle due. Stessa lista di piani di `PIANI_CON_ANALYTICS`
 * (coincidenza dei requisiti attuali, non un vincolo: i due Set restano
 * indipendenti apposta, un domani potrebbero divergere).
 */
export const PIANI_CON_PROMEMORIA = new Set(["growth", "pro", "enterprise"]);

export function pianoHaPromemoria(piano: string): boolean {
  return PIANI_CON_PROMEMORIA.has(piano);
}
