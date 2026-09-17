import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { PannelloCaparra } from "./pannello-caparra";
import { formatoEuroDaCentesimi as formatoEuro } from "@/lib/piani";


const ETICHETTA_STATO: Record<string, string> = {
  in_attesa: "In attesa di pagamento",
  completata: "Completata",
  fallita_conflitto: "Fallita (slot occupato, rimborsata)",
  annullata: "Annullata dal cliente",
};

/**
 * Impostazioni -> Deposito/caparra anti-no-show (Fase 6). Configurazione +
 * elenco delle richieste recenti, incluse quelle fallite/rimborsate
 * automaticamente (vedi webhook Stripe) -- così un conflitto di slot durante
 * il pagamento non sparisce nel nulla, il titolare lo vede qui.
 */
export default async function PaginaCaparra() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const [tenantRes, richiesteRes] = await Promise.all([
    supabase.from("tenants").select("caparra_attiva, caparra_tipo, caparra_valore").eq("id", tenantId).single(),
    supabase
      .from("richieste_caparra")
      .select("id, cliente_nome, importo_centesimi, stato, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <a href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </a>
        <h1 className="mt-2 text-xl font-semibold">Deposito/caparra anti-no-show</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Richiedi il pagamento online di una caparra per confermare le prenotazioni fatte dalla tua pagina
          pubblica -- riduce i clienti che prenotano e poi non si presentano. Nessun addebito viene mai fatto
          senza che il cliente lo veda e lo confermi nella pagina di pagamento di Stripe.
        </p>
      </div>

      <PannelloCaparra
        configurazioneIniziale={{
          attiva: tenantRes.data?.caparra_attiva ?? false,
          tipo: (tenantRes.data?.caparra_tipo as "percentuale" | "fisso") ?? "percentuale",
          valore: tenantRes.data?.caparra_valore ?? 20,
        }}
      />

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-900">Richieste recenti</h2>
        {(richiesteRes.data ?? []).length === 0 ? (
          <p className="text-sm text-zinc-500">Nessuna richiesta di caparra ancora.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {(richiesteRes.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-zinc-900">{r.cliente_nome}</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(r.created_at).toLocaleString("it-IT")} · {ETICHETTA_STATO[r.stato] ?? r.stato}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-zinc-900">{formatoEuro(r.importo_centesimi)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
