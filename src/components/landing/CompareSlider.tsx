"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/**
 * Cursore trascinabile che confronta due pannelli (ispirato a "Compare" di
 * Aceternity, riscritto da zero con clip-path invece di due immagini --
 * qui non ci sono foto di saloni reali da mostrare, quindi confrontiamo due
 * illustrazioni della UI, non due screenshot).
 */
export function CompareSlider({
  sinistra,
  destra,
  className = "",
}: {
  sinistra: ReactNode;
  destra: ReactNode;
  className?: string;
}) {
  const rifContenitore = useRef<HTMLDivElement>(null);
  const [percento, setPercento] = useState(50);
  const trascinando = useRef(false);

  function aggiorna(clientX: number) {
    const rect = rifContenitore.current?.getBoundingClientRect();
    if (!rect) return;
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPercento(Math.min(100, Math.max(0, p)));
  }

  return (
    <div
      ref={rifContenitore}
      className={`relative touch-none overflow-hidden rounded-2xl border border-white/10 select-none ${className}`}
      onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
        trascinando.current = true;
        aggiorna(e.clientX);
      }}
      onPointerMove={(e) => {
        if (trascinando.current) aggiorna(e.clientX);
      }}
      onPointerUp={() => {
        trascinando.current = false;
      }}
      onPointerLeave={() => {
        trascinando.current = false;
      }}
    >
      <div className="absolute inset-0">{destra}</div>
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - percento}% 0 0)` }}>
        {sinistra}
      </div>

      <div className="absolute inset-y-0 z-10 w-0.5 bg-white/60" style={{ left: `${percento}%` }}>
        <div className="absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M8 6l-6 6 6 6M16 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
