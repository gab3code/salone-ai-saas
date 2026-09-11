"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function Nav() {
  const [scrollato, setScrollato] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrollato(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrollato ? "bg-noir/80 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      {/* Bug segnalato da Gabriel ("la navbar mi sembra decentrata"): con
          `justify-between` su 3 elementi, quello centrale non è centrato
          sulla PAGINA -- è solo a metà dello spazio che resta tra gli altri
          due, e a destra c'è sempre più roba (Accedi + bottone pieno) che a
          sinistra (solo il logo), quindi i link scivolavano verso sinistra.
          Griglia a 3 colonne con quella centrale `auto`: le due colonne
          laterali sono sempre uguali (`1fr` ciascuna), quindi quella
          centrale cade esattamente al centro della pagina qualunque sia la
          larghezza del logo o del blocco bottoni. */}
      <nav className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center px-5 py-4 sm:grid-cols-[1fr_auto_1fr] sm:px-8">
        <a href="#top" className="justify-self-start text-sm font-semibold tracking-tight text-white">
          Salone AI
        </a>
        <div className="hidden items-center justify-self-center gap-8 text-sm text-white/70 sm:flex">
          <a href="#funzionalita" className="transition-colors hover:text-white">
            Funzionalità
          </a>
          <a href="#per-chi" className="transition-colors hover:text-white">
            Per chi è
          </a>
          <a href="#prezzi" className="transition-colors hover:text-white">
            Prezzi
          </a>
        </div>
        <div className="flex items-center justify-self-end gap-3">
          <a href="/accedi" className="hidden text-sm text-white/70 transition-colors hover:text-white sm:block">
            Accedi
          </a>
          <a
            href="/registrati"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-transform hover:scale-105"
          >
            Inizia gratis
          </a>
        </div>
      </nav>
    </motion.header>
  );
}
