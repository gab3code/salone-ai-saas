import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chiave) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY mancanti -- servono in .env.local per lanciare i test E2E (leggono lo stesso file dell'app)."
    );
  }
  return createClient(url, chiave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
