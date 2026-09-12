"use client";

import { useEffect, type PointerEvent as ReactPointerEvent } from "react";
import { Check } from "lucide-react";
import { motion, useMotionValue, useSpring, useMotionTemplate, animate } from "framer-motion";
import { Reveal, RevealStagger, RevealItem } from "./Reveal";
import { Grana } from "./Grana";
import { GlowBorder } from "./GlowBorder";

const GARANZIE = ["Nessuna carta richiesta", "Attivo in 5 minuti", "Cancella quando vuoi"];

/**
 * Riscritta da zero (Giro 4, feedback esplicito di Gabriel: "la cosa in
 * fondo non mi piace, cambiala completamente"). La versione precedente
 * riusava LiquidMetal (lo stesso shader dell'Hero) dentro una card piccola:
 * in Hero funziona perché è a piena pagina, con un badge/titolo/mockup
 * prodotto sopra a bilanciarlo -- lo sguardo ha altro su cui posarsi. Chiusa
 * dentro una card stretta con solo un titolo e un bottone, lo stesso vortice
 * satura diventa l'UNICO elemento visivo: legge come un gradient da
 * "template AI generico", non come la chiusura sobria di un vero SaaS
 * premium (vedi screenshot in docs/librerie-ui.md).
 *
 * Nuova direzione: niente shader. Un bagliore ambientale morbido (stessa
 * tecnica di Lampada.tsx, ellissi sfocate, mai un vortice a piena card) +
 * contenuto vero al posto del colore -- tre garanzie concrete come badge,
 * non solo una riga di sottotitolo. Il bordo animato (GlowBorder, già usato
 * su Hero e sul piano consigliato) resta come unico richiamo dinamico:
 * un dettaglio, non il protagonista.
 *
 * Sfondo rifatto una seconda volta (quinto giro, feedback di Gabriel: "lo
 * sfondo non mi piace per niente" -- stavolta chiesto esplicitamente di
 * proporre alternative e farmi scegliere prima di riscrivere alla cieca una
 * terza volta). Mostrate 4 direzioni via screenshot (aurora multicolore,
 * griglia tecnica, spotlight scuro, piatto/minimale) -- scelta "Spotlight
 * scuro": un solo bagliore viola morbido, non due ellissi fisse come prima.
 * Reso interattivo (coerente con la preferenza di Gabriel per UI "fluide e
 * dinamiche"): segue il puntatore quando il mouse è sopra la card (con uno
 * smoothing a molla, stessa tecnica di MagneticButton/GlowBorder), e deriva
 * lentamente da solo quando non c'è interazione -- su schermi touch, dove
 * "seguire il mouse" non ha senso, si vede sempre la deriva lenta.
 */
/**
 * Restituisce sia il livello visivo (`sfondo`, da mettere dentro la card)
 * sia il gestore da agganciare al CONTENITORE ESTERNO della card (non a un
 * div interno): il puntatore deve muovere il bagliore anche quando è sopra
 * il titolo o il pulsante, non solo sulle zone "vuote" della card -- un
 * div interno sotto testo/pulsante non riceverebbe mai il pointermove lì
 * sopra, perché gli elementi successivi nel markup (sopra nello z-order)
 * lo intercettano prima.
 */
function useSpotlightScuro() {
  const x = useMotionValue(50);
  const y = useMotionValue(42);
  const xMolla = useSpring(x, { stiffness: 55, damping: 18 });
  const yMolla = useSpring(y, { stiffness: 55, damping: 18 });
  const sfondo = useMotionTemplate`radial-gradient(34% 48% at ${xMolla}% ${yMolla}%, rgba(168,85,247,0.5), transparent 70%)`;

  useEffect(() => {
    const riduciMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (riduciMovimento) return;

    const controlliX = animate(x, [50, 68, 32, 50], { duration: 10, repeat: Infinity, ease: "easeInOut" });
    const controlliY = animate(y, [42, 28, 58, 42], { duration: 10, repeat: Infinity, ease: "easeInOut" });
    return () => {
      controlliX.stop();
      controlliY.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function alMuovimento(e: ReactPointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - rect.left) / rect.width) * 100);
    y.set(((e.clientY - rect.top) / rect.height) * 100);
  }

  return { sfondo, alMuovimento };
}

export function CTAFinale() {
  const { sfondo, alMuovimento } = useSpotlightScuro();

  return (
    <section className="mx-auto max-w-6xl px-5 pt-12 pb-24 sm:px-8 sm:pt-16">
      <Reveal>
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-noir px-8 py-20 text-center sm:py-24"
          onPointerMove={alMuovimento}
        >
          <GlowBorder rounded={24} borderWidth={1} speed={5} hoverMultiplier={2} tailLength={35} dualTails={false} glowColor="#c084fc" tailColor="rgba(168,85,247,0.35)" baseColor="rgba(255,255,255,0.03)" />

          <motion.div className="pointer-events-none absolute inset-0" style={{ background: sfondo, filter: "blur(30px)" }} />
          <Grana opacita={0.05} />

          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Pronto a smettere di perdere prenotazioni?
          </h2>
          {/* Bug segnalato da Gabriel: la riga andava a capo in un punto
              brutto (una singola parola isolata sull'ultima riga) --
              max-w-md non bastava per stare su una riga sola a desktop, e
              su telefono il wrap automatico del browser tagliava a caso.
              Fix: a capo esplicito al confine naturale della frase (la
              virgola), visibile solo su telefono; da sm in su il
              contenitore è abbastanza largo da stare su un'unica riga. */}
          <p className="relative mx-auto mt-3 max-w-xs text-white/60 sm:max-w-2xl">
            Il tuo salone online in 5 minuti,<br className="sm:hidden" /> senza toccare una riga di codice.
          </p>

          {/* Bug reale trovato (terzo giro, segnalazione di Gabriel:
              "il pulsante ha un hover orrendo"): MagneticButton sposta il
              pulsante seguendo il cursore, ma GlowBorder qui sotto è un
              fratello assoluto (`inset: 0`) ancorato al contenitore fisso --
              non alla posizione che il pulsante assume mentre "insegue" il
              mouse. Al hover il bordo luminoso restava fermo mentre il
              pulsante bianco slittava sopra di esso, sfasandosi
              visibilmente. Fix mirato (opzione scelta con Gabriel): tolto
              solo l'effetto magnetico da QUESTO pulsante, tenuto tutto il
              resto (bagliore ambientale, bordo animato) invariato -- un
              semplice `hover:scale` sostituisce il movimento magnetico,
              stesso feedback tattile, senza disallineamento possibile
              perché non c'è più nulla che si sposta rispetto al bordo. */}
          <div className="relative mt-7 inline-block rounded-full p-px">
            <GlowBorder rounded={100} borderWidth={1.5} speed={10} hoverMultiplier={3} glowColor="#ffffff" tailColor="rgba(240,171,252,0.5)" baseColor="rgba(255,255,255,0.04)" />
            <a
              href="/registrati"
              className="relative block rounded-full bg-white px-7 py-3 text-sm font-medium text-zinc-900 transition-transform duration-200 hover:scale-105"
            >
              Crea il tuo account
            </a>
          </div>

          <RevealStagger className="relative mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2" gapMs={0.05}>
            {GARANZIE.map((g) => (
              <RevealItem key={g}>
                <span className="flex items-center gap-1.5 text-xs text-white/50">
                  <Check className="size-3.5 text-violet-400" />
                  {g}
                </span>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </Reveal>
    </section>
  );
}
