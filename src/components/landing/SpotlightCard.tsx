"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

/**
 * Card che rivela un bagliore radiale nel punto esatto del cursore al hover
 * (ispirata a "Card Spotlight" di Aceternity, riscritta da zero: coordinate
 * del mouse in variabili CSS, nessuna libreria in più necessaria).
 */
export function SpotlightCard({
  children,
  className = "",
  colore = "rgba(168,85,247,0.16)",
}: {
  children: ReactNode;
  className?: string;
  colore?: string;
}) {
  const rifCard = useRef<HTMLDivElement>(null);

  function alMovimento(e: MouseEvent<HTMLDivElement>) {
    const el = rifCard.current;
    const rect = el?.getBoundingClientRect();
    if (!el || !rect) return;
    el.style.setProperty("--sx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--sy", `${e.clientY - rect.top}px`);
  }

  return (
    <div ref={rifCard} onMouseMove={alMovimento} className={`group relative overflow-hidden ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(260px circle at var(--sx, 50%) var(--sy, 50%), ${colore}, transparent 70%)` }}
      />
      {children}
    </div>
  );
}
