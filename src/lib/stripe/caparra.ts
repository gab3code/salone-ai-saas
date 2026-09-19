/**
 * Deposito/caparra anti-no-show (Fase 6, PIANO.md Gruppo B punto 1, 13/09/2026).
 * Calcolo puro dell'importo, senza alcuna dipendenza da Stripe/Supabase --
 * usato sia lato server (src/app/s/[slug]/azioni.ts, per creare la Checkout
 * Session con l'importo giusto) sia lato client (FlussoPrenotazione.tsx, per
 * mostrare l'importo al cliente PRIMA di pagare): stesso calcolo, mai
 * duplicato in due punti che potrebbero disallinearsi (stesso principio di
 * "unica fonte di verità" già seguito per il booking engine, punto 9 di
 * CLAUDE.md -- qui applicato a un calcolo invece che a una scrittura).
 *
 * Nessun "server-only" apposta: deve poter essere importato da un componente
 * client, esattamente come src/lib/stripe/piani.ts.
 */

export type TipoCaparra = "percentuale" | "fisso";
/** A chi si chiede: a tutti, o solo a chi ha gia' saltato (migrazione 0071). */
export type RegolaCaparra = "tutti" | "dopo_no_show";

export interface ConfigCaparra {
  attiva: boolean;
  tipo: TipoCaparra;
  // percentuale: 1-100 (percento del prezzo del servizio); fisso: importo in centesimi.
  valore: number;
  /** Assente = "tutti" (le configurazioni scritte prima della 0071). */
  regola?: RegolaCaparra;
  /** Con "dopo_no_show": da quanti no-show in poi. Assente = 1. */
  sogliaNoShow?: number;
}

/**
 * La caparra e' dovuta da QUESTO cliente? Con la regola "tutti" sempre (se
 * attiva); con "dopo_no_show" solo da chi ha almeno `sogliaNoShow` assenze.
 * `noShowCliente` sconosciuto (null/undefined) vale zero: un cliente mai
 * visto, o un telefono non ancora scritto nel form, non paga.
 */
export function caparraDovuta(config: ConfigCaparra, noShowCliente?: number | null): boolean {
  if (!config.attiva) return false;
  if ((config.regola ?? "tutti") === "tutti") return true;
  const soglia = Math.max(1, Math.round(config.sogliaNoShow ?? 1));
  return (noShowCliente ?? 0) >= soglia;
}

/**
 * Importo della caparra in centesimi per un servizio di un dato prezzo,
 * secondo la configurazione del tenant. Ritorna 0 se la caparra non è
 * attiva, o se il calcolo darebbe un importo non addebitabile (es. servizio
 * a prezzo zero con tipo percentuale) -- il chiamante deve trattare 0 come
 * "nessuna caparra richiesta per questa prenotazione", MAI bloccare la
 * prenotazione per un importo pari a zero (Stripe stesso rifiuterebbe una
 * Checkout Session a importo zero).
 */
export function calcolaImportoCaparraCentesimi(
  config: ConfigCaparra,
  prezzoServizioCentesimi: number,
  noShowCliente?: number | null
): number {
  if (!caparraDovuta(config, noShowCliente)) return 0;
  if (config.tipo === "fisso") return Math.max(0, Math.round(config.valore));
  const importo = Math.round((prezzoServizioCentesimi * config.valore) / 100);
  return Math.max(0, importo);
}
