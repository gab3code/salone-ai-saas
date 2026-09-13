"use client";

import { useEffect } from "react";

/**
 * Registra il service worker minimo di public/sw.js (vedi quel file per il
 * perché non fa caching). Componente client isolato e senza output visivo
 * (torna `null`) apposta: `layout.tsx` resta altrimenti un Server Component
 * puro, questo è l'unico pezzo che deve girare nel browser.
 */
export function RegistraServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Fail-open: un browser che rifiuta la registrazione (privacy mode,
        // policy aziendale, ecc.) non deve mai rompere il resto del sito --
        // l'app resta perfettamente utilizzabile, solo non installabile.
      });
    }
  }, []);

  return null;
}
