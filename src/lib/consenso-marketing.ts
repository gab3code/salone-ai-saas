/**
 * Il consenso marketing del cliente (migrazione 0070): la parte pura.
 *
 * Tre stati: null = mai chiesto, true, false. La differenza fra null e false
 * conta: a chi ha detto no non si chiede piu'; a chi non e' mai stato chiesto
 * si puo' chiedere. Chi puo' ricevere cosa e' deciso nei moduli che mandano
 * (auguri e follow-up solo con true; richiesta di recensione dopo un servizio
 * anche con null, mai con false: art. 130 c. 4 Codice Privacy).
 */
export type FonteConsensoMarketing = "prenotazione_online" | "import" | "scheda" | "chat";

/**
 * I tre campi del consenso marketing (migrazione 0070), come si scrivono.
 * `undefined` = non e' stato chiesto in questo passaggio: non si tocca
 * quello che c'e'. `true`/`false` = il cliente ha risposto adesso: si scrive
 * con data e provenienza, anche sopra un valore precedente -- una revoca
 * vale quanto un consenso.
 */
export function campiConsenso(
  consenso: boolean | undefined,
  fonte: FonteConsensoMarketing
): { consenso_marketing?: boolean; consenso_marketing_at?: string; consenso_marketing_fonte?: FonteConsensoMarketing } {
  if (consenso === undefined) return {};
  return { consenso_marketing: consenso, consenso_marketing_at: new Date().toISOString(), consenso_marketing_fonte: fonte };
}

