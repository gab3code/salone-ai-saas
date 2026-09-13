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

export interface ConfigCaparra {
  attiva: boolean;
  tipo: TipoCaparra;
  // percentuale: 1-100 (percento del prezzo del servizio); fisso: importo in centesimi.
  valore: number;
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
  prezzoServizioCentesimi: number
): number {
  if (!config.attiva) return 0;
  if (config.tipo === "fisso") return Math.max(0, Math.round(config.valore));
  const importo = Math.round((prezzoServizioCentesimi * config.valore) / 100);
  return Math.max(0, importo);
}
