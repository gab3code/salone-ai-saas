import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcolaAndamento,
  confrontaConPeriodoPrecedente,
  type ConfrontoPeriodo,
  type Periodo,
  type PuntoAndamento,
} from "@/lib/analytics";
import { calcolaRetention, type Retention } from "@/lib/retention";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";

export interface DatiAnalytics {
  andamento: PuntoAndamento[];
  confronto: ConfrontoPeriodo;
  retention: Retention;
}

/**
 * Livello di collegamento tra i calcoli puri (analytics.ts, retention.ts) e
 * Supabase -- stesso principio di metriche.server.ts: solo query e
 * conversione dati, zero logica di calcolo qui.
 *
 * Una query sola per gli appuntamenti anche se i due calcoli guardano
 * finestre diverse (il grafico il periodo scelto, la retention tutto lo
 * storico): sarebbe la stessa identica riga letta due volte. La retention
 * ha bisogno dello storico INTERO per costruzione -- una coorte di un anno
 * fa serve proprio a sapere se quella gente e' poi tornata -- quindi la
 * finestra qui non si puo' stringere nemmeno volendo.
 *
 * Costo noto e gia' segnalato quando questo file e' nato: nessuna finestra
 * temporale lato query. Sostenibile oggi (un salone ha centinaia di
 * appuntamenti, non milioni), da rivedere con una vista aggregata lato
 * database quando un tenant arrivera' alle migliaia. Il 17/09/2026 e'
 * arrivato l'indice `appuntamenti (tenant_id, inizio)` (migrazione 0038),
 * che prima non esisteva affatto: e' quello che tiene in piedi questa
 * scelta ancora per un pezzo.
 */
export async function caricaAnalytics(
  supabase: SupabaseClient,
  tenantId: string,
  periodo: Periodo
): Promise<DatiAnalytics> {
  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
  const adesso = realeAPseudoUtc(new Date(), fusoOrario);

  const [appuntamentiRes, clientiRes] = await Promise.all([
    supabase.from("appuntamenti").select("inizio, stato, cliente_id").eq("tenant_id", tenantId),
    supabase.from("clienti").select("created_at").eq("tenant_id", tenantId),
  ]);
  if (appuntamentiRes.error) {
    throw new Error(`Errore caricando gli appuntamenti per l'andamento: ${appuntamentiRes.error.message}`);
  }
  if (clientiRes.error) {
    throw new Error(`Errore caricando i clienti per l'andamento: ${clientiRes.error.message}`);
  }

  const appuntamenti = (appuntamentiRes.data ?? []).map((a) => ({
    inizio: realeAPseudoUtc(new Date(a.inizio), fusoOrario),
    stato: a.stato as string,
    clienteId: (a.cliente_id as string | null) ?? "",
  }));
  const clienti = (clientiRes.data ?? []).map((c) => ({
    createdAt: realeAPseudoUtc(new Date(c.created_at), fusoOrario),
  }));

  return {
    andamento: calcolaAndamento(appuntamenti, clienti, adesso, periodo),
    confronto: confrontaConPeriodoPrecedente(appuntamenti, clienti, adesso, periodo),
    retention: calcolaRetention(appuntamenti, adesso),
  };
}
