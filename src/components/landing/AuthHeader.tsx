import Link from "next/link";

/**
 * Header condiviso da /accedi e /registrati (terzo giro, richiesta di
 * Gabriel: "se clicco accedi o registrati devo comunque avere il titolo del
 * mio sito sopra, esteticamente bello, che se clicco mi fa tornare alla
 * landing page"). Un link di testo esisteva già sopra il form su entrambe
 * le pagine, ma centrato e piccolo (`text-sm`, nessuno sfondo) -- facile da
 * non notare come un vero header. Questo lo sostituisce con una barra fissa
 * in cima, stesso linguaggio visivo della navbar della landing (Nav.tsx:
 * `bg-noir` sfumato + `backdrop-blur`, stessa tipografia) ma ridotta al solo
 * logo -- queste pagine non hanno link di sezione da mostrare, solo la via
 * di tornare alla home.
 */
export function AuthHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/5 bg-noir/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center px-5 py-4 sm:px-8">
        <Link href="/" className="text-sm font-semibold tracking-tight text-white transition-colors hover:text-white/80">
          Salone AI
        </Link>
      </div>
    </header>
  );
}
