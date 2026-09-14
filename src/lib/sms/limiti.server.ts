import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Conta gli SMS REALMENTE inviati (mai i tentativi falliti, vedi
 * `inviaSmsSeInclusoNelPiano` in invio.server.ts -- si traccia solo dopo un
 * invio riuscito) per questo tenant nel mese corrente. Stesso pattern
 * esatto di `contaMessaggiClienteQuestoMese` in ai/limiti.server.ts:
 * fuso orario semplificato come UTC, query count/head (non servono le
 * righe, solo il numero).
 */
export async function contaSmsTenantQuestoMese(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const adesso = new Date();
  const inizioMese = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), 1));

  const { count, error } = await supabase
    .from("sms_inviati")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", inizioMese.toISOString());

  if (error) {
    // Un errore nel CONTROLLO di quota non deve mai bloccare un invio reale
    // (il sintomo sarebbe peggiore del problema che preveniamo) -- logghiamo
    // e lasciamo passare, stesso principio di contaMessaggiClienteQuestoMese.
    console.error("[sms] Errore contando gli SMS del mese per la quota:", tenantId, error);
    return 0;
  }
  return count ?? 0;
}
