"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import {
  canaleConfermaValido,
  canaleConsentitoDalPiano,
  ETICHETTA_CANALE_CONFERMA,
} from "@/lib/notifiche-prenotazione";

const PERCORSO = "/dashboard/impostazioni/notifiche";

/**
 * Chi riceve cosa quando arriva una prenotazione (17/09/2026).
 *
 * Il gate di piano sull'SMS è ricontrollato QUI oltre che nella UI, stesso
 * principio di `aggiornaTonoAi`/`aggiornaCompleanno`: una server action è un
 * endpoint POST chiamabile senza mai aprire la pagina. Senza questo
 * controllo un tenant Growth potrebbe salvare "solo SMS" e restare in uno
 * stato assurdo -- crede di aver scelto un canale, e i suoi clienti non
 * ricevono niente, perché `inviaSmsSeInclusoNelPiano` scarta comunque
 * l'invio.
 */
export async function aggiornaNotifiche(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  if (!tenant) return { errore: "Attività non trovata." };

  const canale = String(formData.get("conferma_cliente_canale") || "");
  if (!canaleConfermaValido(canale)) {
    return { errore: "Scelta non valida per la conferma ai clienti." };
  }
  if (!canaleConsentitoDalPiano(canale, tenant.piano)) {
    return {
      errore: `"${ETICHETTA_CANALE_CONFERMA[canale]}" richiede l'SMS, incluso dal piano Pro in su.`,
    };
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      notifica_titolare_nuova_prenotazione: formData.get("avvisa_titolare") === "on",
      conferma_cliente_canale: canale,
    })
    .eq("id", tenantId);

  revalidatePath(PERCORSO);
  return error ? { errore: `Errore salvando le notifiche: ${error.message}` } : { ok: true as const };
}
