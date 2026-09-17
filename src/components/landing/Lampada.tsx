"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Bagliore morbido sopra il titolo di sezione al primo scroll-in-view --
 * dà peso a un titolo senza un'altra card/bento, una sezione su due che apre
 * con lo stesso stile stanca l'occhio.
 *
 * Riscritta (Giro 4, dopo feedback esplicito di Gabriel: "quella piramide" --
 * la versione precedente ritagliava un poligono a forma di triangolo dentro
 * un rettangolo sfocato: con un blur non abbastanza forte rispetto ai bordi
 * dritti del poligono, si vedeva uno spigolo netto invece di un cono di luce
 * morbido. Qui niente clip-path: solo un'ellisse sfocata (nessuno spigolo
 * possibile) + una linea sottile, la stessa idea ma senza il rischio.
 */
export function Lampada({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-col items-center pt-6 pb-2">
      <div className="pointer-events-none absolute inset-x-0 -top-16 flex justify-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          className="h-40 w-72 rounded-full bg-gradient-to-b from-violet-500/30 via-fuchsia-400/10 to-transparent blur-3xl sm:w-[28rem]"
        />
        <motion.div
          initial={{ opacity: 0, scaleX: 0.2 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="absolute top-14 h-px w-40 bg-gradient-to-r from-transparent via-violet-300/70 to-transparent sm:w-64"
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
