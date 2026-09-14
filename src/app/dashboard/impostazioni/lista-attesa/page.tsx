import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaListaAttesaAutomatica } from "@/lib/piani";
import { PannelloListaAttesa } from "./pannello-lista-attesa";

/**
 * Impostazioni -> Contatto automatico lista d'attesa (Fase 1, Growth in su
 * -- vedi `pianoHaListaAttesaAutomatica`). Decisione con Gabriel il
 * 14/09/2026: quando un posto si libera e `trovaEAvvisaListaAttesa`
 * (booking-engine.server.ts) trova un cliente compatibile in coda, oggi
 * quella riga passa a stato "proposto" e il titolare la vede in
 * /dashboard/lista-attesa, poi contatta il cliente a mano. Questa pagina
 * aggiunge un unico toggle per tutto il salone (non per servizio) per far
 * scrivere subito a Salone AI al posto del titolare -- default "manuale"
 * per ogni tenant, nuovo o esistente, finché non lo attiva esplicitamente.
 */
export default async function PaginaListaAttesa() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("piano, lista_attesa_contatto_automatico")
    .eq("id", tenantId)
    .single();
  const haAccesso = pianoHaListaAttesaAutomatica(tenant?.piano ?? "");

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <a href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </a>
        <h1 className="mt-2 text-xl font-semibold">Contatto automatico lista d&apos;attesa</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Quando un posto si libera e un cliente in lista d&apos;attesa lo riceve in proposta, decidi se
          contattarlo tu stesso a mano oppure se Salone AI gli scrive subito via email o SMS.
        </p>
      </div>

      {haAccesso ? (
        <PannelloListaAttesa attivoIniziale={tenant?.lista_attesa_contatto_automatico ?? false} />
      ) : (
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-600">
            Il contatto automatico della lista d&apos;attesa è incluso dal piano <strong>Growth</strong> in su.
          </p>
          <Link href="/#prezzi" className="mt-4 inline-block rounded bg-black px-3 py-2 text-sm font-medium text-white">
            Passa a Growth
          </Link>
        </div>
      )}
    </div>
  );
}
