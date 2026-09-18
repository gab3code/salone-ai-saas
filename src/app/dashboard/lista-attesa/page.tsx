import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { PannelloListaAttesa } from "./pannello-lista-attesa";
import { segnaListaAttesaRisolta, rimuoviListaAttesa } from "./azioni";
import Link from "next/link";

interface RigaListaAttesa {
  id: string;
  cliente_nome: string | null;
  cliente_telefono: string;
  data_preferita: string | null;
  note: string | null;
  stato: string;
  slot_liberato_inizio: string | null;
  created_at: string;
  servizi: { nome: string } | { nome: string }[] | null;
  operatori: { nome: string } | { nome: string }[] | null;
}

function nomeRelazione(v: { nome: string } | { nome: string }[] | null): string | null {
  return (Array.isArray(v) ? v[0]?.nome : v?.nome) ?? null;
}

/**
 * Lista d'attesa automatica alla cancellazione (Fase 6, PIANO.md Gruppo B
 * punto 3): qui il titolare vede chi aspetta un servizio e, quando una
 * cancellazione libera uno slot compatibile, chi contattare subito (righe
 * "proposto", in cima). Nessun invio automatico al cliente ancora (zero
 * email/SMS nel progetto oggi, PIANO.md "Gruppo B-bis" punto 1): il
 * contatto resta manuale (telefonata/messaggio), questa pagina è il punto
 * dove il titolare scopre di doverlo fare.
 */
export default async function PaginaListaAttesa() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const [serviziRes, operatoriRes, listaRes, fusoOrario] = await Promise.all([
    supabase.from("servizi").select("id, nome").eq("tenant_id", tenantId).eq("attivo", true).order("nome"),
    supabase.from("operatori").select("id, nome").eq("tenant_id", tenantId).eq("attivo", true).order("nome"),
    supabase
      .from("lista_attesa")
      .select(
        // "operatori!operatore_id(...)", non "operatori(...)": la tabella ha DUE foreign key
        // verso operatori (operatore_id e slot_liberato_operatore_id) -- senza l'hint sulla
        // colonna, PostgREST rifiuta l'embed come ambiguo ("more than one relationship was
        // found") e la select fallisce IN SILENZIO qui sotto (solo `.data ?? []`, mai
        // controllato `.error`): bug reale trovato il 13/09/2026, Gabriel aveva aggiunto due
        // clienti alla lista ma la pagina risultava vuota. Vedi DECISIONS.md.
        "id, cliente_nome, cliente_telefono, data_preferita, note, stato, slot_liberato_inizio, created_at, servizi(nome), operatori!operatore_id(nome)"
      )
      .eq("tenant_id", tenantId)
      .in("stato", ["in_attesa", "proposto"])
      .order("created_at", { ascending: true }),
    caricaFusoOrarioTenant(supabase, tenantId),
  ]);

  const servizi = (serviziRes.data ?? []).map((s) => ({ id: s.id, nome: s.nome }));
  const operatori = (operatoriRes.data ?? []).map((o) => ({ id: o.id, nome: o.nome }));

  // Non silenziare un errore reale dietro un fuorviante "nessuno in lista" (esattamente il bug
  // del 13/09/2026: la select falliva per l'embed ambiguo su operatori, ma la pagina mostrava
  // comunque "nessuno in lista d'attesa" invece di un errore leggibile).
  if (listaRes.error) console.error("Errore caricando la lista d'attesa:", listaRes.error);
  const righe = (listaRes.data ?? []) as unknown as RigaListaAttesa[];
  // "proposto" (da contattare adesso) sempre in cima, poi FIFO tra chi resta in attesa.
  const proposte = righe.filter((r) => r.stato === "proposto");
  const inAttesa = righe.filter((r) => r.stato === "in_attesa");

  function rigaLista(r: RigaListaAttesa) {
    const servizioNome = nomeRelazione(r.servizi) ?? "servizio";
    const operatoreNome = nomeRelazione(r.operatori);
    return (
      <li
        key={r.id}
        className={`flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
          r.stato === "proposto" ? "bg-amber-50" : ""
        }`}
      >
        <div>
          <p className="font-medium text-zinc-900">
            {r.cliente_nome || "Cliente senza nome"} · {r.cliente_telefono}
          </p>
          <p className="text-xs text-zinc-500">
            {servizioNome}
            {operatoreNome ? ` · preferisce ${operatoreNome}` : ""}
            {r.data_preferita ? ` · giorno preferito ${r.data_preferita}` : " · va bene qualunque giorno"}
          </p>
          {r.stato === "proposto" && r.slot_liberato_inizio && (
            <p className="mt-1 text-xs font-medium text-amber-800">
              🔔 Si è liberato un posto compatibile il{" "}
              {realeAPseudoUtc(new Date(r.slot_liberato_inizio), fusoOrario).toISOString().slice(0, 16).replace("T", " alle ")}
              -- contatta il cliente.
            </p>
          )}
          {r.note && <p className="mt-1 text-xs text-zinc-400">Nota: {r.note}</p>}
        </div>
        <div className="flex shrink-0 gap-3 text-xs">
          <form
            action={async () => {
              "use server";
              await segnaListaAttesaRisolta(r.id);
            }}
          >
            <button type="submit" className="underline">
              Segna risolto
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await rimuoviListaAttesa(r.id);
            }}
          >
            <button type="submit" className="text-red-600 underline">
              Rimuovi
            </button>
          </form>
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Lista d&apos;attesa</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Quando cancelli un appuntamento, se un cliente in questa lista era in attesa proprio di quel servizio (e
          operatore/giorno, se richiesti), lo vedrai segnalato qui in cima -- da contattare a mano, nessun messaggio
          parte da solo.
        </p>
      </div>

      {servizi.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Configura almeno un servizio prima di usare la lista d&apos;attesa --{" "}
          <Link href="/dashboard/configura" className="underline">
            vai a Configura l&apos;attività
          </Link>
          .
        </p>
      ) : (
        <PannelloListaAttesa servizi={servizi} operatori={operatori} />
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium text-zinc-900">
          In coda {righe.length > 0 && `(${proposte.length} da contattare, ${inAttesa.length} in attesa)`}
        </h2>
        {righe.length === 0 ? (
          <p className="text-sm text-zinc-500">Nessuno in lista d&apos;attesa al momento.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
            {[...proposte, ...inAttesa].map(rigaLista)}
          </ul>
        )}
      </section>
    </div>
  );
}
