"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Cono di luce che si apre sopra il titolo di sezione al primo scroll-in-view
 * (ispirato a "Lamp Effect" di Aceternity, riscritto da zero). Usato per dare
 * peso a un titolo di sezione senza un'altra card/bento -- una sezione su due
 * che apre con lo stesso identico stile stanca l'occhio.
 */
export function Lampada({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex flex-col items-center pt-6 pb-2">
      <div className="pointer-events-none absolute inset-x-0 -top-10 flex justify-center overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scaleX: 0.4 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
          className="h-32 w-64 bg-gradient-to-b from-violet-500/35 via-fuchsia-400/10 to-transparent blur-2xl sm:w-96"
          style={{ clipPath: "polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)" }}
        />
        <motion.div
          initial={{ opacity: 0, scaleX: 0.2 }}
          whileInView={{ opacity: 1, scaleX: 1 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="absolute top-8 h-px w-40 bg-gradient-to-r from-transparent via-violet-300/80 to-transparent sm:w-64"
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
