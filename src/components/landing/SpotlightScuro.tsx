"use client";

import { useEffect, type PointerEvent as ReactPointerEvent } from "react";
import { useMotionValue, useSpring, useMotionTemplate, animate } from "framer-motion";

/**
 * Estratto da CTAFinale.tsx (quinto giro, seconda parte) -- Gabriel ha
 * definito quello sfondo "bellissima" e ha chiesto di riusarlo su /accedi e
 * /registrati ("se pensi possa migliorare, fallo"): sì, perché le due
 * pagine avevano solo un alone viola statico e fisso (mai chiesto
 * esplicitamente da Gabriel, semplice sfondo di riempimento messo lì nel
 * controllo pre-pubblicazione) -- lo stesso bagliore interattivo che segue
 * il puntatore dà continuità visiva con il resto del sito invece di un
 * pattern diverso per ogni pagina, coerente con la preferenza già espressa
 * da Gabriel per un'interfaccia "fluida e dinamica".
 *
 * Spostato qui (non più definito dentro CTAFinale.tsx) per essere condiviso
 * da tre punti (CTAFinale, /accedi, /registrati) senza tre copie della
 * stessa logica da mantenere allineate.
 *
 * Uso: `const { sfondo, alMuovimento } = useSpotlightScuro();` poi
 * `<motion.div className="pointer-events-none absolute inset-0" style={{ background: sfondo, filter: "blur(30px)" }} />`
 * dentro un contenitore `position: relative` (o `fixed`, per un sfondo di
 * pagina intera) con `onPointerMove={alMuovimento}` sul contenitore
 * ESTERNO che riceve il puntatore -- non su un div interno, altrimenti gli
 * elementi sopra (testo, form, pulsanti) intercettano il movimento prima
 * che raggiunga lo sfondo.
 *
 * `derivaAutomatica` (quinto giro, seconda parte -- feedback di Gabriel su
 * /accedi e /registrati: "potrebbe dare fastidio e fa sempre lo stesso
 * movimento"): su CTAFinale il bagliore si vede per pochi secondi mentre si
 * scorre la pagina, un loop di 10s lì non fa in tempo a notarsi come
 * "sempre lo stesso". Su un form di login/registrazione l'utente ci resta
 * fermo più a lungo (legge, digita) -- lo stesso loop ripetuto all'infinito
 * in un angolo dell'occhio diventa notabile e fastidioso. Con
 * `derivaAutomatica: false` il bagliore fa UN solo movimento di assestamento
 * verso il centro e poi resta fermo finché non arriva il puntatore -- niente
 * più animazione automatica che si ripete, l'interattività al passaggio del
 * mouse resta identica.
 */
export function useSpotlightScuro(derivaAutomatica: boolean = true) {
  const x = useMotionValue(50);
  const y = useMotionValue(42);
  const xMolla = useSpring(x, { stiffness: 55, damping: 18 });
  const yMolla = useSpring(y, { stiffness: 55, damping: 18 });
  const sfondo = useMotionTemplate`radial-gradient(34% 48% at ${xMolla}% ${yMolla}%, rgba(168,85,247,0.5), transparent 70%)`;

  useEffect(() => {
    if (!derivaAutomatica) return;
    const riduciMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (riduciMovimento) return;

    const controlliX = animate(x, [50, 68, 32, 50], { duration: 10, repeat: Infinity, ease: "easeInOut" });
    const controlliY = animate(y, [42, 28, 58, 42], { duration: 10, repeat: Infinity, ease: "easeInOut" });
    return () => {
      controlliX.stop();
      controlliY.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivaAutomatica]);

  function alMuovimento(e: ReactPointerEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - rect.left) / rect.width) * 100);
    y.set(((e.clientY - rect.top) / rect.height) * 100);
  }

  return { sfondo, alMuovimento };
}
