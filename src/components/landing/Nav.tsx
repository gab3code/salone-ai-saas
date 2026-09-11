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
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a href="#top" className="text-sm font-semibold tracking-tight text-white">
          Salone AI
        </a>
        <div className="hidden items-center gap-8 text-sm text-white/70 sm:flex">
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
        <div className="flex items-center gap-3">
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
