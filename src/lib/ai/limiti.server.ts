import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Conta i messaggi REALI del cliente per questo tenant nel mese corrente
 * (fuso orario semplificato come UTC, stessa scelta già fatta nel resto del
 * progetto -- vedi problema noto #1 in PROJECT_STATUS.md). Query con
 * count/head: non serve scaricare le righe, solo il numero -- rilevante
 * perché questo controllo gira su OGNI messaggio della chat, non una volta
 * per pagina come le metriche della dashboard.
 */
export async function contaMessaggiClienteQuestoMese(supabase: SupabaseClient, tenantId: string): Promise<number> {
  const adesso = new Date();
  const inizioMese = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), 1));

  const { count, error } = await supabase
    .from("messaggi")
    .select("id, conversazioni!inner(tenant_id)", { count: "exact", head: true })
    .eq("ruolo", "cliente")
    .eq("conversazioni.tenant_id", tenantId)
    .gte("created_at", inizioMese.toISOString());

  if (error) {
    // Un errore nel CONTROLLO di quota non deve rompere l'intera chat per un
    // cliente reale (il sintomo sarebbe peggiore del problema che preveniamo)
    // -- logghiamo e lasciamo passare questo singolo messaggio. La difesa
    // costi vera contro un guasto di questo controllo è un limite di spesa
    // lato Anthropic/organizzazione, non questa query.
    console.error("Errore contando i messaggi del mese per la quota AI:", tenantId, error);
    return 0;
  }
  return count ?? 0;
}

/**
 * true se l'ultimo messaggio del cliente in QUESTA conversazione è più
 * recente della soglia -- probabile script che manda messaggi a raffica,
 * non una persona che digita.
 */
export async function ultimoMessaggioTroppoRecente(
  supabase: SupabaseClient,
  conversazioneId: string,
  sogliaMs: number
): Promise<boolean> {
  const { data } = await supabase
    .from("messaggi")
    .select("created_at")
    .eq("conversazione_id", conversazioneId)
    .eq("ruolo", "cliente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return false;
  return Date.now() - new Date(data.created_at).getTime() < sogliaMs;
}
