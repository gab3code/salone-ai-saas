"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { normalizzaTelefonoVisibile, telefonoPlausibile } from "@/lib/contatti";

const PERCORSO = "/dashboard/impostazioni/contatti";

/**
 * I recapiti dell'attività: telefono e WhatsApp (17/09/2026).
 *
 * Questa pagina è l'UNICO posto che scrive `tenants.telefono`. Prima il
 * campo viveva dentro "Cancellazione online", dove era finito per comodità
 * il 14/09/2026 (serviva il numero da mostrare a chi prova a cancellare
 * troppo tardi): un campo importante nascosto sotto un titolo che parla
 * d'altro. Ora quella pagina lo mostra e basta, con un rimando qui --
 * due schermate che scrivono la stessa colonna sono la ricetta per farle
 * divergere.
 *
 * Entrambi i campi sono facoltativi: un'attività può non avere WhatsApp, e
 * in quel caso l'assistente semplicemente non lo propone.
 */
export async function aggiornaContatti(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const telefono = normalizzaTelefonoVisibile(String(formData.get("telefono") || "")).slice(0, 40);
  const whatsapp = normalizzaTelefonoVisibile(String(formData.get("telefono_whatsapp") || "")).slice(0, 40);

  // Validati solo se compilati: il campo vuoto significa "non ce l'ho", che
  // è una risposta legittima e non un errore da segnalare.
  if (telefono && !telefonoPlausibile(telefono)) {
    return { errore: "Il numero di telefono non sembra un numero valido." };
  }
  if (whatsapp && !telefonoPlausibile(whatsapp)) {
    return { errore: "Il numero WhatsApp non sembra un numero valido." };
  }

  const { error } = await supabase
    .from("tenants")
    .update({ telefono: telefono || null, telefono_whatsapp: whatsapp || null })
    .eq("id", accesso.tenantId);

  revalidatePath(PERCORSO);
  // La pagina pubblica mostra il telefono, e la pagina della cancellazione
  // online lo rilegge: entrambe devono aggiornarsi senza aspettare.
  revalidatePath("/dashboard/impostazioni/cancellazione");
  return error ? { errore: `Errore salvando i contatti: ${error.message}` } : { ok: true as const };
}
