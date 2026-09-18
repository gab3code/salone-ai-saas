/**
 * Regole pure su COSA si puo' cancellare davvero dalla configurazione di un
 * salone, e cosa invece va solo disattivato.
 *
 * Nasce da una scoperta del 18/09/2026, mentre si costruiva l'onboarding AI
 * capace di modificare ed eliminare: `eliminaOperatore` ed `eliminaServizio`
 * non guardavano NIENTE prima di cancellare, e i vincoli del database sono
 * silenziosi nel modo peggiore possibile.
 *
 *   appuntamenti.operatore_id  references operatori on delete SET NULL
 *   appuntamenti.servizio_id   references servizi   on delete SET NULL
 *   richieste_caparra.*        references ...       on delete CASCADE
 *
 * Cancellare un operatore quindi non fallisce e non avvisa: svuota il campo
 * su tutti i suoi appuntamenti, passati e futuri, confermati e pagati. Lo
 * storico resta ma diventa anonimo, le statistiche per operatore perdono i
 * numeri, e un appuntamento futuro resta in agenda senza sapere chi lo fa.
 * Per un servizio va anche peggio: spariscono a cascata le richieste di
 * caparra collegate, cioe' righe che parlano di soldi incassati.
 *
 * Le colonne `attivo` esistono dalla 0001 su entrambe le tabelle, sono gia'
 * lette dal motore di disponibilita' (un operatore non attivo non riceve
 * slot) e da oggi sono anche scrivibili: disattivare fa il 99% di quello che
 * la gente intende con "togli", senza distruggere niente.
 *
 * Regola: si cancella solo cio' che non e' mai stato usato.
 */

export interface LegamiOperatore {
  /** Appuntamenti collegati, di qualunque data e stato. */
  appuntamenti: number;
}

export interface LegamiServizio {
  appuntamenti: number;
  /** Richieste di caparra: righe che parlano di pagamenti, cancellate a cascata. */
  richiesteCaparra: number;
}

export type EsitoEliminazione =
  | { consentita: true }
  | { consentita: false; motivo: string };

export function valutaEliminazioneOperatore(legami: LegamiOperatore): EsitoEliminazione {
  if (legami.appuntamenti > 0) {
    return {
      consentita: false,
      motivo:
        legami.appuntamenti === 1
          ? "C'è 1 appuntamento collegato a questo operatore: cancellarlo lo lascerebbe in agenda senza nessuno assegnato. Disattivalo invece: sparisce dagli orari prenotabili e lo storico resta intero."
          : `Ci sono ${legami.appuntamenti} appuntamenti collegati a questo operatore: cancellarlo li lascerebbe in agenda senza nessuno assegnato. Disattivalo invece: sparisce dagli orari prenotabili e lo storico resta intero.`,
    };
  }
  return { consentita: true };
}

export function valutaEliminazioneServizio(legami: LegamiServizio): EsitoEliminazione {
  if (legami.richiesteCaparra > 0) {
    return {
      consentita: false,
      motivo:
        "Questo servizio ha richieste di caparra collegate: cancellarlo cancellerebbe anche quelle, e sono righe che parlano di pagamenti. Disattivalo invece: non sarà più prenotabile e lo storico resta intero.",
    };
  }
  if (legami.appuntamenti > 0) {
    return {
      consentita: false,
      motivo:
        legami.appuntamenti === 1
          ? "C'è 1 appuntamento collegato a questo servizio: cancellarlo lo lascerebbe in agenda senza sapere cosa era. Disattivalo invece: non sarà più prenotabile e lo storico resta intero."
          : `Ci sono ${legami.appuntamenti} appuntamenti collegati a questo servizio: cancellarlo li lascerebbe in agenda senza sapere cosa erano. Disattivalo invece: non sarà più prenotabile e lo storico resta intero.`,
    };
  }
  return { consentita: true };
}
