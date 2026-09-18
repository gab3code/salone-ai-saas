import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientAdmin } from "@/lib/supabase/admin";

/**
 * Gli usi del modello fatti DAL SALONE dalla sua dashboard: la bozza di
 * onboarding e la prova dell'assistente.
 *
 * Prima del 18/09/2026 non venivano contati da nessuna parte. L'onboarding
 * AI in particolare era l'unica strada del prodotto che chiamava Anthropic
 * senza contatore, senza tetto e senza gate di piano: un tenant Free poteva
 * chiamarla a ripetizione, anche direttamente come POST della server action,
 * e la bolletta era nostra.
 */

export type TipoUsoAi = "onboarding" | "prova_assistente";

export type EsitoConsumo =
  | { ok: true; rimasti: number }
  | { ok: false; motivo: "tetto_raggiunto" | "errore" };

/**
 * Controlla la quota e ne consuma un'unita', atomicamente (la funzione SQL
 * `consuma_uso_ai_interno` della 0059 conta e inserisce nella stessa
 * istruzione: due schede aperte insieme non passano lo stesso ultimo uso).
 *
 * Gira col client ADMIN perche' la funzione e' eseguibile solo dal
 * service_role -- di proposito: se potesse chiamarla il titolare, si
 * passerebbe da solo il limite che preferisce come terzo parametro.
 *
 * Si consuma PRIMA di chiamare il modello e anche se il modello poi
 * fallisce: il contrario rende il tetto aggirabile da chi riesca a far
 * fallire la chiamata a comando, e una chiamata fallita ad Anthropic e' gia'
 * stata pagata comunque. Stessa scelta gia' fatta per la prova assistente.
 */
export async function consumaUsoAiInterno(
  tenantId: string,
  tipo: TipoUsoAi,
  limite: number
): Promise<EsitoConsumo> {
  const admin = creaClientAdmin();
  const { data, error } = await admin.rpc("consuma_uso_ai_interno", {
    p_tenant_id: tenantId,
    p_tipo: tipo,
    p_limite: limite,
  });

  if (error) {
    console.error("Errore consumando un uso AI interno:", tenantId, tipo, error);
    return { ok: false, motivo: "errore" };
  }
  if (typeof data !== "number" || data < 0) return { ok: false, motivo: "tetto_raggiunto" };
  return { ok: true, rimasti: data };
}

/**
 * Quante volte il salone ha usato il modello dalla dashboard questo mese.
 * Serve solo a MOSTRARE il numero: il controllo vero e' la funzione sopra,
 * che conta e consuma insieme.
 */
export async function contaUsiAiInterniQuestoMese(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const adesso = new Date();
  const inizioMese = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), 1));

  const { count, error } = await supabase
    .from("usi_ai_interni")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", inizioMese.toISOString());

  if (error) {
    // Un errore nel MOSTRARE un numero non deve rompere la dashboard.
    console.error("Errore contando gli usi AI interni del mese:", tenantId, error);
    return 0;
  }
  return count ?? 0;
}
