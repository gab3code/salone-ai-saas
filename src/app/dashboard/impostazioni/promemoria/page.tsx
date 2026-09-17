import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaPromemoria } from "@/lib/piani";
import { PannelloPromemoria } from "./pannello-promemoria";

/**
 * Impostazioni -> Promemoria automatici (Fase 6, Growth in su -- vedi
 * `pianoHaPromemoria`). Costruita il 14/09/2026 su richiesta esplicita di
 * Gabriel, lo stesso giorno in cui è stato costruito il motore: "vorrei che
 * lo staff possa decidere quanto tempo prima mandare il promemoria e anche
 * se averne più di uno" -- questa pagina è esattamente quella scelta,
 * niente di più (il follow-up clienti inattivi resta fisso a 60 giorni,
 * mai reso configurabile: non è quello che è stato chiesto).
 */
export default async function PaginaPromemoria() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  const haAccesso = pianoHaPromemoria(tenant?.piano ?? "");

  const { data: regoleGrezze } = haAccesso
    ? await supabase
        .from("regole_promemoria")
        .select("id, ore_preavviso")
        .eq("tenant_id", tenantId)
        .order("ore_preavviso", { ascending: true })
    : { data: null };

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <a href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </a>
        <h1 className="mt-2 text-xl font-semibold">Promemoria automatici</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Decidi quanto tempo prima dell&apos;appuntamento mandare il reminder al cliente via email -- puoi
          attivarne più di uno (es. 3 giorni prima E 1 giorno prima).
        </p>
      </div>

      {haAccesso ? (
        <PannelloPromemoria regoleIniziali={(regoleGrezze ?? []).map((r) => ({ id: r.id, orePreavviso: r.ore_preavviso }))} />
      ) : (
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-600">
            I promemoria automatici sono inclusi dal piano <strong>Growth</strong> in su.
          </p>
          <Link href="/dashboard/abbonamento?piano=growth" className="mt-4 inline-block rounded bg-black px-3 py-2 text-sm font-medium text-white">
            Passa a Growth
          </Link>
        </div>
      )}
    </div>
  );
}
