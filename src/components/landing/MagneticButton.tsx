"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

/**
 * Bottone "magnetico": segue leggermente il cursore quando ci si avvicina,
 * poi torna al centro con una molla -- dettaglio da sito curato a mano
 * (Linear, Vercel, agenzie di design) che un template generico non ha mai.
 * Usato solo sulle call-to-action principali della landing, mai ovunque.
 */
export function MagneticButton({
  href,
  children,
  className,
  forza = 0.35,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  forza?: number;
}) {
  const rifBottone = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 12, mass: 0.3 });
  const springY = useSpring(y, { stiffness: 150, damping: 12, mass: 0.3 });

  function alMovimento(e: MouseEvent<HTMLAnchorElement>) {
    const rect = rifBottone.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - (rect.left + rect.width / 2)) * forza);
    y.set((e.clientY - (rect.top + rect.height / 2)) * forza);
  }

  function alTermineHover() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.a
      ref={rifBottone}
      href={href}
      onMouseMove={alMovimento}
      onMouseLeave={alTermineHover}
      style={{ x: springX, y: springY }}
      className={className}
    >
      {children}
    </motion.a>
  );
}
