import type { MetadataRoute } from "next";

/**
 * PWA installabile (Fase 4 di PIANO.md, promessa anche in `Funzionalita.tsx`
 * e come voce di prezzo Enterprise in `Prezzi.tsx`) -- QUESTA è la versione
 * base (manifest + service worker minimo, vedi public/sw.js): icona
 * placeholder nei colori del sito (noir + viola, vedi globals.css), non
 * ancora il logo vero. La rifinitura (splash screen curata, esperienza a
 * schermo intero) è un task a parte in Fase 7, deliberatamente non qui.
 *
 * File speciale dell'App Router: Next lo serve automaticamente su
 * `/manifest.webmanifest` e aggiunge da solo il `<link rel="manifest">` nel
 * `<head>` -- nessun collegamento manuale necessario in layout.tsx.
 *
 * `start_url: "/dashboard"`: chi installa l'app è il titolare che la usa per
 * lavorare (calendario/prenotazioni), non un cliente finale -- aprirla sulla
 * landing ogni volta sarebbe una frizione inutile. Un titolare non ancora
 * loggato viene comunque rimandato a `/accedi` da `/dashboard` stesso
 * (redirect già esistente), quindi resta un punto di partenza sempre valido.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Salone AI",
    short_name: "Salone AI",
    description: "Gestionale e prenotazioni online per centri estetici, parrucchieri e barbieri",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#07040d",
    theme_color: "#07040d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
