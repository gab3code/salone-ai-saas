/**
 * Ruoli dentro un'attività (Fase 5, migrazione 0027) -- logica PURA, zero
 * dipendenze da Supabase, così è testabile senza database ed è la stessa
 * identica risposta sia in UI (cosa mostrare) sia nelle server action (cosa
 * lasciar fare davvero).
 *
 * Due ruoli soli, di proposito: più livelli senza un cliente vero che li
 * chieda sarebbero solo superficie da mantenere.
 *
 *   owner -> accesso pieno (il titolare, e chi lui promuove)
 *   staff -> il lavoro quotidiano: agenda, clienti, lista d'attesa
 *
 * Cosa uno staff NON può fare, scelto da Gabriel il 16/09/2026:
 *   - vedere fatturato e analytics (è il motivo più citato dai titolari per
 *     cui NON danno un accesso ai dipendenti sugli altri gestionali)
 *   - toccare servizi, prezzi, orari e il resto della configurazione
 *     (un prezzo cambiato per sbaglio si propaga su pagina pubblica, AI e
 *     caparre)
 *   - gestire abbonamento e fatturazione
 * Cosa uno staff PUÒ fare, deciso esplicitamente: vedere l'agenda di TUTTI
 * gli operatori, non solo la propria. In un salone piccolo chi è alla cassa
 * risponde al telefono e deve poter prenotare per la collega -- limitarlo
 * sarebbe controproducente.
 */

export const RUOLI_ATTIVITA = ["owner", "staff"] as const;
export type RuoloAttivita = (typeof RUOLI_ATTIVITA)[number];

/**
 * Normalizza quello che arriva dal database. `profiles.ruolo` esiste dalla
 * migrazione 0001 con un default 'owner' e nessun vincolo, e può contenere
 * anche 'admin_piattaforma' (ruolo di PIATTAFORMA, vedi `eAdminPiattaforma`).
 * Qualunque valore non riconosciuto diventa 'staff': in caso di dato sporco
 * si concede MENO potere, mai di più.
 */
export function normalizzaRuolo(valore: string | null | undefined): RuoloAttivita {
  if (valore === "owner" || valore === "admin_piattaforma") return "owner";
  return "staff";
}

/**
 * Ruolo di piattaforma, completamente separato dai ruoli di un'attività:
 * identifica Gabriel e dà accesso a /admin. Vive su `profiles.ruolo` perché
 * non appartiene a nessun tenant in particolare.
 */
export function eAdminPiattaforma(ruoloProfilo: string | null | undefined): boolean {
  return ruoloProfilo === "admin_piattaforma";
}

export function puoVedereAnalytics(ruolo: RuoloAttivita): boolean {
  return ruolo === "owner";
}

/** Servizi, prezzi, orari, operatori e tutte le impostazioni dell'attività. */
export function puoConfigurareAttivita(ruolo: RuoloAttivita): boolean {
  return ruolo === "owner";
}

/** Checkout Stripe, portale abbonamento, cambio piano. */
export function puoGestireFatturazione(ruolo: RuoloAttivita): boolean {
  return ruolo === "owner";
}

/** Invitare, promuovere o rimuovere membri dell'attività. */
export function puoGestireMembri(ruolo: RuoloAttivita): boolean {
  return ruolo === "owner";
}

/**
 * Esportare l'intera rubrica clienti in CSV. Owner-only anche se lo staff i
 * clienti li vede: guardarli uno per uno dentro il prodotto e portarsi via
 * l'intero database in un file sono due cose diverse, e la seconda è quella
 * che un titolare non si aspetta che un dipendente possa fare.
 */
export function puoEsportareClienti(ruolo: RuoloAttivita): boolean {
  return ruolo === "owner";
}

/**
 * Importare una rubrica intera (Fase 6ter, 18/09/2026).
 *
 * Owner-only, come l'export e per il motivo simmetrico: uno staff crea un
 * cliente alla volta mentre lavora, ma far entrare trecento schede in un
 * colpo -- magari prese da un'altra attivita' -- e' una decisione del
 * titolare. E' anche lui il titolare del trattamento di quei dati: chi
 * importa una rubrica si sta assumendo la responsabilita' di averne diritto.
 */
export function puoImportareClienti(ruolo: RuoloAttivita): boolean {
  return ruolo === "owner";
}

/** Agenda, spostamenti, cancellazioni, schede cliente, lista d'attesa. */
export function puoGestireAgenda(ruolo: RuoloAttivita): boolean {
  return ruolo === "owner" || ruolo === "staff";
}

/**
 * Cancellare definitivamente la scheda di un cliente (17/09/2026).
 *
 * Separato da `puoGestireAgenda` di proposito: uno staff crea clienti e
 * corregge un numero di telefono tutti i giorni, ma la cancellazione è
 * irreversibile e chi si trova una scheda sparita non ha modo di sapere se è
 * stato un errore o un dispetto. È anche l'azione con cui il salone risponde
 * a una richiesta di cancellazione del suo cliente (art. 17 GDPR): una
 * responsabilità del titolare, non di chi sta in negozio.
 *
 * Lo stesso confine è applicato dal database dalla migrazione 0035
 * (`cancellazione_owner` su `clienti`), perché un permesso che vive solo
 * nell'applicazione non è un permesso -- regola della 0030.
 */
export function puoCancellareClienti(ruolo: RuoloAttivita): boolean {
  return ruolo === "owner";
}

/**
 * Messaggio unico per tutti i rifiuti di permesso: le server action del
 * progetto restituiscono `{ errore }` invece di lanciare (vedi le azioni
 * esistenti in src/app/dashboard/**), quindi il testo deve essere leggibile
 * da un dipendente, non un codice di errore.
 */
export const ERRORE_PERMESSO_NEGATO =
  "Questa sezione è riservata al titolare dell'attività.";
