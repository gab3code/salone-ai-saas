import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcolaAndamentoSettimanale, type PuntoAndamento } from "@/lib/analytics";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";

/**
 * Livello di collegamento tra il calcolo puro (analytics.ts) e Supabase --
 * stesso principio di metriche.server.ts: solo query e conversione dati,
 * zero logica di calcolo qui. Stessa identica forma di query di
 * `caricaMetriche` (storico intero, nessuna finestra temporale) per lo
 * stesso motivo onestamente segnalato lì: sostenibile oggi, da rivedere
 * (finestra temporale lato query, o paginazione) quando un tenant avrà
 * migliaia di appuntamenti storici.
 */
export async function caricaAndamento(
  supabase: SupabaseClient,
  tenantId: string,
  numeroSettimane: number = 12
): Promise<PuntoAndamento[]> {
  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
  const adesso = realeAPseudoUtc(new Date(), fusoOrario);

  const [appuntamentiRes, clientiRes] = await Promise.all([
    supabase.from("appuntamenti").select("inizio, stato").eq("tenant_id", tenantId),
    supabase.from("clienti").select("created_at").eq("tenant_id", tenantId),
  ]);
  if (appuntamentiRes.error) {
    throw new Error(`Errore caricando gli appuntamenti per l'andamento: ${appuntamentiRes.error.message}`);
  }
  if (clientiRes.error) {
    throw new Error(`Errore caricando i clienti per l'andamento: ${clientiRes.error.message}`);
  }

  return calcolaAndamentoSettimanale(
    (appuntamentiRes.data ?? []).map((a) => ({
      inizio: realeAPseudoUtc(new Date(a.inizio), fusoOrario),
      stato: a.stato,
    })),
    (clientiRes.data ?? []).map((c) => ({ createdAt: realeAPseudoUtc(new Date(c.created_at), fusoOrario) })),
    adesso,
    numeroSettimane
  );
}
