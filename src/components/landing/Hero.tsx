"use client";

import { Calendar, Check, MessageCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Grana } from "./Grana";
import { MagneticButton } from "./MagneticButton";
import { LiquidMetal } from "./LiquidMetal";
import { FlipWords } from "./FlipWords";

const PROFESSIONI = ["salone", "studio", "centro", "spazio"];

function Titolo() {
  return (
    <h1
      className="max-w-3xl text-4xl leading-[1.08] font-semibold tracking-tight text-white sm:text-6xl"
      style={{ textShadow: "0 2px 28px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.6)" }}
    >
      <span className="block overflow-hidden">
        <motion.span
          className="block"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
        >
          Il tuo <FlipWords parole={PROFESSIONI} />,
        </motion.span>
      </span>
      <span className="block overflow-hidden">
        <motion.span
          className="block"
          initial={{ y: "110%" }}
          animate={{ y: "0%" }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.23, 1, 0.32, 1] }}
        >
          {/* Prima: testo in gradient viola->fucsia (bg-clip-text) sopra lo
              stesso shader viola->fucsia dell'Hero -- a seconda della fase
              dello shader il testo poteva finire quasi dello stesso colore
              dello sfondo dietro, leggendo come "sporco"/illeggibile invece
              che come un accento (segnalato da Gabriel, "colore orrendo").
              Passato poi a bianco pieno con un bagliore colorato attorno
              (text-shadow viola/fucsia) -- ma quel bagliore leggeva come
              un'"evidenziazione" indesiderata (un alone che imita
              l'evidenziatore), non come un accento di colore sul testo
              stesso (segnalato di nuovo da Gabriel: "togli
              l'evidenziazione... dai un colore bello al testo che non si
              confonda con lo sfondo"). Ora: nessun bagliore, un colore
              pieno sul testo -- ambra, lontano su qualunque ruota cromatica
              dal viola/fucsia dello shader dietro (mai un tono vicino con
              cui confondersi, a qualunque fase sia lo shader), con solo
              l'ombra scura neutra ereditata dall'h1 per la leggibilità (non
              più un'ombra colorata propria). */}
          <span className="text-amber-300">mai più senza risposta.</span>
        </motion.span>
      </span>
    </h1>
  );
}

/** Il mock del prodotto della hero: NON una demo cliccabile -- un'illustrazione animata
 * (dati d'esempio, mai spacciati per statistiche reali) di cosa succede davvero dietro le
 * quinte: una prenotazione arriva sulla pagina pubblica, l'AI risponde, il calendario si aggiorna.
 * Stesso principio del resto del prodotto (punto 7 di CLAUDE.md, "l'AI non deve inventare dati")
 * esteso al marketing: qui non ci sono numeri finti, solo un esempio di flusso. */
