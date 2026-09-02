import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import {
  creaOperatore,
  creaServizio,
  eliminaOperatore,
  eliminaServizio,
  impostaAssociazioneOperatoreServizio,
  salvaOrari,
} from "./azioni";

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
 * in Fase 7 quando tutto il funnel funziona davvero. Server Component puro:
 * ogni azione è un submit di form che rilegge i dati dal database, niente
 * stato client da tenere sincronizzato a mano.
 */
export default async function PaginaConfigura() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const [orariRes, operatoriRes, serviziRes, opServiziRes] = await Promise.all([
    supabase.from("orari_apertura").select("*").eq("tenant_id", tenantId),
    supabase.from("operatori").select("id, nome").eq("tenant_id", tenantId).order("nome"),
    supabase
      .from("servizi")
      .select("id, nome, durata_minuti, prezzo_centesimi")
      .eq("tenant_id", tenantId)
      .order("nome"),
    supabase.from("operatori_servizi").select("operatore_id, servizio_id"),
  ]);

  const orariPerGiorno = new Map<number, OrarioRiga>(
    (orariRes.data ?? []).map((r) => [r.giorno_settimana, r])
  );
  const operatori = operatoriRes.data ?? [];
  const servizi = serviziRes.data ?? [];
  const associazioni = new Set(
    (opServiziRes.data ?? []).map((r) => `${r.operatore_id}:${r.servizio_id}`)
  );

  return (
    <div className="flex flex-1 flex-col gap-10 p-8">
      <div>
        <a href="/dashboard" className="text-sm underline">
          ← Dashboard
        </a>
        <h1 className="mt-2 text-xl font-semibold">Configura il salone</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Orari, operatori e servizi: senza questi dati il calendario e l&apos;AI non hanno nulla
          su cui lavorare.
        </p>
      </div>

      {/* --- Orari di apertura --- */}
      <section>
        <h2 className="text-base font-medium">Orari di apertura</h2>
        <form
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
              <span className="min-w-40">{o.nome}</span>
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
          className="mt-3 flex items-end gap-2"
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
    </div>
  );
}
