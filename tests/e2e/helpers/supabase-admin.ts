import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { risolviDatabaseDiProva } from "./database-di-prova";

/**
 * Client Supabase service_role per i test E2E -- stesso ruolo di
 * `src/lib/supabase/admin.ts` (bypassa RLS), ma senza l'import "server-only"
 * di quel file: qui gira sotto il test runner di Playwright (Node puro), non
 * dentro il bundler di Next, e non c'è alcun rischio che finisca nel browser.
 *
 * Richiede le stesse due variabili di `.env.local` che usa già l'app --
 * Playwright le legge da lì tramite `dotenv`-like caricamento di Next stesso
 * quando il webServer parte, ma i file di test girano come processo Node
 * separato: vedi `tests/e2e/helpers/carica-env.ts`.
 */
export function creaClientAdminTest(): SupabaseClient {
  // Quale database, lo decide un posto solo (database-di-prova.ts), lo stesso
  // che playwright.config.ts usa per il server: se i due divergessero, i test
  // leggerebbero da una parte e l'app scriverebbe dall'altra.
  const esito = risolviDatabaseDiProva(process.env);
  if (!esito.ok) throw new Error(`\n\n${esito.errore}\n`);

  return createClient(esito.database.url, esito.database.chiaveServizio, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
