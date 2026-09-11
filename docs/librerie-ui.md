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
- **Bug reali di layout trovati e risolti dopo un secondo giro di feedback
  duro di Gabriel** ("il sito fa pena... piramide messa a caso, spaziato
  male, abbonamenti storti, parte finale orrenda") -- tutti bug concreti,
  non impressioni:
  - `Lampada.tsx` (usato in PercheNoi): il "cono di luce" sopra il titolo
    usava un `clip-path: polygon(...)` per ritagliare un rettangolo sfocato
    a forma di trapezio -- con il blur non abbastanza forte rispetto alla
    dimensione della forma, si vedevano gli spigoli dritti del poligono
    invece di un bagliore morbido (la "piramide"). Riscritto senza
    clip-path: solo un'ellisse (`rounded-full`) molto sfocata, geometricamente
    impossibile che mostri uno spigolo.
  - `PercheNoi.tsx` e `PerChi.tsx`: entrambi mappano 5 elementi su una
    griglia a 3 colonne (`sm:grid-cols-2 lg:grid-cols-3`) -- 5 non è
    multiplo di 3, quindi l'ultima riga aveva 2 elementi a sinistra e un
    buco vuoto a destra. Fix: le prime 3 card restano nella griglia normale,
    le ultime 2 vanno in una riga a parte (`flex flex-wrap justify-center`)
    larga quanto sarebbero state nella griglia (`calc((100%-2rem)/3)`) --
    centrate come coppia, nessun buco. (Un primo tentativo con
    `lg:col-start-2` sul solo ultimo elemento era sbagliato: funziona solo
    se la riga finale ha UN elemento, qui ne ha due.)
  - `Prezzi.tsx`: le 5 card piano avevano altezze diverse ("storto") --
    causa reale: `h-full` sulla card interna non aveva nulla da cui
    ereditare l'altezza, perché né `RevealItem` né il wrapper `p-px` del
    piano consigliato avevano un'altezza esplicita (una griglia CSS stira
    il grid item, ma non i suoi discendenti a cascata senza `h-full` ad
    ogni livello). Aggiunto `h-full` su `RevealItem` e sul wrapper --
    tutte le card ora hanno sempre l'altezza della riga.
  - `CTAFinale.tsx`: nessun padding-top -- il box viola nasceva incollato
    subito sotto la griglia prezzi. Aggiunto `pt-12`/`sm:pt-16` alla
    sezione e più `py` interno al box per una chiusura che respira invece
    di un'appendice incollata.
