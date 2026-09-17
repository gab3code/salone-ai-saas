import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { PulsantePortaleAbbonamento } from "./pulsante-portale-abbonamento";

/**
 * Impostazioni (Fase 5): finora esisteva solo la sotto-pagina
 * "Calendari personali" -- questa è la pagina indice, con lo stato reale
 * dell'abbonamento (letto dal DB, aggiornato dal webhook Stripe) e
 * l'accesso al customer portal per chi è già su un piano a pagamento.
 */
export default async function PaginaImpostazioni() {
  const supabase = await creaClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/accedi");
  }

  const { data: profilo } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  const { data: tenant } = profilo
    ? await supabase.from("tenants").select("piano, stato_abbonamento").eq("id", profilo.tenant_id).single()
    : { data: null };

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <a href="/dashboard" className="text-sm underline">
        ← Dashboard
      </a>
      <h1 className="text-xl font-semibold">Impostazioni</h1>

      <section className="max-w-md rounded border border-zinc-200 p-5">
        <h2 className="text-sm font-medium text-zinc-500">Abbonamento</h2>
        <p className="mt-2 text-lg font-semibold capitalize">{tenant?.piano ?? "free"}</p>
        <p className="text-sm text-zinc-500 capitalize">{tenant?.stato_abbonamento ?? "--"}</p>

        {tenant && tenant.piano !== "free" ? (
          <PulsantePortaleAbbonamento />
        ) : (
          <Link href="/#prezzi" className="mt-4 inline-block rounded bg-black px-3 py-2 text-sm font-medium text-white">
            Passa a un piano a pagamento
          </Link>
        )}
      </section>

      <a href="/dashboard/fatturazione" className="text-sm underline">
        Dati per la fattura
      </a>

      <a href="/dashboard/impostazioni/calendari" className="text-sm underline">
        Calendari personali
      </a>
      <a href="/dashboard/impostazioni/caparra" className="text-sm underline">
        Deposito/caparra anti-no-show
      </a>
      <a href="/dashboard/impostazioni/tono-ai" className="text-sm underline">
        Tono dell&apos;AI
      </a>
      <a href="/dashboard/impostazioni/promemoria" className="text-sm underline">
        Promemoria automatici
      </a>
      <a href="/dashboard/impostazioni/compleanno" className="text-sm underline">
        Promemoria di compleanno
      </a>
      <a href="/dashboard/impostazioni/lista-attesa" className="text-sm underline">
        Contatto automatico lista d&apos;attesa
      </a>
      <a href="/dashboard/impostazioni/recensioni" className="text-sm underline">
        Recensioni
      </a>
      <a href="/dashboard/impostazioni/cancellazione" className="text-sm underline">
        Cancellazione online
      </a>
      <a href="/dashboard/impostazioni/informazioni-attivita" className="text-sm underline">
        Informazioni per l&apos;AI (receptionist)
      </a>
      <a href="/dashboard/impostazioni/pagina-pubblica" className="text-sm underline">
        Logo e foto di copertina
      </a>
    </div>
  );
}
