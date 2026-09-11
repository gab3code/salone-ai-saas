"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Calendar, Globe2, MessageSquareText, RefreshCw, Check, Users, BellRing, CalendarClock, type LucideIcon } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { Reveal } from "./Reveal";
import { Grana } from "./Grana";

interface Scena {
  titolo: string;
  testo: string;
  icona: LucideIcon;
  inArrivo?: boolean;
}

/**
 * Vetrina scroll-driven -- questa è la sezione "vetrina" vera della landing
 * (richiesta di Gabriel dell'11/09/2026 di spingere di più su GSAP/Framer
 * Motion invece di un semplice bento statico, poi estesa il giorno stesso a
 * coprire TUTTO il set di funzionalità, attuali e pianificate, non solo 3):
 * un pannello resta fisso mentre si scorre, e cambia scena in base a quanto
 * si è scrollato -- pattern da vero "scrollytelling" (GSAP ScrollTrigger con
 * pin+scrub), non un fade-in a caso. Le scene con `inArrivo: true`
 * corrispondono a funzionalità pianificate in PIANO.md ma non ancora
 * disponibili -- badge onesto, mai spacciate per già pronte (CLAUDE.md
 * punto 7 esteso al marketing).
 */
const SCENE: Scena[] = [
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
    testo: "Risponde su chat web e (in arrivo) WhatsApp a domande su orari e prezzi e prenota da sola -- e passa la mano a te quando serve davvero una persona.",
    icona: MessageSquareText,
  },
  {
    titolo: "Anagrafica clienti che si aggiorna da sola",
    testo: "Ogni prenotazione, da dashboard o da AI, finisce nella stessa scheda cliente -- storico completo, mai due archivi da tenere allineati a mano.",
    icona: Users,
  },
  {
    titolo: "Promemoria e clienti da recontattare",
    testo: "Un insight ti segnala chi non prenota da un po'; i promemoria automatici via messaggio sono in arrivo per chiudere il cerchio da soli.",
    icona: BellRing,
    inArrivo: true,
  },
  {
    titolo: "Il tuo calendario personale, sempre sincronizzato",
    // Prima diceva anche "Apple/iCloud tecnicamente pronto, in attesa di
    // essere riaperto" -- verificato in PROJECT_STATUS.md (problema noto
    // #14): non è "quasi pronto", è bloccato lato Apple sul traffico CalDAV
    // che arriva da IP di data center/cloud, non risolvibile da qui senza
    // instradare le chiamate da un IP non-cloud -- una promessa che rischiava
    // di non poter essere mantenuta. Tolta dal marketing finché Gabriel non
    // decide come posizionarla (vedi messaggio a parte).
    testo: "Google Calendar già collegabile: gli impegni personali bloccano lo slot in automatico, e viceversa.",
    icona: CalendarClock,
  },
];

/** Percorso mostrato nella barra del finto browser che incornicia la scena --
 * un solo "schermo" persistente, coerente con quale parte del prodotto la
 * scena sta raccontando (pagina pubblica vs dashboard). */
const PERCORSI = [
  "salone-ai-saas.vercel.app/dashboard",
  "salone-ai-saas.vercel.app/s/il-tuo-salone",
  "salone-ai-saas.vercel.app/s/il-tuo-salone",
  "salone-ai-saas.vercel.app/dashboard/clienti",
  "salone-ai-saas.vercel.app/dashboard/clienti",
  "salone-ai-saas.vercel.app/dashboard/impostazioni/calendari",
];

/**
 * Riscritte (Giro 4, feedback di Gabriel su uno screenshot: "riquadro dentro
 * un altro riquadro, e quello dentro è minuscolo"). Causa reale: ogni scena
 * portava con sé la propria mini-finestra (bordo + pallini rosso/giallo/
 * verde), annidata dentro il grande pannello "palco" che GIÀ la incornicia
 * -- due finestre una dentro l'altra, e quella interna a `max-w-xs` restava
 * piccola nel grande spazio del palco. Ora il palco stesso mostra UNA sola
 * barra da finestra (sotto, sempre presente, con l'URL che cambia in base
 * alla scena) e queste funzioni restituiscono solo il CONTENUTO -- niente
 * bordo/pallini propri, larghezza piena del palco.
 */
