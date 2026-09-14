"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaPromemoria } from "@/lib/piani";
import { MAX_REGOLE_PROMEMORIA_PER_TENANT } from "@/lib/promemoria";

/**
 * Aggiunge una regola "manda un promemoria X ore prima" (Fase 6, vedi
 * src/lib/promemoria.ts per la logica di invio vera e propria). Il gate di
 * piano è ricontrollato QUI oltre che nella UI (che nasconde il form ai
 * piani senza accesso), stesso principio già seguito da
 * `aggiornaTonoAi` (impostazioni/tono-ai/azioni.ts): un utente non deve
 * poter aggiungere regole chiamando l'azione direttamente se il suo piano
 * non le include.
 */
export async function aggiungiRegolaPromemoria(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessuna attività associata a questo utente." };

  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  if (!tenant || !pianoHaPromemoria(tenant.piano)) {
    return { errore: "I promemoria automatici sono inclusi dal piano Growth in su." };
  }

  const oreTesto = String(formData.get("ore_preavviso") || "");
  const ore = Number(oreTesto);
  if (!Number.isInteger(ore) || ore <= 0 || ore > 720) {
    return { errore: "Il preavviso deve essere un numero intero di ore tra 1 e 720 (30 giorni)." };
  }

  const { count } = await supabase
    .from("regole_promemoria")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((count ?? 0) >= MAX_REGOLE_PROMEMORIA_PER_TENANT) {
    return { errore: `Massimo ${MAX_REGOLE_PROMEMORIA_PER_TENANT} promemoria attivi per volta.` };
  }

  const { error } = await supabase.from("regole_promemoria").insert({ tenant_id: tenantId, ore_preavviso: ore });

  revalidatePath("/dashboard/impostazioni/promemoria");
  if (error) {
    // Violazione dell'unique (tenant_id, ore_preavviso), messaggio leggibile invece del testo grezzo di Postgres.
    if (error.code === "23505") return { errore: "Hai già un promemoria impostato su questo numero di ore." };
    return { errore: `Errore salvando il promemoria: ${error.message}` };
  }
  return { ok: true as const };
}

/** Rimuove una regola -- il gate di piano non serve ricontrollarlo qui: una regola già esistente
 * è legittima da rimuovere anche se nel frattempo il tenant fosse sceso di piano (RLS impedisce
 * comunque di toccare regole di un altro tenant, vedi migrazione 0017). */
export async function eliminaRegolaPromemoria(regolaId: string) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessuna attività associata a questo utente." };

  const { error } = await supabase.from("regole_promemoria").delete().eq("id", regolaId).eq("tenant_id", tenantId);

  revalidatePath("/dashboard/impostazioni/promemoria");
  return error ? { errore: `Errore rimuovendo il promemoria: ${error.message}` } : { ok: true as const };
}
