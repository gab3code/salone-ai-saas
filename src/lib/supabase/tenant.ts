import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * L'utente loggato -> il suo tenant_id, secondo "profiles" (popolata dal
 * provisioning automatico alla registrazione, migrazione 0004). Centralizzato
 * qui perché ogni pagina/azione della dashboard ne ha bisogno prima di poter
 * leggere o scrivere qualunque dato di dominio -- niente_ripetuto in ogni file.
 */
export async function ottieniTenantCorrente(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profilo } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  return profilo?.tenant_id ?? null;
}
