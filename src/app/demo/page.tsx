import Link from "next/link";
import { ChatDemo } from "./ChatDemo";
import {
  DESCRIZIONE_SALONE_DEMO,
  INDIRIZZO_SALONE_DEMO,
  NOME_SALONE_DEMO,
  OPERATORI_DEMO,
  SERVIZI_DEMO,
} from "@/lib/demo/salone-finto";

/**
 * La demo pubblica (Fase 6ter).
 *
 * Terza forma in un giorno, e le prime due erano saloni VERI nel database --
 * buttate perche' un tenant demo e' indistinguibile da un salone vero per
 * tutto il resto del sistema, e perche' il suo link pubblico si poteva dare
 * ai propri clienti (che poi si presentavano a un appuntamento cancellato
 * dalla pulizia). Ragionamento intero in `docs/brief-demo-senza-rischi.md`.
 *
 * Qui non si scrive niente da nessuna parte: il salone e' una costante, e
 * l'agenda vive nello stato della pagina di chi sta guardando. Due
 * conseguenze, ed erano le due richieste di Gabriel:
 *  - non e' uguale per tutti: ogni visitatore ha la sua agenda, e nessuno
 *    puo' occupargli gli slot;
 *  - non si puo' usare come salone vero, perche' non c'e' nessun indirizzo
 *    da dare ai propri clienti e niente sopravvive alla scheda chiusa.
 *
 * L'interruttore Growth/Pro non e' un vezzo: e' il miglior argomento di
 * vendita per Pro che abbiamo, perche' la differenza fra i due piani si
 * prova invece di leggerla in una tabella.
 */
export default async function PaginaDemo({
  searchParams,
}: {
  searchParams: Promise<{ piano?: string }>;
}) {
  const { piano: pianoScelto } = await searchParams;
  const piano: "growth" | "pro" = pianoScelto === "pro" ? "pro" : "growth";

  const perCategoria = new Map<string, typeof SERVIZI_DEMO>();
  for (const s of SERVIZI_DEMO) {
    perCategoria.set(s.categoria, [...(perCategoria.get(s.categoria) ?? []), s] as typeof SERVIZI_DEMO);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900 text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <strong>Salone di prova.</strong>{" "}
            <span className="text-zinc-300">
              Non esiste e non lo vede nessun altro: quello che prenoti qui resta solo sul tuo schermo.
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex rounded-lg bg-zinc-800 p-0.5" role="group" aria-label="Piano da provare">
              {(["growth", "pro"] as const).map((p) => (
                <Link
                  key={p}
                  href={`/demo?piano=${p}`}
                  aria-current={piano === p ? "true" : undefined}
                  className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${
                    piano === p ? "bg-white text-zinc-900" : "text-zinc-300 hover:text-white"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
            <Link
              href="/registrati"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 hover:bg-zinc-200"
            >
              Provalo sul tuo salone
            </Link>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-3 text-xs text-zinc-400">
          {piano === "pro" ? (
            <>
              Su <strong className="text-zinc-200">Pro</strong> l&apos;assistente conosce anche
              l&apos;attivit&agrave;: chiedigli dove si parcheggia o se fanno il colore vegetale.
            </>
          ) : (
            <>
              Su <strong className="text-zinc-200">Growth</strong> l&apos;assistente prenota, sposta e disdice. Alle
              domande sull&apos;attivit&agrave; risponde di chiamare: quelle le sa solo da Pro. Prova a
              chiedergliele su tutti e due.
            </>
          )}
        </div>
      </div>

      <header className="bg-zinc-900 pb-12 text-white">
        <div className="mx-auto max-w-5xl px-4 pt-10">
          <h1 className="text-3xl font-semibold sm:text-4xl">{NOME_SALONE_DEMO}</h1>
          <p className="mt-3 max-w-xl text-zinc-300">{DESCRIZIONE_SALONE_DEMO}</p>
          <p className="mt-4 text-sm text-zinc-400">{INDIRIZZO_SALONE_DEMO}</p>
        </div>
      </header>

      <main className="mx-auto -mt-8 grid max-w-5xl gap-6 px-4 pb-16 lg:grid-cols-[1fr_24rem]">
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-medium text-zinc-900">Servizi</h2>
            <div className="mt-4 flex flex-col gap-5">
              {[...perCategoria.entries()].map(([categoria, servizi]) => (
                <div key={categoria}>
                  <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">{categoria}</p>
                  <ul className="mt-2 flex flex-col divide-y divide-zinc-100">
                    {servizi.map((s) => (
                      <li key={s.id} className="flex items-baseline justify-between gap-4 py-2">
                        <span className="text-sm text-zinc-800">
                          {s.nome}
                          <span className="ml-2 text-xs text-zinc-400">{s.durataMinuti} min</span>
                        </span>
                        <span className="text-sm font-medium text-zinc-900 tabular-nums">
                          {(s.prezzoCentesimi / 100).toFixed(2).replace(".", ",")} &euro;
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-medium text-zinc-900">Chi lavora qui</h2>
            <ul className="mt-3 flex flex-wrap gap-4">
              {OPERATORI_DEMO.map((o) => (
                <li key={o.id} className="text-sm">
                  <span className="font-medium text-zinc-900">{o.nome}</span>
                  <span className="text-zinc-500"> — {o.ruolo}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-zinc-500">
              Non sanno fare tutti tutto, come in un salone vero: chiedi la barba e vedrai che
              l&apos;assistente ti propone Luca, non Giulia.
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-medium text-zinc-900">Orari</h2>
            <p className="mt-2 text-sm text-zinc-700">Da martedì a sabato, 9:00-13:00 e 14:00-19:00.</p>
            <p className="text-sm text-zinc-500">Domenica e lunedì chiuso.</p>
          </section>
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <ChatDemo piano={piano} />
        </aside>
      </main>
    </div>
  );
}
