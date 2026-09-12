"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { MoveHorizontal } from "lucide-react";
import { GlowBorder } from "./GlowBorder";

/**
 * Cursore trascinabile che confronta due pannelli (ispirato a "Compare" di
 * Aceternity, riscritto da zero con clip-path invece di due immagini --
 * qui non ci sono foto di saloni reali da mostrare, quindi confrontiamo due
 * illustrazioni della UI, non due screenshot).
 *
 * Rifinita (12/09/2026, punto 9 di Gabriel: "cosa cambia davvero è
 * bruttino" -- stessa interazione di trascinamento, chiesta esplicitamente
 * da tenere, solo il "vestito" cambia). Tre aggiunte, ispirate ai compare-
 * slider più curati visti su 21st/OriginKit: (1) un piccolo "wiggle"
 * automatico al primo caricamento, che sposta il cursore avanti e indietro
 * una volta sola -- senza, niente nella UI suggerisce che sia trascinabile
 * finché qualcuno non ci prova per caso; (2) la maniglia centrale ha
 * un'icona di drag riconoscibile (frecce sinistra-destra) invece delle due
 * parentesi ravvicinate di prima, più bagliore/ombra per sembrare
 * sollevata dalla superficie; (3) un bordo animato (GlowBorder, lo stesso
 * linguaggio del piano "Consigliato" e della CTA finale) al posto del
 * bordo statico bianco/10, per coerenza con il resto del sito.
 */
export function CompareSlider({
  sinistra,
  destra,
  className = "",
}: {
  sinistra: ReactNode;
  destra: ReactNode;
  className?: string;
}) {
  const rifContenitore = useRef<HTMLDivElement>(null);
  const [percento, setPercento] = useState(50);
  const trascinando = useRef(false);
  const controlliManiglia = useAnimationControls();

  function aggiorna(clientX: number) {
    const rect = rifContenitore.current?.getBoundingClientRect();
    if (!rect) return;
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPercento(Math.min(100, Math.max(0, p)));
  }

  /* Bug reale trovato durante un controllo generale dell'interfaccia
   * (screenshot con scroll vero, non solo lettura del codice): il taglio
   * netto di `clip-path` faceva leggere le due liste come UNA frase sola
   * nel punto esatto del divisore, perché ogni riga di "sinistra" e
   * "destra" occupa la STESSA posizione ma parla di cose diverse (non la
   * stessa immagine ritoccata) -- a percento=50 (il riposo di default,
   * dove il "wiggle" iniziale torna sempre) si leggeva letteralmente
   * "Cliente in attesa da 40 minut[i]" incollato a "[4] ore su 24" come se
   * fosse una frase sola, per ogni riga. Un compare-slider su due FOTO
   * funziona perché il contenuto è lo stesso ai due lati del taglio; qui
   * il contenuto è diverso, quindi un bordo netto crea un incontro di
   * parole a caso.
   *
   * Primo tentativo (poi scartato): dissolvenza incrociata con mask-image
   * su entrambi i pannelli. Verificato dal vivo che non basta -- una
   * dissolvenza sfuma l'OPACITÀ, non la leggibilità: al centro della zona
   * di sfumatura entrambi i testi sono ancora leggibili al 50%, quindi il
   * problema (le due frasi si toccano) restava, solo più graduale invece
   * che netto.
   *
   * Fix vero: non provare a fondere due testi diversi (non funziona mai
   * bene, sono parole non pixel di una foto), separarli fisicamente. Una
   * "fessura" opaca e sfocata (vedi il div con `backdrop-blur` sotto),
   * larga quanto un paio di caratteri, coperta sopra ENTRAMBI i pannelli
   * esattamente nel punto del taglio: l'ultimo pezzo di ciascuna frase
   * finisce dietro il vetro smerigliato invece di toccare l'altra,
   * qualunque sia la posizione del cursore -- non solo lontano dal 50%. */
  const LARGHEZZA_FESSURA = 64; // px, non percento: deve restare costante qualunque sia la larghezza del riquadro. Stretta (22px, primo tentativo) copriva solo 1-2 caratteri: le code di parola restavano leggibili su entrambi i lati e si leggevano ancora come una frase sola, solo con un buco in mezzo. Serve coprire una PAROLA intera da ciascun lato, non un paio di lettere.

  useEffect(() => {
    const riduciMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (riduciMovimento) return;
    const t = setTimeout(() => {
      setPercento(62);
      setTimeout(() => setPercento(38), 450);
      setTimeout(() => setPercento(50), 900);
    }, 500);
    controlliManiglia.start({ scale: [1, 1.08, 1], transition: { duration: 1.4, delay: 0.5 } });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // Wrapper esterno con 1px di padding: lascia lo spazio in cui il bordo
    // animato (sotto) può essere visto -- se il GlowBorder stesse nello
    // stesso contenitore dei due pannelli, questi ultimi (opachi, a tutto
    // riquadro) lo coprirebbero completamente. Stessa tecnica già usata per
    // il piano "Consigliato" in Prezzi.tsx.
    <div className={`relative rounded-2xl p-px ${className}`}>
      <GlowBorder rounded={16} borderWidth={1} speed={7} tailLength={40} glowColor="#c084fc" tailColor="rgba(168,85,247,0.35)" baseColor="rgba(255,255,255,0.03)" />
      <div
        ref={rifContenitore}
        className="group relative h-full w-full cursor-grab touch-none overflow-hidden rounded-2xl select-none active:cursor-grabbing"
        onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
          trascinando.current = true;
          aggiorna(e.clientX);
        }}
        onPointerMove={(e) => {
          if (trascinando.current) aggiorna(e.clientX);
        }}
        onPointerUp={() => {
          trascinando.current = false;
        }}
        onPointerLeave={() => {
          trascinando.current = false;
        }}
        role="slider"
        aria-label="Trascina per confrontare prima e dopo"
        aria-valuenow={Math.round(percento)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="absolute inset-0">{destra}</div>
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - percento}% 0 0)` }}>
          {sinistra}
        </div>

        {/* La fessura vera e propria: vetro smerigliato (blur di quello che
            c'è sotto, non un colore piatto -- resta "vivo", non un buco nero
            nel mezzo del componente) centrata sul taglio, che copre l'ultimo
            pezzo di testo di entrambi i lati. `pointer-events-none`: deve
            restare visiva soltanto, il trascinamento continua a leggere la
            posizione del mouse sul contenitore intero sotto di lei. */}
        <div
          className="pointer-events-none absolute inset-y-0 z-[5] backdrop-blur-sm"
          style={{
            left: `calc(${percento}% - ${LARGHEZZA_FESSURA / 2}px)`,
            width: `${LARGHEZZA_FESSURA}px`,
            background: "linear-gradient(to right, rgba(24,24,27,0.35), rgba(24,24,27,0.55), rgba(24,24,27,0.35))",
          }}
        />

        <div className="absolute inset-y-0 z-10 w-0.5 bg-gradient-to-b from-transparent via-white/70 to-transparent" style={{ left: `${percento}%` }}>
          <motion.div
            animate={controlliManiglia}
            className="absolute top-1/2 left-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-900 shadow-[0_4px_20px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.4)] transition-transform group-active:scale-95"
          >
            <MoveHorizontal className="size-4" />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
