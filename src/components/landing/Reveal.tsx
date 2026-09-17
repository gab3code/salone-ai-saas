"use client";

import { motion, type Variants } from "motion/react";
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

/**
 * Contenitore per una griglia/lista di RevealItem -- oggi solo un div di
 * layout, non anima più nulla lui stesso.
 *
 * Riscritto (quinto giro, segnalazione di Gabriel: "le card salgono tutte
 * insieme invece che una riga per volta quando scendo"). Causa reale: prima
 * questo contenitore era l'UNICO trigger (`whileInView` su di sé), e ogni
 * RevealItem figlio si limitava a ereditare le sue varianti con uno
 * sfalsamento (`staggerChildren`) misurato in tempo, non in scroll. Su una
 * griglia alta più schermate (es. le 15 card di Funzionalita.tsx), il
 * contenitore entra in "vista" (margine -80px) quando solo la prima riga è
 * davvero visibile -- ma lo sfalsamento totale per 15 elementi dura meno di
 * un secondo, quindi finisce prima ancora che l'utente scorra fino alle
 * righe più basse: quando ci arriva le trova già comparse, non "una riga
 * alla volta mentre scende" come voluto. `gapMs` è rimasto nel tipo solo per
 * non rompere le chiamate esistenti che lo passano ancora; non fa più nulla.
 */
export function RevealStagger({
  children,
  className,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- accettato ma ignorato, vedi commento sopra
  gapMs,
}: {
  children: ReactNode;
  className?: string;
  /** @deprecated non più usato -- ogni RevealItem si attiva da solo in base alla propria posizione di scroll, non a un ritardo condiviso. */
  gapMs?: number;
}) {
  return <div className={className}>{children}</div>;
}

/**
 * Ogni card si attiva da sola quando ENTRA lei stessa nella viewport (stesso
 * `whileInView`/margine di Reveal), non più in base a quando lo fa il
 * contenitore. Le card della stessa riga entrano nella viewport quasi allo
 * stesso momento (stessa posizione di scroll) e quindi compaiono insieme
 * naturalmente -- le righe più in basso restano ferme finché non ci si
 * scorre davvero vicino, che è esattamente l'effetto "una riga alla volta"
 * richiesto.
 */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial="nascosto"
      whileInView="visibile"
      viewport={{ once: true, margin: "-80px" }}
      variants={VARIANTI}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
