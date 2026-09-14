import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { PannelloCancellazione } from "./pannello-cancellazione";

/**
 * Impostazioni -> Finestra minima di cancellazione online (richiesta
 * esplicita di Gabriel il 14/09/2026, migrazione 0016): prima di questa
 * pagina il cliente poteva cancellare da /gestisci/[id] fino all'ultimo
 * minuto, anche il giorno stesso -- qui il titolare decide quante ore prima
 * resta permesso, sotto quella soglia il link chiede di chiamare (vedi
 * src/lib/finestra-cancellazione.ts, applicato in gestisci/[id]/azioni.ts).
 */
export default async function PaginaCancellazione() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("ore_minime_cancellazione, telefono")
    .eq("id", tenantId)
    .single();

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <a href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </a>
        <h1 className="mt-2 text-xl font-semibold">Cancellazione online</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Decidi fino a quante ore prima dell&apos;appuntamento un cliente può cancellare da solo dal link ricevuto
          via email, senza dover chiamare.
        </p>
      </div>

      <PannelloCancellazione
        oreIniziali={tenant?.ore_minime_cancellazione ?? 24}
        telefonoIniziale={tenant?.telefono ?? ""}
      />
    </div>
  );
}
