import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";

/**
 * Torna sul calendario mostrando un errore, invece di scartarlo in silenzio.
 *
 * STA FUORI DAL COMPONENTE, e non e' un dettaglio di stile (18/09/2026).
 * Quando era una chiusura dentro il componente, le tre Server Action inline
 * di questa pagina la catturavano, e Next prova a serializzare tutto quello
 * che una Server Action cattura: una funzione non e' serializzabile, quindi
 * la pagina lanciava "Functions cannot be passed directly to Client
 * Components" e le azioni non facevano piu' niente.
 *
 * Il guaio e' che non si vedeva: nessun messaggio all'utente, il pulsante
 * cliccato, la pagina che si ricarica identica. Segnare un'assenza,
 * cancellare e spostare un appuntamento dal calendario -- la pagina piu'
 * usata della dashboard -- erano rotti tutti e tre. L'ha scoperto lo
 * Scenario 11, che verificava lo stato nel database invece di fidarsi dello
 * schermo.
 *
 * Regola che ne esce: una Server Action inline puo' catturare solo valori
 * serializzabili (stringhe, numeri, array di stringhe). Mai una funzione,
 * mai un oggetto come URLSearchParams.
 */
function tornaConErrore(
  errore: string,
  dataYMD: string,
  servizioIds: string[],
  operatoreId: string | null
): never {
  const parametri = new URLSearchParams({ data: dataYMD });
  for (const id of servizioIds) parametri.append("servizio_id", id);
  if (operatoreId) parametri.set("operatore_id", operatoreId);
  parametri.set("errore", errore);
  redirect(`/dashboard/calendario?${parametri.toString()}`);
}
import { trovaSlotDisponibiliTenant } from "@/lib/booking-engine.server";
import { pseudoUtcAReale, realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { cancellaAppuntamento, modificaAppuntamento, segnaNoShow } from "./azioni";
import { PannelloNuovoAppuntamento } from "./pannello-nuovo-appuntamento";
import { RiquadroProvaAssistente } from "./riquadro-prova-assistente";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { pianoPuoProvareAssistente, statoDemo } from "@/lib/ai/demo-assistente";

function oggiYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * L'istante di adesso, letto dentro una funzione e non nel corpo del
 * componente: la regola di purezza di React vieta una chiamata impura in
 * render (giustamente -- un valore che cambia a ogni riga renderebbe la
 * pagina non deterministica), e `oggiYMD` qui sopra segue già lo stesso
 * schema. Serve per sapere quali appuntamenti sono finiti.
 */
function adessoMs(): number {
  return Date.now();
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
  searchParams: Promise<{
    data?: string;
    // Servizi consecutivi (punto 12): più valori con la stessa chiave nella
    // query string (?servizio_id=a&servizio_id=b) -> Next li dà già come
    // array, un solo valore resta una stringa semplice.
    servizio_id?: string | string[];
    operatore_id?: string;
    modifica?: string;
    lista_attesa_avviso?: string;
    errore?: string;
  }>;
}) {
  const sp = await searchParams;
  const supabase = await creaClientServer();
  // `ottieniSessioneTenant` invece di `ottieniTenantCorrente`: serve anche
  // il ruolo, per decidere se mostrare il riquadro commerciale della prova
  // dell'assistente (Fase 5) -- un collaboratore non deve vederlo.
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) redirect("/accedi");
  const tenantId = sessione.tenantId;

  const dataYMD = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : oggiYMD();
  const servizioIds = sp.servizio_id ? (Array.isArray(sp.servizio_id) ? sp.servizio_id : [sp.servizio_id]) : [];
  const operatoreId = sp.operatore_id ?? "";
  const modificaId = sp.modifica ?? "";

  // Riga marcata "proposto" dalla cancellazione appena fatta (Fase 6, lista
  // d'attesa): un id opaco in querystring, mai il nome/telefono del cliente
  // direttamente -- letta qui sotto RLS, quindi solo se è davvero di questo
  // tenant. Nessun dato sensibile in URL (solo un uuid), coerente con
  // "modifica=<id>" già usato sopra.
  // Le azioni di questa pagina girano dentro form di Server Component, che
  // non hanno stato client per mostrare un errore. Fino all'audit del
  // 17/09/2026 l'esito veniva semplicemente SCARTATO: uno spostamento
  // rifiutato per conflitto d'orario, una cancellazione fallita o
  // un'assenza non salvata sparivano senza dire niente, e il titolare
  // restava convinto che fossero andate a buon fine. Nel caso dello
  // spostamento e' anche pericoloso: il salone crede il cliente spostato,
  // quel posto risulta libero e ci finisce qualcun altro.
  //
  // L'errore torna nell'indirizzo, che e' lo stesso meccanismo gia' usato
  // qui sotto per il banner della lista d'attesa.

  const avvisoListaAttesa = sp.lista_attesa_avviso
    ? (
        await supabase
          .from("lista_attesa")
          .select("cliente_nome, cliente_telefono, servizi(nome)")
          .eq("id", sp.lista_attesa_avviso)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      ).data
    : null;

  const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
  // dataYMD è un giorno "civile" del salone (pseudo-UTC): i confini reali
  // per interrogare la colonna timestamptz vera si ottengono convertendo
  // gli estremi pseudo del giorno, non usando le stringhe direttamente
  // come se fossero già tempo reale (vedi src/lib/fuso-orario.ts).
  const inizioGiornoReale = pseudoUtcAReale(new Date(`${dataYMD}T00:00:00Z`), fusoOrario);
  const fineGiornoReale = pseudoUtcAReale(new Date(`${giornoAdiacente(dataYMD, 1)}T00:00:00Z`), fusoOrario);

  const [operatoriRes, serviziRes, appuntamentiRes, tenantRes] = await Promise.all([
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
      .gte("inizio", inizioGiornoReale.toISOString())
      .lt("inizio", fineGiornoReale.toISOString())
      .neq("stato", "cancellato")
      .order("inizio"),
    supabase.from("tenants").select("piano, demo_ai_mese, demo_ai_usate").eq("id", tenantId).single(),
  ]);

  // Il riquadro "guarda cosa avrebbe risposto l'assistente" (Fase 5): si
  // mostra solo sui piani che l'assistente NON ce l'hanno, e solo a chi puo'
  // configurare l'attivita' -- un collaboratore non deve nemmeno vedere una
  // proposta commerciale che non e' sua da accettare. Il gate sul ruolo e'
  // comunque ricontrollato nella server action: qui decide solo cosa
  // disegnare.
  const mostraProvaAssistente =
    pianoPuoProvareAssistente(tenantRes.data?.piano ?? "") && puoConfigurareAttivita(sessione.ruolo);
  const proveRimaste = statoDemo(
    tenantRes.data?.demo_ai_mese ?? null,
    tenantRes.data?.demo_ai_usate ?? 0,
    new Date()
  ).rimaste;

  const operatori = (operatoriRes.data ?? []).map((o) => ({ id: o.id, nome: o.nome }));
  const servizi = (serviziRes.data ?? []).map((s) => ({
    id: s.id,
    nome: s.nome,
    durataMinuti: s.durata_minuti,
  }));
  // Righe grezze convertite subito in pseudo-UTC: da qui in giù (display e
  // form di modifica) tutto il resto della pagina ragiona nella stessa
  // convenzione di sempre, mai un istante reale in mezzo al JSX.
  // Una volta sola, non dentro il map.
  const adesso = adessoMs();

  const appuntamenti = (appuntamentiRes.data ?? []).map((a) => ({
    ...a,
    inizio: realeAPseudoUtc(new Date(a.inizio), fusoOrario).toISOString(),
    fine: realeAPseudoUtc(new Date(a.fine), fusoOrario).toISOString(),
  }));

  let slots: { operatoreId: string; inizio: string }[] = [];
  if (servizioIds.length > 0) {
    const slotsCalcolati = await trovaSlotDisponibiliTenant(supabase, tenantId, {
      data: new Date(`${dataYMD}T00:00:00Z`),
      servizioIds,
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

      {sp.errore && (
        <p
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {sp.errore}
        </p>
      )}

      {avvisoListaAttesa && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          🔔 Lo slot appena liberato era atteso da{" "}
          <strong>
            {avvisoListaAttesa.cliente_nome || "un cliente"} · {avvisoListaAttesa.cliente_telefono}
          </strong>{" "}
          (
          {Array.isArray(avvisoListaAttesa.servizi)
            ? avvisoListaAttesa.servizi[0]?.nome
            : (avvisoListaAttesa.servizi as { nome: string } | null)?.nome}
          ) -- contattalo per riproporglielo. Vedi anche{" "}
          <a href="/dashboard/lista-attesa" className="underline">
            Lista d&apos;attesa
          </a>
          .
        </p>
      )}

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
              const inModifica = modificaId === a.id;
              const eFinito = new Date(a.fine).getTime() <= adesso;
              const eAssente = a.stato === "no_show";
              const parametriSenzaModifica = new URLSearchParams({ data: dataYMD });
              for (const id of servizioIds) parametriSenzaModifica.append("servizio_id", id);
              if (operatoreId) parametriSenzaModifica.set("operatore_id", operatoreId);
              // Stessa regola: la Server Action qui sotto cattura la STRINGA,
              // non l'oggetto URLSearchParams, che non e' serializzabile.
              const queryBase = parametriSenzaModifica.toString();

              return (
                <li key={a.id} className="rounded border border-zinc-200 p-3">
                  <div className="flex items-center justify-between gap-3">
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
                    <div className="flex items-center gap-3 text-xs">
                      {eAssente && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                          non si è presentato
                        </span>
                      )}
                      {/* Il pulsante compare solo su un appuntamento finito:
                          segnare assente qualcuno che deve ancora arrivare
                          non è un caso d'uso, è un errore di clic. */}
                      {eFinito && (
                        <form
                          action={async () => {
                            "use server";
                            const esito = await segnaNoShow(a.id, !eAssente);
                            if (esito?.errore) tornaConErrore(esito.errore, dataYMD, servizioIds, operatoreId);
                          }}
                        >
                          <button type="submit" className="underline text-amber-700">
                            {eAssente ? "Annulla assenza" : "Non si è presentato"}
                          </button>
                        </form>
                      )}
                      <a
                        href={`/dashboard/calendario?${parametriSenzaModifica.toString()}&modifica=${a.id}`}
                        className="underline"
                      >
                        {inModifica ? "Modifica in corso" : "Modifica"}
                      </a>
                      <form
                        action={async () => {
                          "use server";
                          const risultato = await cancellaAppuntamento(a.id);
                          if ("errore" in risultato && risultato.errore)
                            tornaConErrore(risultato.errore, dataYMD, servizioIds, operatoreId);
                          // Match in lista d'attesa (Fase 6): torna sulla stessa vista con
                          // l'id della riga da segnalare, così il banner sopra compare subito
                          // senza dover aprire /dashboard/lista-attesa per accorgersene.
                          if ("listaAttesaAvvisata" in risultato && risultato.listaAttesaAvvisata) {
                            const parametri = new URLSearchParams(queryBase);
                            parametri.set("lista_attesa_avviso", risultato.listaAttesaAvvisata.id);
                            redirect(`/dashboard/calendario?${parametri.toString()}`);
                          }
                        }}
                      >
                        <button type="submit" className="text-red-600 underline">
                          Cancella
                        </button>
                      </form>
                    </div>
                  </div>

                  {inModifica && (
                    <form
                      action={async (formData: FormData) => {
                        "use server";
                        const esito = await modificaAppuntamento(a.id, formData);
                        if (esito?.errore) tornaConErrore(esito.errore, dataYMD, servizioIds, operatoreId);
                      }}
                      className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-3"
                    >
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500">Nuovo operatore</label>
                        <select
                          name="operatore_id"
                          defaultValue={a.operatore_id ?? ""}
                          className="rounded border border-zinc-300 px-2 py-1 text-sm"
                        >
                          {operatori.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500">Nuovo orario</label>
                        <input
                          type="datetime-local"
                          name="inizio"
                          defaultValue={new Date(a.inizio).toISOString().slice(0, 16)}
                          className="rounded border border-zinc-300 px-2 py-1 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white"
                      >
                        Salva spostamento
                      </button>
                      <a
                        href={`/dashboard/calendario?${parametriSenzaModifica.toString()}`}
                        className="text-xs underline"
                      >
                        Annulla
                      </a>
                    </form>
                  )}
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
            vai a Configura l&apos;attività
          </a>
          .
        </p>
      ) : (
        <PannelloNuovoAppuntamento
          operatori={operatori}
          servizi={servizi}
          slots={slots}
          servizioIdsIniziali={servizioIds}
          operatoreIdIniziale={operatoreId}
          dataIniziale={dataYMD}
          provaAssistente={
            mostraProvaAssistente ? <RiquadroProvaAssistente rimasteIniziali={proveRimaste} /> : undefined
          }
        />
      )}
    </div>
  );
}
