import { redirect } from "next/navigation";
import Link from "next/link";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import {
  creaOperatore,
  creaServizio,
  eliminaOperatore,
  eliminaServizio,
  impostaAssociazioneOperatoreServizio,
  salvaOrari,
} from "./azioni";
import { PannelloOnboardingAI } from "./PannelloOnboardingAI";
import { OnboardingWizard } from "./OnboardingWizard";

const NOMI_GIORNI = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

interface OrarioRiga {
  giorno_settimana: number;
  chiuso: boolean;
  apertura: string | null;
  chiusura: string | null;
  pausa_inizio: string | null;
  pausa_fine: string | null;
}

/**
 * Onboarding minimo: orari, operatori, servizi (Fase 1). Volutamente
 * spartano nella grafica -- vedi PIANO.md, la passata di design vera arriva
 * in una fase successiva quando tutto il funnel funziona davvero. Server Component puro:
 * ogni azione è un submit di form che rilegge i dati dal database, niente
 * stato client da tenere sincronizzato a mano.
 */
export default async function PaginaConfigura() {
  const supabase = await creaClientServer();
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) redirect("/accedi");
  const tenantId = sessione.tenantId;

  // Fase 5 (migrazione 0027): un dipendente vede com'è configurata
  // l'attività -- durate e prezzi gli servono per lavorare -- ma non ha
  // nessun form davanti. Il blocco vero è comunque nelle azioni
  // (`richiediPermesso` in azioni.ts), questa è solo l'interfaccia giusta.
  const soloLettura = !puoConfigurareAttivita(sessione.ruolo);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [orariRes, operatoriRes, serviziRes, opServiziRes, profiloRes] = await Promise.all([
    supabase.from("orari_apertura").select("*").eq("tenant_id", tenantId),
    supabase.from("operatori").select("id, nome, descrizione").eq("tenant_id", tenantId).order("nome"),
    supabase
      .from("servizi")
      .select("id, nome, durata_minuti, prezzo_centesimi")
      .eq("tenant_id", tenantId)
      .order("nome"),
    supabase.from("operatori_servizi").select("operatore_id, servizio_id"),
    user ? supabase.from("profiles").select("nome").eq("id", user.id).single() : Promise.resolve({ data: null }),
  ]);

  const orariPerGiorno = new Map<number, OrarioRiga>(
    (orariRes.data ?? []).map((r) => [r.giorno_settimana, r])
  );
  const operatori = operatoriRes.data ?? [];
  const servizi = serviziRes.data ?? [];
  const associazioni = new Set(
    (opServiziRes.data ?? []).map((r) => `${r.operatore_id}:${r.servizio_id}`)
  );
  const nomeTitolare = profiloRes.data?.nome || "Titolare";

  if (soloLettura) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Configurazione dell&apos;attività</h1>
          <p className="text-sm text-zinc-500">
            Qui vedi come è configurata l&apos;attività. Le modifiche le può fare il titolare.
          </p>
        </header>

        <section>
          <h2 className="text-base font-medium">Orari di apertura</h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {NOMI_GIORNI.map((nome, giorno) => {
              const riga = orariPerGiorno.get(giorno);
              const chiuso = riga?.chiuso ?? true;
              const pausa =
                riga?.pausa_inizio && riga?.pausa_fine
                  ? ` (pausa ${riga.pausa_inizio.slice(0, 5)}-${riga.pausa_fine.slice(0, 5)})`
                  : "";
              return (
                <li key={giorno} className="flex gap-3">
                  <span className="w-24 text-zinc-500">{nome}</span>
                  <span>
                    {chiuso
                      ? "Chiuso"
                      : `${riga?.apertura?.slice(0, 5) ?? "--"} - ${riga?.chiusura?.slice(0, 5) ?? "--"}${pausa}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-medium">Operatori</h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {operatori.map((o) => (
              <li key={o.id}>
                {o.nome}
                {o.descrizione && <span className="ml-2 text-xs text-zinc-500">{o.descrizione}</span>}
              </li>
            ))}
            {operatori.length === 0 && <li className="text-zinc-500">Nessun operatore configurato.</li>}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-medium">Servizi</h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {servizi.map((s) => (
              <li key={s.id}>
                {s.nome} · {s.durata_minuti} min · {(s.prezzo_centesimi / 100).toFixed(2)}€
              </li>
            ))}
            {servizi.length === 0 && <li className="text-zinc-500">Nessun servizio configurato.</li>}
          </ul>
        </section>

        <Link href="/dashboard" className="text-sm underline">
          Torna alla dashboard
        </Link>
      </main>
    );
  }

  // Onboarding a domande guidate (richiesta esplicita di Gabriel, 15/09/2026,
  // dopo aver provato di persona il flusso): un'attività ancora vuota (zero
  // operatori E zero servizi, non ha mai completato la configurazione) vede
  // subito il wizard a domande invece della stessa interfaccia "di base" di
  // chi la usa da mesi -- l'interfaccia manuale + "Compila con l'AI" restano
  // disponibili sotto un dettaglio richiudibile per chi preferisce comunque
  // configurare tutto a mano dall'inizio, mai nascosti del tutto.
  const vuoto = operatori.length === 0 && servizi.length === 0;

  // Bug trovato dal vivo 15/09/2026 durante il test dell'onboarding AI: subito
  // dopo "Applica alla configurazione" (PannelloOnboardingAI -> router.refresh()),
  // le checkbox "Chiuso" restavano visivamente con lo stato vecchio anche se i
  // dati salvati erano già corretti (confermato ricaricando la pagina). Causa:
  // gli input qui sotto sono non controllati (defaultChecked/defaultValue) --
  // React li imposta solo al primo mount e un router.refresh() non rimonta gli
  // elementi già presenti, si limita a riconciliarli. La soluzione più semplice
  // che resta nello spirito "niente stato client da sincronizzare a mano" del
  // resto della pagina: una `key` sul form che cambia quando cambiano i dati,
  // così React rimonta l'intero form (e quindi i default) invece di riusarlo.
  const chiaveOrari = NOMI_GIORNI.map((_, giorno) => {
    const r = orariPerGiorno.get(giorno);
    return `${giorno}:${r?.chiuso ?? ""}:${r?.apertura ?? ""}:${r?.chiusura ?? ""}:${r?.pausa_inizio ?? ""}:${r?.pausa_fine ?? ""}`;
  }).join("|");

  // Le tre sezioni "manuali" di sempre (orari/operatori/servizi + la tabella
  // di associazione) -- estratte in una variabile invece che ripetute due
  // volte nel JSX qui sotto: quando l'attività è vuota restano disponibili
  // ma richiuse dentro un <details> ("preferisci configurare a mano?"),
  // altrimenti sono mostrate esattamente come da sempre, invariate.
  const sezioniManuali = (
    <>
      {/* --- Orari di apertura --- */}
      <section>
        <h2 className="text-base font-medium">Orari di apertura</h2>
        <form
          key={chiaveOrari}
          action={async (formData: FormData) => {
            "use server";
            await salvaOrari(formData);
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <div className="grid grid-cols-[100px_auto_1fr_1fr_1fr_1fr] items-center gap-x-3 gap-y-2 text-sm">
            <span className="font-medium text-zinc-500">Giorno</span>
            <span className="font-medium text-zinc-500">Chiuso</span>
            <span className="font-medium text-zinc-500">Apertura</span>
            <span className="font-medium text-zinc-500">Chiusura</span>
            <span className="font-medium text-zinc-500">Pausa da</span>
            <span className="font-medium text-zinc-500">Pausa a</span>
            {NOMI_GIORNI.map((nome, giorno) => {
              const riga = orariPerGiorno.get(giorno);
              return (
                <div key={giorno} className="contents">
                  <span>{nome}</span>
                  <input
                    type="checkbox"
                    name={`chiuso_${giorno}`}
                    defaultChecked={riga?.chiuso ?? giorno === 0}
                  />
                  <input
                    type="time"
                    name={`apertura_${giorno}`}
                    defaultValue={riga?.apertura?.slice(0, 5) ?? "09:00"}
                    className="rounded border border-zinc-300 px-2 py-1"
                  />
                  <input
                    type="time"
                    name={`chiusura_${giorno}`}
                    defaultValue={riga?.chiusura?.slice(0, 5) ?? "19:00"}
                    className="rounded border border-zinc-300 px-2 py-1"
                  />
                  <input
                    type="time"
                    name={`pausa_inizio_${giorno}`}
                    defaultValue={riga?.pausa_inizio?.slice(0, 5) ?? ""}
                    className="rounded border border-zinc-300 px-2 py-1"
                  />
                  <input
                    type="time"
                    name={`pausa_fine_${giorno}`}
                    defaultValue={riga?.pausa_fine?.slice(0, 5) ?? ""}
                    className="rounded border border-zinc-300 px-2 py-1"
                  />
                </div>
              );
            })}
          </div>
          <button
            type="submit"
            className="mt-3 w-fit rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Salva orari
          </button>
        </form>
      </section>

      {/* --- Operatori --- */}
      <section>
        <h2 className="text-base font-medium">Operatori</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {operatori.map((o) => (
            <li key={o.id} className="flex items-center gap-3">
              <span className="min-w-40">
                {o.nome}
                {o.descrizione && <span className="ml-2 text-xs text-zinc-500">{o.descrizione}</span>}
              </span>
              <form
                action={async () => {
                  "use server";
                  await eliminaOperatore(o.id);
                }}
              >
                <button type="submit" className="text-xs text-red-600 underline">
                  Elimina
                </button>
              </form>
            </li>
          ))}
          {operatori.length === 0 && (
            <li className="text-zinc-500">Nessun operatore ancora, aggiungine uno sotto.</li>
          )}
        </ul>
        <form
          action={async (formData: FormData) => {
            "use server";
            await creaOperatore(formData);
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="nome_operatore" className="text-xs text-zinc-500">
              Nome operatore
            </label>
            <input
              id="nome_operatore"
              name="nome"
              required
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="descrizione_operatore" className="text-xs text-zinc-500">
              Descrizione/specializzazione (opzionale)
            </label>
            <input
              id="descrizione_operatore"
              name="descrizione"
              maxLength={500}
              className="w-64 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
            Aggiungi
          </button>
        </form>
      </section>

      {/* --- Servizi --- */}
      <section>
        <h2 className="text-base font-medium">Servizi</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {servizi.map((s) => (
            <li key={s.id} className="flex items-center gap-3">
              <span className="min-w-56">
                {s.nome} · {s.durata_minuti} min · {(s.prezzo_centesimi / 100).toFixed(2)}€
              </span>
              <form
                action={async () => {
                  "use server";
                  await eliminaServizio(s.id);
                }}
              >
                <button type="submit" className="text-xs text-red-600 underline">
                  Elimina
                </button>
              </form>
            </li>
          ))}
          {servizi.length === 0 && (
            <li className="text-zinc-500">Nessun servizio ancora, aggiungine uno sotto.</li>
          )}
        </ul>
        <form
          action={async (formData: FormData) => {
            "use server";
            await creaServizio(formData);
          }}
          className="mt-3 flex flex-wrap items-end gap-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="nome_servizio" className="text-xs text-zinc-500">
              Nome servizio
            </label>
            <input
              id="nome_servizio"
              name="nome"
              required
              className="rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="durata" className="text-xs text-zinc-500">
              Durata (min)
            </label>
            <input
              id="durata"
              name="durata_minuti"
              type="number"
              min={1}
              required
              className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="prezzo" className="text-xs text-zinc-500">
              Prezzo (€)
            </label>
            <input
              id="prezzo"
              name="prezzo_euro"
              type="number"
              min={0}
              step="0.01"
              required
              className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1.5 text-sm">
            Aggiungi
          </button>
        </form>
      </section>

      {/* --- Chi eroga cosa --- */}
      {operatori.length > 0 && servizi.length > 0 && (
        <section>
          <h2 className="text-base font-medium">Chi eroga quale servizio</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Un operatore compare come disponibile per un servizio solo se associato qui.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="p-2 text-left"> </th>
                  {servizi.map((s) => (
                    <th key={s.id} className="p-2 text-left font-medium text-zinc-500">
                      {s.nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operatori.map((o) => (
                  <tr key={o.id}>
                    <td className="p-2 font-medium">{o.nome}</td>
                    {servizi.map((s) => {
                      const associato = associazioni.has(`${o.id}:${s.id}`);
                      return (
                        <td key={s.id} className="p-2">
                          <form
                            action={async () => {
                              "use server";
                              await impostaAssociazioneOperatoreServizio(o.id, s.id, !associato);
                            }}
                          >
                            <button
                              type="submit"
                              className={
                                associato
                                  ? "rounded bg-black px-2 py-1 text-xs text-white"
                                  : "rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-500"
                              }
                            >
                              {associato ? "✓ associato" : "+ associa"}
                            </button>
                          </form>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );

  return (
    <div className="flex flex-1 flex-col gap-10 p-8">
      <div>
        <Link href="/dashboard" className="text-sm underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Configura l&apos;attività</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Orari, operatori e servizi: senza questi dati il calendario e l&apos;AI non hanno nulla
          su cui lavorare.
        </p>
      </div>

      {vuoto ? (
        <>
          <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
            <h2 className="text-base font-medium">Iniziamo a configurare la tua attività</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Rispondi a poche domande, l&apos;AI prepara una bozza da rivedere prima di salvarla --
              non scrive nulla senza la tua conferma.
            </p>
            <div className="mt-4">
              <OnboardingWizard nomeTitolare={nomeTitolare} />
            </div>
          </section>
          <details className="rounded-2xl border border-zinc-200 p-5">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600">
              Preferisci configurare tutto a mano?
            </summary>
            <div className="mt-4 flex flex-col gap-10">{sezioniManuali}</div>
          </details>
        </>
      ) : (
        <>
          {/* Fase 3 di PIANO.md: resta disponibile come opzione da riaprire
              per chi vuole aggiungere servizi/operatori/informazioni
              descrivendoli invece di compilare i form uno per uno -- il
              wizard a domande guidate sopra è pensato solo per il primo
              giro, quando l'attività è ancora vuota. */}
          <PannelloOnboardingAI evidenzia={false} />
          {sezioniManuali}
        </>
      )}
    </div>
  );
}
