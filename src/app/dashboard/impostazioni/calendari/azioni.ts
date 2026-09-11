"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { collegaCaldav, scollegaCalendario } from "@/lib/calendario-esterno/collegamenti.server";

/**
 * Collegamento calendari esterni (Fase 6bis, deciso con Gabriel il
 * 02/09/2026): Apple/iCloud via CalDAV, disponibile subito -- Google Calendar
 * arriva quando l'OAuth è pronto (vedi PIANO.md).
 */

export async function collegaCalendarioApple(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const operatoreId = String(formData.get("operatore_id") || "");
  const username = String(formData.get("apple_id") || "").trim();
  const password = String(formData.get("password_app") || "").trim();

  if (!operatoreId) return { errore: "Seleziona l'operatore da collegare." };
  if (!username || !password) {
    return { errore: "Servono sia l'Apple ID sia la password specifica per l'app." };
  }

  const risultato = await collegaCaldav(supabase, tenantId, {
    operatoreId,
    serverUrl: "https://caldav.icloud.com/",
    username,
    password,
  });

  revalidatePath("/dashboard/impostazioni/calendari");
  return risultato.ok ? { ok: true } : { errore: risultato.errore };
}

export async function scollegaCalendarioAzione(collegamentoId: string) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const risultato = await scollegaCalendario(supabase, tenantId, collegamentoId);
  revalidatePath("/dashboard/impostazioni/calendari");
  return risultato.ok ? { ok: true } : { errore: risultato.errore };
}
