/**
 * Regola "non cancellare online troppo vicino all'appuntamento" (richiesta
 * esplicita di Gabriel, 14/09/2026): ogni titolare decide, da
 * /dashboard/impostazioni/cancellazione, quante ore prima dell'appuntamento
 * un cliente può ancora cancellare da solo dal link ricevuto via email
 * (`tenants.ore_minime_cancellazione`, migrazione 0016). Sotto quella
 * soglia deve chiamare il salone.
 *
 * Funzioni pure (l'"adesso" è sempre un parametro, mai `new Date()` interno):
 * testabili senza mock e riusabili sia lato server (gestisci/[id]/azioni.ts,
 * l'unico punto autorevole) sia lato pagina (gestisci/[id]/page.tsx, solo
 * per mostrare/nascondere in anticipo il bottone -- mai l'unica difesa,
 * stesso principio "doppio controllo" già usato per i conflitti di slot).
 */
export function cancellazioneOnlineConsentita(
  inizioAppuntamento: Date,
  oreMinime: number,
  adesso: Date = new Date()
): boolean {
  if (oreMinime <= 0) return true; // 0 = nessun limite, comportamento di prima
  const oreAllAppuntamento = (inizioAppuntamento.getTime() - adesso.getTime()) / 3_600_000;
  return oreAllAppuntamento >= oreMinime;
}

/** Messaggio mostrato al cliente quando la cancellazione online è bloccata dalla finestra. */
export function messaggioCancellazioneBloccata(
  oreMinime: number,
  nomeTenant: string,
  telefonoTenant: string | null
): string {
  const unita = oreMinime === 1 ? "ora" : "ore";
  const contatto = telefonoTenant
    ? `chiama ${nomeTenant} al ${telefonoTenant}`
    : `contatta direttamente ${nomeTenant}`;
  return `Non è più possibile cancellare online: mancano meno di ${oreMinime} ${unita} all'appuntamento. Per cancellare, ${contatto}.`;
}
