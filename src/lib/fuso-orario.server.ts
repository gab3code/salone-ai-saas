import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FUSO_ORARIO_PREDEFINITO } from "./fuso-orario";

/**
 * Fuso orario vero del tenant (colonna aggiunta in
 * 0010_fuso_orario_tenant). Condiviso da booking-engine.server.ts,
 * metriche.server.ts, l'endpoint chat AI e le pagine dashboard che
 * mostrano/modificano orari -- un solo punto che legge questa colonna,
 * mai una query duplicata per ognuno.
 *
 * Fail-open sul default: non riuscire a leggerlo non deve mai bloccare una
 * prenotazione o il caricamento di una pagina, e 'Europe/Rome' resta
 * corretto per tutti i tenant di oggi anche come ripiego.
 */
export async function caricaFusoOrarioTenant(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const { data } = await supabase.from("tenants").select("fuso_orario").eq("id", tenantId).maybeSingle();
  return data?.fuso_orario || FUSO_ORARIO_PREDEFINITO;
}
