"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CalendarDays, Users, LayoutDashboard, Globe2, Settings, TrendingUp } from "lucide-react";
import { Reveal } from "./Reveal";
import { Grana } from "./Grana";

/**
 * Il dashboard "si apre" mentre si scorre, come se uscisse dallo schermo di
 * un laptop (ispirato al "MacBook Scroll" di Aceternity, riscritto da zero
 * con GSAP invece che con un vero mockup di laptop -- qui basta l'idea del
 * pannello che si raddrizza, senza bisogno di disegnare un MacBook).
 * Dati di esempio, mai spacciati per statistiche reali (stesso principio
 * della hero).
 */
export function ProdottoScroll() {
  const rifSezione = useRef<HTMLDivElement>(null);
  const rifSchermo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (!rifSezione.current || !rifSchermo.current) return;

    const tween = gsap.fromTo(
      rifSchermo.current,
      { rotateX: 26, scale: 0.8, y: 50 },
      {
        rotateX: 0,
        scale: 1,
        y: 0,
        ease: "none",
        scrollTrigger: {
          trigger: rifSezione.current,
          start: "top 85%",
          end: "top 20%",
          scrub: true,
        },
      }
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <section ref={rifSezione} className="relative overflow-hidden bg-noir py-20 sm:py-28">
      <Grana opacita={0.035} />
      <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-8" style={{ perspective: 1600 }}>
        <Reveal>
          <h2 className="text-sm font-medium text-violet-400">Il prodotto vero, non un rendering</h2>
          <p className="mx-auto mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            La stessa dashboard che useresti domani mattina.
          </p>
        </Reveal>

        <div
          ref={rifSchermo}
          className="relative mx-auto mt-14 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90 text-left shadow-2xl"
          style={{ transformStyle: "preserve-3d", transformOrigin: "50% 100%" }}
        >
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
            <span className="size-2.5 rounded-full bg-red-400/70" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-white/40">salone-ai-saas.vercel.app/dashboard</span>
          </div>

          <div className="grid grid-cols-[3rem_1fr] sm:grid-cols-[11rem_1fr]">
            <div className="hidden flex-col gap-1 border-r border-white/10 bg-white/[0.02] p-3 sm:flex">
              {[
                { icona: LayoutDashboard, testo: "Dashboard", attivo: true },
                { icona: CalendarDays, testo: "Calendario" },
                { icona: Users, testo: "Clienti" },
                { icona: Globe2, testo: "Pagina pubblica" },
                { icona: Settings, testo: "Impostazioni" },
              ].map((v) => (
                <div
                  key={v.testo}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs ${
                    v.attivo ? "bg-violet-500/15 text-violet-200" : "text-white/45"
                  }`}
                >
                  <v.icona className="size-3.5" /> {v.testo}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1 p-3 sm:hidden">
              {[LayoutDashboard, CalendarDays, Users, Globe2].map((Icona, i) => (
                <div key={i} className={`flex items-center justify-center rounded-lg p-2 ${i === 0 ? "bg-violet-500/15 text-violet-200" : "text-white/40"}`}>
                  <Icona className="size-3.5" />
                </div>
              ))}
            </div>

            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { etichetta: "Appuntamenti oggi", valore: "7" },
                  { etichetta: "Valore prenotato", valore: "€210" },
                  { etichetta: "Nuovi clienti (30gg)", valore: "12" },
                ].map((m) => (
                  <div key={m.etichetta} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] text-white/40">{m.etichetta}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{m.valore}</p>
                  </div>
                ))}
              </div>

              {/* Bug reale segnalato da Gabriel ("ha senso ma hai messo robe
                  a caso"): questa lista riusava lo stesso array
                  orario+servizio degli appuntamenti DI OGGI mostrati sopra --
                  sotto un titolo "3 clienti non prenotano da 60 giorni" non
                  ha senso mostrare orari di oggi. Un insight su clienti
                  inattivi non ha bisogno di orario/servizio, solo di chi
                  sono (nome + iniziale del cognome, come richiesto) e di
                  un'azione -- coerente con "un pulsante per contattare i
                  clienti inattivi" già promesso in Funzionalita.tsx. */}
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-white/50">
                  <TrendingUp className="size-3.5" /> 3 clienti non prenotano da 60 giorni
                </div>
                <div className="flex flex-col gap-1.5">
                  {["Elena T.", "Davide P.", "Francesca M."].map((nome) => (
                    <div key={nome} className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px]">
                      <span className="text-white/70">{nome}</span>
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">Contatta</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* base del "laptop": suggerisce lo schermo che si apre senza disegnarne uno intero */}
        <div className="mx-auto mt-1 h-2 w-[92%] rounded-b-xl bg-gradient-to-b from-zinc-800/80 to-zinc-900/40 sm:w-4/5" />
      </div>
    </section>
  );
}
