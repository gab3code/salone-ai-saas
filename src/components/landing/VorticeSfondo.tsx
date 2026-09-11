"use client";

import { useEffect, useRef } from "react";

/**
 * Sfondo a particelle che salgono lente, come un "vortice" di luce
 * (ispirato a "Vortex" di Aceternity, riscritto da zero su canvas 2D --
 * niente dipendenze in più). Pensato per la sezione CTA finale, dove uno
 * sfondo completamente fermo si sente subito "spento".
 */
export function VorticeSfondo({ className = "" }: { className?: string }) {
  const rifCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = rifCanvas.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let larghezza = 0;
    let altezza = 0;
    let idFrame = 0;

    type Particella = { x: number; y: number; vx: number; vy: number; r: number; alfa: number };
    let particelle: Particella[] = [];
    const NUMERO = 90;

    function ridimensiona() {
      const rect = canvas!.getBoundingClientRect();
      larghezza = canvas!.width = Math.max(1, rect.width);
      altezza = canvas!.height = Math.max(1, rect.height);
    }

    function crea() {
      particelle = Array.from({ length: NUMERO }, () => ({
        x: Math.random() * larghezza,
        y: Math.random() * altezza,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.15 - Math.random() * 0.45,
        r: Math.random() * 1.4 + 0.4,
        alfa: Math.random() * 0.5 + 0.2,
      }));
    }

    function passo() {
      if (!ctx) return;
      ctx.clearRect(0, 0, larghezza, altezza);
      for (const p of particelle) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -8) {
          p.y = altezza + 8;
          p.x = Math.random() * larghezza;
        }
        if (p.x < -8) p.x = larghezza + 8;
        if (p.x > larghezza + 8) p.x = -8;

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
        grad.addColorStop(0, `rgba(196,140,255,${p.alfa})`);
        grad.addColorStop(1, "rgba(196,140,255,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 7, 0, Math.PI * 2);
        ctx.fill();
      }
      idFrame = requestAnimationFrame(passo);
    }

    ridimensiona();
    crea();
    passo();

    const alRidimensionamento = () => ridimensiona();
    window.addEventListener("resize", alRidimensionamento);
    return () => {
      cancelAnimationFrame(idFrame);
      window.removeEventListener("resize", alRidimensionamento);
    };
  }, []);

  return <canvas ref={rifCanvas} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />;
}
