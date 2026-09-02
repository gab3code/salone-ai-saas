"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { verificaConflittoTenant } from "@/lib/booking-engine.server";

/**
 * Creazione di un appuntamento manuale dalla dashboard -- deve passare dallo
 * STESSO motore di disponibilità che useranno i tool dell'AI in Fase 2
 * (punto 14, "single source of truth"): controllo anti-conflitto applicativo
 * qui, poi il vincolo `niente_sovrapposizioni` del database come rete di
 * sicurezza finale contro le race condition (due richieste concorrenti che
 * superano entrambe il controllo applicativo prima che l'altra scriva).
 */
export async function creaAppuntamento(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const operatoreId = String(formData.get("operatore_id") || "");
  const servizioId = String(formData.get("servizio_id") || "");
  const inizioStr = String(formData.get("inizio") || "");
  const clienteNome = String(formData.get("cliente_nome") || "").trim();
  const clienteTelefono = String(formData.get("cliente_telefono") || "").trim();

  if (!operatoreId || !servizioId || !inizioStr) {
    return { errore: "Scegli operatore, servizio e orario." };
  }

  const inizio = new Date(inizioStr);
  if (Number.isNaN(inizio.getTime())) {
    return { errore: "Orario non valido." };
  }

  const { data: servizio } = await supabase
    .from("servizi")
    .select("durata_minuti")
    .eq("id", servizioId)
    .eq("tenant_id", tenantId)
    .single();
  if (!servizio) return { errore: "Servizio non trovato." };

  const fine = new Date(inizio.getTime() + servizio.durata_minuti * 60_000);

  const conflitto = await verificaConflittoTenant(supabase, tenantId, {
    inizio,
    fine,
    operatoreId,
  });
  if (conflitto) {
    return { errore: "Questo operatore ha già un appuntamento in quell'orario. Scegli un altro slot." };
  }

  let clienteId: string | null = null;
  if (clienteTelefono) {
    const { data: esistente } = await supabase
      .from("clienti")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("telefono", clienteTelefono)
      .maybeSingle();

    if (esistente) {
      clienteId = esistente.id;
    } else {
      const { data: nuovo, error: erroreCliente } = await supabase
        .from("clienti")
        .insert({ tenant_id: tenantId, nome: clienteNome || null, telefono: clienteTelefono })
        .select("id")
        .single();
      if (erroreCliente) return { errore: `Errore creando il cliente: ${erroreCliente.message}` };
      clienteId = nuovo.id;
    }
  }

  const { error } = await supabase.from("appuntamenti").insert({
    tenant_id: tenantId,
    operatore_id: operatoreId,
    servizio_id: servizioId,
    cliente_id: clienteId,
    inizio: inizio.toISOString(),
    fine: fine.toISOString(),
    stato: "confermato",
    creato_da: "manuale",
  });

  if (error) {
    // 23P01 = exclusion_violation: il vincolo "niente_sovrapposizioni" ha
    // bloccato una race condition sfuggita al controllo applicativo sopra
    // (due creazioni concorrenti sullo stesso slot).
    if (error.code === "23P01") {
      return {
        errore: "Questo slot è appena stato occupato da un altro appuntamento. Scegli un altro orario.",
      };
    }
    return { errore: `Errore salvando l'appuntamento: ${error.message}` };
  }

  revalidatePath("/dashboard/calendario");
  return { ok: true };
}

export async function cancellaAppuntamento(id: string) {
  const supabase = await creaClientServer();
  const { error } = await supabase
    .from("appuntamenti")
    .update({ stato: "cancellato" })
    .eq("id", id);
  if (error) return { errore: `Errore cancellando l'appuntamento: ${error.message}` };
  revalidatePath("/dashboard/calendario");
  return { ok: true };
}
