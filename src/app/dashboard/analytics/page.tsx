import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaAnalytics } from "@/lib/piani";
import { trovaPeriodo } from "@/lib/analytics";
import { caricaAnalytics } from "@/lib/analytics.server";
import { GIORNI_INATTIVITA_PREDEFINITI, giorniInattivitaValidi } from "@/lib/promemoria";
import { SelettorePeriodo } from "./selettore-periodo";
import { PannelloAndamento } from "./pannello-andamento";
import { BloccoRetention } from "./blocco-retention";

/**
 * Analytics (Fase 3, Growth in su -- vedi src/lib/piani.ts).
 *
 * Nata il 14/09/2026 con due grafici a barre fissi su dodici settimane,
 * perche' quello -- e solo quello -- era promesso sul sito. Il 17/09/2026
 * Gabriel ha chiesto di chiudere la fase: la pagina adesso ha un periodo
 * scegliebile con granularita' che lo segue, le variazioni sul periodo
 * precedente e il blocco retention, che era l'ultimo punto aperto dell'intera
 * Fase 3.
 *
 * Il gate di piano non cambia: upsell se il piano non include la funzione,
 * mai un errore o una pagina vuota (stesso pattern di
 * `/dashboard/impostazioni/tono-ai`).
 */
export default async function PaginaAnalytics({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { periodo: periodoScelto } = await searchParams;
  const periodo = trovaPeriodo(periodoScelto);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("piano, follow_up_inattivi_giorni")
    .eq("id", tenantId)
    .single();
  const haAccesso = pianoHaAnalytics(tenant?.piano ?? "");

  const dati = haAccesso ? await caricaAnalytics(supabase, tenantId, periodo) : null;
  // Stessa soglia della card in dashboard, del filtro della rubrica e del
  // job notturno: un dato sporco ricade sul predefinito, mai su un numero
  // diverso da quello che il salone legge nelle impostazioni.
  const giorniFollowUp = giorniInattivitaValidi(tenant?.follow_up_inattivi_giorni)
    ? (tenant?.follow_up_inattivi_giorni as number)
    : GIORNI_INATTIVITA_PREDEFINITI;

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <a href="/dashboard" className="text-sm underline">
            ← Dashboard
          </a>
          <h1 className="mt-2 text-xl font-semibold">Analytics</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-600">
            Come sta andando nel tempo, e quanti clienti tornano. Non solo i numeri di oggi.
          </p>
        </div>
        {haAccesso && <SelettorePeriodo attivo={periodo} />}
      </div>

      {haAccesso && dati ? (
        <>
          <PannelloAndamento punti={dati.andamento} confronto={dati.confronto} periodo={periodo} />
          <BloccoRetention retention={dati.retention} giorniFollowUp={giorniFollowUp} />
        </>
      ) : (
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-600">
            Analytics è incluso dal piano <strong>Growth</strong> in su. La dashboard mostra già oggi i numeri del
            momento (appuntamenti di oggi, nuovi clienti, clienti inattivi).
          </p>
          <Link
            href="/dashboard/abbonamento?piano=growth"
            className="mt-4 inline-block rounded bg-black px-3 py-2 text-sm font-medium text-white"
          >
            Passa a Growth
          </Link>
        </div>
      )}
    </div>
  );
}
