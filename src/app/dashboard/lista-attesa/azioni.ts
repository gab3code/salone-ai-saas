"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { aggiungiListaAttesaTenant } from "@/lib/booking-engine.server";

const FORMATO_DATA_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Aggiunta manuale (staff) alla lista d'attesa -- Fase 6, PIANO.md Gruppo B
 * punto 3. Stesso ingresso che usa il tool AI `aggiungi_lista_attesa`, per
 * il caso in cui il cliente chiami/scriva direttamente invece di passare
 * dalla chat pubblica (single source of truth: entrambi i canali chiamano
 * solo `aggiungiListaAttesaTenant`, mai una seconda logica di inserimento).
 */
export async function aggiungiListaAttesa(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const servizioId = String(formData.get("servizio_id") || "");
  const operatoreId = String(formData.get("operatore_id") || "").trim();
  const clienteNome = String(formData.get("cliente_nome") || "").trim();
  const clienteTelefono = String(formData.get("cliente_telefono") || "").trim();
  const dataPreferita = String(formData.get("data_preferita") || "").trim();
  const note = String(formData.get("note") || "").trim();

  if (!servizioId || !clienteTelefono) {
    return { errore: "Servizio e telefono del cliente sono obbligatori." };
  }
  if (dataPreferita && !FORMATO_DATA_YMD.test(dataPreferita)) {
    return { errore: "Data preferita non valida." };
  }

  const risultato = await aggiungiListaAttesaTenant(supabase, tenantId, {
    servizioId,
    operatoreId: operatoreId || undefined,
    clienteNome: clienteNome || undefined,
    clienteTelefono,
    dataPreferitaYMD: dataPreferita || undefined,
    note: note || undefined,
    creatoDa: "manuale",
  });

  if (!risultato.ok) return { errore: risultato.errore };

  revalidatePath("/dashboard/lista-attesa");
  return { ok: true };
}

/** Il titolare ha contattato il cliente e l'appuntamento è stato risistemato (o il cliente ha rifiutato/non risponde più): esce dalla lista attiva. */
export async function segnaListaAttesaRisolta(id: string) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const { error } = await supabase
    .from("lista_attesa")
    .update({ stato: "risolto" })
    .eq("id", id)
    .eq("tenant_id", tenantId);
  if (error) return { errore: `Errore aggiornando la lista d'attesa: ${error.message}` };

  revalidatePath("/dashboard/lista-attesa");
  return { ok: true };
}

/** Rimuove definitivamente una voce (il cliente ha rinunciato, o è stata inserita per errore). */
export async function rimuoviListaAttesa(id: string) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const { error } = await supabase.from("lista_attesa").delete().eq("id", id).eq("tenant_id", tenantId);
  if (error) return { errore: `Errore rimuovendo dalla lista d'attesa: ${error.message}` };

  revalidatePath("/dashboard/lista-attesa");
  return { ok: true };
}