function AnteprimaProdotto() {
  const APPUNTAMENTI = [
    { ora: "10:00", nome: "Marco R.", servizio: "Barba e capelli" },
    { ora: "11:30", nome: "Giulia B.", servizio: "Taglio e piega" },
    { ora: "15:00", nome: "Sara V.", servizio: "Colore" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="relative mx-auto mt-14 w-full max-w-3xl"
    >
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-violet-600/30 via-fuchsia-500/20 to-orange-400/20 blur-2xl" />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-3 text-xs text-white/40">salone-ai-saas.vercel.app/s/il-tuo-salone</span>
        </div>

        <div className="grid gap-px bg-white/5 sm:grid-cols-[1.3fr_1fr]">
          {/* calendario che si popola da solo */}
          <div className="bg-zinc-900/95 p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-white/50">
              <Calendar className="size-3.5" /> Oggi
            </div>
            <div className="flex flex-col gap-2">
              {APPUNTAMENTI.map((a, i) => (
                <motion.div
                  key={a.ora}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 1.1 + i * 0.25, ease: [0.23, 1, 0.32, 1] }}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-white/80">
                    <span className="font-medium text-white">{a.ora}</span> · {a.nome}
                  </span>
                  <span className="text-xs text-white/40">{a.servizio}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* chat AI che risponde da sola */}
          <div className="flex flex-col justify-end gap-2 bg-zinc-900/95 p-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/50">
              <MessageCircle className="size-3.5" /> Assistente AI
            </div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.9 }}
              className="self-end rounded-2xl rounded-br-sm bg-white/10 px-3 py-2 text-xs text-white/80"
            >
              Avete un buco domani pomeriggio per un taglio?
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 2.4 }}
              className="flex items-start gap-2 self-start rounded-2xl rounded-bl-sm bg-gradient-to-br from-violet-500/80 to-fuchsia-500/80 px-3 py-2 text-xs text-white"
            >
              <Sparkles className="mt-0.5 size-3 shrink-0" />
              {/* Prima diceva "con Marco" -- ma il calendario a sinistra
                  mostra già un cliente chiamato "Marco R." alle 10:00: lo
                  stesso nome riusato per quello che sembra un operatore
                  diverso leggeva come un errore, non come un esempio pulito
                  (segnalato da Gabriel, "l'esempio concreto è strano").
                  Tolto il nome: la risposta resta vera qualunque sia la
                  struttura del salone (anche a operatore singolo). */}
              Sì! Domani alle 16:30, ti va bene?
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 3 }}
              className="mt-1 flex items-center gap-1.5 self-start text-[11px] text-emerald-400"
            >
              <Check className="size-3" /> Prenotazione confermata sul calendario
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  return (
    <div id="top" className="relative isolate overflow-hidden bg-noir">
      {/* Liquid Metal (OriginKit, vedi docs/librerie-ui.md "Giro 3"): l'unico
          "protagonista" visivo della hero -- niente altri sfondi animati in
          competizione. Reagisce lievemente al mouse (tilt dello sfondo), mai
          al cursore reale. */}
      <LiquidMetal />
      {/* velo scuro dietro al blocco di testo: garantisce leggibilità del
          titolo qualunque sia il colore dello shader in quel momento */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(65% 60% at 50% 34%, rgba(5,1,8,0.72), transparent 75%)" }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <Grana opacita={0.045} />
      {/* Bug segnalato da Gabriel ("la home appena apro il sito è tagliata
          sotto"): la Hero finisce di netto nel suo sfondo animato
          (LiquidMetal, ricco di colore) e la sezione successiva
          (ProdottoScroll) è un bg-noir piatto -- stesso colore di base, ma
          nessuna transizione tra "shader vivo" e "sfondo piatto" produce uno
          spigolo netto proprio all'altezza del mockup del prodotto. Un fade
          in gradiente verso bg-noir negli ultimi ~8rem della Hero ammorbidisce
          il passaggio, senza toccare nulla della sezione sotto (che resta lo
          stesso mockup della dashboard, "tagliata" solo perché tornerà dritta
          allo scroll -- vedi ProdottoScroll.tsx). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-noir sm:h-48" />

      {/* Bug segnalato da Gabriel: "deve reagire al mouse ma così non
          reagisce". Causa reale, verificata puntando il mouse e leggendo
          `document.elementFromPoint` in ogni punto della hero: questo div
          (badge, titolo, paragrafo, bottoni, mockup) è trasparente ma resta
          `pointer-events: auto` di default -- occupa quasi tutta l'altezza
          della hero nella colonna centrale, quindi "ruba" il mouseover a
          LiquidMetal ovunque tranne nei margini vuoti ai lati (che su un
          laptop da 13-15" sono strettissimi o assenti). Lo sfondo reagiva
          SOLO in quei margini, mai dove l'utente guarda davvero -- da qui la
          sensazione "non reagisce". Fix: questo contenitore diventa
          "trasparente anche al mouse" (pointer-events-none), così il
          movimento passa sempre a LiquidMetal sotto; solo i due bottoni
          (l'unica cosa qui dentro che deve restare cliccabile) riattivano
          pointer-events sul proprio contenitore. */}
      <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pt-28 pb-20 text-center sm:px-8 sm:pt-36 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70"
        >
          <Sparkles className="size-3.5 text-fuchsia-300" />
          Prenotazioni, CRM e reception AI in un&apos;unica piattaforma
        </motion.div>

        <Titolo />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-6 max-w-xl text-base text-white/70 sm:text-lg"
          style={{ textShadow: "0 2px 16px rgba(0,0,0,0.7)" }}
        >
          I tuoi clienti prenotano da soli dalla tua pagina, un&apos;assistente AI risponde a chi
          scrive fuori orario, e tu vedi tutto in un unico calendario — senza cambiare il modo
          in cui lavori oggi.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="pointer-events-auto mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          {/* Stessa scelta applicata a Nav.tsx (richiesta di Gabriel
              dell'11/09/2026): anche il CTA principale della hero ora scende
              ai piani invece di portare dritti a /registrati. Prima i due
              bottoni "Inizia gratis" del sito (questo e quello in nav)
              avevano comportamenti diversi -- incoerente, ed è proprio questo
              il pulsante più in vista di tutti. Il testo resta vero: da
              Prezzi in giù si arriva comunque al piano Free senza carta. */}
          <MagneticButton
            href="#prezzi"
            className="block rounded-full bg-white px-6 py-3 text-sm font-medium text-zinc-900 shadow-lg shadow-white/10"
          >
            Inizia gratis — nessuna carta richiesta
          </MagneticButton>
          <MagneticButton
            href="#funzionalita"
            forza={0.25}
            className="inline-block rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
          >
            Guarda come funziona
          </MagneticButton>
        </motion.div>

        <AnteprimaProdotto />
      </div>
    </div>
  );
}
