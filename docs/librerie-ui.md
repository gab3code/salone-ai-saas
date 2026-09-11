# Librerie/connettori UI da usare per questo progetto

Nota persistente (richiesta da Gabriel l'11/09/2026) per non perdere di vista, in sessioni
future, quali strumenti UI sono disponibili e come usarli. Vale soprattutto per superfici
rivolte all'esterno (landing page, pagina pubblica del salone) dove l'obiettivo è "il top del
top" -- moderno, fluido, interattivo, dinamico (vedi anche le preferenze salvate di Gabriel).

## Connettori MCP reali (ricerca componenti/pattern)

- **21st / "Magic"** (`mcp__21st__search`, `mcp__21st__get_component`, ecc.) -- catalogo di
  componenti React/Tailwind/shadcn pronti (hero, pricing, feature grid...). Cercare qui PRIMA di
  scrivere un componente da zero per una sezione della landing.
- **OriginKit** (`mcp__OriginKit__search`, `list_components`, `get_component`) -- stesso uso,
  catalogo complementare.

Entrambi vanno interrogati con `ToolSearch` se non già caricati (i tool si disconnettono e
riconnettono nel corso di una sessione lunga -- ricaricarli con
`ToolSearch("select:mcp__21st__search,mcp__OriginKit__search,...")`, non aspettare che
riappaiano da soli).

**Limite noto (11/09/2026):** `mcp__21st__get_component` ha una quota free-tier di **2
chiamate/giorno** -- esaurita in questa sessione (hero + bento grid). `mcp__21st__search` non
sembra avere lo stesso limite stretto, quindi va bene per esplorare; è `get_component` (il
dettaglio/codice del singolo componente) a essere razionato. Pianificare le chiamate: cercare
prima, scegliere il componente più utile, e chiamare `get_component` solo su quello.

## Siti di riferimento (NON connettori installabili -- verificato via SearchMcpRegistry
l'11/09/2026, non hanno un server MCP)

Da consultare con `WebFetch` per capire un pattern/effetto, poi RIPRODURRE con librerie vere
(sotto) -- mai copiare blocchi di codice interi con branding/commenti originali (limite
copyright): si prende l'idea dell'interazione, si scrive un'implementazione propria.

- **Aceternity UI** (ui.aceternity.com) -- effetti "wow" (spotlight, bento grid animata, text
  reveal, background beams...), quasi tutti costruiti sopra Framer Motion.
- **transitions.dev** -- pattern di transizione/animazione per landing page.
- **Agentation** (agentation.dev) -- pattern UI per prodotti AI-native.

## Librerie reali installate in `package.json` (11/09/2026)

- **framer-motion** ("motion") -- animazioni React dichiarative (scroll reveal, stagger,
  hover/press, layout animations). Libreria PRINCIPALE per l'interattività della landing.
- **gsap** (+ ScrollTrigger) -- per effetti scroll-driven più elaborati che Framer Motion non
  copre bene (scrub, pin, timeline complesse).
- **tw-animate-css** -- già presente, utility di animazione via classi Tailwind per casi semplici.

## Risorse locali NON wired a nessuna pagina (valutare caso per caso, non riusare alla cieca)

- `src/app/beautifui/` + `src/components/primitives/`, `src/components/atoms/` -- galleria
  "Beautiful UI": componenti demo con dati finti/scriptati e un set di token CSS
  (`--ink`, `--surface`, ecc.) SEPARATO da quello del resto dell'app (`src/app/globals.css`,
  token shadcn `--background`/`--foreground`/ecc.) -- importarlo globalmente rischia di far
  collidere due build Tailwind indipendenti. Uso consigliato: prendere ispirazione visiva
  (spaziature, ombre, radii) e riscrivere con i token già globali, MAI importare
  `foundation.css` in una pagina reale senza aver verificato l'impatto.
- **thinking-orbs** (pacchetto npm già installato) -- da valutare se serve un effetto "AI sta
  pensando" a orb 3D; non ancora usato da nessuna pagina.

## Regola pratica

Per ogni nuova sezione della landing: (1) cercare su 21st/OriginKit se esiste già un componente
del genere, (2) se serve un effetto più specifico, guardare Aceternity/transitions.dev per il
pattern, (3) implementarlo con framer-motion/gsap dentro lo stile Tailwind già in uso nel
progetto (non i token "Beautiful UI").

## Pattern concreti già implementati sulla landing (`/`, 11/09/2026)

Riferimento rapido per non re-inventarli in una sessione futura -- tutti in
`src/components/landing/`:

- **`Vetrina.tsx`** -- GSAP `ScrollTrigger` con `pin` + `scrub`: un pannello resta fisso mentre
  si scorre e una callback `onUpdate` guida uno state React (quale "scena" è attiva), crossfade
  tra scene con Framer Motion `AnimatePresence`. Pattern da usare quando un fade-in/reveal
  semplice non basta e serve vero "scrollytelling".
- **`MagneticButton.tsx`** -- bottone che segue leggermente il cursore (`useMotionValue` +
  `useSpring` di framer-motion, offset dal centro scalato da un fattore `forza`, reset a 0 su
  mouse-leave). Dettaglio a basso costo che however distingue subito un sito curato da un
  template generico -- usarlo su ogni CTA primaria.
- **`Grana.tsx`** -- overlay SVG `feTurbulence` (rumore/grana) con `mix-blend-overlay` e opacità
  bassissima (0.03-0.05), da mettere su ogni sezione a sfondo scuro/gradient per evitare l'effetto
  "gradient CSS piatto" tipico dei siti generati al volo.
- **`Reveal.tsx`** (`Reveal`/`RevealStagger`/`RevealItem`) -- scroll-reveal condiviso via Framer
  Motion `whileInView`. Attenzione: `RevealItem` non ha un proprio trigger, va sempre annidato
  dentro un `Reveal`/`RevealStagger`, altrimenti resta invisibile per sempre.
- Regola contro l'effetto "AI slop": evitare gradient a 3+ stop (usare 2 stop, es.
  `from-violet-400 to-fuchsia-400`), evitare griglie bento con `colSpan` disomogenei se il numero
  di elementi non le riempie esattamente (lascia buchi vuoti -- usare una griglia uniforme, o uno
  showcase scroll-driven come `Vetrina.tsx` per gli elementi "principali"), non usare mockup
  generici di browser-chrome senza personalizzarli col vero contesto del prodotto.
