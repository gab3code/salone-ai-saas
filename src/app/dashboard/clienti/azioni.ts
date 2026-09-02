"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";

/**
 * CRM (punto 12 di CLAUDE.md): la scheda cliente è il punto centrale della
 * relazione -- qui solo modifica dei dati anagrafici. Storico prenotazioni,
 * conversazioni, automazioni collegate restano una query di sola lettura
 * nella pagina (punto 12: "deve essere REALMENTE connesso", non un modulo
 * isolato che duplica dati).
 */
export async function aggiornaCliente(id: string, formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const nome = String(formData.get("nome") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const tagGrezzo = String(formData.get("tag") || "").trim();
  const tag = tagGrezzo
    ? tagGrezzo.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { error } = await supabase
    .from("clienti")
    .update({
      nome: nome || null,
      email: email || null,
      note: note || null,
      tag,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { errore: `Errore salvando il cliente: ${error.message}` };

  revalidatePath(`/dashboard/clienti/${id}`);
  revalidatePath("/dashboard/clienti");
  return { ok: true };
}
