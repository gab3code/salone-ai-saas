/**
 * Un evento di calendario (RFC 5545) da allegare alla conferma di
 * prenotazione, cosi' il cliente lo aggiunge al telefono con un tocco.
 *
 * Perche' esiste (19/09/2026): una parte dei no-show non e' cattiva
 * volonta', e' dimenticanza. Un appuntamento che sta nel calendario del
 * telefono, con la notifica di sistema il giorno prima, costa zero al salone
 * e non passa da nessun provider a pagamento. E' la difesa anti no-show piu'
 * economica che esista, e la caparra non la sostituisce: la caparra punisce,
 * questo previene.
 *
 * Tutto in UTC con la "Z" finale: gli istanti arrivano gia' reali dal
 * database (`appuntamenti.inizio/fine` sono timestamptz), e un evento in UTC
 * lo mostra giusto ogni calendario nel fuso in cui si trova il telefono.
 * Niente VTIMEZONE: sarebbe l'unico modo di sbagliare.
 */

export interface EventoIcs {
  /** Stabile per l'appuntamento: se il cliente importa due volte, il calendario aggiorna invece di duplicare. */
  uid: string;
  inizio: Date;
  fine: Date;
  titolo: string;
  descrizione?: string;
  luogo?: string;
  url?: string;
  /** L'istante di generazione: parametro, non `new Date()` dentro (regola del progetto). */
  generatoIl: Date;
}

/** "20260923T140000Z" */
export function dataIcs(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Virgole, punti e virgola, backslash e a capo hanno un significato nel formato: si scappano. */
export function testoIcs(testo: string): string {
  return testo.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * Le righe non possono superare 75 ottetti: si spezzano con CRLF + spazio.
 * Si conta in byte UTF-8, non in caratteri, perche' "Perche'" con l'accento
 * pesa piu' di quanto sembra.
 */
export function piegaRiga(riga: string): string {
  const pezzi: string[] = [];
  let corrente = "";
  let ottetti = 0;
  for (const carattere of riga) {
    const peso = Buffer.byteLength(carattere, "utf8");
    // La prima riga puo' avere 75 ottetti, le successive 74 (lo spazio iniziale conta).
    const limite = pezzi.length === 0 ? 75 : 74;
    if (ottetti + peso > limite) {
      pezzi.push(corrente);
      corrente = "";
      ottetti = 0;
    }
    corrente += carattere;
    ottetti += peso;
  }
  pezzi.push(corrente);
  return pezzi.join("\r\n ");
}

export function costruisciIcs(evento: EventoIcs): string {
  const righe = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Salone AI//Prenotazione//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${testoIcs(evento.uid)}`,
    `DTSTAMP:${dataIcs(evento.generatoIl)}`,
    `DTSTART:${dataIcs(evento.inizio)}`,
    `DTEND:${dataIcs(evento.fine)}`,
    `SUMMARY:${testoIcs(evento.titolo)}`,
  ];
  if (evento.descrizione) righe.push(`DESCRIPTION:${testoIcs(evento.descrizione)}`);
  if (evento.luogo) righe.push(`LOCATION:${testoIcs(evento.luogo)}`);
  if (evento.url) righe.push(`URL:${evento.url}`);
  righe.push("END:VEVENT", "END:VCALENDAR");
  return righe.map(piegaRiga).join("\r\n") + "\r\n";
}
