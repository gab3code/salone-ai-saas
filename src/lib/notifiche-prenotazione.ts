import { pianoHaSms } from "./piani";

/**
 * Chi riceve cosa quando arriva una prenotazione (17/09/2026, richiesta di
 * Gabriel).
 *
 * Prima di oggi non si poteva scegliere: il titolare riceveva un'email per
 * OGNI prenotazione senza modo di spegnerla, e il cliente riceveva l'email
 * -- o l'SMS se non aveva lasciato un'email, sui piani che lo includono --
 * senza che il salone potesse decidere altrimenti. Erano le uniche due
 * notifiche del prodotto senza un interruttore: promemoria, compleanno,
 * recensioni e lista d'attesa ce l'hanno già tutte.
 *
 * Logica pura apposta: la decisione "mando email, SMS, entrambi o niente"
 * deve essere verificabile senza un database e senza mandare niente a
 * nessuno. `notifiche.server.ts` la chiama e si limita a eseguire.
 */

export const CANALI_CONFERMA_CLIENTE = [
  "email_o_sms",
  "solo_email",
  "solo_sms",
  "nessuna",
] as const;

export type CanaleConfermaCliente = (typeof CANALI_CONFERMA_CLIENTE)[number];

/** Default: esattamente il comportamento che il prodotto aveva prima di questa scelta. */
export const CANALE_CONFERMA_PREDEFINITO: CanaleConfermaCliente = "email_o_sms";

export function canaleConfermaValido(valore: string): valore is CanaleConfermaCliente {
  return (CANALI_CONFERMA_CLIENTE as readonly string[]).includes(valore);
}

/**
 * Le opzioni SMS esistono solo sui piani che hanno l'SMS (Pro in su).
 *
 * Il gate è applicato in tre punti, e non è ridondanza inutile: la UI non
 * mostra le opzioni SMS sotto Pro, la server action le rifiuta se arrivano
 * lo stesso (una server action è un endpoint POST chiamabile senza aprire la
 * pagina), e `inviaSmsSeInclusoNelPiano` ricontrolla comunque piano e quota
 * al momento dell'invio. Senza il secondo controllo un tenant Growth
 * potrebbe salvare `solo_sms` e restare in uno stato assurdo: crede di aver
 * scelto un canale, e i suoi clienti non ricevono niente.
 */
export function canaliDisponibiliPerPiano(piano: string): CanaleConfermaCliente[] {
  return pianoHaSms(piano)
    ? [...CANALI_CONFERMA_CLIENTE]
    : ["email_o_sms", "solo_email", "nessuna"];
}

export function canaleConsentitoDalPiano(canale: CanaleConfermaCliente, piano: string): boolean {
  return canaliDisponibiliPerPiano(piano).includes(canale);
}

export type DestinatarioConferma = {
  /** Il cliente ha lasciato un'email. */
  haEmail: boolean;
  /** Il cliente ha un numero di telefono in scheda. */
  haTelefono: boolean;
};

export type InviiConferma = { email: boolean; sms: boolean };

/**
 * Cosa mandare davvero a QUESTO cliente, con QUESTA scelta, su QUESTO piano.
 *
 * Nota su `email_o_sms`: è "o", non "e". Mandare a una stessa persona la
 * conferma per email E per SMS è spam, e l'SMS costa soldi veri (Skebby).
 * Il fallback scatta solo quando l'email manca.
 *
 * Nota su `solo_sms`: qui l'SMS va anche a chi HA lasciato un'email. È
 * l'unico caso in cui lo facciamo, ed è una scelta esplicita del salone --
 * ci sono attività i cui clienti l'email non la leggono mai.
 */
export function inviiConferma(
  canale: CanaleConfermaCliente,
  piano: string,
  destinatario: DestinatarioConferma
): InviiConferma {
  const smsPossibile = pianoHaSms(piano) && destinatario.haTelefono;

  switch (canale) {
    case "nessuna":
      return { email: false, sms: false };
    case "solo_email":
      return { email: destinatario.haEmail, sms: false };
    case "solo_sms":
      return { email: false, sms: smsPossibile };
    case "email_o_sms":
    default:
      return destinatario.haEmail
        ? { email: true, sms: false }
        : { email: false, sms: smsPossibile };
  }
}

/**
 * Etichette per le impostazioni. Stanno qui e non nel componente perché la
 * stessa scelta va spiegata anche altrove (per esempio in un futuro riepilogo
 * nel pannello di piattaforma) e due elenchi di etichette divergono sempre.
 */
export const ETICHETTA_CANALE_CONFERMA: Record<CanaleConfermaCliente, string> = {
  email_o_sms: "Email, e SMS a chi non ha lasciato l'email",
  solo_email: "Solo email",
  solo_sms: "Solo SMS",
  nessuna: "Nessuna conferma",
};

export const SPIEGAZIONE_CANALE_CONFERMA: Record<CanaleConfermaCliente, string> = {
  email_o_sms:
    "Come funziona oggi: chi lascia l'email riceve l'email con il link per cancellare, gli altri un SMS.",
  solo_email:
    "Chi prenota senza lasciare un'email non riceve nessuna conferma. Nessun costo di SMS.",
  solo_sms:
    "L'SMS arriva a tutti quelli con un numero, anche a chi ha lasciato l'email. Consuma la quota SMS del piano e non contiene il link per cancellare.",
  nessuna:
    "Il cliente non riceve nulla. La prenotazione resta nel tuo calendario, ma nessuno gliela conferma.",
};
