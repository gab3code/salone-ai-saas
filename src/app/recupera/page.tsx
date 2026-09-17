"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { creaClientBrowserRecupero } from "@/lib/supabase/client";
import { Grana } from "@/components/landing/Grana";
import { AuthHeader } from "@/components/landing/AuthHeader";
import { useSpotlightScuro } from "@/components/landing/SpotlightScuro";

/**
 * "Ho dimenticato la password" (17/09/2026).
 *
 * Fino a oggi un titolare che perdeva la password non aveva NESSUN modo di
 * rientrare nel proprio pannello: era l'unica voce dell'audit segnata come
 * "deve esistere prima del primo cliente pagante".
 *
 * La pagina risponde SEMPRE la stessa cosa, che l'email esista o no. Non e'
 * pigrizia: se rispondesse "questa email non e' registrata" diventerebbe uno
 * strumento gratuito per scoprire chi e' nostro cliente e chi no, provando
 * indirizzi a caso. Il prezzo e' che chi sbaglia a digitare la propria email
 * aspetta un messaggio che non arrivera' mai -- per questo il testo di
 * conferma dice esplicitamente di controllare l indirizzo scritto.
 */
export default function PaginaRecupero() {
  const supabase = creaClientBrowserRecupero();
  const { sfondo, alMuovimento } = useSpotlightScuro(false);

  const [email, setEmail] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function chiediRecupero(evento: React.FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setCaricamento(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reimposta`,
    });

    setCaricamento(false);

    // Un errore di RETE lo diciamo (altrimenti la persona aspetta un email
    // che non e' mai partita). Un errore che rivela se l'account esiste,
    // no: si mostra comunque la conferma.
    if (error && error.status !== 400 && error.status !== 422) {
      setErrore("Non riesco a inviare il messaggio adesso. Riprova fra poco.");
      return;
    }

    setInviato(true);
  }

  const classeCampo =
    "w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-violet-400/60 focus:bg-white/[0.07]";
  const classeEtichetta = "text-sm font-medium text-white/70";

  return (
    <div
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-noir p-6 py-24 sm:p-8 sm:py-28"
      onPointerMove={alMuovimento}
    >
      <AuthHeader />
      <motion.div className="pointer-events-none fixed inset-0" style={{ background: sfondo, filter: "blur(30px)" }} />
      <Grana opacita={0.04} />

      <div className="relative w-full max-w-sm">
        {inviato ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-2xl sm:p-8">
            <h1 className="text-xl font-semibold text-white">Controlla la posta</h1>
            <p className="text-sm text-white/60">
              Se esiste un account con questo indirizzo, fra poco ricevi un messaggio con il link per
              scegliere una password nuova. Il link vale un&apos;ora e si usa una volta sola.
            </p>
            <p className="text-sm text-white/40">
              Non arriva niente? Guarda nello spam, e controlla di aver scritto bene l&apos;indirizzo.
            </p>
            <Link
              className="inline-block text-sm text-white underline underline-offset-2"
              href="/accedi"
            >
              Torna all&apos;accesso
            </Link>
          </div>
        ) : (
          <form
            onSubmit={chiediRecupero}
            className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-2 text-center">
              <h1 className="text-xl font-semibold text-white">Password dimenticata</h1>
              <p className="mt-1 text-sm text-white/50">
                Scrivi la tua email: ti mandiamo un link per sceglierne una nuova.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className={classeEtichetta} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={classeCampo}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {errore && <p className="text-sm text-red-400">{errore}</p>}

            <button
              type="submit"
              disabled={caricamento}
              className="w-full rounded-full bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {caricamento ? "Invio in corso..." : "Mandami il link"}
            </button>

            <p className="text-center text-sm text-white/50">
              Te la sei ricordata?{" "}
              <Link className="text-white underline underline-offset-2" href="/accedi">
                Accedi
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
