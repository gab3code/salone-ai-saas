/**
 * I soli NOMI degli strumenti dell'assistente, senza il codice che li
 * esegue (17/09/2026).
 *
 * Esiste per una ragione pratica e una di sostanza. Pratica: `tools.ts` si
 * porta dietro il lato server (`server-only`, il client Supabase), quindi un
 * componente che gira nel browser non puo' importarlo -- e il primo build
 * della prova dell'assistente e' fallito proprio cosi'. Di sostanza: chi
 * deve decidere QUALI strumenti concedere ragiona sui nomi, non
 * sull'implementazione, e tenere le due cose separate rende impossibile
 * dimenticarsi di aggiornare un elenco quando se ne aggiunge uno.
 *
 * Che questa lista e quella vera di `tools.ts` restino allineate lo verifica
 * `tools.test.ts`, che puo' importarle entrambe.
 */
export const STRUMENTI_AI: readonly string[] = [
  "elenca_servizi",
  "elenca_operatori",
  "info_orari",
  "verifica_disponibilita",
  "cerca_prenotazioni_cliente",
  "crea_prenotazione",
  "modifica_prenotazione",
  "cancella_prenotazione",
  "aggiungi_lista_attesa",
  "info_attivita",
  "trasferisci_a_operatore",
];