- **Terzo giro di feedback (11/09/2026), su cose più di sostanza che di
  bug puntuali** -- "prima di fare il push, la cosa in fondo non mi piace...
  la cosa dell'inizia gratis degli abbonamenti non la capisco... le
  funzioni mi sembrano un po' troppe ed incasinate":
  - `CTAFinale.tsx` riscritta da zero, non solo aggiustata. Causa del
    "non mi piace": riusava `LiquidMetal` (lo stesso shader animato
    dell'Hero) dentro una card piccola con solo un titolo e un bottone --
    in Hero lo shader è a piena pagina con badge/titolo/mockup prodotto
    sopra a bilanciarlo, qui diventava l'UNICO elemento visivo e leggeva
    come un gradient viola da "template AI generico", non come una chiusura
    sobria da SaaS vero. Sostituito con un bagliore ambientale morbido
    (due ellissi sfocate agli angoli, stessa tecnica di `Lampada.tsx`, mai
    un vortice a piena card) + un `GlowBorder` sottile sul bordo dell'intera
    card (dettaglio, non protagonista) + tre garanzie concrete come chip
    ("Nessuna carta richiesta", "Attivo in 5 minuti", "Cancella quando
    vuoi") al posto di una riga di sottotitolo -- più contenuto vero, meno
    colore.
  - `Prezzi.tsx`: bug reale, non solo di percezione -- il bottone diceva
    "Inizia gratis" anche su Starter/Growth/Pro (€19,90-69,90). Verificato
    in `DECISIONS.md` e `PROJECT_STATUS.md`: non esiste ancora uno Stripe
    checkout, "/registrati" crea SEMPRE lo stesso account sul piano Free
    a prescindere da quale card si clicchi -- il piano si cambia oggi solo
    a mano nel database. "Inizia gratis" resta quindi vero solo per la
    card Free; le altre ora dicono "Crea il tuo account" (vero per
    tutte, senza promettere un'attivazione a pagamento che il prodotto
    non sa ancora fare da solo). Enterprise invariato ("Richiedi info").
  - `Funzionalita.tsx`: 15 card identiche (10 vere + 5 pianificate) con lo
    stesso peso visivo erano il problema, non il numero in sé -- un badge
    ambra piccolo tra 15 box uguali non basta a far percepire la gerarchia
    "disponibile ora" vs "in arrivo". Separate in due gruppi con peso
    diverso: le 9 funzioni vere restano card complete in una griglia pulita
    a 3 colonne (righe piene, nessun resto); le 6 pianificate diventano una
    fascia unica sotto, bordo tratteggiato ambra, chip compatte con solo
    icona+titolo (descrizione nel `title` dell'elemento) -- stesso contenuto
    onesto di prima, ma un peso visivo minore perché minore è davvero.
  - Verificato con screenshot Playwright desktop+mobile (0px di overflow
    orizzontale, 0 errori console su entrambi) prima di committare.
- **Quarto giro (11/09/2026), feedback su uno screenshot dal vivo di
  salone-ai-saas.vercel.app + audit di fattibilità richiesto esplicitamente
  ("verifica che tutto quello che offriamo lo possiamo effettivamente
  realizzare")**:
  - `Hero.tsx`: "mai più senza risposta." era in gradient viola->fucsia
    (`bg-clip-text`) sopra lo shader Liquid Metal, anch'esso viola->fucsia --
    a seconda della fase dello shader il testo poteva quasi sparire nello
    sfondo ("colore orrendo"). Passato a testo bianco pieno + bagliore
    (`text-shadow`), sempre leggibile a qualunque fase. Rimosso anche "con
    Marco" dalla risposta dell'AI nel mockup: il calendario a fianco mostra
    già un cliente "Marco R." alle 10:00, riusare lo stesso nome per quello
    che sembra un operatore leggeva come un errore, non un esempio pulito.
  - `LiquidMetal.tsx`: il tilt di parallasse al mouse era di soli 3 gradi con
    mezzo secondo di transizione -- impercettibile su uno shader già "vivo"
    di suo ("lo sfondo è poco reattivo"). Portato a 9 gradi, 150ms, aggiunto
    un alone radiale bianco (`mix-blend-screen`) che segue davvero il punto
    sotto il cursore.
  - `ProdottoScroll.tsx`: bug reale, non di percezione -- sotto "3 clienti
    non prenotano da 60 giorni" la lista riusava lo stesso array
    orario+servizio degli appuntamenti DI OGGI mostrati sopra ("hai messo
    robe a caso"). Sostituito con nomi diversi (formato nome + iniziale,
    come richiesto) e un'etichetta "Contatta" per azione, coerente con
    "un pulsante per contattare i clienti inattivi" già promesso altrove.
  - `Prezzi.tsx`: il badge "Consigliato" viveva dentro il flusso della card
    (prima di nome/prezzo) -- su Growth aggiungeva ~36px che le altre 4 card
    non avevano, disallineando nome/prezzo/descrizione lungo la riga
    ("rovina l'ordine"). Spostato fuori dal flusso: etichetta assoluta che
    sporge sopra il bordo della card.
  - `Vetrina.tsx`: ogni scena portava la propria mini-finestra (bordo +
    pallini) annidata dentro il grande pannello che GIÀ la incornicia --
    "riquadro dentro un altro riquadro, e quello dentro è minuscolo".
    Riscritto: UNA sola barra da finestra sul pannello esterno (con l'URL
    che cambia per scena), le scene ora restituiscono solo il contenuto a
    piena larghezza. Aggiunta animazione di ingresso a stagger sul
    contenuto di alcune scene per sentirsi più "vive" ("poco fluida").
  - `PrimaDopo.tsx`: aggiunto un calcolo economico illustrativo sotto lo
    slider ("un messaggio senza risposta a settimana, su uno scontrino
    medio di 35€, sono oltre 1.800€/anno") per rendere concreto il
    vantaggio, richiesto da Gabriel ("vantaggi economici, quanto fatturato
    salverebbero"). Non un dato reale medio sui clienti (non ne abbiamo
    ancora, il prodotto non è live) -- un calcolo con ipotesi dichiarate ed
    esplicitamente etichettato come illustrativo, stessa disciplina già
    usata per gli altri mockup ("mai dati finti spacciati per reali").
  - **Audit di fattibilità** (richiesta esplicita di Gabriel): incrociando
    Prezzi.tsx/Funzionalita.tsx con PROJECT_STATUS.md sono emerse 5 voci
    vendute come incluse su un piano a pagamento ma in realtà MAI costruite
    (zero codice, non solo "da rifinire"): **Analytics** (Growth -- zero
    codice oltre ai dati grezzi in tabella), **SMS** (Pro -- nessuna
    integrazione, mai menzionato nel codice prima d'ora), oltre a WhatsApp/
    Tono AI/Instagram-Telegram/PWA (già noti "in arrivo" altrove ma non
    marcati qui). Aggiunto badge "in arrivo" inline su ogni voce non ancora
    costruita nelle card prezzi, e aggiunte Analytics+SMS alla griglia
    Funzionalita.tsx per coerenza. Trovato anche un caso più serio: Vetrina
    prometteva "Apple/iCloud tecnicamente pronto, in attesa di essere
    riaperto" -- ma PROJECT_STATUS.md (problema #14) documenta che è
    bloccato lato Apple sul traffico CalDAV da IP di data center/cloud,
    **non risolvibile da Vercel senza instradare da un IP non-cloud** -- non
    è "quasi pronto", potrebbe non esserlo mai su questo hosting. Rimossa la
    promessa dal marketing (testo raccontato solo per Google Calendar,
    Apple nel mockup passato a "in valutazione" invece di "pronto");
    posizionamento finale da decidere con Gabriel (vedi messaggio a parte).
