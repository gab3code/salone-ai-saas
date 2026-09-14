"use server";

import { revalidatePath } from "next/cache";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { cancellaAppuntamentoTenant } from "@/lib/booking-engine.server";
import { cancellazioneOnlineConsentita, messaggioCancellazioneBloccata } from "@/lib/finestra-cancellazione";
import type { RisultatoAzionePubblica } from "@/app/s/[slug]/azioni";

/**
 * Cancellazione della prenotazione lato CLIENTE (PIANO.md Fase 4: "il modo
 * più naturale è un link 'gestisci la tua prenotazione' nell'email di
 * conferma, non un login separato per il cliente finale"). Nessuna
 * autenticazione Supabase: come per `/s/[slug]/azioni.ts`, il chiamante è un
 * visitatore anonimo -- qui riconosciuto SOLO dal possesso dell'id
 * dell'appuntamento (UUID v4, 122 bit di entropia, mai indovinabile),
 * ricevuto esclusivamente via il link nell'email di conferma
 * (`notifiche.server.ts`). Stesso identico modello di sicurezza già usato da
 * ogni prodotto di prenotazione consumer (Calendly, Google Calendar: un link
 * "cancella" con un id lungo nell'URL, senza password) -- non un compromesso
 * fatto qui, uno standard di settore.
 *
 * Riusa `cancellaAppuntamentoTenant`, la STESSA funzione di scrittura di
 * dashboard/AI/pubblico (punto 9 di CLAUDE.md): la cancellazione lato
 * cliente attiva quindi GRATIS anche la lista d'attesa automatica già
 * costruita lì (il primo cliente in coda per quello slot viene avvisato),
 * nessuna logica duplicata.
 *
 * FINESTRA MINIMA (richiesta di Gabriel il 14/09/2026, migrazione 0016):
 * ogni titolare può impostare quante ore prima dell'appuntamento la
 * cancellazione online resta permessa (`tenants.ore_minime_cancellazione`,
 * default 24, configurabile da /dashboard/impostazioni/cancellazione). Sotto
 * quella soglia questa azione rifiuta e indica il numero del salone -- vedi
 * src/lib/finestra-cancellazione.ts (funzione pura, testata a parte). Stesso
 * controllo mostrato in anticipo in page.tsx per nascondere il bottone, ma
 * QUESTO è il punto autorevole: un link riaperto da una tab vecchia o una
 * pagina in cache non deve mai bypassare la regola.
 */
export async function cancellaPrenotazionePubblica(appuntamentoId: string): Promise<RisultatoAzionePubblica> {
  const supabase = creaClientAdmin();

  const { data: appuntamento } = await supabase
    .from("appuntamenti")
    .select("tenant_id, stato, inizio, tenants(nome, telefono, ore_minime_cancellazione)")
    .eq("id", appuntamentoId)
    .maybeSingle();
  if (!appuntamento) return { ok: false, errore: "Prenotazione non trovata." };
  if (appuntamento.stato === "cancellato") {
    return { ok: false, errore: "Questa prenotazione è già stata cancellata." };
  }

  // Stessa normalizzazione oggetto-o-array delle relazioni annidate già
  // usata in notifiche.server.ts e in page.tsx.
  const uno = <T,>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : (v as T | null));
  const tenant = uno<{ nome: string; telefono: string | null; ore_minime_cancellazione: number }>(appuntamento.tenants);

  if (
    tenant &&
    !cancellazioneOnlineConsentita(new Date(appuntamento.inizio), tenant.ore_minime_cancellazione)
  ) {
    return {
      ok: false,
      errore: messaggioCancellazioneBloccata(tenant.ore_minime_cancellazione, tenant.nome, tenant.telefono),
    };
  }

  const risultato = await cancellaAppuntamentoTenant(supabase, appuntamento.tenant_id, appuntamentoId);
  if (!risultato.ok) return { ok: false, errore: risultato.errore };

  revalidatePath(`/gestisci/${appuntamentoId}`);
  return { ok: true };
}
