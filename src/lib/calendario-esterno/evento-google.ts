/**
 * L'evento da scrivere nel calendario Google del salone: parte pura.
 *
 * Direzione EXPORT (Fase 6bis, 18/09/2026). Fino a oggi i calendari
 * esterni si leggevano soltanto: gli impegni personali di un'operatrice
 * bloccavano gli slot, ma i suoi appuntamenti del salone non comparivano da
 * nessuna parte se non dentro il prodotto. Chi vive dentro Google Calendar
 * doveva guardare due agende.
 *
 * QUI DENTRO NON C'E' RETE. Si costruisce l'oggetto che Google si aspetta e
 * si riconoscono gli eventi nostri; chiamare l'API e' compito di
 * google.server.ts. La ragione e' la solita di questo progetto: la parte che
 * puo' sbagliare in silenzio (i fusi, il titolo, il riconoscimento) si prova
 * gratis, quella che puo' solo fallire rumorosamente (la rete) no.
 *
 * ---------------------------------------------------------------------
 * IL PROBLEMA CHE QUESTO FILE ESISTE PER EVITARE: L'ANELLO.
 *
 * Scriviamo l'appuntamento nel calendario di Anna. Alla richiesta dopo,
 * `recuperaImpegniGoogle` rilegge quel calendario per sapere quando Anna e'
 * occupata, e ci ritrova dentro il nostro stesso appuntamento: da quel
 * momento il prodotto crede che Anna sia impegnata da un evento esterno
 * proprio nell'ora in cui ha un appuntamento nostro. Non e' un doppione
 * innocuo -- e' uno slot che risulta occupato due volte, e che non si libera
 * piu' nemmeno cancellando l'appuntamento, perche' l'evento su Google
 * resterebbe li' a dire che quell'ora e' presa.
 *
 * La difesa e' marcare i nostri eventi con una proprieta' privata e
 * saltarli in lettura. Non e' un dettaglio implementativo: e' la condizione
 * perche' l'export possa esistere.
 */

/** La chiave della proprieta' privata con cui marchiamo i nostri eventi. */
export const PROPRIETA_APPUNTAMENTO = "salone_ai_appuntamento";

export interface DatiEventoGoogle {
  /** Id dell'appuntamento nostro: finisce nella proprieta' privata. */
  appuntamentoId: string;
  nomeServizio: string;
  /** Null quando il cliente non ha lasciato un nome. */
  nomeCliente: string | null;
  /** Istanti REALI, non pseudo-UTC: chi chiama converte prima. */
  inizio: Date;
  fine: Date;
  /** Serve a Google per mostrare l'evento nell'ora giusta a chi lo guarda. */
  fusoOrario: string;
  /** Link di gestione, se il salone ne ha uno da mettere in descrizione. */
  urlGestione?: string | null;
}

export interface EventoGoogle {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  extendedProperties: { private: Record<string, string> };
}

/**
 * Il titolo lo legge una persona sul telefono, di corsa, fra altri impegni:
 * prima il servizio, poi chi. Senza nome resta il solo servizio -- mai
 * "Taglio - null", e mai un nome inventato.
 */
export function titoloEvento(nomeServizio: string, nomeCliente: string | null): string {
  const servizio = nomeServizio.trim() || "Appuntamento";
  const cliente = (nomeCliente ?? "").trim();
  return cliente ? `${servizio} - ${cliente}` : servizio;
}

export function costruisciEventoGoogle(dati: DatiEventoGoogle): EventoGoogle {
  const evento: EventoGoogle = {
    summary: titoloEvento(dati.nomeServizio, dati.nomeCliente),
    start: { dateTime: dati.inizio.toISOString(), timeZone: dati.fusoOrario },
    end: { dateTime: dati.fine.toISOString(), timeZone: dati.fusoOrario },
    // La marcatura che rompe l'anello. Google la restituisce nelle letture
    // e non la mostra a nessuno nell'interfaccia.
    extendedProperties: { private: { [PROPRIETA_APPUNTAMENTO]: dati.appuntamentoId } },
  };

  const righe = ["Appuntamento gestito da Salone AI."];
  if (dati.urlGestione) righe.push(dati.urlGestione);
  // Niente telefono ne' email del cliente qui dentro: finirebbero in un
  // calendario che puo' essere condiviso con chiunque, fuori dal nostro
  // controllo e fuori da quello che il cliente ha accettato.
  evento.description = righe.join("\n");

  return evento;
}

/**
 * Un evento che abbiamo scritto noi. Va saltato in lettura: vedi l'anello
 * descritto in testa al file.
 *
 * Volutamente tollerante su come arriva l'oggetto: se Google un giorno
 * cambiasse forma, il caso peggiore deve essere "non lo riconosco e lo
 * tratto come impegno esterno" (uno slot in meno), mai un'eccezione dentro
 * il calcolo della disponibilita'.
 */
export function eNostroEvento(item: unknown): boolean {
  if (!item || typeof item !== "object") return false;
  const ext = (item as { extendedProperties?: unknown }).extendedProperties;
  if (!ext || typeof ext !== "object") return false;
  const privati = (ext as { private?: unknown }).private;
  if (!privati || typeof privati !== "object") return false;
  const valore = (privati as Record<string, unknown>)[PROPRIETA_APPUNTAMENTO];
  return typeof valore === "string" && valore.trim() !== "";
}
