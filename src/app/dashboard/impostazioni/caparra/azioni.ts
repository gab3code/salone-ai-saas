"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import type { TipoCaparra } from "@/lib/stripe/caparra";

/**
 * Impostazioni della caparra (Fase 6, PIANO.md Gruppo B punto 1). Aggiorna
 * direttamente `tenants` con il client autenticato (RLS già permette al
 * titolare di modificare la propria riga, policy "tenant_update" in
 * 0001_init.sql -- nessun bisogno del client admin qui, a differenza del
 * checkout Stripe che scrive `stripe_customer_id`).
 */
export async function aggiornaCaparra(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const attiva = formData.get("attiva") === "on";
  const tipo = String(formData.get("tipo") || "percentuale") as TipoCaparra;
  const valoreGrezzo = String(formData.get("valore") || "").replace(",", ".");
  const valoreNumero = Number(valoreGrezzo);

  if (tipo !== "percentuale" && tipo !== "fisso") {
    return { errore: "Tipo di caparra non valido." };
  }
  if (!Number.isFinite(valoreNumero) || valoreNumero <= 0) {
    return { errore: "Inserisci un valore maggiore di zero." };
  }
  if (tipo === "percentuale" && valoreNumero > 100) {
    return { errore: "Una percentuale non può superare 100." };
  }

  // "fisso" arriva dal form in euro (più naturale da digitare per Gabriel/il
  // titolare) -> convertito in centesimi qui, unico punto di conversione.
  const valore = tipo === "fisso" ? Math.round(valoreNumero * 100) : Math.round(valoreNumero);

  const { error } = await supabase
    .from("tenants")
    .update({ caparra_attiva: attiva, caparra_tipo: tipo, caparra_valore: valore })
    .eq("id", tenantId);

  revalidatePath("/dashboard/impostazioni/caparra");
  return error ? { errore: `Errore salvando le impostazioni: ${error.message}` } : { ok: true as const };
}
