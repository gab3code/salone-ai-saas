import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { aggiornaCliente } from "../azioni";

/**
 * Scheda cliente (punto 12, CRM "realmente connesso"): dati anagrafici
 * modificabili + storico COMPLETO delle prenotazioni (passate e future),
 * qualunque sia stato il canale che le ha create (dashboard manuale o AI --
 * stessa tabella `appuntamenti`, mai due storie separate per canale).
 */
export default async function PaginaClienteDettaglio({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await creaClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/accedi");

  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/dashboard");

  const { data: cliente } = await supabase
    .from("clienti")
    .select("id, nome, telefono, email, note, tag, creato_da_ai, created_at")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!cliente) notFound();

  const { data: appuntamentiGrezzi } = await supabase
    .from("appuntamenti")
    .select("id, inizio, fine, stato, creato_da, servizi(nome), operatori(nome)")
    .eq("tenant_id", tenantId)
    .eq("cliente_id", id)
    .order("inizio", { ascending: false });

  // `inizio` in colonna è un istante reale (timestamptz) -- va riportato
  // all'ora civile del salone prima di mostrarlo, stessa convenzione
  // "pseudo-UTC" di tutto il resto della dashboard (vedi src/lib/fuso-orario.ts).
  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
  const appuntamenti = (appuntamentiGrezzi ?? []).map((a) => ({
    ...a,
    inizio: realeAPseudoUtc(new Date(a.inizio), fusoOrario).toISOString(),
  }));

  const etichetteStato: Record<string, string> = {
    confermato: "Confermato",
    cancellato: "Cancellato",
    completato: "Completato",
    no_show: "No-show",
  };

  return (
    <div className="flex flex-1 flex-col p-8">
      <Link href="/dashboard/clienti" className="text-sm underline">
        ← Clienti
      </Link>
      <h1 className="mt-2 text-xl font-semibold">{cliente.nome || "(senza nome)"}</h1>
      <p className="text-sm text-zinc-500">
        {cliente.telefono || "nessun telefono"} · cliente dal{" "}
        {new Date(cliente.created_at).toLocaleDateString("it-IT")} ·{" "}
        {cliente.creato_da_ai ? "creato dall'AI" : "creato manualmente"}
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <section className="rounded border border-zinc-200 p-4">
          <h2 className="text-sm font-medium text-zinc-500">Dati anagrafici</h2>
          <form
            action={async (formData) => {
              "use server";
              await aggiornaCliente(cliente.id, formData);
            }}
            className="mt-3 flex flex-col gap-3"
          >
            <label className="flex flex-col gap-1 text-sm">
              Nome
              <input
                type="text"
                name="nome"
                defaultValue={cliente.nome ?? ""}
                className="rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                type="email"
                name="email"
                defaultValue={cliente.email ?? ""}
                className="rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Tag (separati da virgola)
              <input
                type="text"
                name="tag"
                defaultValue={(cliente.tag ?? []).join(", ")}
                placeholder="vip, allergico al lattice, ..."
                className="rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Note
              <textarea
                name="note"
                defaultValue={cliente.note ?? ""}
                rows={4}
                className="rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <button type="submit" className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm">
              Salva
            </button>
          </form>
          <p className="mt-3 text-xs text-zinc-400">
            Il telefono è la chiave di riconoscimento del cliente (WhatsApp/chat) e non è modificabile qui.
          </p>
        </section>

        <section className="rounded border border-zinc-200 p-4">
          <h2 className="text-sm font-medium text-zinc-500">
            Storico appuntamenti ({(appuntamenti ?? []).length})
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {(appuntamenti ?? []).map((a) => {
              const inizio = new Date(a.inizio);
              const servizio = (a.servizi as unknown as { nome: string } | null)?.nome ?? "servizio eliminato";
              const operatore = (a.operatori as unknown as { nome: string } | null)?.nome ?? "operatore eliminato";
              return (
                <li key={a.id} className="flex items-center justify-between rounded border border-zinc-100 px-3 py-2">
                  <span>
                    {inizio.toLocaleDateString("it-IT")} {inizio.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                    {" · "}
                    {servizio} · {operatore}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-zinc-500">
                    {a.creato_da === "ai" ? "AI" : "Manuale"}
                    <span
                      className={
                        a.stato === "confermato"
                          ? "rounded bg-green-100 px-2 py-0.5 text-green-700"
                          : a.stato === "cancellato"
                            ? "rounded bg-red-100 px-2 py-0.5 text-red-700"
                            : "rounded bg-zinc-100 px-2 py-0.5 text-zinc-700"
                      }
                    >
                      {etichetteStato[a.stato] ?? a.stato}
                    </span>
                  </span>
                </li>
              );
            })}
            {(appuntamenti ?? []).length === 0 && (
              <li className="text-zinc-500">Nessuna prenotazione ancora per questo cliente.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
