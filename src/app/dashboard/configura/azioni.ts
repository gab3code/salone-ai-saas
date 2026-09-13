"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { limiteOperatori } from "@/lib/piani";

const GIORNI = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Onboarding minimo (punto 1 del funnel self-service, Fase 1): senza orari,
 * operatori e servizi veri non c'è nulla su cui il booking engine possa
 * lavorare -- questa è la schermata che rende il resto reale, non solo
 * teorico.
 */

export async function salvaOrari(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const righe = GIORNI.map((giorno) => {
    const chiuso = formData.get(`chiuso_${giorno}`) === "on";
    const apertura = String(formData.get(`apertura_${giorno}`) || "");
    const chiusura = String(formData.get(`chiusura_${giorno}`) || "");
    const pausaInizio = String(formData.get(`pausa_inizio_${giorno}`) || "");
    const pausaFine = String(formData.get(`pausa_fine_${giorno}`) || "");
    return {
      tenant_id: tenantId,
      giorno_settimana: giorno,
      chiuso,
      apertura: chiuso || !apertura ? null : apertura,
      chiusura: chiuso || !chiusura ? null : chiusura,
      pausa_inizio: chiuso || !pausaInizio ? null : pausaInizio,
      pausa_fine: chiuso || !pausaFine ? null : pausaFine,
    };
  });

  const { error } = await supabase
    .from("orari_apertura")
    .upsert(righe, { onConflict: "tenant_id,giorno_settimana" });

  if (error) return { errore: `Errore salvando gli orari: ${error.message}` };

  revalidatePath("/dashboard/configura");
  return { ok: true };
}

export async function creaOperatore(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { errore: "Il nome dell'operatore è obbligatorio." };

  // "1 operatore" sul piano Free (Fase 5 di PIANO.md, trovato 13/09/2026):
  // pubblicizzato in Prezzi.tsx ma mai applicato tecnicamente finché
  // limiteOperatori non esisteva -- stesso principio del tetto mensile di
  // prenotazioni in booking-engine.server.ts (punto 20 di CLAUDE.md, "il
  // sistema deve tecnicamente applicare i limiti"). Fail-open sull'errore di
  // lettura del piano: non riuscire a leggerlo non deve mai bloccare la
  // creazione di un operatore vero.
  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  const limite = limiteOperatori(tenant?.piano ?? "");
  if (limite !== Infinity) {
    const { count } = await supabase
      .from("operatori")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if ((count ?? 0) >= limite) {
      return {
        errore: `Il piano Free è limitato a ${limite} ${limite === 1 ? "operatore" : "operatori"}. Passa a un piano superiore per aggiungerne altri.`,
      };
    }
  }

  const { error } = await supabase.from("operatori").insert({ tenant_id: tenantId, nome });
  if (error) return { errore: `Errore creando l'operatore: ${error.message}` };

  revalidatePath("/dashboard/configura");
  return { ok: true };
}

export async function eliminaOperatore(id: string) {
  const supabase = await creaClientServer();
  const { error } = await supabase.from("operatori").delete().eq("id", id);
  if (error) return { errore: `Errore eliminando l'operatore: ${error.message}` };
  revalidatePath("/dashboard/configura");
  return { ok: true };
}

export async function creaServizio(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const nome = String(formData.get("nome") || "").trim();
  const durataMinuti = Number(formData.get("durata_minuti") || 0);
  const prezzoEuro = Number(formData.get("prezzo_euro") || 0);

  if (!nome) return { errore: "Il nome del servizio è obbligatorio." };
  if (!Number.isFinite(durataMinuti) || durataMinuti <= 0) {
    return { errore: "La durata deve essere un numero di minuti maggiore di zero." };
  }
  if (!Number.isFinite(prezzoEuro) || prezzoEuro < 0) {
    return { errore: "Il prezzo non può essere negativo." };
  }

  const { error } = await supabase.from("servizi").insert({
    tenant_id: tenantId,
    nome,
    durata_minuti: Math.round(durataMinuti),
    prezzo_centesimi: Math.round(prezzoEuro * 100),
  });
  if (error) return { errore: `Errore creando il servizio: ${error.message}` };

  revalidatePath("/dashboard/configura");
  return { ok: true };
}

export async function eliminaServizio(id: string) {
  const supabase = await creaClientServer();
  const { error } = await supabase.from("servizi").delete().eq("id", id);
  if (error) return { errore: `Errore eliminando il servizio: ${error.message}` };
  revalidatePath("/dashboard/configura");
  return { ok: true };
}

/**
 * Un operatore eroga un servizio solo se esplicitamente associato -- senza
 * questo passaggio calcolaSlotDisponibili non troverebbe mai nessuno
 * disponibile per quel servizio (comportamento corretto: meglio "nessuno
 * slot" che proporre un operatore non qualificato).
 */
export async function impostaAssociazioneOperatoreServizio(
  operatoreId: string,
  servizioId: string,
  associato: boolean
) {
  const supabase = await creaClientServer();

  if (associato) {
    const { error } = await supabase
      .from("operatori_servizi")
      .insert({ operatore_id: operatoreId, servizio_id: servizioId });
    if (error) return { errore: `Errore associando il servizio: ${error.message}` };
  } else {
    const { error } = await supabase
      .from("operatori_servizi")
      .delete()
      .eq("operatore_id", operatoreId)
      .eq("servizio_id", servizioId);
    if (error) return { errore: `Errore rimuovendo l'associazione: ${error.message}` };
  }

  revalidatePath("/dashboard/configura");
  return { ok: true };
}
