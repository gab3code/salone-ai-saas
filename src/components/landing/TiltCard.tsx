"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

/**
 * Card con inclinazione 3D che segue il cursore (ispirata al "3D Card Effect"
 * di Aceternity, riscritta da zero con Motion). Usata per le card
 * "per chi è" e le card funzionalità -- molto più viva di un semplice hover
 * di colore.
 */
export function TiltCard({
  children,
  className = "",
  forza = 9,
}: {
  children: ReactNode;
  className?: string;
  forza?: number;
}) {
  const rifCard = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spx = useSpring(px, { stiffness: 220, damping: 22 });
  const spy = useSpring(py, { stiffness: 220, damping: 22 });
  const rotateX = useTransform(spy, [0, 1], [forza, -forza]);
  const rotateY = useTransform(spx, [0, 1], [-forza, forza]);

  function alMovimento(e: MouseEvent<HTMLDivElement>) {
    const rect = rifCard.current?.getBoundingClientRect();
    if (!rect) return;
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }

  function alReset() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <motion.div
      ref={rifCard}
      onMouseMove={alMovimento}
      onMouseLeave={alReset}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
