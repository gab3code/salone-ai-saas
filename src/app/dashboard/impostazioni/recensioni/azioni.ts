"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { rispondiRecensioneTenant } from "@/lib/recensioni.server";

/**
 * Accende/spegne l'interruttore generale (vedi 0026_recensioni.sql per cosa
 * controlla insieme: invio di nuove richieste E visibilità pubblica). Client
 * AUTENTICATO del chiamante: la policy `tenant_update` di RLS permette al
 * titolare di aggiornare il PROPRIO tenant, stesso meccanismo già usato da
 * `aggiornaCompleanno`.
 */
export async function aggiornaToggleRecensioni(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const attivo = formData.get("attivo") === "on";

  const { error } = await supabase.from("tenants").update({ raccolta_recensioni_attiva: attivo }).eq("id", tenantId);

  revalidatePath("/dashboard/impostazioni/recensioni");
  return error ? { errore: `Errore salvando le impostazioni: ${error.message}` } : { ok: true as const };
}

/**
 * Aggiunge/aggiorna la risposta pubblica a una recensione -- delega a
 * `rispondiRecensioneTenant` (client ADMIN interno, perché "authenticated"
 * ha SOLO select su "recensioni": vedi 0026_recensioni.sql, il titolare non
 * ha comunque il permesso Postgres di scrivere lì, questa server action è
 * l'unico varco, ristretto a queste due sole colonne).
 */
export async function rispondiRecensione(recensioneId: string, risposta: string) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const risultato = await rispondiRecensioneTenant(tenantId, recensioneId, risposta);
  revalidatePath("/dashboard/impostazioni/recensioni");
  return risultato.ok ? { ok: true as const } : { errore: risultato.errore };
}
