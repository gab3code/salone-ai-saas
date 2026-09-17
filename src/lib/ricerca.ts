/**
 * Ripulisce un termine di ricerca prima di infilarlo in un filtro PostgREST.
 *
 * Nato da un audit del 17/09/2026. La ricerca clienti costruiva il filtro
 * cosi':
 *
 *   .or(`nome.ilike.%${q}%,telefono.ilike.%${q}%`)
 *
 * con `q` preso dalla barra degli indirizzi e non toccato. Quella stringa
 * NON e' SQL -- e' la grammatica di PostgREST -- ma ha comunque dei
 * caratteri che significano qualcosa: la virgola separa due condizioni, le
 * parentesi raggruppano, il punto separa colonna, operatore e valore. Una
 * ricerca contenente una virgola smetteva di essere una ricerca e diventava
 * un filtro in piu' sulla tabella.
 *
 * L'isolamento fra saloni reggeva comunque, perche' l'`.eq("tenant_id", ...)`
 * viene applicato a parte e non si puo' scavalcare da qui: nessuno poteva
 * leggere i clienti di un altro. Ma restava input dell'utente che arrivava
 * intero dentro una query, ed e' il genere di cosa che si sistema prima che
 * diventi qualcos'altro.
 *
 * Due categorie di caratteri, per due motivi diversi:
 *  - `, ( ) . " \` -- rompono la GRAMMATICA del filtro;
 *  - `% _` -- sono i jolly di `like`, e lasciarli passare permette a chiunque
 *    di scrivere `%` e farsi tornare l'intera rubrica in un colpo solo,
 *    scaricando piu' dati del dovuto.
 *
 * Si tolgono invece di scappare: qui il termine serve a cercare un nome o un
 * numero di telefono, e nessuno dei due contiene legittimamente quei segni.
 * Togliere e' piu' facile da leggere e non ha casi limite.
 */
const CARATTERI_DA_TOGLIERE = /[,().%_"\\]/g;

/** Lunghezza massima: oltre, non e' piu' una ricerca. */
export const LUNGHEZZA_MASSIMA_TERMINE_RICERCA = 80;

export function terminoRicercaSicuro(grezzo: string | null | undefined): string | null {
  if (typeof grezzo !== "string") return null;
  const pulito = grezzo.replace(CARATTERI_DA_TOGLIERE, " ").trim().slice(0, LUNGHEZZA_MASSIMA_TERMINE_RICERCA);
  return pulito === "" ? null : pulito;
}

/** Il filtro `or` per la ricerca clienti, in un posto solo invece di due. */
export function filtroRicercaClienti(termine: string): string {
  return `nome.ilike.%${termine}%,telefono.ilike.%${termine}%`;
}
