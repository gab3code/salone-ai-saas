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

## Giro 2 (11/09/2026, stesso giorno): "spremi al massimo", ispirazione multi-sito

Dopo il primo giro, Gabriel ha chiesto esplicitamente di spingere ancora di più
("l'UI fa schifo, manca fluidità/interattività, sfondo fermo") e di guardare
oltre Aceternity anche altri cataloghi UI gratuiti/premium. Pattern nuovi
aggiunti in questo giro (tutti riscritti da zero, mai codice copiato --
principio già scritto sopra, vale anche qui):

- **Ispirati da Aceternity** (ui.aceternity.com): Background Beams (→
  `RaggiSfondo.tsx`), Sticky Scroll Reveal (→ Vetrina.tsx esteso da 3 a 6
  scene), Card Spotlight (→ `SpotlightCard.tsx`), 3D Card Effect (→
  `TiltCard.tsx`), Compare (→ `CompareSlider.tsx`), Flip Words (→
  `FlipWords.tsx`), Lamp Effect (→ `Lampada.tsx`), Vortex (→
  `VorticeSfondo.tsx`, canvas 2D invece di libreria dedicata), MacBook Scroll
  (→ `ProdottoScroll.tsx`, GSAP scrub invece di un vero mockup di laptop).
- **Ispirato da Magic UI** (magicui.design, altro catalogo gratuito
  framer-motion/Tailwind, utile per NON restare sull'estetica "solo
  Aceternity" che è diventata comune): Border Beam (→ `BorderBeam.tsx`,
  anello di luce che ruota sul bordo di CTA/card in evidenza).
- **ReactBits** (reactbits.dev) verificato ma non consultabile via WebFetch in
  questo giro (pagina senza contenuto testuale utile) -- da riprovare in
  futuro se serve ispirazione aggiuntiva.

Nuovi file in `src/components/landing/`: `RaggiSfondo.tsx`, `SpotlightCard.tsx`,
`TiltCard.tsx`, `CompareSlider.tsx`, `FlipWords.tsx`, `Lampada.tsx`,
`VorticeSfondo.tsx`, `BorderBeam.tsx`, `ProdottoScroll.tsx`, `PrimaDopo.tsx`,
`PercheNoi.tsx`. Regola pratica confermata da questo giro: mescolare pattern
di più cataloghi (non solo Aceternity) aiuta proprio a evitare l'effetto "sito
AI slop" che Aceternity da solo, ormai molto usato, può produrre se applicato
1:1 senza variazioni.

**Decisione di prodotto presa in questo giro (con Gabriel)**: la sezione
"perché noi" NON nomina i concorrenti (Estetia/Calendix/Skedula) per evitare
rischi di pubblicità comparativa scorretta/obsolescenza -- resta generica sui
nostri differenziatori reali. Ogni funzionalità pianificata ma non ancora
disponibile (WhatsApp, promemoria automatici, Stripe, PWA, Instagram/
Telegram, Prompt Lab, Apple Calendar pubblico) è marcata onestamente "in
arrivo" nella UI (Vetrina.tsx e Funzionalita.tsx), mai presentata come pronta.

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

## Giro 3 (11/09/2026): rifacimento con METODO, dopo il rifiuto esplicito di v2

Gabriel ha bocciato il Giro 2 ("raffazzonato, buttato lì a caso") e ha dato un
metodo preciso da seguire (vedi il messaggio con la sequenza narrativa
mandato a lui prima di toccare codice, non ripetuto qui): un solo linguaggio
visivo per tutta la pagina, un solo "protagonista" per sezione, codice reale
dai connettori (OriginKit/21st) invece di reinventare a mano, screenshot e
autovalutazione dopo ogni sezione prima di andare avanti.

**Decisioni prese in questo giro, con motivazione (richiesta esplicita di
Gabriel -- "dimmi cosa hai deciso e perché"):**

- **Beautiful UI** (`src/app/beautifui/`) -- NON usato in questa landing. Ha
  un sistema di token separato (oklch, `--ink`/`--surface`/ecc., pensato per
  tabelle/UI dati fitte -- vedi `foundation.css` + `records-table.css`), un
  registro visivo da prodotto/dashboard, non da pagina marketing. Ha senso
  rivalutarlo per la dashboard vera del prodotto, non per questa pagina.
- **Thinking Orbs** (pacchetto npm) -- usato in UN punto solo, mirato:
  `Vetrina.tsx`, scena "assistente AI" (indice 2), un piccolo
  `<ThinkingOrb state="connecting" size={20} theme="dark" />` che compare
  per un attimo tra la domanda del cliente e la risposta dell'AI ("sta
  scrivendo…"). Non è decorazione: rende visibile letteralmente il momento
  in cui l'AI sta elaborando, prima che compaia la risposta.