function VisualeScena({ indice }: { indice: number }) {
  if (indice === 1) {
    return (
      <motion.div
        initial="nascosto"
        animate="visibile"
        variants={{ visibile: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
        className="w-full max-w-sm"
      >
        <motion.div variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }} className="h-3 w-2/3 rounded bg-white/20" />
        <motion.div variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }} className="mt-2 h-2 w-1/2 rounded bg-white/10" />
        <motion.div variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }} className="mt-4 flex gap-2">
          {["Taglio", "Colore", "Piega"].map((s) => (
            <span key={s} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70">
              {s}
            </span>
          ))}
        </motion.div>
        <motion.div
          variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }}
          className="mt-4 rounded-xl bg-violet-500/20 px-4 py-3 text-sm text-violet-200"
        >
          Ven 15 · 16:30 disponibile
        </motion.div>
      </motion.div>
    );
  }

  if (indice === 2) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-2">
        <div className="self-end rounded-2xl rounded-br-sm bg-white/10 px-3 py-2 text-xs text-white/80">
          Siete aperti domenica?
        </div>
        {/* L'orb non è decorazione: rende letteralmente visibile il momento in
            cui l'AI sta elaborando la risposta, prima che compaia -- stato
            "connecting" di thinking-orbs, pensato apposta per agenti AI. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.4, times: [0, 0.15, 0.75, 1], repeat: Infinity, repeatDelay: 2.2 }}
          className="flex items-center gap-1.5 self-start pl-1"
        >
          <ThinkingOrb state="connecting" size={20} theme="dark" aria-label="L'assistente sta elaborando la risposta" />
          <span className="text-[10px] text-white/40">sta scrivendo…</span>
        </motion.div>
        <div className="self-start rounded-2xl rounded-bl-sm bg-gradient-to-br from-violet-500/80 to-fuchsia-500/80 px-3 py-2 text-xs text-white">
          Siamo chiusi la domenica, ma sabato ho le 11:00 libere!
        </div>
        <div className="mt-1 flex items-center gap-1.5 self-start text-[11px] text-emerald-400">
          <Check className="size-3" /> Nessuno del salone ha dovuto rispondere
        </div>
      </div>
    );
  }

  if (indice === 3) {
    return (
      <motion.div
        initial="nascosto"
        animate="visibile"
        variants={{ visibile: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
        className="w-full max-w-sm"
      >
        <motion.div variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }} className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-violet-500/20 text-xs font-medium text-violet-200">GB</span>
          <div className="h-2.5 w-1/2 rounded bg-white/20" />
        </motion.div>
        <div className="mt-3.5 flex flex-col gap-2">
          {["Taglio · 12/09", "Colore · 20/08 (da AI)", "Piega · 02/08"].map((r) => (
            <motion.div
              key={r}
              variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60"
            >
              {r}
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (indice === 4) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-white/50">Promemoria automatico</span>
          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">in arrivo</span>
        </div>
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/50">
          &quot;Ciao Giulia, ti aspettiamo domani alle 16:30 da noi 👋&quot;
        </div>
      </div>
    );
  }

  if (indice === 5) {
    return (
      <div className="grid w-full max-w-sm grid-cols-2 gap-3">
        {[
          { nome: "Google", stato: "collegato" },
          { nome: "Apple", stato: "in valutazione" },
        ].map((p) => (
          <div key={p.nome} className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-4">
            <CalendarClock className="size-5 text-violet-300" />
            <span className="text-xs text-white/70">{p.nome}</span>
            <span className={`text-[10px] ${p.stato === "collegato" ? "text-emerald-400" : "text-white/40"}`}>{p.stato}</span>
          </div>
        ))}
        <div className="col-span-2 mt-1 rounded-lg bg-white/5 px-3 py-2.5 text-center text-xs text-white/50">
          impegni personali = slot bloccato
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-sm grid-cols-3 gap-3">
      {[Calendar, Globe2, MessageSquareText].map((Icona, i) => (
        <div key={i} className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
          <Icona className="size-4.5 text-violet-300" />
          <span className="h-1.5 w-full rounded bg-white/15" />
        </div>
      ))}
      <div className="col-span-3 mt-1 rounded-lg bg-white/5 px-3 py-2.5 text-center text-xs text-white/50">
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
    <section className="relative overflow-hidden bg-noir py-4">
      <Grana opacita={0.035} />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="pt-16">
          <h2 className="text-sm font-medium text-violet-400">Perché è diverso</h2>
          <p className="mt-2 max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Non è un altro calendario online.
          </p>
        </Reveal>

        {/* contenitore alto NxSchermo (una "schermata" di scroll per scena): GSAP
            anima "attivo" mentre lo si attraversa scrollando, il pannello di
            destra resta fisso (pin) */}
        <div ref={contenitoreRef} className="relative mt-8" style={{ height: `${SCENE.length * 100}vh` }}>
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
                    {s.inArrivo && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">in arrivo</span>
                    )}
                  </div>
                  <p className={`mt-2 text-sm leading-relaxed transition-colors duration-300 ${attivo === i ? "text-white/70" : "text-white/30"}`}>
                    {s.testo}
                  </p>
                </button>
              ))}
            </div>

            {/* Un solo "schermo" persistente (barra con pallini + URL), non
                una finestra diversa per ogni scena -- prima ogni scena
                portava la propria mini-finestra dentro questa già presente,
                risultando in un riquadro minuscolo dentro un riquadro
                grande (feedback di Gabriel su screenshot). L'URL nella
                barra cambia con la scena, per dare comunque il senso di
                "stiamo guardando parti diverse del prodotto". */}
            <div className="relative order-1 flex h-80 flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 sm:h-[26rem] lg:order-2">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-amber-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={attivo}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.25 }}
                    className="ml-3 truncate text-xs text-white/40"
                  >
                    {PERCORSI[attivo]}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-6 sm:px-10">
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
      </div>
    </section>
  );
}
