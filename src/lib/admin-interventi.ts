/**
 * Le azioni che il registro interventi dell'admin sa registrare.
 *
 * Esiste perche' il 18/09/2026 ne mancava una: `cambiaPianoConStripe`
 * scriveva "piano_con_stripe", che il CHECK della migrazione 0029 non
 * prevedeva. L'insert veniva rifiutato dal database, il codice lo logga e
 * tira dritto (giusto: una traccia mancata non deve impedire l'intervento),
 * e il risultato era che il cambio piano fatto passando da Stripe -- quello
 * che tocca i soldi -- era l'unico a non lasciare traccia. Nessuno se ne
 * sarebbe accorto guardando l'interfaccia.
 *
 * Da qui in poi la lista sta in un posto solo e un test la confronta con il
 * CHECK vero nelle migrazioni: aggiungerne una senza migrazione fa diventare
 * rosso quel test invece di aprire un altro buco silenzioso.
 */
export const AZIONI_INTERVENTO = [
  "piano_manuale",
  "piano_con_stripe",
  "ripristino_stripe",
  "sospensione",
  "riattivazione",
  "cancellazione_attivita",
] as const;

export type AzioneIntervento = (typeof AZIONI_INTERVENTO)[number];
