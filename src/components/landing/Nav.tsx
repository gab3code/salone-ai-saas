"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

/** Easing standard "accelera poi rallenta" -- lento in apertura e in
 * chiusura, veloce nel mezzo. Stessa curva descritta da Gabriel ("fallo che
 * accelera piano piano e poi rallenta"). */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const ALTEZZA_NAVBAR = 96; // stesso valore di `scroll-mt-24` (24 * 4px) usato sulle sezioni

/** Scroll fluido con easing personalizzato per ogni link "#ancora" del sito
 * (terzo giro, segnalazione di Gabriel: "lo scorrimento è un po' troppo
 * veloce e poco fluido"). Prima il click su un link della navbar/hero
 * navigava normalmente e lasciava fare tutto a `scroll-behavior: smooth` in
 * globals.css -- comodo ma con l'easing di sistema del browser, non
 * personalizzabile e via, spesso più lineare che "morbido". Un listener
 * unico a livello di documento (montato qui perché Nav è già un componente
 * client presente una sola volta in cima alla pagina) intercetta OGNI click
 * su un link che punta a un'ancora della pagina, non solo quelli della
 * navbar -- copre anche i due CTA della Hero senza dover toccare
 * MagneticButton. Rispetta `prefers-reduced-motion` (salto istantaneo,
 * nessuna animazione) come il resto del sito. */
function useScrollFluido() {
  useEffect(() => {
    function alClick(e: MouseEvent) {
      const el = e.target as HTMLElement;
      const link = el.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.length < 2) return;
      const destinazione = document.querySelector(href);
      if (!destinazione) return;

      e.preventDefault();

      const riduciMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const partenza = window.scrollY;
      const arrivo = destinazione.getBoundingClientRect().top + window.scrollY - ALTEZZA_NAVBAR;
      const distanza = arrivo - partenza;

      if (riduciMovimento || Math.abs(distanza) < 1) {
        window.scrollTo({ top: arrivo, behavior: "instant" });
        history.pushState(null, "", href);
        return;
      }

      const durata = 700;
      const inizio = performance.now();

      function passo(ora: number) {
        const t = Math.min(1, (ora - inizio) / durata);
        // `behavior: "instant"` ad ogni frame: senza, `scroll-behavior:
        // smooth` (globale, in globals.css) applicherebbe il SUO smoothing
        // sopra ogni singolo scrollTo, sommandosi al nostro easing e
        // producendo un movimento a scatti invece che una curva pulita.
        window.scrollTo({ top: partenza + distanza * easeInOutCubic(t), behavior: "instant" });
        if (t < 1) requestAnimationFrame(passo);
        else history.pushState(null, "", href);
      }
      requestAnimationFrame(passo);
    }

    document.addEventListener("click", alClick);
    return () => document.removeEventListener("click", alClick);
  }, []);
}

const LINK_SEZIONI = [
  { href: "#funzionalita", etichetta: "Funzionalità" },
  { href: "#per-chi", etichetta: "Per chi è" },
  { href: "#prezzi", etichetta: "Prezzi" },
];

export function Nav() {
  const [scrollato, setScrollato] = useState(false);
  // Bug segnalato da Gabriel (13/09/2026): "la navbar su telefono e la
  // sezione accedi è inaccessibile". Causa reale: i link di sezione e
  // "Accedi" erano semplicemente `hidden` sotto il breakpoint `sm`
  // (640px), senza che esistesse alcun menu mobile a sostituirli -- su
  // telefono sparivano nel nulla, non c'era alcun modo di raggiungerli
  // dalla navbar (solo "Inizia gratis" restava visibile). Aggiunto un
  // pulsante hamburger, visibile solo sotto `sm` (speculare a `sm:hidden`
  // sui link originali), che apre un pannello a comparsa con tutti e
  // quattro i link nascosti.
  const [menuAperto, setMenuAperto] = useState(false);
  useScrollFluido();

  useEffect(() => {
    const onScroll = () => setScrollato(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Chiude il menu mobile se la finestra torna a una larghezza desktop
  // (es. rotazione tablet o resize), altrimenti resterebbe aperto ma
  // invisibile finché non si torna sotto `sm`.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const chiudiSeDesktop = () => setMenuAperto(false);
    mq.addEventListener("change", chiudiSeDesktop);
    return () => mq.removeEventListener("change", chiudiSeDesktop);
  }, []);

  // Blocca lo scroll della pagina sotto al pannello aperto (pattern
  // standard per i menu mobile a comparsa) -- senza, si potrebbe scrollare
  // il contenuto sottostante mentre il menu resta fisso in overlay.
  useEffect(() => {
    if (!menuAperto) return;
    const precedente = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = precedente;
    };
  }, [menuAperto]);

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
          {/* Richiesta di Gabriel dell'11/09/2026: invece di portare dritti a
              /registrati, ora scende alla sezione prezzi -- così chi clicca
              vede prima i piani (e può comunque scegliere Free per iniziare
              gratis da lì) invece di creare un account senza aver ancora
              visto cosa include ogni piano. */}
          <a
            href="#prezzi"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-transform hover:scale-105"
          >
            Inizia gratis
          </a>
          <button
            type="button"
            onClick={() => setMenuAperto((a) => !a)}
            aria-expanded={menuAperto}
            aria-controls="menu-mobile-nav"
            aria-label={menuAperto ? "Chiudi il menu" : "Apri il menu"}
            className="grid size-9 place-items-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
          >
            {menuAperto ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuAperto && (
          <motion.div
            id="menu-mobile-nav"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="border-t border-white/10 bg-noir/95 px-5 pb-6 pt-2 backdrop-blur-md sm:hidden"
          >
            <div className="flex flex-col divide-y divide-white/10">
              {LINK_SEZIONI.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuAperto(false)}
                  className="py-3 text-base text-white/80 transition-colors hover:text-white"
                >
                  {link.etichetta}
                </a>
              ))}
              <a
                href="/accedi"
                onClick={() => setMenuAperto(false)}
                className="py-3 text-base text-white/80 transition-colors hover:text-white"
              >
                Accedi
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
