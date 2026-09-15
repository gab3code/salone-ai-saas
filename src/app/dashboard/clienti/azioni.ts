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

  // Data di nascita (facoltativa, vedi migrazione 0023 e src/lib/compleanno.ts
  // per l'uso che ne fa il promemoria di compleanno): il solo controllo qui è
  // "non nel futuro", errore di battitura più probabile di un vero dato da
  // rifiutare (l'input <input type="date"> non impedisce di per sé una data
  // futura).
  const dataNascitaGrezza = String(formData.get("data_nascita") || "").trim();
  if (dataNascitaGrezza && dataNascitaGrezza > new Date().toISOString().slice(0, 10)) {
    return { errore: "La data di nascita non può essere nel futuro." };
  }

  const { error } = await supabase
    .from("clienti")
    .update({
      nome: nome || null,
      email: email || null,
      note: note || null,
      tag,
      data_nascita: dataNascitaGrezza || null,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) return { errore: `Errore salvando il cliente: ${error.message}` };

  revalidatePath(`/dashboard/clienti/${id}`);
  revalidatePath("/dashboard/clienti");
  return { ok: true };
}
