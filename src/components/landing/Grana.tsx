/**
 * Texture di "grana" (rumore) sottilissima per le sezioni scure -- senza,
 * un gradient piatto su fondo nero legge subito come "sfondo generato al
 * volo"; con un rumore leggerissimo (pochi punti percentuali di opacità)
 * la superficie sembra materiale, non un CSS gradient a caso.
 */
export function Grana({ opacita = 0.05 }: { opacita?: number }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full mix-blend-overlay"
      style={{ opacity: opacita }}
    >
      <filter id="grana-rumore">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grana-rumore)" />
    </svg>
  );
}
