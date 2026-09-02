import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";

/**
 * CRM (punto 12): anagrafica cliente con storico -- qui l'elenco con
 * ricerca, il dettaglio con lo storico completo vive in [id]/page.tsx.
 * Popolata sia dalla dashboard (creazione manuale di un appuntamento) sia,
 * in Fase 2, dall'AI (`creaAppuntamentoTenant`/gli strumenti in
 * src/lib/ai/tools.ts creano il cliente se non esiste ancora) -- stessa
 * tabella, mai un'anagrafica separata per canale.
 */
export default async function PaginaClienti({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await creaClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/accedi");

  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/dashboard");

  let query = supabase
    .from("clienti")
    .select("id, nome, telefono, email, tag, creato_da_ai, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (q?.trim()) {
    const termine = q.trim();
    query = query.or(`nome.ilike.%${termine}%,telefono.ilike.%${termine}%`);
  }

  const { data: clienti, error } = await query;

  // Conteggio appuntamenti per cliente in un'unica query (non N+1): serve
  // solo a dare un'idea della "storia" del cliente nell'elenco, il dettaglio
  // completo si vede aprendo la scheda.
  const { data: righeAppuntamenti } = await supabase
    .from("appuntamenti")
    .select("cliente_id")
    .eq("tenant_id", tenantId)
    .not("cliente_id", "is", null);

  const conteggioPerCliente = new Map<string, number>();
  for (const riga of righeAppuntamenti ?? []) {
    if (!riga.cliente_id) continue;
    conteggioPerCliente.set(riga.cliente_id, (conteggioPerCliente.get(riga.cliente_id) ?? 0) + 1);
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

      <form className="mt-4 flex gap-2" action="/dashboard/clienti">
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

      {error && <p className="mt-4 text-sm text-red-600">Errore caricando i clienti: {error.message}</p>}

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
                <td className="px-3 py-2">{c.creato_da_ai ? "AI" : "Manuale"}</td>
                <td className="px-3 py-2">{new Date(c.created_at).toLocaleDateString("it-IT")}</td>
              </tr>
            ))}
            {(clienti ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  {q ? "Nessun cliente trovato per questa ricerca." : "Nessun cliente ancora."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
