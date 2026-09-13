"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaTonoPersonalizzato } from "@/lib/ai/limiti";
import type { StileTonoAI } from "@/lib/ai/agente";

const STILI_VALIDI: StileTonoAI[] = ["professionale", "amichevole", "informale_con_emoji"];

/**
 * Tono dell'AI personalizzabile (Fase 5, Pro/Enterprise -- vedi
 * `pianoHaTonoPersonalizzato`). Il gate di piano è ricontrollato QUI oltre
 * che nella UI (che nasconde il form ai piani senza accesso): un utente non
 * deve poter salvare un tono personalizzato chiamando l'azione direttamente
 * se il suo piano non lo include, anche se l'interfaccia normale glielo
 * impedirebbe già.
 */
export async function aggiornaTonoAi(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessuna attività associata a questo utente." };

  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  if (!tenant || !pianoHaTonoPersonalizzato(tenant.piano)) {
    return { errore: "Il tono personalizzabile è incluso dal piano Pro in su." };
  }

  const stile = String(formData.get("stile") || "");
  const nota = String(formData.get("nota") || "").trim();

  if (!STILI_VALIDI.includes(stile as StileTonoAI)) {
    return { errore: "Stile non valido." };
  }
  if (nota.length > 300) {
    return { errore: "La nota può avere al massimo 300 caratteri." };
  }

  const { error } = await supabase
    .from("tenants")
    .update({ tono_ai: stile, tono_ai_nota: nota || null })
    .eq("id", tenantId);

  revalidatePath("/dashboard/impostazioni/tono-ai");
  return error ? { errore: `Errore salvando le impostazioni: ${error.message}` } : { ok: true as const };
}
