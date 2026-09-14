import type { ReactNode } from "react";
import { AuthHeader } from "@/components/landing/AuthHeader";
import { Grana } from "@/components/landing/Grana";

/**
 * Pagine legali (privacy/termini/cookie) -- PIANO.md Gruppo D punto 2, gap
 * trovato nel mega-controllo competitor del 12/09/2026: il progetto non ne
 * aveva nessuna, ogni concorrente verificato le ha, bloccante prima di
 * pubblicare il link di un salone vero.
 *
 * Stessa identità visiva dark/viola di /accedi e /registrati (AuthHeader +
 * Grana su `bg-noir`) invece di uno stile a parte solo per queste tre
 * pagine: sono comunque pagine pubbliche linkate dal footer della landing,
 * non pagine di lavoro della dashboard (quelle sono zinc/bianco di
 * proposito, vedi FlussoPrenotazione.tsx). Testo bianco all'80% di opacità
 * (non il 50-70% usato per le didascalie altrove): qui è il contenuto
 * principale della pagina, non un dettaglio secondario, serve più
 * contrasto per una lettura lunga.
 */
export function PaginaLegale({
  titolo,
  aggiornata,
  children,
}: {
  titolo: string;
  aggiornata: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-noir">
      <AuthHeader />
      <Grana opacita={0.04} />
      <div className="relative mx-auto max-w-3xl px-5 py-28 sm:px-8">
        <h1 className="text-3xl font-semibold text-white">{titolo}</h1>
        <p className="mt-2 text-sm text-white/40">Ultimo aggiornamento: {aggiornata}</p>
        <div className="mt-8 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-4 text-lg font-semibold text-white">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-white/80">{children}</p>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed text-white/80">{children}</ul>;
}
