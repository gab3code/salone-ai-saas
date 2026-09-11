"use client";

import { motion } from "framer-motion";

/**
 * Fasci di luce diagonali che attraversano lo sfondo (ispirati a "Background
 * Beams" di Aceternity, riscritti da zero con semplici gradient animati via
 * framer-motion invece di path SVG -- più leggero, stesso effetto "wow" per
 * una hero scura). Va combinato con il glow che segue il mouse già presente
 * in Hero.tsx, non lo sostituisce.
 */
const RAGGI = [
  { top: "8%", durata: 7, ritardo: 0, spessore: 2 },
  { top: "28%", durata: 9.5, ritardo: 1.4, spessore: 1.5 },
  { top: "52%", durata: 8.2, ritardo: 2.6, spessore: 2.5 },
  { top: "74%", durata: 10.5, ritardo: 0.7, spessore: 1.5 },
  { top: "92%", durata: 8.8, ritardo: 3.2, spessore: 2 },
];

export function RaggiSfondo({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {RAGGI.map((r, i) => (
        <motion.div
          key={i}
          className="absolute left-[-20%] w-[140%] -rotate-6"
          style={{
            top: r.top,
            height: `${r.spessore}px`,
            background: "linear-gradient(90deg, transparent, rgba(196,140,255,0.6), transparent)",
            filter: "blur(1.5px)",
          }}
          animate={{ x: ["-8%", "8%"], opacity: [0, 0.85, 0] }}
          transition={{ duration: r.durata, delay: r.ritardo, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
