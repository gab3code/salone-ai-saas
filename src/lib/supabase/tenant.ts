import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizzaRuolo, type RuoloAttivita } from "@/lib/ruoli";

/**
 * L'utente loggato -> il suo tenant_id, secondo "profiles" (popolata dal
 * provisioning automatico alla registrazione, migrazione 0004). Centralizzato
 * qui perché ogni pagina/azione della dashboard ne ha bisogno prima di poter
 * leggere o scrivere qualunque dato di dominio -- niente_ripetuto in ogni file.
 *
 * Da Fase 5 (migrazione 0027) `profiles.tenant_id` è la SEDE ATTIVA: un
 * account può appartenere a più attività (tabella `membri_tenant`) e il
 * selettore di sede aggiorna questa colonna. Per il database non cambia
 * nulla -- `auth_tenant_id()` e tutte le policy RLS continuano a leggere
 * esattamente lo stesso campo.
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

export type SessioneTenant = {
  userId: string;
  tenantId: string;
  /** Ruolo NELLA sede attiva. */
  ruolo: RuoloAttivita;
  /** Ruolo di piattaforma grezzo (serve solo a /admin). */
  ruoloProfilo: string | null;
};

/**
 * Come `ottieniTenantCorrente`, ma restituisce anche CHI è e con quale
 * ruolo -- quello che serve a ogni gate di permesso (src/lib/ruoli.ts).
 *
 * Il ruolo viene letto da `profiles.ruolo`, che il cambio sede tiene
 * allineato all'appartenenza corrispondente in `membri_tenant` (vedi
 * `cambiaSedeAttiva` in src/lib/membri.server.ts). Leggere da qui invece che
 * da `membri_tenant` costa una query in meno su OGNI richiesta della
 * dashboard, ed è la stessa riga che il trigger di registrazione scrive.
 */
export async function ottieniSessioneTenant(
  supabase: SupabaseClient
): Promise<SessioneTenant | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profilo } = await supabase
    .from("profiles")
    .select("tenant_id, ruolo")
    .eq("id", user.id)
    .single();

  if (!profilo?.tenant_id) return null;

  return {
    userId: user.id,
    tenantId: profilo.tenant_id,
    ruolo: normalizzaRuolo(profilo.ruolo),
    ruoloProfilo: profilo.ruolo ?? null,
  };
}
