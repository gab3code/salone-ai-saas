"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import {
  creaAppuntamentoTenant,
  modificaAppuntamentoTenant,
  cancellaAppuntamentoTenant,
  parsaOrarioLocale,
} from "@/lib/booking-engine.server";

/**
 * Creazione di un appuntamento manuale dalla dashboard -- wrapper sottile
 * attorno a `creaAppuntamentoTenant` in booking-engine.server.ts, la STESSA
 * funzione che useranno i tool dell'AI in Fase 2 (punto 9, "single source of
 * truth": AI e calendario devono usare lo stesso motore, non due sistemi
 * separati). Qui si occupa solo di leggere il form e il tenant loggato.
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

  const risultato = await creaAppuntamentoTenant(supabase, tenantId, {
    operatoreId,
    servizioId,
    inizio,
    clienteNome: clienteNome || undefined,
    clienteTelefono: clienteTelefono || undefined,
    creatoDa: "manuale",
  });

  if (!risultato.ok) return { errore: risultato.errore };

  revalidatePath("/dashboard/calendario");
  return { ok: true };
}

export async function cancellaAppuntamento(id: string) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const risultato = await cancellaAppuntamentoTenant(supabase, tenantId, id);
  if (!risultato.ok) return { errore: risultato.errore };

  revalidatePath("/dashboard/calendario");
  return { ok: true };
}

/**
 * Sposta un appuntamento esistente su un nuovo orario/operatore -- wrapper
 * sottile attorno a `modificaAppuntamentoTenant`, stessa logica anti-conflitto
 * (esclude l'appuntamento stesso dal calcolo).
 */
export async function modificaAppuntamento(id: string, formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const operatoreId = String(formData.get("operatore_id") || "");
  const inizioStrGrezzo = String(formData.get("inizio") || "");
  if (!operatoreId || !inizioStrGrezzo) return { errore: "Scegli operatore e orario." };

  // <input type="datetime-local"> restituisce "YYYY-MM-DDTHH:MM" senza fuso --
  // trattato come UTC per coerenza con la semplificazione sul fuso orario
  // usata in tutto il resto del booking engine (vedi nota in
  // booking-engine.server.ts), altrimenti verrebbe interpretato nel fuso
  // orario del server invece che come "l'ora scritta" dal titolare.
  const inizio = parsaOrarioLocale(inizioStrGrezzo);
  if (!inizio) return { errore: "Orario non valido." };

  const risultato = await modificaAppuntamentoTenant(supabase, tenantId, id, {
    operatoreId,
    inizio,
  });

  if (!risultato.ok) return { errore: risultato.errore };

  revalidatePath("/dashboard/calendario");
  return { ok: true };
}
