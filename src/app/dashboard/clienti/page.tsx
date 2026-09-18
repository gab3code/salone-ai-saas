import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { elencaClientiInattivi } from "@/lib/metriche";
import { giorniInattivitaValidi } from "@/lib/promemoria";
import { originePerCliente } from "@/lib/origine-cliente";
import { terminoRicercaSicuro } from "@/lib/ricerca";
import { elencaClienti } from "@/lib/clienti.server";

/**
 * CRM (punto 12): anagrafica cliente con storico -- qui l'elenco con
 * ricerca, il dettaglio con lo storico completo vive in [id]/page.tsx.
 * Popolata sia dalla dashboard (creazione manuale di un appuntamento) sia,
 * in Fase 2, dall'AI (`creaAppuntamentoTenant`/gli strumenti in
 * src/lib/ai/tools.ts creano il cliente se non esiste ancora) -- stessa
 * tabella, mai un'anagrafica separata per canale.
 *
 * `?filtro=inattivi` è la destinazione del pulsante "Contatta questi
 * clienti" della dashboard (punto 18) -- stessa logica testata di
 * `elencaClientiInattivi`, non una seconda regola scritta a mano qui.
 */
export default async function PaginaClienti({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const { q, filtro } = await searchParams;
  const supabase = await creaClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/accedi");

  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/dashboard");

  // Il termine si ripulisce PRIMA di entrare nel filtro: virgole, parentesi
  // e punti hanno un significato nella grammatica di PostgREST, e i jolly di
  // `like` permetterebbero di farsi tornare l'intera rubrica con un "%".
  const termine = terminoRicercaSicuro(q);

  // La rubrica non si legge piu' da qui con il client dell'utente: dopo la
  // migrazione 0051 `authenticated` non ha piu' SELECT su `clienti`, e ogni
  // lettura passa da clienti.server.ts (vedi la spiegazione in quel file).
  const { clienti: clientiGrezzi, errore } = await elencaClienti(tenantId, { termine });

  // Soglia "cliente sparito" scelta dal salone (migrazione 0040): la stessa
  // che usano la card della dashboard e il follow-up automatico. Se questa
  // pagina restasse a 60 fisso, il filtro mostrerebbe un insieme diverso da
  // quello a cui partono davvero le email.
  const { data: tenantSoglia } = await supabase
    .from("tenants")
    .select("follow_up_inattivi_giorni")
    .eq("id", tenantId)
    .maybeSingle();
  const giorniInattivita = giorniInattivitaValidi(tenantSoglia?.follow_up_inattivi_giorni);

  // Una query sola per: (a) il conteggio appuntamenti per cliente mostrato
  // in tabella, (b) l'elenco di chi è inattivo se richiesto dal filtro,
  // (c) l'origine di ogni cliente (vedi origine-cliente.ts) -- non tre giri
  // separati sulla stessa tabella.
  const { data: righeAppuntamenti } = await supabase
    .from("appuntamenti")
    .select("cliente_id, inizio, stato, creato_da, created_at")
    .eq("tenant_id", tenantId)
    .not("cliente_id", "is", null);

  const conteggioPerCliente = new Map<string, number>();
  for (const riga of righeAppuntamenti ?? []) {
    if (!riga.cliente_id) continue;
    conteggioPerCliente.set(riga.cliente_id, (conteggioPerCliente.get(riga.cliente_id) ?? 0) + 1);
  }

  const origineCliente = originePerCliente(
    (righeAppuntamenti ?? []).map((r) => ({
      clienteId: r.cliente_id,
      creatoDa: r.creato_da,
      createdAt: new Date(r.created_at),
    }))
  );

  let clienti = clientiGrezzi ?? [];
  if (filtro === "inattivi") {
    const inattivi = elencaClientiInattivi(
      (righeAppuntamenti ?? []).map((r) => ({
        inizio: new Date(r.inizio),
        fine: new Date(r.inizio),
        stato: r.stato,
        clienteId: r.cliente_id,
        operatoreId: null,
        servizioId: null,
      })),
      new Date(),
      giorniInattivita
    );
    clienti = clienti.filter((c) => inattivi.has(c.id));
  }

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm underline">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-xl font-semibold">Clienti</h1>
        </div>
      </div>

      {filtro === "inattivi" && (
        <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Filtro attivo: clienti che hanno prenotato in passato ma non negli ultimi {giorniInattivita} giorni.{" "}
          <Link href="/dashboard/clienti" className="underline">
            Mostra tutti
          </Link>
        </p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <form className="flex gap-2" action="/dashboard/clienti">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Cerca per nome o telefono..."
            className="w-72 rounded border border-zinc-300 px-3 py-1.5 text-sm"
          />
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
            Cerca
          </button>
        </form>
        {/* Esporta esattamente quello che la pagina sta mostrando (stessi
            q/filtro), vedi export/route.ts -- "esporta quello che vedi". */}
        <a
          href={`/dashboard/clienti/export${q || filtro ? `?${new URLSearchParams({ ...(q ? { q } : {}), ...(filtro ? { filtro } : {}) })}` : ""}`}
          className="shrink-0 rounded border border-zinc-300 px-3 py-1.5 text-sm"
        >
          Esporta CSV
        </a>
        {/* Una pagina che non si raggiunge da nessuna parte non e' una
            funzionalita': l'import vive qui accanto all'export, dove uno lo
            cerca. Il permesso e' ricontrollato dalla pagina e dalle azioni --
            questo link e' comodita', non sicurezza. */}
        <Link
          href="/dashboard/clienti/importa"
          className="shrink-0 rounded border border-zinc-300 px-3 py-1.5 text-sm"
        >
          Importa rubrica
        </Link>
      </div>

      {errore && <p className="mt-4 text-sm text-red-600">Errore caricando i clienti: {errore}</p>}

      <div className="mt-4 overflow-x-auto rounded border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-normal">Nome</th>
              <th className="px-3 py-2 font-normal">Telefono</th>
              <th className="px-3 py-2 font-normal">Email</th>
              <th className="px-3 py-2 font-normal">Tag</th>
              <th className="px-3 py-2 font-normal">Appuntamenti</th>
              <th className="px-3 py-2 font-normal">Origine</th>
              <th className="px-3 py-2 font-normal">Cliente da</th>
            </tr>
          </thead>
          <tbody>
            {(clienti ?? []).map((c) => (
              <tr key={c.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/dashboard/clienti/${c.id}`} className="underline">
                    {c.nome || "(senza nome)"}
                  </Link>
                </td>
                <td className="px-3 py-2">{c.telefono || "—"}</td>
                <td className="px-3 py-2">{c.email || "—"}</td>
                <td className="px-3 py-2">{(c.tag ?? []).join(", ") || "—"}</td>
                <td className="px-3 py-2">{conteggioPerCliente.get(c.id) ?? 0}</td>
                <td className="px-3 py-2">{origineCliente.get(c.id) ?? (c.creato_da_ai ? "AI" : "Manuale")}</td>
                <td className="px-3 py-2">{new Date(c.created_at).toLocaleDateString("it-IT")}</td>
              </tr>
            ))}
            {(clienti ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  {q
                    ? "Nessun cliente trovato per questa ricerca."
                    : filtro === "inattivi"
                      ? "Nessun cliente inattivo al momento -- ottimo segno."
                      : "Nessun cliente ancora."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
