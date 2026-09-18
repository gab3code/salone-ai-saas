import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase con la service_role key: BYPASSA RLS by design. Da usare
 * SOLO in codice server-side fidato (webhook Stripe, webhook WhatsApp,
 * job schedulati/pg_cron, tool dell'AI che devono scrivere per conto del
 * sistema).
 *
 * "Mai per servire una richiesta per conto di un utente" e' stata la regola
 * fino al 18/09/2026, e adesso ha DUE eccezioni dichiarate: la rubrica
 * clienti (`clienti.server.ts`, migrazione 0051) e i collegamenti dei
 * calendari (`collegamenti.server.ts`, migrazione 0065). In tutti e due i
 * casi il motivo e' lo stesso: quelle tabelle contengono dati che nemmeno un
 * collaboratore del salone deve poter scaricare da PostgREST, quindi il
 * permesso e' stato tolto del tutto e l'unico accesso passa da un modulo
 * server.
 *
 * Il prezzo di ogni eccezione, da pagare per intero o non farla: RLS non
 * protegge piu' quelle query, quindi il filtro `tenant_id` diventa l'unica
 * difesa, il modulo deve rifiutarsi di partire senza tenant, e un test deve
 * controllare OGNI query -- compreso il confronto fra funzioni esportate e
 * funzioni coperte, cosi' una aggiunta domani non passa in silenzio.
 * Un'eccezione senza queste tre cose e' solo RLS spenta.
 *
 * "server-only" fa fallire la build se questo file finisse per sbaglio in un
 * bundle che arriva al browser -- prima linea di difesa, non l'unica: la
 * chiave stessa vive solo in SUPABASE_SERVICE_ROLE_KEY (mai NEXT_PUBLIC_*).
 */
export function creaClientAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chiave) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti in .env.local");
  }
  return createClient(url, chiave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
