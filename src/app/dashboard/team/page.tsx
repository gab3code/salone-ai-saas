import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoGestireMembri } from "@/lib/ruoli";
import { pianoHaTeam } from "@/lib/piani";
import { elencaInvitiPendenti, elencaMembri } from "@/lib/membri.server";
import { PannelloTeam } from "./pannello-team";

/**
 * Chi lavora in questa attività (Fase 5, migrazione 0027). Riservata al
 * titolare: è la schermata da cui si dà e si toglie l'accesso, quindi non
 * deve poterla nemmeno aprire chi quell'accesso lo ha ricevuto.
 */
export default async function PaginaTeam() {
  const supabase = await creaClientServer();
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) redirect("/accedi");
  if (!puoGestireMembri(sessione.ruolo)) redirect("/dashboard");

  const [membri, inviti, tenantRes] = await Promise.all([
    elencaMembri(sessione.tenantId),
    elencaInvitiPendenti(sessione.tenantId),
    supabase.from("tenants").select("piano").eq("id", sessione.tenantId).single(),
  ]);

  // Gate di piano: gli accessi per il personale sono da Pro in su (vedi
  // `limiteMembri` in piani.ts). Chi non ce l'ha vede comunque la pagina --
  // con chi c'è oggi e il motivo per cui il modulo di invito non c'è -- invece
  // di un link che sparisce senza spiegazione.
  const haTeam = pianoHaTeam(tenantRes.data?.piano ?? "");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <Link href="/dashboard" className="text-sm underline">
        ← Dashboard
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-zinc-500">
          Le persone che possono entrare in questa attività, e con quale ruolo.
        </p>
      </header>

      <PannelloTeam
        membri={membri}
        inviti={inviti}
        userIdCorrente={sessione.userId}
        haTeam={haTeam}
      />

    </main>
  );
}
