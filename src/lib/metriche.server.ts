import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcolaMetriche, type Metriche } from "@/lib/metriche";

/**
 * Livello di collegamento tra il calcolo puro (metriche.ts) e Supabase --
 * stesso principio del booking engine: solo query e conversione dati, zero
 * logica di calcolo qui.
 *
 * NOTA scalabilità (onesta, non nascosta): per i clienti "inattivi da 60
 * giorni" serve l'ULTIMA prenotazione confermata di ogni cliente, quindi qui
 * sotto si legge lo storico intero degli appuntamenti confermati del tenant,
 * senza una finestra temporale -- perfettamente sostenibile per un'attività
 * agli inizi, da rivedere (paginazione o una vista materializzata "ultima
 * prenotazione per cliente") quando un tenant avrà migliaia di appuntamenti
 * storici.
 */
export async function caricaMetriche(supabase: SupabaseClient, tenantId: string): Promise<Metriche> {
  const adesso = new Date();
  const giornoSettimanaOggi = adesso.getUTCDay();

  const [orarioRes, appuntamentiRes, servizioRes, clientiRes] = await Promise.all([
    supabase
      .from("orari_apertura")
      .select("chiuso, apertura, chiusura, pausa_inizio, pausa_fine")
      .eq("tenant_id", tenantId)
      .eq("giorno_settimana", giornoSettimanaOggi)
      .maybeSingle(),
    supabase
      .from("appuntamenti")
      .select("inizio, fine, stato, cliente_id, operatore_id, servizio_id")
      .eq("tenant_id", tenantId),
    supabase.from("servizi").select("id, prezzo_centesimi").eq("tenant_id", tenantId),
    supabase.from("clienti").select("id, created_at").eq("tenant_id", tenantId),
  ]);

  for (const [nome, res] of Object.entries({
    orari: orarioRes,
    appuntamenti: appuntamentiRes,
    servizi: servizioRes,
    clienti: clientiRes,
  })) {
    if (res.error) throw new Error(`Errore caricando "${nome}" per le metriche: ${res.error.message}`);
  }

  const prezzoCentesimiPerServizio = new Map<string, number>();
  for (const s of servizioRes.data ?? []) prezzoCentesimiPerServizio.set(s.id, s.prezzo_centesimi);

  return calcolaMetriche({
    adesso,
    appuntamenti: (appuntamentiRes.data ?? []).map((a) => ({
      inizio: new Date(a.inizio),
      fine: new Date(a.fine),
      stato: a.stato,
      clienteId: a.cliente_id,
      operatoreId: a.operatore_id,
      servizioId: a.servizio_id,
    })),
    clienti: (clientiRes.data ?? []).map((c) => ({ id: c.id, createdAt: new Date(c.created_at) })),
    prezzoCentesimiPerServizio,
    orarioOggi: orarioRes.data
      ? {
          chiuso: orarioRes.data.chiuso,
          apertura: orarioRes.data.apertura?.slice(0, 5),
          chiusura: orarioRes.data.chiusura?.slice(0, 5),
          pausaInizio: orarioRes.data.pausa_inizio?.slice(0, 5),
          pausaFine: orarioRes.data.pausa_fine?.slice(0, 5),
        }
      : { chiuso: true },
  });
}
