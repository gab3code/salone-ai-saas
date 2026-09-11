"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wrapper condiviso per il reveal-on-scroll della landing page (Fase 5bis --
 * fuori dai 33 punti originali, richiesta esplicita di Gabriel dell'11/09/2026
 * di un livello di rifinitura "top del top" per la sola pagina di
 * presentazione del servizio, con Framer Motion). Un solo posto per la
 * curva/durata dell'animazione, così ogni sezione della landing si muove allo
 * stesso ritmo invece di avere ciascuna la sua costante a caso.
 */
const VARIANTI: Variants = {
  nascosto: { opacity: 0, y: 24 },
  visibile: { opacity: 1, y: 0 },
};

export function Reveal({
  children,
  ritardo = 0,
  className,
}: {
  children: ReactNode;
  ritardo?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial="nascosto"
      whileInView="visibile"
      viewport={{ once: true, margin: "-80px" }}
      variants={VARIANTI}
      transition={{ duration: 0.6, delay: ritardo, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Contenitore che sfalsa (stagger) il reveal dei figli diretti -- usare con <Reveal> o motion.div dentro. */
export function RevealStagger({
  children,
  className,
  gapMs = 0.08,
}: {
  children: ReactNode;
  className?: string;
  gapMs?: number;
}) {
  return (
    <motion.div
      initial="nascosto"
      whileInView="visibile"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ staggerChildren: gapMs }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={VARIANTI} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }} className={className}>
      {children}
    </motion.div>
  );
}
