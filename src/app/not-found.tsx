import Link from "next/link";
import { Grana } from "@/components/landing/Grana";

/**
 * 404 custom (controllo approfondito pre-pubblicazione, 12/09/2026):
 * prima non esisteva nessun `not-found.tsx`, quindi Next mostrava la sua
 * pagina di default -- sfondo bianco, "404 | This page could not be found",
 * zero brand -- l'esatto opposto della landing curata a mano. Capita
 * facilmente nel mondo reale (un link a `/s/<slug-sbagliato>` da un post
 * social, un salone che chiude e cancella il proprio account): vale la pena
 * che anche questa pagina sembri parte dello stesso prodotto, non un errore
 * di sistema. Stesso sfondo/grana/palette della landing, nessuna nuova
 * dipendenza -- solo componenti già esistenti.
 */
export default function NonTrovata() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-noir px-6 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(55% 50% at 50% 40%, rgba(124,58,237,0.18), transparent 70%)" }}
      />
      <Grana opacita={0.045} />

      <Link
        href="/"
        className="relative mb-10 text-sm font-semibold tracking-tight text-white/70 transition-colors hover:text-white"
      >
        Salone AI
      </Link>

      <p className="relative text-sm font-medium text-violet-400">Errore 404</p>
      <h1 className="relative mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Questa pagina non esiste (più).
      </h1>
      <p className="relative mx-auto mt-3 max-w-md text-white/60">
        Il link potrebbe essere sbagliato, o la pagina che cercavi non è più disponibile.
      </p>

      <Link
        href="/"
        className="relative mt-8 rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-900 shadow-lg shadow-white/10 transition-transform hover:scale-105"
      >
        Torna alla home
      </Link>
    </div>
  );
}
