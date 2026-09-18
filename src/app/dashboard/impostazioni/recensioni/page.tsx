import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { caricaRecensioniDashboard } from "@/lib/recensioni.server";
import { PannelloRecensioni } from "./pannello-recensioni";
import Link from "next/link";

/**
 * Impostazioni -> Recensioni (Fase 3, 16/09/2026 -- vedi DECISIONS.md).
 * Disponibile da Free in su (Gabriel, 16/09/2026: "la metterei dal free
 * perché le recensioni si possono già lasciare su Google") -- a differenza
 * di compleanno/promemoria, NESSUN gate di piano qui.
 */
export default async function PaginaRecensioni() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase.from("tenants").select("raccolta_recensioni_attiva").eq("id", tenantId).single();
  const { recensioni, media } = await caricaRecensioniDashboard(supabase, tenantId);

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Recensioni</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Ogni cliente riceve un invito a lasciare una recensione qualche ora dopo l&apos;appuntamento, solo se ha
          davvero prenotato da te. Non puoi modificare o eliminare una recensione (nemmeno negativa) -- puoi solo
          rispondere pubblicamente.
        </p>
      </div>

      <PannelloRecensioni
        attivoIniziale={tenant?.raccolta_recensioni_attiva ?? true}
        recensioni={recensioni}
        media={media}
      />
    </div>
  );
}
