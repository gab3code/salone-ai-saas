import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { trovaSlotDisponibiliTenant } from "@/lib/booking-engine.server";
import { cancellaAppuntamento } from "./azioni";
import { PannelloNuovoAppuntamento } from "./pannello-nuovo-appuntamento";

function oggiYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

function giornoAdiacente(dataYMD: string, delta: number): string {
  const d = new Date(`${dataYMD}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Vista calendario di base (Fase 1, punto 12/13/14): lettura e creazione
 * manuale degli appuntamenti del giorno per il tenant loggato, sopra lo
 * stesso motore di disponibilità che useranno i tool AI in Fase 2. Interattiva
 * quanto basta (query string) senza bisogno di un componente client per la
 * lista -- solo il pannello "nuovo appuntamento" è client, per la selezione
 * dello slot.
 */
export default async function PaginaCalendario({
  searchParams,
}: {
  searchParams: Promise<{ data?: string; servizio_id?: string; operatore_id?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const dataYMD = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : oggiYMD();
  const servizioId = sp.servizio_id ?? "";
  const operatoreId = sp.operatore_id ?? "";

  const [operatoriRes, serviziRes, appuntamentiRes] = await Promise.all([
    supabase.from("operatori").select("id, nome").eq("tenant_id", tenantId).eq("attivo", true).order("nome"),
    supabase
      .from("servizi")
      .select("id, nome, durata_minuti")
      .eq("tenant_id", tenantId)
      .eq("attivo", true)
      .order("nome"),
    supabase
      .from("appuntamenti")
      .select("id, inizio, fine, stato, operatore_id, operatori(nome), servizi(nome), clienti(nome, telefono)")
      .eq("tenant_id", tenantId)
      .gte("inizio", `${dataYMD}T00:00:00Z`)
      .lt("inizio", `${giornoAdiacente(dataYMD, 1)}T00:00:00Z`)
      .neq("stato", "cancellato")
      .order("inizio"),
  ]);

  const operatori = (operatoriRes.data ?? []).map((o) => ({ id: o.id, nome: o.nome }));
  const servizi = (serviziRes.data ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    durataMinuti: s.durata_minuti,
  }));
  const appuntamenti = appuntamentiRes.data ?? [];

  let slots: { operatoreId: string; inizio: string }[] = [];
  if (servizioId) {
    const slotsCalcolati = await trovaSlotDisponibiliTenant(supabase, tenantId, {
      data: new Date(`${dataYMD}T00:00:00Z`),
      servizioIds: [servizioId],
      operatoreId: operatoreId || undefined,
    });
    slots = slotsCalcolati.map((s) => ({
      operatoreId: s.operatoreId,
      inizio: s.inizio.toISOString(),
    }));
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <a href="/dashboard" className="text-sm underline">
          ← Dashboard
        </a>
        <h1 className="mt-2 text-xl font-semibold">Calendario</h1>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <a
          href={`/dashboard/calendario?data=${giornoAdiacente(dataYMD, -1)}`}
          className="rounded border border-zinc-300 px-2 py-1"
        >
          ← Giorno prima
        </a>
        <span className="font-medium">{dataYMD}</span>
        <a
          href={`/dashboard/calendario?data=${giornoAdiacente(dataYMD, 1)}`}
          className="rounded border border-zinc-300 px-2 py-1"
        >
          Giorno dopo →
        </a>
      </div>

      <section>
        <h2 className="text-base font-medium">Appuntamenti del giorno</h2>
        {appuntamenti.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nessun appuntamento per questo giorno.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {appuntamenti.map((a) => {
              const operatoreNome = Array.isArray(a.operatori) ? a.operatori[0]?.nome : (a.operatori as { nome: string } | null)?.nome;
              const servizioNome = Array.isArray(a.servizi) ? a.servizi[0]?.nome : (a.servizi as { nome: string } | null)?.nome;
              const cliente = Array.isArray(a.clienti) ? a.clienti[0] : (a.clienti as { nome: string | null; telefono: string } | null);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded border border-zinc-200 p-3"
                >
                  <span>
                    <strong>{new Date(a.inizio).toISOString().slice(11, 16)}</strong>
                    {" – "}
                    {new Date(a.fine).toISOString().slice(11, 16)} · {servizioNome ?? "servizio"} ·{" "}
                    {operatoreNome ?? "operatore"}
                    {cliente && (
                      <>
                        {" · "}
                        {cliente.nome || cliente.telefono}
                      </>
                    )}
                  </span>
                  <form
                    action={async () => {
                      "use server";
                      await cancellaAppuntamento(a.id);
                    }}
                  >
                    <button type="submit" className="text-xs text-red-600 underline">
                      Cancella
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {operatori.length === 0 || servizi.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Configura almeno un operatore e un servizio prima di creare appuntamenti --{" "}
          <a href="/dashboard/configura" className="underline">
            vai a Configura il salone
          </a>
          .
        </p>
      ) : (
        <PannelloNuovoAppuntamento
          operatori={operatori}
          servizi={servizi}
          slots={slots}
          servizioIdIniziale={servizioId}
          operatoreIdIniziale={operatoreId}
          dataIniziale={dataYMD}
        />
      )}
    </div>
  );
}
