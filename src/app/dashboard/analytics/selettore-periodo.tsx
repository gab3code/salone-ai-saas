import Link from "next/link";
import { PERIODI, type Periodo } from "@/lib/analytics";

/**
 * Il periodo da guardare.
 *
 * Quattro pillole in fila, non un menu a tendina. La demo pubblica di
 * Plausible (guardata il 17/09/2026 per capire come lo fanno gli altri) usa
 * una tendina con undici voci raggruppate -- Today, Realtime, Month to
 * Date, Year to Date, Custom Range... -- ed e' la scelta giusta per il loro
 * utente, uno sviluppatore che ci passa la giornata. Il nostro e' un
 * titolare di salone che apre questa pagina forse una volta a settimana: le
 * opzioni gli devono stare davanti agli occhi gia' aperte, e devono essere
 * poche.
 *
 * Sono `Link`, non bottoni con stato: il periodo sta nella barra degli
 * indirizzi, quindi la pagina si puo' ricaricare e mandare a qualcuno senza
 * perderlo, i dati si ricalcolano sul server e questo file non ha bisogno
 * di JavaScript nel browser.
 */
export function SelettorePeriodo({ attivo }: { attivo: Periodo }) {
  return (
    <div
      role="group"
      aria-label="Periodo da visualizzare"
      className="inline-flex rounded-xl border border-zinc-200 bg-white p-1"
    >
      {PERIODI.map((p) => {
        const selezionato = p.chiave === attivo.chiave;
        return (
          <Link
            key={p.chiave}
            href={`/dashboard/analytics?periodo=${p.chiave}`}
            aria-current={selezionato ? "true" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              selezionato
                ? "bg-zinc-900 font-medium text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {p.etichetta}
          </Link>
        );
      })}
    </div>
  );
}
