import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaPromemoria } from "@/lib/piani";
import { PannelloPromemoria } from "./pannello-promemoria";
import { PannelloFollowUp } from "./pannello-follow-up";
import { giorniInattivitaValidi } from "@/lib/promemoria";

/**
 * Impostazioni -> Promemoria automatici (Fase 6, Growth in su -- vedi
 * `pianoHaPromemoria`). Costruita il 14/09/2026 su richiesta esplicita di
 * Gabriel, lo stesso giorno in cui è stato costruito il motore: "vorrei che
 * lo staff possa decidere quanto tempo prima mandare il promemoria e anche
 * se averne più di uno".
 *
 * Dal 17/09/2026 la pagina ha un secondo blocco: il follow-up ai clienti
 * spariti, che fino a quel giorno partiva da solo a 60 giorni fissi con un
 * testo scritto nel codice. Stanno insieme perché sono le due metà dello
 * stesso motore (`promemoria.server.ts`, stesso cron notturno) e perché un
 * titolare li pensa come una cosa sola: "cosa scrive in automatico il mio
 * salone".
 */
export default async function PaginaPromemoria() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "piano, follow_up_inattivi_attivo, follow_up_inattivi_giorni, follow_up_inattivi_messaggio"
    )
    .eq("id", tenantId)
    .single();
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
        <Link href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Promemoria automatici</h1>
        <p className="mt-1 max-w-lg text-sm text-zinc-600">
          Tutto quello che il tuo salone scrive da solo ai clienti: il promemoria prima
          dell&apos;appuntamento e il messaggio a chi non prenota da un po&apos;.
        </p>
      </div>

      {haAccesso ? (
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-1 text-sm font-medium text-zinc-900">Prima dell&apos;appuntamento</h2>
            <p className="mb-3 max-w-lg text-xs text-zinc-500">
              Quanto tempo prima mandare il reminder. Puoi attivarne più di uno (es. 3 giorni prima E 1
              giorno prima).
            </p>
            <PannelloPromemoria
              regoleIniziali={(regoleGrezze ?? []).map((r) => ({ id: r.id, orePreavviso: r.ore_preavviso }))}
            />
          </div>

          <PannelloFollowUp
            attivoIniziale={tenant?.follow_up_inattivi_attivo ?? true}
            giorniIniziali={giorniInattivitaValidi(tenant?.follow_up_inattivi_giorni)}
            messaggioIniziale={tenant?.follow_up_inattivi_messaggio ?? ""}
          />
        </div>
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
