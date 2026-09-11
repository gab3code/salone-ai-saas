"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Calendar, Globe2, MessageSquareText, RefreshCw, Check } from "lucide-react";
import { Reveal } from "./Reveal";
import { Grana } from "./Grana";

/**
 * Vetrina scroll-driven dei 3 differenziatori principali del prodotto --
 * questa è la sezione "vetrina" vera della landing (richiesta di Gabriel
 * dell'11/09/2026 di spingere di più su GSAP/Framer Motion invece di un
 * semplice bento statico): un pannello resta fisso mentre si scorre, e
 * cambia scena in base a quanto si è scrollato -- pattern da vero
 * "scrollytelling" (GSAP ScrollTrigger con pin+scrub), non un fade-in a caso.
 */
const SCENE = [
  {
    titolo: "Un unico motore di prenotazione",
    testo:
      "Calendario, pagina pubblica e assistente AI leggono e scrivono sugli stessi appuntamenti in tempo reale -- mai due sistemi che raccontano storie diverse.",
    icona: RefreshCw,
  },
  {
    titolo: "La tua pagina pubblica",
    testo: "Un link tutto tuo dove i clienti scelgono servizio, orario e prenotano da soli, 24 ore su 24.",
    icona: Globe2,
  },
  {
    titolo: "L'assistente AI, sempre presente",
    testo: "Risponde a domande su orari e prezzi e prenota da sola -- e passa la mano a te quando serve davvero una persona.",
    icona: MessageSquareText,
  },
];

function VisualeScena({ indice }: { indice: number }) {
  if (indice === 1) {
    return (
      <div className="w-full max-w-xs overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-3 py-2">
          <span className="size-2 rounded-full bg-red-400/70" />
          <span className="size-2 rounded-full bg-amber-400/70" />
          <span className="size-2 rounded-full bg-emerald-400/70" />
        </div>
        <div className="space-y-2 p-4">
          <div className="h-2.5 w-2/3 rounded bg-white/20" />
          <div className="h-2 w-1/2 rounded bg-white/10" />
          <div className="mt-3 flex gap-2">
            {["Taglio", "Colore", "Piega"].map((s) => (
              <span key={s} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white/70">
                {s}
              </span>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-violet-500/20 px-3 py-2 text-[11px] text-violet-200">
            Ven 15 · 16:30 disponibile
          </div>
        </div>
      </div>
    );
  }

  if (indice === 2) {
    return (
      <div className="flex w-full max-w-xs flex-col gap-2">
        <div className="self-end rounded-2xl rounded-br-sm bg-white/10 px-3 py-2 text-xs text-white/80">
          Siete aperti domenica?
        </div>
        <div className="self-start rounded-2xl rounded-bl-sm bg-gradient-to-br from-violet-500/80 to-fuchsia-500/80 px-3 py-2 text-xs text-white">
          Siamo chiusi la domenica, ma sabato ho le 11:00 libere!
        </div>
        <div className="mt-1 flex items-center gap-1.5 self-start text-[11px] text-emerald-400">
          <Check className="size-3" /> Nessuno del salone ha dovuto rispondere
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-xs grid-cols-3 gap-2">
      {[Calendar, Globe2, MessageSquareText].map((Icona, i) => (
        <div key={i} className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
          <Icona className="size-4 text-violet-300" />
          <span className="h-1.5 w-full rounded bg-white/15" />
        </div>
      ))}
      <div className="col-span-3 mt-1 rounded-lg bg-white/5 px-3 py-2 text-center text-[11px] text-white/50">
        stessi dati, ovunque
      </div>
    </div>
  );
}

export function Vetrina() {
  const [attivo, setAttivo] = useState(0);
  const contenitoreRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (!contenitoreRef.current || !pinRef.current) return;

    const trigger = ScrollTrigger.create({
      trigger: contenitoreRef.current,
      start: "top top+=72",
      end: "bottom bottom",
      pin: pinRef.current,
      pinSpacing: false,
      scrub: true,
      onUpdate: (self) => {
        const indice = Math.min(SCENE.length - 1, Math.floor(self.progress * SCENE.length));
        setAttivo(indice);
      },
    });

    return () => trigger.kill();
  }, []);

  return (
    <section className="relative overflow-hidden bg-zinc-950 py-4">
      <Grana opacita={0.035} />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="pt-16">
          <h2 className="text-sm font-medium text-violet-400">Perché è diverso</h2>
          <p className="mt-2 max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Non è un altro calendario online.
          </p>
        </Reveal>

        {/* contenitore alto 3x lo schermo: GSAP anima "attivo" mentre lo si
            attraversa scrollando, il pannello di destra resta fisso (pin) */}
        <div ref={contenitoreRef} className="relative mt-8 h-[300vh]">
          <div ref={pinRef} className="grid gap-10 py-10 lg:grid-cols-2 lg:items-center">
            <div className="order-2 flex flex-col gap-3 lg:order-1">
              {SCENE.map((s, i) => (
                <button
                  key={s.titolo}
                  type="button"
                  onClick={() => {
                    setAttivo(i);
                    const target = contenitoreRef.current;
                    if (!target) return;
                    const y = target.offsetTop + (target.offsetHeight * i) / SCENE.length + 20;
                    window.scrollTo({ top: y, behavior: "smooth" });
                  }}
                  className={`rounded-2xl border p-5 text-left transition-colors duration-300 ${
                    attivo === i ? "border-violet-500/50 bg-white/5" : "border-white/5 bg-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
                        attivo === i ? "bg-violet-500 text-white" : "bg-white/5 text-white/40"
                      }`}
                    >
                      <s.icona className="size-4" />
                    </span>
                    <h3 className={`text-[15px] font-medium transition-colors duration-300 ${attivo === i ? "text-white" : "text-white/50"}`}>
                      {s.titolo}
                    </h3>
                  </div>
                  <p className={`mt-2 text-sm leading-relaxed transition-colors duration-300 ${attivo === i ? "text-white/70" : "text-white/30"}`}>
                    {s.testo}
                  </p>
                </button>
              ))}
            </div>

            <div className="relative order-1 flex h-72 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 sm:h-96 lg:order-2">
              <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(280px circle at 50% 20%, rgba(168,85,247,0.15), transparent 70%)" }} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={attivo}
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                  className="relative flex items-center justify-center"
                >
                  <VisualeScena indice={attivo} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
