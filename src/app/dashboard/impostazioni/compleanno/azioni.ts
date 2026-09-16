"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { pianoHaPromemoriaCompleanno } from "@/lib/piani";
import { LUNGHEZZA_MASSIMA_MESSAGGIO_COMPLEANNO } from "@/lib/compleanno";

/**
 * Salva interruttore + messaggio del Promemoria di compleanno (Pro/
 * Enterprise -- vedi `pianoHaPromemoriaCompleanno`). Il gate di piano è
 * ricontrollato QUI oltre che nella UI, stesso principio già seguito da
 * `aggiornaTonoAi`/`aggiungiRegolaPromemoria`: un utente non deve poter
 * accendere l'automazione chiamando l'azione direttamente se il suo piano
 * non la include.
 */
export async function aggiornaCompleanno(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  if (!tenant || !pianoHaPromemoriaCompleanno(tenant.piano)) {
    return { errore: "Il promemoria di compleanno è incluso dal piano Pro in su." };
  }

  const attivo = formData.get("attivo") === "on";
  const messaggio = String(formData.get("messaggio") || "").trim();

  if (messaggio.length > LUNGHEZZA_MASSIMA_MESSAGGIO_COMPLEANNO) {
    return { errore: `Il messaggio può avere al massimo ${LUNGHEZZA_MASSIMA_MESSAGGIO_COMPLEANNO} caratteri.` };
  }

  const { error } = await supabase
    .from("tenants")
    .update({ compleanno_attivo: attivo, compleanno_messaggio: messaggio || null })
    .eq("id", tenantId);

  revalidatePath("/dashboard/impostazioni/compleanno");
  return error ? { errore: `Errore salvando le impostazioni: ${error.message}` } : { ok: true as const };
}
