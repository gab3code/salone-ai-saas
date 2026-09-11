"use client";

import { motion } from "framer-motion";

/**
 * Anello di luce che ruota lungo il bordo di una card/bottone (ispirato a
 * "Border Beam" di Magic UI, riscritto da zero). Va messo dentro un
 * contenitore `relative` con `padding: 1px` e il contenuto vero sopra con
 * uno sfondo opaco, così resta visibile solo l'anello di 1px che ruota.
 */
export function BorderBeam({ durata = 6, className = "" }: { durata?: number; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}>
      <motion.div
        className="absolute inset-[-60%]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, transparent 78%, rgba(216,180,254,0.95) 86%, rgba(232,121,249,0.9) 90%, transparent 96%)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: durata, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
