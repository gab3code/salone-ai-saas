import { cancellazioneOnlineConsentita } from "./finestra-cancellazione";

/**
 * Regola anti-abuso per lo spostamento ("sposta") self-service di un
 * appuntamento (Fase 4, richiesta di Gabriel il 15/09/2026, scelta fra le
 * opzioni proposte): STESSA finestra minima di ore già usata per la
 * cancellazione online (`tenants.ore_minime_cancellazione`) -- niente di
 * nuovo da configurare per il titolare, un solo numero in
 * /dashboard/impostazioni/cancellazione governa entrambi -- PIÙ un tetto
 * separato di massimo 1 spostamento per appuntamento, per evitare che lo
 * stesso appuntamento venga rimbalzato avanti e indietro all'infinito da un
 * link senza password (stesso modello di sicurezza della cancellazione, vedi
 * gestisci/[id]/azioni.ts).
 *
 * Funzioni pure (l'"adesso" è sempre un parametro, mai `new Date()` interno):
 * testabili senza mock e riusabili sia lato server (l'unico punto
 * autorevole) sia lato pagina (solo per mostrare/nascondere in anticipo il
 * bottone giusto -- mai l'unica difesa, stesso principio "doppio controllo"
 * di finestra-cancellazione.ts).
 */
export type MotivoBloccoSpostamento = "finestra" | "gia_spostato";

/**
 * Restituisce il motivo per cui lo spostamento online NON è consentito, o
 * `null` se è consentito. Il limite "già spostato" viene controllato PRIMA
 * della finestra oraria: un appuntamento che ha già usato il suo unico
 * spostamento resta bloccato per sempre su questo fronte, indipendentemente
 * da quante ore mancano -- non ha senso dire "puoi ancora spostarlo, aspetta
 * che si avvicini la data" quando il vero motivo del blocco è un altro.
 */
export function motivoBloccoSpostamento(
  inizioAppuntamento: Date,
  oreMinime: number,
  spostamentiEffettuati: number,
  adesso: Date = new Date()
): MotivoBloccoSpostamento | null {
  if (spostamentiEffettuati >= 1) return "gia_spostato";
  if (!cancellazioneOnlineConsentita(inizioAppuntamento, oreMinime, adesso)) return "finestra";
  return null;
}

/** Messaggio mostrato al cliente quando lo spostamento online è bloccato. */
export function messaggioSpostamentoBloccato(
  motivo: MotivoBloccoSpostamento,
  oreMinime: number,
  nomeTenant: string,
  telefonoTenant: string | null
): string {
  const contatto = telefonoTenant
    ? `chiama ${nomeTenant} al ${telefonoTenant}`
    : `contatta direttamente ${nomeTenant}`;

  if (motivo === "gia_spostato") {
    return `Questo appuntamento è già stato spostato una volta online: per un ulteriore cambio, ${contatto}.`;
  }

  const unita = oreMinime === 1 ? "ora" : "ore";
  return `Non è più possibile spostare online: mancano meno di ${oreMinime} ${unita} all'appuntamento. Per spostarlo, ${contatto}.`;
}
