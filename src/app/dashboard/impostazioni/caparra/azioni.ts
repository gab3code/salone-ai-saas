"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import type { TipoCaparra } from "@/lib/stripe/caparra";

/**
 * Impostazioni della caparra (Fase 6, PIANO.md Gruppo B punto 1). Aggiorna
 * direttamente `tenants` con il client autenticato (RLS già permette al
 * titolare di modificare la propria riga, policy "tenant_update" in
 * 0001_init.sql -- nessun bisogno del client admin qui, a differenza del
 * checkout Stripe che scrive `stripe_customer_id`).
 */
export async function aggiornaCaparra(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const attiva = formData.get("attiva") === "on";
  const tipo = String(formData.get("tipo") || "percentuale") as TipoCaparra;
  const valoreGrezzo = String(formData.get("valore") || "").replace(",", ".");
  const valoreNumero = Number(valoreGrezzo);

  if (tipo !== "percentuale" && tipo !== "fisso") {
    return { errore: "Tipo di caparra non valido." };
  }

  // SPEGNERE LA CAPARRA NON RICHIEDE UN IMPORTO VALIDO (19/09/2026).
  //
  // Il caso vero, segnalato da Gabriel: ha tolto la spunta, ha svuotato il
  // campo della percentuale -- cosa ragionevole, se la caparra non la vuoi
  // piu' -- e ha premuto Salva. Risposta: "Inserisci un valore maggiore di
  // zero". Niente e' stato salvato, e **la caparra e' rimasta attiva**: il
  // prodotto ha continuato a chiedere soldi ai suoi clienti dopo che lui
  // aveva detto di smettere.
  //
  // E' lo stesso difetto del giorno "aperto senza orari" di stamattina:
  // validare un campo che nello stato corrente non vuol dire niente. La
  // percentuale ha senso solo se la caparra e' accesa; se e' spenta, quel
  // numero non lo legge nessuno.
  //
  // Quando si spegne si aggiorna SOLO l'interruttore e si lascia stare tipo
  // e valore: cosi' riaccendendola si ritrova l'impostazione di prima invece
  // di un default. Un'impostazione che si perde quando la disattivi e' un
  // motivo per non disattivarla mai.
  if (!attiva) {
    const { error: erroreSpegnimento } = await supabase
      .from("tenants")
      .update({ caparra_attiva: false })
      .eq("id", tenantId);
    revalidatePath("/dashboard/impostazioni/caparra");
    return erroreSpegnimento
      ? { errore: `Errore salvando le impostazioni: ${erroreSpegnimento.message}` }
      : { ok: true as const };
  }

  if (!Number.isFinite(valoreNumero) || valoreNumero <= 0) {
    return { errore: "Inserisci un valore maggiore di zero." };
  }
  if (tipo === "percentuale" && valoreNumero > 100) {
    return { errore: "Una percentuale non può superare 100." };
  }

  // "fisso" arriva dal form in euro (più naturale da digitare per Gabriel/il
  // titolare) -> convertito in centesimi qui, unico punto di conversione.
  const valore = tipo === "fisso" ? Math.round(valoreNumero * 100) : Math.round(valoreNumero);

  // Caparra selettiva (migrazione 0071): a tutti, o solo da N no-show in poi.
  const regola = formData.get("regola") === "dopo_no_show" ? "dopo_no_show" : "tutti";
  const sogliaNumero = Number(String(formData.get("soglia") || "1"));
  if (regola === "dopo_no_show" && (!Number.isInteger(sogliaNumero) || sogliaNumero < 1)) {
    return { errore: "La soglia dei no-show deve essere un numero intero, almeno 1." };
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      caparra_attiva: true,
      caparra_tipo: tipo,
      caparra_valore: valore,
      caparra_regola: regola,
      caparra_no_show_soglia: regola === "dopo_no_show" ? sogliaNumero : 1,
    })
    .eq("id", tenantId);

  revalidatePath("/dashboard/impostazioni/caparra");
  return error ? { errore: `Errore salvando le impostazioni: ${error.message}` } : { ok: true as const };
}
