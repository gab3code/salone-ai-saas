import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { elencaCollegamentiTenant } from "@/lib/calendario-esterno/collegamenti.server";
import { PannelloCalendari } from "./pannello-calendari";
import Link from "next/link";

/**
 * Impostazioni -> Calendari personali (Fase 6bis). Collegare il calendario
 * personale di un operatore fa sì che i suoi impegni privati blocchino
 * automaticamente gli stessi slot nel motore di disponibilità -- stesso
 * principio degli appuntamenti interni, mai una seconda logica di conflitto
 * (punto 9 di CLAUDE.md).
 */
export default async function PaginaCalendariEsterni({
  searchParams,
}: {
  searchParams: Promise<{ google_collegato?: string; errore_google?: string }>;
}) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const [operatoriRes, collegamenti, parametri] = await Promise.all([
    supabase.from("operatori").select("id, nome").eq("tenant_id", tenantId).order("nome"),
    elencaCollegamentiTenant(tenantId),
    searchParams,
  ]);

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Calendari personali</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Collega il calendario personale di ogni operatore: i suoi impegni privati bloccheranno
          automaticamente gli stessi orari qui, ed è sempre lo stesso calendario del database a
          decidere cosa è libero -- niente doppie prenotazioni tra il salone e la vita privata.
        </p>
      </div>

      {parametri.google_collegato && (
        <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          Google Calendar collegato con successo.
        </p>
      )}
      {parametri.errore_google && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {parametri.errore_google}
        </p>
      )}

      <PannelloCalendari operatori={operatoriRes.data ?? []} collegamenti={collegamenti} />
    </div>
  );
}
