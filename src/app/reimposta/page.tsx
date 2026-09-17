"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { creaClientBrowserRecupero } from "@/lib/supabase/client";
import { problemaPasswordRipetuta, LUNGHEZZA_MINIMA_PASSWORD } from "@/lib/password";
import { Grana } from "@/components/landing/Grana";
import { AuthHeader } from "@/components/landing/AuthHeader";
import { useSpotlightScuro } from "@/components/landing/SpotlightScuro";

/**
 * La pagina su cui atterra il link ricevuto per email (17/09/2026).
 *
 * Tre stati, non uno: mentre si controlla il link, link valido (si mostra il
 * form), link non valido o scaduto (si spiega cosa fare). Il terzo caso non
 * e' un dettaglio: un link di recupero scade, e la persona che ci arriva
 * sopra e' gia' in difficolta' -- un form che non funziona senza dire perche'
 * la lascerebbe a pensare di aver sbagliato lei.
 *
 * Supabase consuma da solo il token che arriva nel frammento
 * dell'indirizzo (vedi creaClientBrowserRecupero). Qui si aspetta che abbia
 * finito e si guarda se ne e' uscita una sessione.
 */

type Stato = "controllo" | "pronto" | "linkNonValido";

export default function PaginaReimpostazione() {
  const router = useRouter();
  const [supabase] = useState(() => creaClientBrowserRecupero());
  const { sfondo, alMuovimento } = useSpotlightScuro(false);

  const [stato, setStato] = useState<Stato>("controllo");
  const [password, setPassword] = useState("");
  const [ripetuta, setRipetuta] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;

    async function controllaLink() {
      // Caso PKCE: il link porta un ?code= invece del token nel frammento.
      // Non e' il flusso che usiamo oggi, ma un link vecchio -- o un domani
      // in cui si torna a PKCE -- non deve rompersi in silenzio.
      const codice = new URLSearchParams(window.location.search).get("code");
      if (codice) {
        const { error } = await supabase.auth.exchangeCodeForSession(codice);
        if (!vivo) return;
        setStato(error ? "linkNonValido" : "pronto");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      setStato(data.session ? "pronto" : "linkNonValido");
    }

    // Un giro dell'event loop: con detectSessionInUrl Supabase legge il
    // frammento subito dopo il montaggio, e chiedere la sessione nello
    // stesso istante la troverebbe ancora vuota.
    const attesa = setTimeout(controllaLink, 0);

    return () => {
      vivo = false;
      clearTimeout(attesa);
    };
  }, [supabase]);

  async function reimposta(evento: React.FormEvent) {
    evento.preventDefault();

    const problema = problemaPasswordRipetuta(password, ripetuta);
    if (problema) {
      setErrore(problema);
      return;
    }

    setErrore(null);
    setCaricamento(true);
    const { error } = await supabase.auth.updateUser({ password });
    setCaricamento(false);

    if (error) {
      // Il caso piu' comune qui e' "la nuova password e' uguale alla
      // vecchia": va detto con parole sue, non con il messaggio inglese.
      setErrore(
        error.message.toLowerCase().includes("should be different")
          ? "La nuova password deve essere diversa da quella di prima."
          : "Non sono riuscito a cambiare la password. Riprova, o chiedi un link nuovo."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
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
        {stato === "controllo" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-2xl sm:p-8">
            <p className="text-sm text-white/50">Un attimo...</p>
          </div>
        )}

        {stato === "linkNonValido" && (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-2xl sm:p-8">
            <h1 className="text-xl font-semibold text-white">Questo link non vale piu&apos;</h1>
            <p className="text-sm text-white/60">
              I link di recupero durano un&apos;ora e si usano una volta sola. Chiedine un altro: ci
              vuole un momento.
            </p>
            <Link
              className="inline-block rounded-full bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-transform hover:scale-[1.02]"
              href="/recupera"
            >
              Chiedi un link nuovo
            </Link>
          </div>
        )}

        {stato === "pronto" && (
          <form
            onSubmit={reimposta}
            className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8"
          >
            <div className="mb-2 text-center">
              <h1 className="text-xl font-semibold text-white">Scegli una password nuova</h1>
              <p className="mt-1 text-sm text-white/50">
                Almeno {LUNGHEZZA_MINIMA_PASSWORD} caratteri. Poi entri subito nel pannello.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className={classeEtichetta} htmlFor="password">
                Password nuova
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className={classeCampo}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className={classeEtichetta} htmlFor="ripetuta">
                Ripetila
              </label>
              <input
                id="ripetuta"
                type="password"
                autoComplete="new-password"
                className={classeCampo}
                value={ripetuta}
                onChange={(e) => setRipetuta(e.target.value)}
                required
              />
            </div>

            {errore && <p className="text-sm text-red-400">{errore}</p>}

            <button
              type="submit"
              disabled={caricamento}
              className="w-full rounded-full bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {caricamento ? "Salvataggio..." : "Salva e entra"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
