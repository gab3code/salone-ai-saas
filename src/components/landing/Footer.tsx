// Reveal aggiunto (terzo giro, richiesta di Gabriel: "voglio che tutto
// compare scendendo nel sito, anche il testo") -- era l'unica sezione della
// pagina rimasta del tutto ferma.
//
// Reveal TOLTO di nuovo (quinto giro, seconda parte -- bug reale segnalato
// da Gabriel: "è scomparso il pie di pagina" sul sito vero). Causa reale:
// `Reveal` usa `whileInView` con `margin: "-80px"` (il contenuto parte da
// opacity:0 finché l'elemento non entra in un'area di viewport ristretta di
// 80px su ogni lato, footer incluso) -- per l'ULTIMO elemento della pagina,
// il cui bordo inferiore coincide con la fine scrollabile del documento,
// serve che il suo bordo superiore arrivi ad almeno 80px dal fondo del
// viewport perché l'observer lo consideri "visibile": con un footer alto
// circa 85px il margine di sicurezza è di soli ~5px, e su Safari mobile
// l'altezza EFFETTIVA del viewport cambia durante lo scroll (la barra degli
// indirizzi si nasconde/mostra), quindi quei 5px potevano sparire da un
// momento all'altro -- l'observer non scattava mai, il contenuto restava a
// opacity:0 per sempre, il footer risultava "scomparso" pur essendo nel DOM
// (il bordo superiore `border-t` restava visibile, il testo dentro no).
// Un footer è un elemento di utilità (link di accesso, copyright): non vale
// il rischio di un'animazione mai partita per un effetto puramente
// estetico. Ora sempre visibile, nessuna dipendenza da scroll/viewport.
export function Footer() {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-white/40 sm:flex-row sm:px-8">
        <span>© {new Date().getFullYear()} Salone AI</span>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <a href="/accedi" className="transition-colors hover:text-white">
            Accedi
          </a>
          <a href="/registrati" className="transition-colors hover:text-white">
            Registrati
          </a>
          {/* Pagine legali (PIANO.md Gruppo D punto 2, 14/09/2026): gap reale,
              il sito non ne aveva nessuna. */}
          <a href="/privacy" className="transition-colors hover:text-white">
            Privacy
          </a>
          <a href="/termini" className="transition-colors hover:text-white">
            Termini
          </a>
          <a href="/cookie" className="transition-colors hover:text-white">
            Cookie
          </a>
        </div>
      </div>
    </footer>
  );
}
