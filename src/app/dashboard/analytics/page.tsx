import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaAnalytics } from "@/lib/piani";
import { caricaAndamento } from "@/lib/analytics.server";
import { GraficoAndamento } from "./grafico-andamento";

/**
 * Analytics (Fase 3, Growth in su -- vedi src/lib/piani.ts). Trovato mancante
 * nel controllo promesse del sito 13/09/2026: `Prezzi.tsx`/`Funzionalita.tsx`
 * pubblicizzano "Andamento prenotazioni e clienti nel tempo, non solo i
 * numeri di oggi", ma la dashboard mostrava solo finestre fisse (oggi/30gg/
 * 60gg). Stesso pattern di gate di `/dashboard/impostazioni/tono-ai`:
 * upsell se il piano non include la funzione, mai un errore o una pagina
 * vuota.
 *
 * Deliberatamente SOLO il grafico promesso, non anche retention/no-show
 * reale (vedi il commento in src/lib/analytics.ts sul perché quei due sono
 * lasciati aperti, non dimenticati).
 */
export default async function PaginaAnalytics() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  const haAccesso = pianoHaAnalytics(tenant?.piano ?? "");

  const andamento = haAccesso ? await caricaAndamento(supabase, tenantId, 12) : null;

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <a href="/dashboard" className="text-sm underline">
          ← Dashboard
        </a>
        <h1 className="mt-2 text-xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Andamento prenotazioni e clienti nelle ultime 12 settimane, non solo i numeri di oggi.
        </p>
      </div>

      {haAccesso ? (
        andamento && <GraficoAndamento punti={andamento} />
      ) : (
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-600">
            Analytics è incluso dal piano <strong>Growth</strong> in su. La dashboard mostra già oggi i numeri del
            momento (appuntamenti di oggi, nuovi clienti, clienti inattivi).
          </p>
          <Link href="/#prezzi" className="mt-4 inline-block rounded bg-black px-3 py-2 text-sm font-medium text-white">
            Passa a Growth
          </Link>
        </div>
      )}
    </div>
  );
}
