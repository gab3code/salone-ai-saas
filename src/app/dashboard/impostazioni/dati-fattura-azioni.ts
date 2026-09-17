"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoGestireFatturazione } from "@/lib/ruoli";
import { identificativoFiscaleValido } from "@/lib/fiscale";

/**
 * Salva i dati che servono a consegnare la fattura elettronica: codice
 * destinatario SdI o PEC (migrazione 0031).
 *
 * Si chiedono al checkout, dove però sono opzionali di proposito -- un
 * cliente che non sa cosa sia il codice destinatario non deve restare
 * bloccato davanti al pagamento. Questa è la seconda occasione: chi è
 * arrivato qui li ha sottomano.
 *
 * Scrive con il client ADMIN e non con quello dell'utente: dalla migrazione
 * 0030 `authenticated` può aggiornare solo un elenco esplicito di colonne di
 * `tenants`, e queste due non ci sono -- come `piano` e `stato_abbonamento`,
 * descrivono il rapporto contrattuale, non una preferenza del titolare, e
 * non devono essere scrivibili con una richiesta diretta al database. Il
 * permesso viene quindi verificato QUI, prima di usare il service_role.
 */
export async function salvaDatiFattura(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoGestireFatturazione);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const codice = String(formData.get("codice_destinatario") ?? "").trim().toUpperCase();
  const pec = String(formData.get("pec_fatturazione") ?? "").trim().toLowerCase();
  const codiceFiscale = String(formData.get("codice_fiscale") ?? "").trim().toUpperCase();

  // Il codice destinatario è di 6 caratteri per la PA e 7 per i privati; si
  // accettano entrambe le lunghezze e solo lettere/cifre. "0000000" è un
  // valore legittimo e significa "consegnamela nel cassetto fiscale".
  if (codice && !/^[A-Z0-9]{6,7}$/.test(codice)) {
    return { errore: "Il codice destinatario è di 6 o 7 caratteri, solo lettere e numeri." };
  }
  if (pec && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pec)) {
    return { errore: "La PEC non sembra un indirizzo valido." };
  }
  // Si valida il carattere di controllo, non solo la lunghezza: un refuso in
  // un codice fiscale non dà un errore il giorno stesso, dà una fattura
  // scartata dallo SdI giorni dopo, quando è già stata contata come emessa.
  if (codiceFiscale && !identificativoFiscaleValido(codiceFiscale)) {
    return { errore: "Il codice fiscale non è valido: ricontrolla, il carattere di controllo non torna." };
  }

  const { error } = await creaClientAdmin()
    .from("tenants")
    .update({
      codice_destinatario: codice || null,
      pec_fatturazione: pec || null,
      codice_fiscale: codiceFiscale || null,
    })
    .eq("id", accesso.tenantId);

  if (error) return { errore: `Errore salvando i dati di fatturazione: ${error.message}` };

  revalidatePath("/dashboard/impostazioni");
  return { ok: true as const };
}
