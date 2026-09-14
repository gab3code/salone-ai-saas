"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaListaAttesaAutomatica } from "@/lib/piani";

/**
 * Impostazioni del Contatto automatico della lista d'attesa (Fase 1,
 * deciso con Gabriel il 14/09/2026). Aggiorna direttamente `tenants` con il
 * client autenticato (RLS già permette al titolare di modificare la propria
 * riga, policy "tenant_update" in 0001_init.sql), stesso pattern di
 * `aggiornaCaparra` in impostazioni/caparra/azioni.ts.
 *
 * Il gate di piano è ricontrollato QUI oltre che nella UI (che nasconde il
 * pannello ai piani senza accesso, vedi page.tsx) -- difesa in profondità,
 * stesso principio già seguito da `aggiungiRegolaPromemoria`
 * (impostazioni/promemoria/azioni.ts): un utente non deve poter attivare il
 * contatto automatico chiamando l'azione direttamente se il suo piano non
 * lo include.
 */
export async function aggiornaListaAttesaContattoAutomatico(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessuna attività associata a questo utente." };

  const attivo = formData.get("attivo") === "on";

  if (attivo) {
    const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
    if (!tenant || !pianoHaListaAttesaAutomatica(tenant.piano)) {
      return { errore: "Il contatto automatico della lista d'attesa è incluso dal piano Growth in su." };
    }
  }

  const { error } = await supabase
    .from("tenants")
    .update({ lista_attesa_contatto_automatico: attivo })
    .eq("id", tenantId);

  revalidatePath("/dashboard/impostazioni/lista-attesa");
  return error ? { errore: `Errore salvando le impostazioni: ${error.message}` } : { ok: true as const };
}
