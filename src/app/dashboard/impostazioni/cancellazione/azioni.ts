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
 * Salva anche `telefono` insieme alla soglia: girando il codice per questa
 * funzionalità è emerso che `tenants.telefono` (colonna già esistente, usata
 * sulla pagina pubblica e ora anche nel messaggio di blocco cancellazione)
 * non aveva NESSUNA pagina delle impostazioni da cui modificarlo -- gap
 * onestamente segnalato, non taciuto (vedi PIANO.md). Sistemarlo qui è il
 * punto più naturale: è esattamente il numero che serve perché questa
 * funzionalità sia utile, non ha senso rimandarlo a un'altra pagina.
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

  const telefono = String(formData.get("telefono") || "").trim().slice(0, 40) || null;

  const { error } = await supabase
    .from("tenants")
    .update({ ore_minime_cancellazione: ore, telefono })
    .eq("id", tenantId);

  revalidatePath("/dashboard/impostazioni/cancellazione");
  return error ? { errore: `Errore salvando le impostazioni: ${error.message}` } : { ok: true as const };
}
