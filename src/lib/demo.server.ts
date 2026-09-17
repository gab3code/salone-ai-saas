import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GIORNI_CONSERVAZIONE_DATI_DEMO } from "@/lib/demo";

export interface EsitoPuliziaDemo {
  clientiCancellati: number;
  conversazioniCancellate: number;
}

/**
 * Cancella quello che i visitatori hanno lasciato nel salone dimostrativo.
 *
 * Chi prova la demo scrive il proprio nome e il proprio numero VERI: e' il
 * motivo per cui la demo funziona, ed e' anche il motivo per cui quei dati
 * non possono restare li'. Nessuno ci ha chiesto di conservarli, nessuno li
 * guardera' mai, e un archivio di contatti reali che si accumula da solo e'
 * solo un problema che aspetta.
 *
 * La regola puo' essere brutale -- si cancella TUTTO quello che sta in
 * `clienti` per un tenant dimostrativo oltre la soglia -- solo perche' nella
 * demo non c'e' nessun cliente seminato da noi: la migrazione 0042 crea
 * servizi, operatori, orari e FAQ, mai un cliente. Quindi tutto quello che
 * c'e' li' dentro l'ha scritto un visitatore. Se un giorno si volessero
 * recensioni finte sulla pagina della demo servirebbero clienti finti, e
 * questa regola andrebbe resa piu' selettiva PRIMA di seminarli.
 *
 * Gli appuntamenti se ne vanno da soli con il cliente (`on delete cascade`).
 * Le conversazioni no -- non hanno un cliente collegato -- quindi si
 * cancellano per data.
 */
export async function pulisciDatiDemo(
  admin: SupabaseClient,
  adesso: Date = new Date()
): Promise<EsitoPuliziaDemo> {
  const soglia = new Date(adesso.getTime() - GIORNI_CONSERVAZIONE_DATI_DEMO * 24 * 60 * 60 * 1000);

  const { data: demo } = await admin.from("tenants").select("id").eq("e_demo", true);
  const idDemo = (demo ?? []).map((t) => t.id as string);
  if (idDemo.length === 0) return { clientiCancellati: 0, conversazioniCancellate: 0 };

  const { data: clienti } = await admin
    .from("clienti")
    .delete()
    .in("tenant_id", idDemo)
    .lt("created_at", soglia.toISOString())
    .select("id");

  const { data: conversazioni } = await admin
    .from("conversazioni")
    .delete()
    .in("tenant_id", idDemo)
    .lt("created_at", soglia.toISOString())
    .select("id");

  return {
    clientiCancellati: clienti?.length ?? 0,
    conversazioniCancellate: conversazioni?.length ?? 0,
  };
}
