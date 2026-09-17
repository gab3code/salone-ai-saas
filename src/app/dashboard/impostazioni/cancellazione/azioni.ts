"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";

/**
 * Finestra minima di cancellazione online (richiesta esplicita di Gabriel,
 * 14/09/2026, migrazione 0016). Stesso pattern di aggiornaCaparra.ts: client
 * autenticato, RLS del titolare già permette l'update della propria riga
 * `tenants` (policy "tenant_update" in 0001_init.sql).
 *
 * NON scrive più `telefono` (17/09/2026). Dal 14/09 lo faceva, perché era
 * l'unico posto da cui quel numero si potesse modificare: un campo
 * importante nascosto sotto un titolo che parla d'altro. Ora ha la sua
 * pagina, "Contatti", insieme al numero WhatsApp, e questa si limita a
 * mostrarlo. Due schermate che scrivono la stessa colonna sono la ricetta
 * per farle divergere -- è lo stesso problema del listino della landing
 * scollegato da `piani.ts`, trovato nel controllo della notte prima.
 */
export async function aggiornaFinestraCancellazione(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const oreGrezze = String(formData.get("ore_minime_cancellazione") || "");
  const ore = Number(oreGrezze);
  if (!Number.isFinite(ore) || ore < 0 || !Number.isInteger(ore)) {
    return { errore: "Inserisci un numero di ore intero e non negativo (0 per nessun limite)." };
  }
  if (ore > 720) {
    return { errore: "Non più di 720 ore (30 giorni)." };
  }

  const { error } = await supabase
    .from("tenants")
    .update({ ore_minime_cancellazione: ore })
    .eq("id", tenantId);

  revalidatePath("/dashboard/impostazioni/cancellazione");
  return error ? { errore: `Errore salvando le impostazioni: ${error.message}` } : { ok: true as const };
}
