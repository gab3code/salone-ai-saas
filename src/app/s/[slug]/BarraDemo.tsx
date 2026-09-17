import Link from "next/link";
import { SLUG_DEMO_GROWTH, SLUG_DEMO_PRO } from "@/lib/demo";

/**
 * La barra che dichiara che questo salone non esiste (Fase 6ter, 17/09/2026).
 *
 * Tre cose, in quest'ordine di importanza:
 *
 * 1. DIRE CHE E' FINTO, subito e senza giri di parole. Una demo che si
 *    spaccia per un'attivita' vera e' una bugia anche quando nessuno ci
 *    casca, e qui dentro si prenota davvero: chi arriva deve sapere che
 *    l'appuntamento che sta per prendere non lo aspetta nessuno.
 * 2. L'INTERRUTTORE GROWTH / PRO. E' il motivo per cui i saloni sono due.
 *    La differenza fra i piani smette di essere una riga in una tabella e
 *    diventa una cosa da provare: stessa identica pagina, stesso assistente,
 *    e su Pro risponde anche alle domande a cui su Growth direbbe di
 *    chiamare. Non si spiega, si fa provare.
 * 3. LA VIA D'USCITA verso la registrazione, per chi ha appena capito.
 *
 * Sta in alto e resta attaccata allo scorrimento: chi apre la chat a meta'
 * pagina non deve poter dimenticare dov'e'.
 */
export function BarraDemo({ slug }: { slug: string }) {
  const suPro = slug === SLUG_DEMO_PRO;

  return (
    <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-900 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <strong>Salone di prova.</strong>{" "}
          <span className="text-zinc-300">
            Non esiste: puoi prenotare davvero, ma non ti aspetta nessuno. Parla con l&apos;assistente in basso a
            destra.
          </span>
        </p>

        <div className="flex shrink-0 items-center gap-3">
          <div className="flex rounded-lg bg-zinc-800 p-0.5" role="group" aria-label="Piano da provare">
            <Link
              href={`/s/${SLUG_DEMO_GROWTH}`}
              aria-current={!suPro ? "true" : undefined}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                !suPro ? "bg-white text-zinc-900" : "text-zinc-300 hover:text-white"
              }`}
            >
              Growth
            </Link>
            <Link
              href={`/s/${SLUG_DEMO_PRO}`}
              aria-current={suPro ? "true" : undefined}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                suPro ? "bg-white text-zinc-900" : "text-zinc-300 hover:text-white"
              }`}
            >
              Pro
            </Link>
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
        {suPro ? (
          <>
            Su <strong className="text-zinc-200">Pro</strong> l&apos;assistente conosce anche l&apos;attivit&agrave;:
            prova a chiedergli dove si parcheggia, se fanno il colore vegetale o cosa succede se disdici tardi.
          </>
        ) : (
          <>
            Su <strong className="text-zinc-200">Growth</strong> l&apos;assistente prenota, sposta e disdice. Alle
            domande sull&apos;attivit&agrave; (&laquo;dove parcheggio?&raquo;) risponde di chiamare: quelle le sa
            solo da Pro. Prova a chiedergliele su tutti e due.
          </>
        )}
      </div>
    </div>
  );
}
