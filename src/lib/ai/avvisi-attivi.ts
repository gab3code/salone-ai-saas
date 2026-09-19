/**
 * Quali avvisi al cliente PARTONO DAVVERO, oggi.
 *
 * ----------------------------------------------------------------------
 * PERCHE' ESISTE UN FILE INTERO PER UNA COSTANTE.
 *
 * Il 19/09/2026 l'assistente ha scritto a un cliente "Riceverai una conferma
 * via SMS". Nessun SMS parte a una prenotazione: in questo progetto gli SMS
 * esistono solo per la lista d'attesa. Gabriel ha osservato che la frase
 * "andava bene, dato che abbiamo in piano di mettere Skebby".
 *
 * Il piano c'e' davvero (PIANO.md: Skebby si attiva con la P.IVA). Ma un
 * piano non e' una capacita': il cliente che ha letto quella frase stanotte
 * l'SMS non lo riceve, e restera' ad aspettarlo. Fra "lo faremo" e "lo
 * facciamo" c'e' esattamente la differenza fra una promessa e una bugia, e
 * chi la paga non e' chi l'ha scritta.
 *
 * Quindi non si allenta il controllo: si sposta la decisione QUI, in un posto
 * solo. Il giorno in cui Skebby manda davvero la conferma di una
 * prenotazione, si aggiunge "sms" a questa lista e l'assistente ricomincia a
 * poterlo promettere -- automaticamente, senza toccare ne' il prompt ne' i
 * controlli.
 *
 * La regola generale: **una capacita' futura si rappresenta con un
 * interruttore spento, non con un controllo assente.** Un controllo assente
 * non si riaccende il giorno giusto: si scopre rotto il giorno sbagliato.
 */

export type CanaleAvviso = "email" | "sms" | "whatsapp";

/**
 * I canali su cui il prodotto manda DAVVERO un avviso al cliente quando
 * prenota. Oggi: l'email, e solo se il cliente ha lasciato un indirizzo.
 *
 * DA AGGIORNARE quando Skebby e' collegato e la conferma via SMS parte
 * davvero -- non quando l'account e' stato creato, non quando le credenziali
 * sono in .env: quando un SMS di conferma arriva a un telefono vero.
 */
export const CANALI_AVVISO_ATTIVI: readonly CanaleAvviso[] = ["email"];

export function avvisoAttivo(canale: CanaleAvviso): boolean {
  return CANALI_AVVISO_ATTIVI.includes(canale);
}