- **`network-lines`** (OriginKit, il candidato per "perché noi") -- NON
  usato, anche dopo lo sblocco del piano premium: la sezione "perché noi" è
  testuale/fiducia, non uno showcase -- un effetto WebGL pesante lì
  competerebbe col contenuto invece di rinforzarlo. Resta il flusso animato
  semplice già presente (`FlussoAnimato` dentro `PercheNoi.tsx`, 3 nodi
  numerati + puntino che scorre) -- scelta di disciplina visiva, non un
  ripiego per un limite di piano.
- **Effetti "wow" per Hero e CTA finale** -- `liquid-metal` (OriginKit, codice
  reale scaricato via `mcp__OriginKit__get_component`, `LiquidMetal.tsx`):
  sfondo WebGL "metallo liquido" viola->fucsia, riusato con parametri diversi
  in Hero e CTAFinale (stesso linguaggio visivo, non una copia identica --
  un "eco" in apertura e chiusura pagina). Aggiunto un lievissimo tilt di
  parallasse al mouse (reagisce solo allo sfondo, mai al cursore reale, come
  richiesto). `shine-card` (OriginKit) valutato per la griglia Funzionalita
  ma scartato: non ha uno slot `children`, e comunque aggiungere 15 canvas
  WebGL a una griglia di contenuto avrebbe violato la priorità
  "performance/fluidità prima degli effetti". `moving-gradient-button`
  valutato e scartato (troppa configurazione per il beneficio) a favore di
  riusare `glow-border` (OriginKit, `GlowBorder.tsx`) ovunque serva un anello
  luminoso attorno a un bordo: piano consigliato in Prezzi, bottone CTA
  finale.
- **Font unico e palette unificata** (11/09/2026, in risposta al feedback di
  Gabriel "non mi piace il bianco e nero... scegli un font e mantienilo"):
  Inter in tutta l'app via `@fontsource-variable/inter` (non
  `next/font/google` -- il build in questo sandbox non riesce a raggiungere
  fonts.googleapis.com, proxy di rete bloccato con 403 sul CONNECT, non un
  problema transitorio; il pacchetto fontsource scarica i woff2 da npm,
  raggiungibile, e li impacchetta a build time, zero dipendenze di rete
  anche per l'utente finale). Aggiunti due token Tailwind (`--color-noir` /
  `--color-crema`) per unificare gli sfondi.
- **Dark theme unico per tutta la landing** (11/09/2026, in risposta al
  feedback successivo di Gabriel "o chiaro o scuro, segui il prompt e non
  rendere la pagina confusionaria"): l'alternanza sezioni scure/chiare
  (pensata inizialmente per dare ritmo) è stata giudicata confusionaria --
  tornata su un'unica identità scura (`bg-noir`) per l'intera pagina, testo
  bianco/violet-400 ovunque, card `bg-white/5` con bordo `border-white/10`.
  Il token `--color-crema` resta definito in `globals.css` ma non è più
  usato in questa landing (tenuto per eventuale riuso altrove nell'app, che
  resta a tema chiaro). I mockup "UI dentro la UI" (chat/dashboard finti
  dentro Hero/Vetrina/ProdottoScroll, pannello "senza AI" nel compare slider
  di PrimaDopo) restano con colori propri anche diversi dallo sfondo di
  sezione -- sono illustrazioni di prodotto, non blocchi di pagina, quindi
  non violano la regola "una sola identità" della pagina.
- **Bug reale trovato e risolto: parola rotante in Hero bloccata invisibile**
  (`FlipWords.tsx`) -- la parola animata ("salone"/"studio"/...) restava
  bloccata per sempre allo stato iniziale (`opacity: 0`, `filter: blur(8px)`)
  invece di animarsi, verificato via Playwright leggendo gli stili calcolati
  nel tempo (non solo screenshot). Causa isolata per esclusione: rimuovendo
  `filter: blur()` dalle keyframe di ingresso/uscita (tenendo solo
  opacity+y) l'animazione riparte e completa normalmente -- indica un
  conflitto tra l'animazione del `filter` di Framer Motion e il layer di
  compositing forzato (`isolate` + `translateZ(0)`) aggiunto in un giro
  precedente per un diverso bug di rendering WebGL. Effetto finale invariato
  nella sostanza (fade + slide verticale), solo la sfocatura d'ingresso è
  stata tolta.
