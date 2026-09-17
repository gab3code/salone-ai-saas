import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientStripe } from "@/lib/stripe/server";
import {
  DATI_FATTURAZIONE_VUOTI,
  datiFatturazioneCompleti,
  normalizzaDatiFatturazione,
  validaDatiFatturazione,
  type DatiFatturazione,
  type ErroriFatturazione,
} from "@/lib/fatturazione";

/**
 * Lettura e scrittura dei dati di fatturazione (migrazione 0033).
 *
 * Da qui in avanti la fonte di verità per la fattura è il NOSTRO database,
 * non il Customer di Stripe: è la conseguenza di aver spostato il modulo da
 * loro a noi, e va ricordata quando si comporrà l'XML. I valori vengono
 * comunque rispecchiati su Stripe (`rispecchiaSuStripe`) perché il portale
 * abbonamento e le ricevute che il cliente vede lì restino coerenti con la
 * fattura che riceve -- due documenti con indirizzi diversi sono il tipo di
 * cosa che fa scrivere al commercialista.
 */

const COLONNE =
  "denominazione, partita_iva, indirizzo_via, indirizzo_cap, indirizzo_comune, indirizzo_provincia, codice_destinatario, pec_fatturazione";

/**
 * Esito della verifica VIES (migrazione 0034), già interpretato per la UI.
 *
 * `nomeDiverso` è il controllo che vale di più: VIES, quando risponde,
 * restituisce anche la ragione sociale associata a quella partita IVA.
 * Se non somiglia a quella dichiarata, o il cliente ha sbagliato a copiare, o
 * ha messo la partita IVA di qualcun altro. Il confronto è volutamente
 * grossolano -- VIES scrive "ROSSI MARIO" dove il cliente scrive "Rossi Mario
 * Acconciature di Rossi M." -- quindi ci si accontenta che una delle due
 * contenga l'altra, normalizzate.
 */
export type VerificaPartitaIva = {
  stato: "mai_verificata" | "in_corso" | "verificata" | "non_trovata";
  nomeVerificato: string | null;
  nomeDiverso: boolean;
};

function semplifica(valore: string): string {
  return valore
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function leggiVerificaPartitaIva(
  supabase: SupabaseClient,
  tenantId: string
): Promise<VerificaPartitaIva> {
  const { data } = await supabase
    .from("tenants")
    .select("denominazione, partita_iva_verifica, partita_iva_nome_verificato")
    .eq("id", tenantId)
    .maybeSingle();

  const grezzo = (data?.partita_iva_verifica as string | null) ?? null;
  const nomeVerificato = (data?.partita_iva_nome_verificato as string | null) ?? null;
  const denominazione = (data?.denominazione as string | null) ?? "";

  const stato: VerificaPartitaIva["stato"] =
    grezzo === "verified"
      ? "verificata"
      : grezzo === "unverified"
        ? "non_trovata"
        : grezzo === "pending"
          ? "in_corso"
          : "mai_verificata";

  let nomeDiverso = false;
  if (stato === "verificata" && nomeVerificato && denominazione) {
    const a = semplifica(nomeVerificato);
    const b = semplifica(denominazione);
    nomeDiverso = !a.includes(b) && !b.includes(a);
  }

  return { stato, nomeVerificato, nomeDiverso };
}

export async function leggiDatiFatturazione(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DatiFatturazione> {
  const { data } = await supabase.from("tenants").select(COLONNE).eq("id", tenantId).maybeSingle();
  if (!data) return DATI_FATTURAZIONE_VUOTI;

  const riga = data as unknown as Record<string, string | null>;
  return {
    denominazione: riga.denominazione ?? "",
    partitaIva: riga.partita_iva ?? "",
    via: riga.indirizzo_via ?? "",
    cap: riga.indirizzo_cap ?? "",
    comune: riga.indirizzo_comune ?? "",
    provincia: riga.indirizzo_provincia ?? "",
    codiceDestinatario: riga.codice_destinatario ?? "",
    pec: riga.pec_fatturazione ?? "",
  };
}

export async function datiFatturazionePronti(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  return datiFatturazioneCompleti(await leggiDatiFatturazione(supabase, tenantId));
}

/**
 * Salva dopo aver validato. Il chiamante ha già verificato il permesso: qui
 * si usa il service_role perché dalla migrazione 0030 queste colonne non
 * sono scrivibili dal browser -- descrivono il rapporto contrattuale, non
 * una preferenza del titolare.
 */
export async function salvaDatiFatturazione(
  tenantId: string,
  grezzi: DatiFatturazione
): Promise<{ ok: true } | { errori: ErroriFatturazione } | { errore: string }> {
  const dati = normalizzaDatiFatturazione(grezzi);
  const errori = validaDatiFatturazione(dati);
  if (Object.keys(errori).length > 0) return { errori };

  const admin = creaClientAdmin();
  const { error } = await admin
    .from("tenants")
    .update({
      denominazione: dati.denominazione,
      partita_iva: dati.partitaIva,
      indirizzo_via: dati.via,
      indirizzo_cap: dati.cap,
      indirizzo_comune: dati.comune,
      indirizzo_provincia: dati.provincia,
      indirizzo_nazione: "IT",
      codice_destinatario: dati.codiceDestinatario || null,
      pec_fatturazione: dati.pec || null,
    })
    .eq("id", tenantId);

  if (error) return { errore: `Errore salvando i dati di fatturazione: ${error.message}` };
  return { ok: true };
}

/**
 * Ricopia i dati sul Customer di Stripe: nome, indirizzo e partita IVA.
 *
 * Fail-open per scelta. Se Stripe rifiuta (partita IVA che non passa la sua
 * validazione, rete, customer cancellato a mano) NON si blocca il
 * salvataggio: i dati nostri sono validi, la fattura si può comporre, e
 * l'unica cosa che resta indietro è la coerenza di quello che il cliente
 * vede nel portale. Bloccare il salvataggio per quello significherebbe
 * impedirgli di pagare per un problema estetico.
 *
 * La partita IVA si cancella e si ricrea invece di aggiornarla: su Stripe un
 * tax id è immutabile, si può solo aggiungere o togliere.
 */
export async function rispecchiaSuStripe(
  stripeCustomerId: string,
  dati: DatiFatturazione
): Promise<void> {
  try {
    const stripe = creaClientStripe();
    await stripe.customers.update(stripeCustomerId, {
      name: dati.denominazione,
      address: {
        line1: dati.via,
        postal_code: dati.cap,
        city: dati.comune,
        state: dati.provincia,
        country: "IT",
      },
    });

    const esistenti = await stripe.customers.listTaxIds(stripeCustomerId, { limit: 10 });
    const atteso = `IT${dati.partitaIva}`;
    const giaPresente = esistenti.data.find((t) => t.value === atteso && t.type === "eu_vat");
    if (giaPresente) return;

    for (const vecchio of esistenti.data) {
      await stripe.customers.deleteTaxId(stripeCustomerId, vecchio.id);
    }
    await stripe.customers.createTaxId(stripeCustomerId, { type: "eu_vat", value: atteso });
  } catch (errore) {
    console.error("[stripe] Dati di fatturazione non rispecchiati sul customer", {
      stripeCustomerId,
      errore: (errore as Error).message,
    });
  }
}
