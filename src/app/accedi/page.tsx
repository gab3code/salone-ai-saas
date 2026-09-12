"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { creaClientBrowser } from "@/lib/supabase/client";
import { Grana } from "@/components/landing/Grana";
import { AuthHeader } from "@/components/landing/AuthHeader";

/**
 * Ristilizzata insieme a /registrati (controllo approfondito pre-
 * pubblicazione, 12/09/2026) -- stessa identità dark/viola della landing
 * invece del form HTML nudo di prima. Logica di accesso invariata.
 *
 * Header sostituito (terzo giro, richiesta di Gabriel: "devo comunque avere
 * il titolo del mio sito sopra, esteticamente bello, che se clicco mi fa
 * tornare alla landing page") -- prima era solo un link di testo centrato
 * sopra il form, facile da scambiare per una scritta decorativa. AuthHeader
 * è condiviso con /registrati (stessa barra fissa in cima, stesso
 * linguaggio della navbar della landing).
 */
export default function PaginaAccesso() {
  const router = useRouter();
  const supabase = creaClientBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function accedi(evento: React.FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setCaricamento(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setCaricamento(false);
    if (error) {
      setErrore(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const classeCampo =
    "w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-violet-400/60 focus:bg-white/[0.07]";
  const classeEtichetta = "text-sm font-medium text-white/70";

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-noir p-6 py-24 sm:p-8 sm:py-28">
      <AuthHeader />
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(124,58,237,0.16), transparent 70%)" }}
      />
      <Grana opacita={0.04} />

      <div className="relative w-full max-w-sm">
        <form onSubmit={accedi} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8">
          <div className="mb-2 text-center">
            <h1 className="text-xl font-semibold text-white">Bentornato</h1>
            <p className="mt-1 text-sm text-white/50">Accedi al tuo pannello.</p>
          </div>

          <div className="space-y-1.5">
            <label className={classeEtichetta} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={classeCampo}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className={classeEtichetta} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={classeCampo}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errore && <p className="text-sm text-red-400">{errore}</p>}

          <button
            type="submit"
            disabled={caricamento}
            className="w-full rounded-full bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {caricamento ? "Accesso in corso..." : "Accedi"}
          </button>

          <p className="text-center text-sm text-white/50">
            Non hai un account?{" "}
            <Link className="text-white underline underline-offset-2" href="/registrati">
              Registrati
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
