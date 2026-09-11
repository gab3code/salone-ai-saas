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
    <span className={`relative inline-grid ${className}`}>
      <AnimatePresence mode="wait">
        <motion.span
          key={parole[indice]}
          initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="col-start-1 row-start-1 inline-block whitespace-nowrap"
        >
          {parole[indice]}
        </motion.span>
      </AnimatePresence>
      {/* copia invisibile della parola più lunga per riservare lo spazio e non far "saltare" il layout */}
      <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
        {parole.reduce((a, b) => (b.length > a.length ? b : a))}
      </span>
    </span>
  );
}
