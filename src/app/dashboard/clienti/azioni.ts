"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoCancellareClienti } from "@/lib/ruoli";

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

/**
 * Cancella definitivamente la scheda di un cliente (17/09/2026).
 *
 * Perché esiste: l'informativa privacy dice dei dati dei clienti finali
 * "Sono dati suoi, e la decisione di cancellarli è sua", e l'accordo art. 28
 * promette al salone che lo assistiamo quando un suo cliente esercita il
 * diritto alla cancellazione. Nessuna delle due cose era vera: questo file
 * esportava solo `aggiornaCliente`, e l'unico modo per far sparire un cliente
 * era cancellare l'intera attività dal pannello di piattaforma. Costruire la
 * funzione è l'unico modo di rimettere in pari prodotto e pagine legali --
 * quell'obbligo il salone ce l'ha comunque, con o senza la nostra frase.
 *
 * Owner-only, e non per scelta di interfaccia: la migrazione 0035 applica lo
 * stesso confine con una policy di DELETE sul database, quindi anche una
 * richiesta HTTP diretta a PostgREST con il JWT di un dipendente viene
 * rifiutata. Il controllo qui serve a dare un messaggio leggibile, non a
 * essere l'unica difesa.
 *
 * Lo storico NON viene toccato: le tre chiavi esterne verso `clienti`
 * (appuntamenti, conversazioni, recensioni) sono `on delete set null`, quindi
 * gli appuntamenti passati restano nei conti del salone senza più il nome di
 * nessuno. È esattamente la forma di cancellazione che serve qui.
 */
export async function cancellaCliente(id: string) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoCancellareClienti);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const { error } = await supabase
    .from("clienti")
    .delete()
    .eq("id", id)
    .eq("tenant_id", accesso.tenantId);

  if (error) return { errore: `Errore cancellando il cliente: ${error.message}` };

  revalidatePath("/dashboard/clienti");
  return { ok: true };
}
