"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Parola che ruota dentro il titolo (ispirato a "Flip Words" di Aceternity,
 * riscritto da zero): utile per far vedere in un colpo solo che il prodotto
 * parla a più tipi di professionista, non solo ai saloni.
 */
export function FlipWords({
  parole,
  durata = 2200,
  className = "",
}: {
  parole: string[];
  durata?: number;
  className?: string;
}) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndice((i) => (i + 1) % parole.length), durata);
    return () => clearInterval(id);
  }, [parole.length, durata]);

  return (
    <span className={`relative isolate inline-block align-top ${className}`} style={{ transform: "translateZ(0)" }}>
      {/* copia invisibile della parola più lunga: riserva lo spazio (posizionamento
          normale, non grid) così il layout non "salta" cambiando parola. Il
          wrapper ha `isolate` + `translateZ(0)` perché sopra uno sfondo WebGL
          (LiquidMetal in Hero) Chromium a volte non dipinge il testo pur
          calcolando opacity:1 correttamente -- forzare un proprio layer di
          compositing risolve il problema, verificato con screenshot Playwright. */}
      <span aria-hidden className="invisible whitespace-nowrap">
        {parole.reduce((a, b) => (b.length > a.length ? b : a))}
      </span>
      {/* `initial={false}` sull'AnimatePresence: la primissima parola non
          anima mai il proprio ingresso (nasce già a opacity:1) -- bug reale
          trovato con Playwright (screenshot a 500ms dal load: la parola era
          completamente invisibile, restava solo la virgola). Causa probabile:
          Chromium a volte non dipinge il primo frame di un motion.span in
          transizione sopra lo shader WebGL dell'Hero, anche con l'isolate/
          translateZ(0) già applicati qui sotto -- evitare la transizione
          sulla primissima parola elimina la finestra in cui il bug può
          manifestarsi, invece di provare a correggere il paint stesso. Le
          parole successive continuano a ruotare con la stessa animazione di
          prima. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={parole[indice]}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="absolute inset-0 inline-block whitespace-nowrap"
        >
          {parole[indice]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
