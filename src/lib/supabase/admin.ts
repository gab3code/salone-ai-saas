import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase con la service_role key: BYPASSA RLS by design. Da usare
 * SOLO in codice server-side fidato (webhook Stripe, webhook WhatsApp,
 * job schedulati/pg_cron, tool dell'AI che devono scrivere per conto del
 * sistema) -- mai per servire una richiesta "per conto" di un utente
 * qualsiasi, altrimenti si perde l'isolamento tra saloni che RLS garantisce.
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
