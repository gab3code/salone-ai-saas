# Stato del progetto

Ultimo aggiornamento: 12/09/2026, quinto giro (Gabriel ha usato il sito pubblicato dal quarto
giro e segnalato altri 7 punti, arrivati anche a metà del lavoro di questo giro stesso -- lo
sfondo della CTA finale rifatto una seconda volta è stato mostrato con 4 opzioni via screenshot
PRIMA di scrivere codice, come richiesto esplicitamente. Bug reali risolti: FAQ e pagina di
registrazione promettevano ancora 10 giorni di prova sul piano Pro, tolto dal terzo giro --
corretti entrambi usando la stessa funzione `giorniDiProva` invece di un secondo elenco di piani
scritto a mano; le card della griglia Funzionalita comparivano tutte insieme invece che una riga
alla volta scendendo (causa reale: il reveal-on-scroll era orchestrato dal CONTENITORE, non dalle
singole card -- riscritto Reveal.tsx perché ogni card si attivi da sola in base alla propria
posizione di scroll, non più a un ritardo condiviso, effetto ora sentito su tutto il sito, non
solo lì); le card piccole della stessa griglia erano senza testo e "inutilmente alte" su
telefono -- causa reale la combinazione tra descrizione nascosta di proposito e `auto-rows-fr`
che pareggiava l'altezza di righe non correlate. Pulsanti "metal" dei piani a pagamento
ripensati come un sottile anello animato attorno a un pulsante scuro pieno, non più uno shader
che riempie tutto il pulsante (ispirazione cercata sui connettori 21st.dev/OriginKit su
richiesta di Gabriel). Vedi la sezione dedicata più sotto per il dettaglio completo. Aggiornamento
precedente, 12/09/2026 quarto giro (Gabriel ha usato il sito pubblicato dal terzo
giro e segnalato 13 nuovi punti via screenshot + testo; 4 erano scelte di design ambigue --
chiarite con `AskUserQuestion` prima di agire, come richiesto esplicitamente da Gabriel in
chiusura del suo messaggio -- le altre erano bug/rifiniture concrete. Vedi la sezione dedicata
più sotto per il dettaglio completo: griglia Funzionalita riordinata per un bug reale di
`grid-auto-flow: dense` a 3 colonne, non solo "riordinata a caso"; click-scroll di Vetrina.tsx
corretto (usava `offsetTop`, relativo all'antenato posizionato più vicino, non al documento);
card featured di PerChi spostata su "chiunque lavori su appuntamento"; TiltCard aggiunto alle
card di PercheNoi; pulsanti dei piani a pagamento con effetto LiquidMetal graduato (Starter ->
Growth -> Pro, sempre più "premium"); pulsante magnetico rimosso dalla CTA finale (disallineava
il bordo animato); scroll della navbar con easing personalizzato; nuovo header condiviso per
`/accedi` e `/registrati`; copy del riquadro verde di ImpattoEconomico riscritto una seconda
volta per nominare sia i messaggi senza risposta sia gli appuntamenti dimenticati; Reveal esteso
a `Footer.tsx` e alla didascalia di `PrimaDopo.tsx`, le uniche porzioni di testo rimaste ferme).
Aggiornamento precedente, 12/09/2026 terzo giro (Gabriel ha scaricato e usato lui stesso il sito
pubblicato dal secondo giro, con screenshot alla mano, e segnalato 10 problemi puntuali --
3 dei quali decisioni di prodotto vere (scope multi-canale AI, trial ristretto a Growth,
contenuto/Lampada di PercheNoi), non solo estetiche: vedi DECISIONS.md, voce omonima, e la
sezione dedicata più sotto per il dettaglio completo. Chiuso anche il controllo di coerenza
generale richiesto esplicitamente da Gabriel -- PIANO.md/DECISIONS.md/PROJECT_STATUS.md contro
il codice reale, vedi "Controllo di coerenza" più sotto). Aggiornamento precedente, 12/09/2026
secondo giro (Gabriel ha usato il sito pubblicato e segnalato
15 problemi puntuali dopo averlo provato di persona; lavorato con domande di chiarimento prima
di agire e opzioni mostrate prima di ogni redesign visivo, come richiesto esplicitamente. Cambio
di fondo: rimosse tutte le etichette "in arrivo"/"nel roadmap" dalla landing -- il sito ora
descrive il prodotto al lancio commerciale, non lo stato di oggi (vedi DECISIONS.md). Bug reali
diagnosticati e risolti con verifica strumentale (non a occhio): FAQ laggose/che si allargavano
su desktop (due cause distinte, vedi sezione dedicata sotto), sfondo Hero che non reagiva al
mouse su quasi tutto lo schermo, click navbar senza scroll fluido, un hydration mismatch
introdotto e poi trovato/corretto nello stesso giro. Tre sezioni riscritte con una bento grid
asimmetrica dopo aver mostrato le opzioni a Gabriel (Funzionalita, PerChi, e la timeline di
PercheNoi). Vedi la sezione dedicata più sotto per il dettaglio completo -- 112/112 test, build
pulita, zero console error in uno scroll reale completo, desktop e mobile). Aggiornamento
precedente, 12/09/2026 primo giro (sessione di controllo visivo e rifinitura pre-pubblicazione
della landing page, richiesta esplicita di Gabriel prima di andare a dormire, lavorata in piena
autonomia: verificata dal vivo con Playwright -- desktop E mobile, scroll reale simulato passo
per passo, non salti bruschi -- l'intera pagina dall'inizio alla fine; risolto un bug reale di
scroll-jacking che rendeva 4 delle 6 scene della "Vetrina" **irraggiungibili su mobile**; rifatta
da zero la sezione calcolo economico come vera sezione a due colonne con numero animato;
aggiunta una FAQ pre-footer; portate `/registrati` e `/accedi` (le pagine dove si converte
davvero) dallo stile HTML grezzo di default allo stesso linguaggio visivo premium del resto del
sito; rimossa ogni traccia da "demo"/"in costruzione" ancora visibile pubblicamente -- vedi la
nuova sezione dedicata più sotto per il dettaglio completo. Vedi anche l'aggiornamento
precedente, sotto, per lo stato del backend/prodotto, che oggi non è stato toccato). Aggiornamento
precedente, 11/09/2026 (fuso orario reale del tenant risolto e verificato dal vivo;
Apple/iCloud CalDAV probabilmente inutilizzabile da Vercel per un blocco lato Apple sugli IP di
data center -- vedi problema noto #14 -- Google Calendar resta il canale affidabile; Fase 4,
pagina pubblica del salone, codice scritto e testato ma non ancora verificato dal vivo -- vedi
sotto; nuova landing page di marketing (`/`) scritta da zero, poi ampliata una seconda volta lo
stesso giorno su feedback esplicito di Gabriel ("fa schifo, manca fluidità/interattività") --
ora copre l'intero set di funzionalità (attuali + pianificate, marcate oneste "in arrivo"),
con pattern ispirati sia ad Aceternity sia a Magic UI (vedi `docs/librerie-ui.md`) -- verificata
dal vivo in-sandbox con Playwright, poiché non dipende da Supabase). Aggiornare questo file ogni volta che cambia lo stato
reale di qualcosa (una funzionalità passa da mock a vera, un problema si apre/chiude, una fase
si chiude) — non lasciarlo invecchiare. Vedi `CLAUDE.md` per le regole di lavoro, `DECISIONS.md`
per il perché delle scelte architetturali, `PIANO.md` per il piano a fasi.

## In una riga

Fase 0 (fondamenta multi-tenant) e Fase 1 (booking engine collegato al database) **chiuse e
verificate dal vivo con un salone di test reale**. Fase 2 (AI conversazionale): il loop completo
MESSAGGIO -> AI -> strumenti -> booking engine -> risposta **funziona ed è stato verificato dal
vivo**, inclusi gli scenari di conversazione ambigua/interrotta/trasferimento a operatore --
resta da fare solo WhatsApp/Telegram (bloccato su business verification Meta). Fase 3: CRM di
base e dashboard con metriche reali/insight **chiusi e verificati dal vivo**; analytics più
avanzate non ancora iniziate. Fase 5: struttura piani (Free -> Enterprise) decisa con Gabriel e
**applicata tecnicamente** (gate AI per piano, quota mensile, anti-burst, tetto prenotazioni
Free) -- **Stripe checkout/webhook/customer portal collegati anche tecnicamente** (11/09/2026
sera, vedi sotto), non ancora verificati dal vivo con un pagamento di test reale; manca ancora
il pannello admin. Fase 6bis (fuori dai 33 punti originali, aggiunta su richiesta di Gabriel):
sincronizzazione calendario personale dell'operatore, direzione import/blocco, costruita per
entrambi i provider ma **verificata dal vivo solo per Google** (funziona) -- **Apple/iCloud via
CalDAV è tecnicamente corretto (client verificato via test comparativo diretto con `curl`) ma
probabilmente inutilizzabile in produzione perché Apple sembra bloccare il traffico CalDAV che
arriva da IP di data center/cloud come quelli di Vercel** (problema noto #14, non risolvibile
lato nostro senza un proxy con IP non-datacenter). La direzione export (mostrare gli appuntamenti
del salone sul calendario personale) non ancora scritta per nessuno dei due. Fase 4 (pagina
pubblica per-attività, punto 15): **codice scritto e testato l'11/09/2026** (`/s/[slug]`,
prenotazione self-service, widget chat AI) ma **non ancora verificato dal vivo in un browser
reale** -- da fare dopo il deploy (vedi sopra il perché). Landing page di marketing (`/`, fuori
dai 33 punti originali, richiesta esplicita di Gabriel l'11/09/2026, ampliata lo stesso giorno
su suo feedback): **scritta e verificata dal vivo in-sandbox** (nessuna dipendenza da Supabase,
quindi verificabile qui con Playwright) -- sezioni Hero (parola che ruota tra salone/studio/
centro/spazio, anteprima animata del prodotto, sfondo a fasci di luce), un "MacBook scroll"
del dashboard vero, un confronto prima/dopo trascinabile, Come funziona, una "vetrina"
scroll-driven (GSAP `ScrollTrigger` pin+scrub) estesa a 6 scene che copre TUTTO il set di
funzionalità (il sito descrive il prodotto al lancio commerciale, non lo stato di oggi -- vedi
DECISIONS.md), una sezione "perché questo" con i differenziatori reali (senza nominare
concorrenti, deciso con Gabriel) e una timeline verticale del flusso, una bento grid asimmetrica
di tutte le funzionalità, per-chi (bento grid, 6 categorie incluso un "chiunque altro"),
prezzi (dati reali da `DECISIONS.md`, piano consigliato con bordo animato), CTA finale con
sfondo a particelle. Dettagli tecnici e libreria di pattern riusabili (Aceternity + Magic UI)
in `docs/librerie-ui.md`. Tutto il resto (automazioni, PWA, Stripe/checkout) non ancora
iniziato.

## Sessione di rifinitura pre-pubblicazione della landing page (12/09/2026)

Richiesta di Gabriel (in italiano, mentre andava a dormire): non una revisione del codice, ma
un vero giro da utente reale su desktop e mobile, sezione per sezione, per portare la landing
page (`/`, `/registrati`, `/accedi`) da "funziona" a "pubblicabile e vendibile". Lavorato in
piena autonomia, senza fermarsi a chiedere conferma (istruzione esplicita di Gabriel). Metodo di
verifica: Playwright headless, screenshot presi con **scroll simulato a piccoli passi (90px,
35ms di pausa)** invece di salti bruschi di `scrollTo` -- i salti bruschi producevano falsi
allarmi su componenti animati con Framer Motion/GSAP (pannelli che sembravano "sanguinare",
scene che sembravano vuote) che sparivano completamente con uno scroll realistico. Lezione da
tenere per le prossime sessioni di QA visivo su questa pagina.

**Bug reale trovato e risolto -- Vetrina mobile (il problema più grave dei 12 punti di
Gabriel)**: la showcase a 6 scene (`Vetrina.tsx`) usa GSAP `ScrollTrigger` con `pin: true` per
l'effetto "fermo mentre scrollo" su desktop. Su mobile lo stesso pin restava attivo, ma lo stack
di card sotto (più alto della viewport) diventava `position: fixed` per l'intera durata dello
scroll-trigger -- di fatto **4 delle 6 scene non erano mai raggiungibili scrollando su
telefono**, il contenuto sotto il fold restava tagliato fuori per sempre. Confermato dal vivo
esattamente il sintomo descritto da Gabriel ("da telefono fa pena, poco equilibrata, non
funziona bene durante lo scroll" -- lui parlava della sezione "Un unico motore...", che è
scena 1 di questa stessa Vetrina). Fix: `gsap.matchMedia()` scopes il pin SOLO a `min-width:
1024px` (stesso breakpoint `lg:` di Tailwind); su mobile la stessa Vetrina ora renderizza un
layout completamente diverso, non semplicemente ridimensionato -- 6 card verticali (`Reveal`
one-shot, nessun pin, nessuno scroll-jacking), ciascuna con titolo/testo/badge "in arrivo" e
un mock-schermo dedicato (`h-64` invece di `h-full`), tutte e 6 ora effettivamente raggiungibili
scrollando normalmente. Verificato dal vivo: tutte e 6 le scene visibili e leggibili su
schermata 390px. La scena 1 (motore di prenotazione) aveva anche il problema visivo separato
segnalato da Gabriel ("quel quadrato è brutto e poco utile") -- sostituita con una vera
illustrazione ("engine hub": 3 nodi etichettati Calendario/Pagina pubblica/Assistente AI, punti
animati sui connettori, cerchio centrale rotante) che riusa lo stesso linguaggio visivo del
flusso animato già esistente in `PercheNoi.tsx`, invece di uno spazio vuoto.

**Calcolo economico, da riga di testo a sezione vera**: era una singola riga (icona + frase +
disclaimer) appesa in fondo a `PrimaDopo.tsx` -- vero nel contenuto ma con un peso visivo
minuscolo per l'argomento di vendita più importante della pagina. Estratto in
`ImpattoEconomico.tsx`, sezione propria a due colonne: a sinistra le 3 ipotesi dichiarate
scomposte come i passaggi di un calcolo (1 messaggio/settimana × 35€ scontrino medio × 52
settimane) con disclaimer esplicito invariato ("calcolo illustrativo... il prodotto non è
ancora live"); a destra un numero che conta verso l'alto quando entra in vista (`animate()` +
`useInView` di Framer Motion, non un valore statico) e un confronto ROI diretto col prezzo
reale del piano Growth (`€478,8/anno`, preso da `DECISIONS.md`/`Prezzi.tsx`, non inventato).
Nessun dato nuovo, nessuna cifra reinventata -- stesso calcolo onesto, mostrato con il peso
che merita.

**FAQ aggiunta** (`Faq.tsx`, suggerita esplicitamente da Gabriel come "se ritieni che serva"):
7 domande pre-footer, accordion con una sola voce aperta alla volta, tutte risposte già vere
altrove sul sito (nessun fatto nuovo) -- copre gli attriti tipici pre-conversione: serve sapere
di tecnologia, si può provare gratis, si può disdire, l'AI sbaglia mai, funziona su WhatsApp
(onestamente segnalato "in arrivo"), sicurezza dati (isolamento reale + hosting EU), migrazione
da un gestionale esistente.

**Rimosso ciò che tradiva "demo"/"in costruzione"**:
- `/registrati` e `/accedi` erano rimasti HTML grezzo non stilizzato fin dalla Fase 0 -- le
  uniche due pagine dove un visitatore mette davvero email/password, invisibili finché non ci
  si arriva navigando, quindi mai notate durante le sessioni precedenti focalizzate sulla
  landing. Restilizzate da zero (stesso sfondo `bg-noir` + `Grana`, stessa card con bordo/blur,
  stesso pulsante a pillola bianco) **senza toccare la logica** (stessa chiamata Supabase, stessi
  hook, stesso query param `piano`) -- verificato leggendo il file intero dopo ogni modifica.
- 404 di default di Next.js (pagina bianca non brandizzata) sostituita con `not-found.tsx` sullo
  stesso linguaggio visivo del resto del sito.
- La route di test `/prova-chat/[slug]` (widget chat isolato, usata solo per sviluppo) era
  ancora pubblicamente raggiungibile e senza alcuno stile -- non cancellabile per un blocco del
  classificatore di sicurezza dell'ambiente su `rm -rf` (anche se il file era dentro la sandbox
  effimera, non sul Mac di Gabriel); soluzione non distruttiva equivalente: il file ora chiama
  solo `notFound()`, la route risponde 404 come se non esistesse, cronologia git intatta.

**Altri fix minori trovati durante il giro**:
- Bug reale di prima parola invisibile nell'header Hero (`FlipWords.tsx`): Chromium non
  dipingeva il primissimo frame della parola che ruota (subito dopo il caricamento) quando è
  sopra lo shader WebGL dell'Hero -- confermato con screenshot Playwright a 500ms dal load, e
  poi confermato risolto interrogando via `page.evaluate()` gli stili computati del vero
  `motion.span` (non lo spacer invisibile che riserva lo spazio, con cui il primo tentativo di
  diagnosi si era confuso). Fix: `initial={false}` sull'`AnimatePresence` -- la primissima
  parola non anima più il proprio ingresso (nasce già a `opacity:1`), eliminando la finestra in
  cui Chromium poteva saltare il paint.
- Il CTA primario dell'Hero puntava ancora a `/registrati`, mentre il CTA della Nav era già
  stato allineato a fare scroll fino a `#prezzi` in una sessione precedente -- disallineamento
  minore ma reale nel percorso di conversione, corretto.
- Rivista tutta la pagina una seconda volta dopo tutti i fix sopra (desktop e mobile, scroll
  reale) per il "controllo finale" richiesto esplicitamente da Gabriel: nessun altro problema
  di layout/overflow/contrasto/spaziatura trovato, sezione per sezione, incluse le pagine
  `/registrati`, `/accedi`, 404 mai verificate visivamente prima d'ora.

**Non toccato in questa sessione (deliberatamente, fuori scopo)**: nessun cambiamento al
backend/prodotto (dashboard, booking engine, AI, calendari) -- vedi la sezione precedente per
quello stato, invariato. Rimane in repo, non cancellabile per lo stesso blocco del
classificatore citato sopra, del codice morto e mai collegato a nessuna route:
`src/components/primitives/*` e `src/app/beautifui/*` -- basso rischio (non raggiungibile da
nessun link pubblico), ma andrebbe rimosso a mano da Gabriel con un `rm -rf` dal Terminal reale
del Mac quando ha un minuto, per tenere il repo pulito.

## Secondo giro di rifinitura landing, dopo revisione dal vivo di Gabriel (12/09/2026)

Gabriel ha usato il sito pubblicato e segnalato 15 problemi puntuali, più la richiesta di
verificare tutto contro gli md prima di agire e di non lavorare di fretta. Prima di correggere
qualunque cosa, sono state fatte domande di chiarimento esplicite (incluso un rischio reale
segnalato PRIMA di agire, vedi DECISIONS.md "Il sito descrive il prodotto al lancio, non lo
stato di oggi") e per 5 sezioni (redesign visivi) sono state mostrate le opzioni prima di
implementare, come richiesto.

**Decisione di fondo, cambia il linguaggio di tutta la landing**: rimosse tutte le etichette
"in arrivo"/"nel roadmap" (Prezzi, Vetrina, Faq, Funzionalita, ImpattoEconomico) -- il sito ora
descrive il prodotto al lancio commerciale, non lo stato di oggi. Dettagli, rischio esposto a
Gabriel e sua decisione finale in DECISIONS.md, voce omonima. Stessa voce copre anche: calendario
solo Google (landing E prodotto vero -- Apple era già stato tolto dalla UI reale l'11/09/2026,
qui allineata anche la landing).

**Bug reali diagnosticati con verifica strumentale, non a occhio** (tutti confermati con
Playwright, non solo letti nel codice):
- FAQ laggose e che si allargavano su desktop: due cause distinte. (1) Framer Motion che anima
  `height: "auto"` deve ri-misurare il layout ad ogni frame -- sostituito con un'altezza in
  pixel misurata via `ref` una volta sola. (2) l'apertura di una voce spingeva l'altezza pagina
  oltre la viewport, facendo comparire la scrollbar verticale (macOS con mouse la mostra sempre)
  e restringendo di colpo la larghezza disponibile -- risolto con `scrollbar-gutter: stable` in
  `globals.css`, che riserva sempre lo spazio.
- Sfondo Hero (`LiquidMetal.tsx`) che non reagiva al mouse: diagnosticato puntando il mouse via
  script e leggendo `document.elementFromPoint` in più punti della hero -- il blocco di
  testo/bottoni sopra lo sfondo, pur trasparente, aveva `pointer-events: auto` di default e
  "rubava" il movimento del mouse su quasi tutta l'area (reagiva solo nei margini vuoti ai lati,
  strettissimi o assenti su un laptop). Fix: quel contenitore è ora `pointer-events-none`, solo
  la riga dei due bottoni riattiva `pointer-events-auto`. Corretta anche una lieve sfocatura del
  canvas (il buffer di disegno era dimensionato su `host`, ma renderizzato alla dimensione più
  grande di `wrap`, usata per il margine del tilt).
- Click in navbar che scendeva di scatto invece di scorrere fluido: `scroll-behavior: smooth` in
  `globals.css` + `scroll-mt-24` su ogni sezione con un id (compensa l'altezza della navbar
  fissa). Verificato con un timeline di scroll reale: atterra esattamente al pixel giusto anche
  attraversando le sezioni con pin GSAP di `Vetrina.tsx`.
- Hydration mismatch reale introdotto durante questo stesso giro (trovato scorrendo l'intera
  pagina con un controllo automatico dei console error, non a occhio): `.toLocaleString("it-IT")`
  chiamato su un numero fisso direttamente nel render produce testo diverso tra server e browser
  quando Node non ha i dati ICU completi ("1820" vs "1.820"). Fix: per i valori statici la
  stringa formattata è scritta una volta come costante, non ricalcolata ad ogni render; il
  contatore animato (che parte da 0 e cambia solo lato client dopo il mount) non ne risente ed è
  stato lasciato invariato.

**Redesign visivi, mostrate le opzioni prima di implementare (come richiesto)**:
- `Funzionalita.tsx`: tolta la separazione "disponibili"/"in arrivo" (non più necessaria dopo
  la decisione sopra) e la lunga lista a colonna singola su telefono ("devo scorrere tantissimo"
  di Gabriel) sostituita da una bento grid asimmetrica -- 4 riquadri grandi per i pilastri del
  prodotto (calendario, AI multicanale, dashboard, promemoria), gli altri compatti (solo
  icona+titolo su telefono, descrizione completa da tablet in su). Altezza sezione su schermo da
  390px scesa del 19% col solo secondo intervento (2490px, da 3071px del primo tentativo).
- `PercheNoi.tsx`: il flusso "1-2-3" con un pallino che correva avanti e indietro all'infinito
  senza un vero motivo per farlo ("i tre punti non hanno senso" di Gabriel) sostituito da una
  timeline verticale ferma con linea tratteggiata, che comunica sequenza invece che
  caricamento.
- `PrimaDopo.tsx`: stessa interazione di trascinamento (voluta, non sostituita), vestito
  rifinito -- bordo animato (`GlowBorder`, stesso linguaggio del piano Consigliato), maniglia con
  icona di drag riconoscibile e ombra, piccolo "wiggle" automatico al primo caricamento per
  segnalare che è trascinabile (rispetta `prefers-reduced-motion`).
- `PerChi.tsx`: stessa logica bento di `Funzionalita.tsx` per coerenza visiva sitewide -- il
  pubblico principale (saloni/parrucchieri con team) in un riquadro doppio, e una sesta voce
  "Qualunque attività lavori su appuntamento" aggiunta su richiesta esplicita di Gabriel
  ("basta che attiri tutte le persone che prendono appuntamenti"). Titolo riscritto senza "non
  solo per i saloni" (suonava come una scusa, non un motivo per convincere).

**Verifica finale**: 112/112 test passano, `tsc --noEmit` pulito, `eslint` pulito, build di
produzione pulita, zero console/page error in uno scroll reale completo della pagina (desktop E
mobile, non solo un controllo visivo) dopo tutte le modifiche insieme.

**Non ancora fatto da questa sessione**: audit "false promesse" (punto 11) fatto -- nessun
form/input/toggle finto trovato nel codice, i mockup sono tutti dichiarati come illustrazioni
non cliccabili nei commenti; sweep generale di spaziatura/allineamento (punto 14) fatto solo sul
titolo di PerChi (esempio esplicito di Gabriel), non su tutta la pagina voce per voce. Prossimo
passo: commit + bundle + consegna a Gabriel per il pull sul suo Mac.

## Terzo giro di rifinitura landing, dopo che Gabriel ha usato lui stesso il sito (12/09/2026)

A differenza dei due giri precedenti (revisione a schermo di Claude via Playwright), stavolta
Gabriel ha scaricato il bundle del secondo giro, l'ha usato sul proprio Mac e ha mandato
screenshot reali con 10 segnalazioni puntuali. Dettaglio completo delle 3 decisioni di prodotto
vere in DECISIONS.md (voce "Seconda revisione landing"); qui il riepilogo tecnico.

**Bug di layout reali, diagnosticati e non solo ritoccati a occhio**:
- `Funzionalita.tsx` e `PerChi.tsx`: buco strutturale nell'angolo in basso a destra della bento
  grid, confermato dal vivo con Playwright a più larghezze. Causa reale (non un problema di
  `grid-auto-flow: dense`, che chiude solo i buchi lasciati da un riquadro doppio fuori posto):
  il totale delle "unità" di griglia (1 per riquadro normale, 2 per doppio) non era multiplo del
  numero di colonne ad alcuni breakpoint -- 19 unità su 4 colonne per Funzionalita, 7 unità su 4
  colonne per PerChi -- quindi l'ultima riga restava sempre incompleta, qualunque fosse l'ordine
  degli elementi. Fix: portato il totale a un multiplo pulito in entrambi i file (20 e 8 unità)
  promuovendo "CRM clienti" a riquadro doppio in Funzionalita (è comunque uno dei pilastri veri
  del prodotto) e aggiungendo una settima categoria vera ("Fotografi e studi fotografici") in
  PerChi -- non un riquadro vuoto o un riempitivo senza senso. Verificato a 1440px, 800px, 390px:
  nessun buco in nessuna delle due griglie a nessuna larghezza testata.
- `ImpattoEconomico.tsx`, riga del promemoria automatico: `pl-14` (allineamento con le righe
  formula sorelle) combinato con un'icona dentro un `flex` proprio spostava il testo ~22px più a
  destra delle righe sorelle, e centrava verticalmente l'icona sull'intero blocco quando il testo
  andava a capo su più righe -- da cui "va a capo ed è spostata a destra" di Gabriel. Fix:
  l'icona è tornata un elemento inline dentro lo stesso identico `<p className="pl-14">` delle
  righe sorelle, non un figlio di un flex separato -- stesso indentamento sempre, testo che va a
  capo come un paragrafo normale. Verificato a 1440px e 375px.
- Hero: nessun vero bug (il mockup del prodotto e la sezione ProdottoScroll sotto sono entrambi
  corretti/intenzionali -- risposta diretta alla domanda di Gabriel "la dashboard è corretta?":
  sì), ma un taglio visivo netto reale tra lo shader colorato `LiquidMetal` della Hero e il
  `bg-noir` piatto di `ProdottoScroll` subito sotto, proprio all'altezza del mockup del prodotto.
  Fix: fade in gradiente (`from-transparent to-noir`) negli ultimi ~8rem della Hero. Verificato
  con uno screenshot a cavallo esatto del confine tra le due sezioni.
- `Vetrina.tsx`, scena chat (indice 2): bug reale di sequenza, non di stile -- la domanda e le
  due righe di risposta erano semplici `<div>` senza alcuna animazione (comparivano quindi tutte
  al montaggio, istante 0), mentre solo l'indicatore "sta scrivendo" aveva un'animazione, in loop
  infinito, sopra risposte già visibili da subito. Riscritta come sequenza vera con `delay`
  crescenti (domanda -> indicatore -> risposte). Verificato con 3 screenshot temporizzati (t=0.2s,
  t=1.1s, t=2.5s): l'ordine ora è esattamente quello richiesto.

**Decisioni di prodotto/copy** (dettaglio completo in DECISIONS.md): scope AI multi-canale
ristretto a "chat e WhatsApp" nel copy attuale (Instagram/Telegram restano un obiettivo futuro,
tolti da Funzionalita.tsx e dalla voce Enterprise di Prezzi.tsx, sostituita con "Multi-sede e
ruoli avanzati"); trial di 10 giorni ristretto al solo piano Growth (Prezzi.tsx **e**
`giorniDiProva` in `src/lib/stripe/piani.ts` -- comportamento Stripe reale, non solo testo,
test aggiornato in `piani.test.ts`); riquadro verde di ImpattoEconomico riscritto senza citare
il prezzo di Growth, con un argomento di vendita (evita perdite + aumenta l'incasso) invece di
un confronto freddo; tolto il "+" ingiustificato dopo il totale animato; rimossi il flusso
numerato 1-2-3 e il bagliore viola (`Lampada`) da `PercheNoi.tsx` (contenuto duplicato con la
scena 0 di Vetrina.tsx, bagliore pensato per titoli senza griglia sotto -- qui la griglia
DIFFERENZIATORI c'è sempre stata). TiltCard aggiunto alle card di Funzionalita.tsx (mancava
rispetto a PerChi.tsx) e titolo della sezione centrato.

**Verifica finale**: 112/112 test passano (incluso l'aggiornamento dell'assert su
`giorniDiProva("pro")`, ora `undefined`), `eslint` pulito sui file toccati, build di produzione
pulita, zero console/page error in uno scroll reale completo (desktop 1440px e mobile 390px).
Controllo visivo con Playwright mirato esattamente sui punti segnalati da Gabriel (angoli delle
griglie, larghezze strette per il wrap del testo, screenshot temporizzati per l'animazione della
chat) invece di uno scroll generico -- lezione esplicita di questo giro: un controllo "generico"
di sezione può non bastare quando il problema è nell'angolo esatto di una griglia o nel timing
esatto di un'animazione.

**Controllo di coerenza generale** (richiesto esplicitamente da Gabriel oltre ai 10 punti):
PIANO.md, DECISIONS.md e questo file sono stati confrontati con il codice reale. Nessuna
discrepanza nuova trovata oltre a quelle già note e già segnalate in questo file (vedi "Problemi
noti aperti" e "Cosa è mock, incompleto o non ancora iniziato" -- entrambe le sezioni erano già
aggiornate correttamente ai giri precedenti). Un solo aggiornamento necessario: la sezione
"Prossimo passo pianificato" in fondo a questo file era rimasta ferma a "il codice non è ancora
committato", ma il secondo giro è già stato committato (`2ff7ea5`) -- corretta più sotto.

## Quinto giro di rifinitura landing, dopo l'uso reale del sito pubblicato dal quarto giro (12/09/2026)

Gabriel ha mandato 7 punti, alcuni via messaggi separati mentre il lavoro di questo stesso giro
era già in corso -- gestiti mano a mano, non ripartendo da capo.

**Bug reali diagnosticati e non solo ritoccati a occhio**:
- `Faq.tsx` e `registrati/page.tsx`: entrambi promettevano ancora "10 giorni di prova" sul piano
  Pro, restrizione tolta nel terzo giro (`giorniDiProva` in `piani.ts` ora ritorna `undefined` per
  Pro). La FAQ aveva semplicemente un testo statico non aggiornato; `registrati/page.tsx` era più
  serio -- un controllo scritto a mano (`pianoValido === "growth" || pianoValido === "pro"`) invece
  di usare `giorniDiProva`, la stessa funzione che il checkout Stripe reale rispetta -- avrebbe
  promesso un trial che al momento di pagare non sarebbe mai arrivato. Corretti entrambi usando
  `giorniDiProva` come unica fonte di verità.
- `Reveal.tsx`: le card di una griglia comparivano "tutte insieme" scendendo, non una riga alla
  volta (segnalazione di Gabriel). Causa reale: `RevealStagger` era l'UNICO trigger
  (`whileInView` sul contenitore), e le card figlie si limitavano a ereditare le varianti con uno
  sfalsamento (`staggerChildren`) misurato in TEMPO, non in scroll -- su una griglia alta più
  schermate lo sfalsamento totale finiva (meno di un secondo) ben prima che l'utente scorresse
  fino alle righe più basse, che quindi arrivavano già comparse. Riscritto perché ogni
  `RevealItem` si attivi DA SOLO in base alla propria posizione di scroll (stesso `whileInView`
  di `Reveal`) -- le card della stessa riga entrano in viewport quasi insieme e compaiono
  insieme naturalmente, quelle sotto restano ferme finché non ci si scorre vicino davvero.
  Cambio in un solo file, effetto su tutte le griglie del sito (Funzionalita, PerChi, PercheNoi,
  Prezzi, Faq, ComeFunziona, CTAFinale), non solo su quella segnalata.
- `Funzionalita.tsx`: le card piccole "non hanno il testo" su telefono, ed erano "troppo grandi
  verticalmente, molto inutilmente" (due segnalazioni di Gabriel, stessa causa). La descrizione
  era nascosta di proposito su telefono per le card non-pilastro (terzo giro, "su telefono devo
  scorrere tantissimo") -- ma la griglia usava `auto-rows-fr`, che senza un'altezza esplicita sul
  contenitore pareggia l'altezza di OGNI riga implicita su quella della riga più alta di TUTTA la
  griglia, non solo delle card della stessa riga: le card piccole senza descrizione si
  stiravano per pareggiare righe lontane con card "grande" a descrizione lunga, lasciando vuoto
  invece di contenuto. Tolto `auto-rows-fr` (ogni riga si dimensiona sul proprio contenuto,
  `align-items: stretch` di default resta comunque utile PER RIGA) e rimossa la descrizione
  nascosta -- ora mostrata sempre, riempiendo lo spazio che prima restava vuoto.

**Consultato prima di agire** (dettaglio in DECISIONS.md): sfondo di CTAFinale.tsx rifatto una
seconda volta -- mostrate 4 direzioni via screenshot (aurora multicolore, griglia tecnica,
spotlight scuro, piatto/minimale) prima di scrivere codice, scelto "Spotlight scuro" e reso
interattivo (segue il puntatore con uno smoothing a molla, deriva lento quando non c'è
interazione). Titolo della Hero ("mai più senza risposta"): tolto il bagliore colorato attorno al
testo (leggeva come un'"evidenziazione" indesiderata) e sostituito con un colore pieno (ambra) --
lontano su qualunque ruota cromatica dal viola/fucsia dello shader dietro, non si confonde più a
nessuna fase dell'animazione. Pulsanti "metal" dei piani a pagamento: cercata ispirazione sui
connettori (21st.dev, componente "metal-fx") su richiesta esplicita di Gabriel -- non installata
la libreria di terze parti (licenza non verificata, budget vicino a zero), ricreata la stessa
idea (un anello metallico animato attorno a un elemento, non uno shader a piena superficie) con
`LiquidMetal`, già in uso e già verificato altrove nel sito.

**Altre rifiniture**: riga del promemoria in `ImpattoEconomico.tsx` accorciata (tolto "prima
dell'appuntamento", ridondante con il titolo della colonna due righe sopra) per stare su una riga
sola a ogni larghezza testata.

**Verifica finale**: 112/112 test, `tsc --noEmit` pulito, `eslint` pulito sui file toccati, build
di produzione pulita, zero console/page error in un controllo Playwright mirato sui 7 punti
segnalati (1440px e 375px), incluso una verifica diretta via `getComputedStyle` per il colore del
titolo della Hero (lì lo screenshot da solo non basta, vedi nota sotto) e uno screenshot per
piano (`?piano=pro` vs `?piano=growth`) per confermare che la pagina di registrazione mostri il
trial solo dove esiste davvero.

**Nota per Gabriel**: gli screenshot della Hero e dei pulsanti "metal" di Prezzi restano poco
affidabili da questa sandbox per lo stesso motivo già segnalato nel giro precedente -- il
contesto WebGL qui non è mai utilizzabile (verificato di nuovo: anche lo shader della Hero, mai
toccato in questi due giri, risulta "context lost" appena caricato), quindi qualunque cosa
disegnata da `LiquidMetal` (compreso il nuovo anello metallico sui pulsanti) non è visibile negli
screenshot presi da qui. Confermato però che il codice è corretto dove verificabile
diversamente (classe CSS del colore Hero via `getComputedStyle`, struttura DOM dei pulsanti,
nessun errore console) -- il controllo visivo vero per questi due punti resta da fare sul sito
reale.

## Quarto giro di rifinitura landing, dopo l'uso reale del sito pubblicato dal terzo giro (12/09/2026)

Gabriel ha usato il sito del terzo giro e mandato 13 punti via screenshot + testo, chiudendo con
un'istruzione esplicita: fare domande a risposta multipla prima di agire sui punti ambigui.
Rispettata alla lettera -- vedi sotto quali punti sono stati chiariti prima di scrivere codice.

**Bug reali, diagnosticati e non solo ritoccati a occhio**:
- `Funzionalita.tsx`, "nella foto che vedi, manca ordine": non un giudizio estetico generico.
  Causa reale trovata rileggendo l'algoritmo: il totale di 20 unità di griglia (impostato nel
  giro precedente apposta per essere multiplo di 4 e di 2) NON è multiplo di 3 -- e la griglia
  passa proprio per 3 colonne nella fascia intermedia (`sm:grid-cols-3`, tablet/finestre strette).
  A 3 colonne un riquadro doppio lascia lì un buco che `grid-auto-flow: dense` richiude facendo
  "saltare avanti" nell'ordine visivo la prima card piccola successiva che ci sta -- l'ordine
  VISTO smette di corrispondere all'elenco. Chiarito con Gabriel prima di toccare il layout
  (`AskUserQuestion`, ha confermato questa diagnosi e scelto "riordino l'elenco"). Fix in due
  parti: (1) l'elenco è riordinato "2 riquadri normali + 1 doppio" ripetuto 5 volte invece di
  raggruppare i pilastri vicini -- un riquadro doppio cade sempre su un confine di riga pari, non
  lo attraversa mai, zero buchi/riordini a 2 e 4 colonne; (2) la fascia intermedia a 3 colonne è
  tolta del tutto (`sm:grid-cols-3` -> diretto a `lg:grid-cols-4`), l'unica larghezza in cui 20
  non torna esatto. Verificato a 375px e 1440px: ordine visivo sempre identico all'elenco.
- `Vetrina.tsx`, click su una scena "mi sposta sulla pagina a caso": bug reale, non percezione --
  l'handler usava `target.offsetTop`, che è relativo al più vicino antenato POSIZIONATO (qualsiasi
  `position` diverso da `static`), non alla cima del documento; con più antenati posizionati nella
  gerarchia (motion/GSAP ne aggiungono facilmente) il valore non corrispondeva più alla posizione
  reale nella pagina. Fix: `target.getBoundingClientRect().top + window.scrollY`, sempre assoluto
  rispetto al documento. Stessa scena, primo mobile scene card tagliato: fix con un array di
  altezze per-scena invece di un'altezza fissa uguale per tutte. Titolo sezione centrato.
- CTAFinale, "il pulsante ha un hover orrendo": bug reale, non gusto -- `MagneticButton` sposta il
  pulsante seguendo il cursore (`x`/`y` via motion values), ma `GlowBorder` sotto è un fratello
  assoluto (`inset:0`) ancorato al contenitore FISSO, non alla posizione che il pulsante assume
  mentre insegue il mouse: al hover il bordo restava fermo mentre il pulsante slittava sopra,
  sfasandosi visibilmente. Chiarito con Gabriel (`AskUserQuestion`, tre opzioni) -- scelto "fix
  mirato": tolto l'effetto magnetico da questo pulsante soltanto, `hover:scale` al suo posto,
  bagliore/bordo animato invariati.

**Decisioni chiarite con `AskUserQuestion` prima di scrivere codice** (dettaglio in
DECISIONS.md): card featured di `PerChi.tsx` spostata su "chiunque lavori su appuntamento" invece
che sui soli saloni/centri estetici; effetto `LiquidMetal` (lo shader della Hero) applicato in
forma graduata a TUTTI e tre i piani a pagamento (Starter/Growth/Pro), non solo a Growth, con
intensità crescente; conferma che la riga del promemoria di `ImpattoEconomico.tsx` era già
corretta dal giro precedente (nuovo screenshot alla mano) -- probabile cache/build non aggiornata
lato Gabriel, non un bug residuo; portata avanti l'estensione di `Reveal`/`RevealStagger` dove
mancava (opzione "a rischio più basso" scelta da Gabriel rispetto a un redesign scroll-driven più
ampio) invece di introdurre un sistema di reveal nuovo.

**Altre rifiniture**: TiltCard aggiunto alle card DIFFERENZIATORI di `PercheNoi.tsx` (mancava
rispetto a PerChi.tsx, estratto in un componente condiviso `CardDifferenziatore` per non duplicare
il markup su due griglie); scroll della navbar con easing "accelera poi rallenta" personalizzato
(`easeInOutCubic`, un listener unico a livello di documento) al posto dello smooth-scroll di
default del browser; nuovo `AuthHeader.tsx` condiviso da `/accedi` e `/registrati` (barra fissa
con logo/link alla home, sostituisce i 3 link di testo inline che c'erano prima); copy del
riquadro verde di `ImpattoEconomico.tsx` riscritto una seconda volta -- il giro precedente lo
aveva tolto dal citare il prezzo di Growth ma copriva solo i messaggi senza risposta, non gli
appuntamenti dimenticati (seconda colonna di calcolo aggiunta nel frattempo); `Reveal` esteso a
`Footer.tsx` e alla didascalia di `PrimaDopo.tsx`, le uniche porzioni di testo rimaste ferme in
uno scroll completo della pagina.

**Verifica finale**: 112/112 test passano, `eslint` pulito sui file toccati, build di produzione
pulita, zero console/page error in un controllo Playwright mirato sui punti segnalati (desktop
1440px e mobile 375px) inclusi un test funzionale del click-scroll di Vetrina (scroll di ~500px
verso la scena cliccata, non un salto a un punto casuale) e un campionamento della curva di scroll
della navbar (progressione lenta-veloce-lenta coerente con l'easing scelto). **Nota per Gabriel**:
i pulsanti `LiquidMetal` dei piani a pagamento non sono verificabili al 100% dalla sandbox --
l'ambiente Playwright qui non ha un contesto WebGL funzionante nemmeno per lo shader della Hero,
già esistente e mai toccato in questo giro (stesso problema, non una regressione introdotta ora),
quindi serve un tuo controllo visivo sul deploy reale (stesso avviso già presente per la Hero
nella sezione "Prossimo passo pianificato" sotto).

## Stack reale (verificato in `package.json`)

Next.js 16.3.4 (App Router, Turbopack) + React 19.2.8 + TypeScript + Tailwind CSS v4 +
Supabase (`@supabase/ssr` 0.12.5, `@supabase/supabase-js` 2.113.0) + Vitest per i test.
Stripe e Anthropic Claude SDK non ancora integrati nel codice (pianificati Fase 2/5).
Progetto Supabase reale collegato: `weeaggiqovnmtovdjzxy` (region `eu-west-1`, confermata EU
l'11/09/2026 via MCP diretto).

## Cosa è REALMENTE funzionante (verificato dal vivo, non solo compilato)

- **Registrazione self-service**: `/registrati` -> `supabase.auth.signUp` -> trigger
  `al_nuovo_utente` (migrazione 0004) crea automaticamente tenant + profilo owner + 7 righe
  `orari_apertura` (tutte chiuse di default). Zero intervento manuale. Testato end-to-end nel
  browser reale più volte.
- **Login/logout**: `/accedi`, server action `esci()`.
- **Isolamento multi-tenant reale**: RLS + funzione `auth_tenant_id()` — verificato
  interrogando l'API REST di Supabase con un token utente vero: un utente legge esattamente
  1 tenant, il proprio.
- **Onboarding minimo** (`/dashboard/configura`): orari settimanali (7 giorni, apertura/
  chiusura/pausa), operatori (CRUD), servizi (CRUD, durata+prezzo), associazione
  operatore<->servizio (tabella con toggle). Tutto persistito su Supabase vero, verificato
  con reload di pagina e con una sessione browser reale (creato operatore "Sara", servizio
  "Taglio 30min 25€", associati).
- **Booking engine collegato al DB** (`src/lib/booking-engine.server.ts`): legge orari/
  chiusure/operatori/servizi/appuntamenti veri e delega SEMPRE al motore puro
  (`booking-engine.ts`, 16 test verdi) per la decisione — mai reimplementata.
- **Calendario** (`/dashboard/calendario`): lista appuntamenti del giorno, ricerca slot liberi
  per servizio/operatore/data con calcolo reale (verificato: 09:00-19:00 di apertura meno un
  servizio da 30 min produce slot fino a 18:30, passo 15 min), creazione con selezione slot a
  un click, modifica/spostamento (esclude se stesso dal controllo conflitto), cancellazione.
  **Verificato dal vivo per intero il 02/09/2026**: creato un appuntamento reale, gli slot
  occupati sono spariti dalla lista, spostato con successo, cancellato con successo, slot
  tornati liberi in ogni caso.
- **Doppia protezione anti-conflitto**: controllo applicativo (messaggio chiaro) + vincolo
  Postgres `niente_sovrapposizioni` (exclusion constraint con `btree_gist`) come rete di
  sicurezza contro le race condition — non ancora testato con un vero scenario di
  concorrenza a due richieste simultanee su questo progetto (era testato con successo sul
  progetto precedente, `test_concorrenza_prenotazione.py`; qui il test equivalente non è
  stato ancora scritto/eseguito).
- **CRM di base** (`/dashboard/clienti`, `/dashboard/clienti/[id]`): elenco clienti con ricerca
  per nome/telefono e conteggio appuntamenti, scheda cliente con dati anagrafici modificabili
  (nome/email/tag/note) e storico completo delle prenotazioni (stato, origine manuale/AI).
  Verificato dal vivo: modifica salvata e persistita dopo reload, ricerca funzionante, storico
  corretto anche per un appuntamento cancellato.
- **Dashboard con metriche reali** (punto 18): appuntamenti oggi, valore prenotato oggi,
  occupazione oggi, clienti totali/nuovi/cancellazioni, insight "clienti inattivi da 60gg" con
  azione diretta verso `/dashboard/clienti?filtro=inattivi`. Verificato dal vivo con un
  appuntamento reale da 25€/30min: tutti i numeri esatti (25,00€, 5% di occupazione su 600 min
  di apertura). Nessun numero finto: se un dato non è tracciato (es. no-show, vedi sotto) la
  card mostra onestamente 0, non un placeholder.
- **Scrittura appuntamenti unificata (single source of truth, 02/09/2026)**:
  `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`/`cancellaAppuntamentoTenant` in
  `booking-engine.server.ts` sono ora l'unico punto che scrive create/modifica/cancella —
  prendono un client Supabase come parametro, quindi la dashboard (client RLS) e i futuri tool
  AI (client admin) chiameranno esattamente lo stesso codice, mai due implementazioni separate
  (CLAUDE.md punto 9). `dashboard/calendario/azioni.ts` è ora solo parsing form + chiamata.
  Verificato dal vivo l'intero ciclo (creazione/spostamento/cancellazione) dopo il refactor.
- **Billing/Stripe (Fase 5, task #21)**: collegato per intero l'11/09/2026 sera (commit
  `faafc55`) -- `/api/stripe/checkout` (crea/riusa un Customer Stripe per tenant, Checkout
  Session in modalità subscription, trial di 10 giorni su Growth/Pro letto da
  `src/lib/stripe/piani.ts`, `tenant_id` sempre letto dalla sessione autenticata lato server,
  mai dal client), `/api/stripe/webhook` (verifica firma `stripe-signature` PRIMA di leggere il
  corpo, gestisce `checkout.session.completed` + i tre eventi `customer.subscription.*` come
  unica fonte di verità per `piano`/`stato_abbonamento` -- il client non è mai fidato per
  "ho pagato"), `/api/stripe/portal` (Customer Portal self-service: cambio piano, carta,
  cancellazione -- mantiene la promessa "Cancella quando vuoi" della CTA finale della landing).
  Collegato lato UI da `Prezzi.tsx`, `registrati/page.tsx` (redirect a Stripe dopo la
  registrazione se il piano scelto è a pagamento) e `dashboard/avvia-checkout-se-necessario.tsx`
  + `impostazioni/pulsante-portale-abbonamento.tsx`. 14 test verdi
  (`stripe/piani.test.ts`, `stripe/abbonamento.server.test.ts`), chiavi sandbox Stripe reali già
  in `.env.local` (account test "Sandbox di Via gambarelli 31"). **Non ancora verificato dal
  vivo con un pagamento di test reale nel browser** (stesso limite di sempre: il sandbox cloud
  di Claude non ha accesso di rete al progetto Supabase/Stripe reale) -- il webhook inoltre va
  ancora configurato lato Stripe Dashboard (endpoint pubblico + signing secret, impossibile
  farlo da qui prima che l'app sia deployata con un dominio reale, vedi commento nel file del
  webhook per i passi esatti).
- **Sincronizzazione calendari personali, direzione import/blocco (Fase 6bis)**: entrambi i
  provider costruiti nello stesso pomeriggio. Apple/iCloud: client CalDAV puro
  (`src/lib/calendario-esterno/caldav.server.ts`, autodiscovery standard, segue il redirect di
  iCloud verso il pod giusto dell'account) + parser ICS puro con 10 test verdi (`ics.ts`, RRULE
  settimanale con BYDAY espansa davvero, EXDATE, eventi CANCELLED esclusi). Google: OAuth2 vero
  (`google.server.ts` + route `/api/calendario/google/{connect,callback}`, nonce anti-CSRF,
  refresh automatico del token) -- credenziali di Gabriel ricevute e configurate lo stesso
  giorno. UI unica in `/dashboard/impostazioni/calendari` che verifica le credenziali CalDAV per
  davvero prima di salvarle e fa collegare Google con un consenso reale, non un placeholder. Gli
  impegni importati da entrambi bloccano gli stessi slot degli appuntamenti interni sia in
  ricerca disponibilità sia in creazione/modifica (fail-open se un calendario esterno non
  risponde o un token è scaduto/revocato). **Non ancora verificato dal vivo con account reali**
  -- solo `npx vitest run` (57/57) e `npm run build` puliti finora. Migrazione
  `0008_calendari_esterni.sql` **confermata gia' applicata** sul database vero (verificato
  11/09/2026 via MCP diretto: le tabelle esistono) -- manca ancora solo Gabriel come "utente di
  test" nella schermata di consenso OAuth Google prima di poter provare quel lato dal vivo.

## Cosa è mock, incompleto o non ancora iniziato

- **AI conversazionale**: strumenti scritti (`src/lib/ai/tools.ts`, 9 strumenti, wrappano il
  booking engine reale con client admin, 9 test di validazione verdi) ma **il loop vero e
  proprio non esiste ancora**: nessun endpoint di chat, nessuna chiamata reale ad Anthropic
  (`@anthropic-ai/sdk` non installato, `ANTHROPIC_API_KEY` non in `.env.local` -- da chiedere a
  Gabriel), nessun motore di conversazione persistente. La migrazione per
  `conversazioni.identificatore_sessione` (necessaria per riconoscere un visitatore anonimo
  della chat web tra un messaggio e l'altro) è scritta
  (`supabase/migrations/0006_conversazioni_sessione.sql`) ma **non ancora applicata al database
  reale** -- vedi "Problemi noti aperti".
- **WhatsApp**: predisposizione tecnica per l'Embedded Signup Meta scritta
  (`src/lib/whatsapp-embedded-signup.ts`, `src/app/api/whatsapp/embedded-signup/callback/
  route.ts`, migrazione 0003) ma **non attivabile**: bloccata dalla business verification
  Meta + P.IVA di Gabriel, in pausa per sua scelta. Il canale AI di default pianificato è
  invece la chat web (nessuna approvazione esterna richiesta) — non ancora costruito.
- **Analytics avanzate**: retention/no-show/canale di acquisizione -- non ancora iniziate (il
  no-show in particolare non ha ancora nessun flusso che lo marchi davvero, vedi sotto).
- **Pagina pubblica per-attività (Fase 4, punto 15)**: CODICE SCRITTO 11/09/2026 -- route
  `/s/[slug]` (Server Component, `src/lib/pagina-pubblica.server.ts` per il loader), flusso di
  prenotazione cliente self-service (`FlussoPrenotazione.tsx`: servizio -> data -> slot ->
  contatto -> conferma, server action in `azioni.ts` che riusa `creaAppuntamentoTenant` con
  `creatoDa: "pubblico"`) e widget chat AI flottante (`ChatWidgetPubblico.tsx`, mostrato solo se
  il piano include la chat AI web). Verificato: suite di test (98/98, incluso il loader con
  mutation test), `tsc --noEmit`, `eslint`, `next build` tutti puliti. **NON ancora verificato
  dal vivo in un browser reale con un salone di test**: il sandbox cloud dove gira Claude non ha
  accesso di rete al progetto Supabase reale (stesso limite già noto per altri strumenti), quindi
  la verifica end-to-end (aprire `/s/<slug>` di un salone vero, cercare slot, prenotare, parlare
  con la chat) va fatta da Gabriel dopo il deploy -- vedi "Problemi noti aperti" #15 per un altro
  limite onestamente segnalato (nessun anti-abuso oltre al tetto mensile Free).
- **Sincronizzazione calendari, direzione export (Fase 6bis)**: mostrare gli appuntamenti del
  salone sul calendario personale dell'operatore non è ancora scritto per nessuno dei due
  provider -- la tabella `eventi_calendario_esterni` esiste già in previsione di questo (vedi
  sopra per la direzione import/blocco, quella già costruita).
- **Foto/galleria**: zero codice. Colonne `logo_url`/`cover_url` esistono sullo schema
  `tenants` ma senza upload né Supabase Storage configurato.
- **Automazioni**: tabella `automazioni` esiste nello schema, nessun motore che la legga o
  scriva.
- **Analytics**: zero codice oltre ai dati grezzi già in tabella (appuntamenti/clienti).
- ~~Billing/Stripe: zero integrazione~~ **NON PIÙ VERO -- il codice esiste già, questo file
  era rimasto indietro**: trovato durante il controllo di accuratezza della documentazione del
  12/09/2026 che l'ultimo commit del repo (`faafc55`, 11/09/2026 23:59, mai riflesso qui) ha
  già collegato Stripe per intero -- vedi la voce spostata sopra in "Cosa è REALMENTE
  funzionante" per il dettaglio. Lezione: quando si finisce una sessione tardi, aggiornare
  SUBITO questo file prima di chiudere, non rimandare al giorno dopo.
- **Admin panel per Gabriel**: zero codice.
- **PWA**: zero manifest/service worker. L'app è oggi un sito responsive Tailwind, non
  un'esperienza installabile.
- **Copy generico per il target ampio**: deciso il 02/09/2026 di allargare il target oltre
  "centri estetici", ma `/registrati` e la dashboard usano ancora testi salone-specifici
  ("Crea il tuo salone") — task aperto, non urgente finché non si tocca quel copy.

## Problemi noti aperti

1. ~~Fuso orario semplificato come UTC in tutto il booking engine~~ **CODICE FATTO
   11/09/2026**: aggiunta colonna `tenants.fuso_orario` (migrazione 0010, default
   `'Europe/Rome'`, già applicata al database reale), nuovo modulo `src/lib/fuso-orario.ts`
   (`realeAPseudoUtc`/`pseudoUtcAReale`, con test) e conversione applicata ai DUE confini
   dove serve un istante reale: la colonna `timestamptz` di `appuntamenti` (scrittura in
   `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`, lettura in
   `caricaContestoBooking`/`verificaConflittoTenant`) e le API Google/CalDAV
   (`collegamenti.server.ts`). Il motore puro (`booking-engine.ts`), `parsaOrarioLocale`
   e la UI della dashboard restano invariati: continuano a ragionare nella stessa
   convenzione "pseudo-UTC" di sempre. Trovato dal vivo l'11/09/2026 durante la verifica
   del sync Google Calendar (un test iniziale sembrava indicare un sync rotto: era invece
   proprio questo bug, con gli appuntamenti sfasati dell'offset del fuso). Test e build
   passano.
2. ~~Repo Git canonico nel sandbox cloud effimero, nessun remote GitHub permanente~~
   **RISOLTO 11/09/2026**: repo spostata su `github.com/gab3code/salone-ai-saas` (privata),
   progetto Vercel collegato via GitHub App (deploy automatico ad ogni push su `main`). Vedi
   DECISIONS.md per il dettaglio (incluso l'ostacolo di rete aggirato per il push iniziale).
   Primo deploy di test live: https://salone-ai-saas.vercel.app (variabili d'ambiente Supabase/
   Anthropic configurate su Vercel; Google Calendar/Stripe/WhatsApp non ancora, non servono per
   questo test).
3. **Causa più probabile degli errori intermittenti in `node_modules` sotto Turbopack** (`EOF
   while parsing`, `Resource deadlock avoided`), rivista il 02/09/2026: inizialmente attribuiti
   a iCloud Drive che sincronizza la cartella Desktop; scoperta oggi una causa alternativa più
   concreta -- i tool del bridge (`device_bash`) eseguono in una VM Linux separata che monta la
   STESSA cartella del progetto sul Mac. Un `npm install` lanciato da lì scriverebbe binari
   nativi Linux (es. SWC) nello stesso `node_modules` che poi il Terminal reale del Mac
   (macOS/arm64) prova a usare -- gli stessi sintomi di "file JSON corrotto"/"deadlock" che si
   sono visti. **Non ancora confermato con certezza, ma per sicurezza: `npm install` va sempre
   lanciato nel Terminal reale del Mac di Gabriel, mai tramite i tool del bridge**, finché non
   si verifica altrimenti. iCloud resta una causa concorrente plausibile, non esclusa.

   **Aggiornamento 12/09/2026 -- stesso sintomo confermato anche su git, non solo npm**: il repo
   locale `~/Desktop/salone-ai-saas` (fuori da "Claude Project", trovato solo dopo che Gabriel ha
   corretto la cartella) ha `.git/index.lock` attivo + `HEAD.lock.stale`/`index.lock.stale`
   risalenti al 02/09 11:31-11:50 (mai puliti da un'operazione git interrotta), e leggere
   `.git/refs/heads/master` da `device_bash` restituisce **"Resource deadlock avoided"** --
   stesso errore di sistema del punto sopra, stavolta su un file di git invece che su
   `node_modules`. Rafforza l'ipotesi del bridge (o iCloud, o entrambi in combinazione) come
   causa reale, e la estende: **anche i comandi git vanno lanciati SOLO dal Terminal reale del
   Mac, mai da `device_bash`** -- usarlo per ispezionare un repo (anche solo `git status`/`log`)
   rischia di aggiungere altro lock contention su una cartella già fragile. Il repo resta
   probabilmente recuperabile (branch `master`, nessun `remote "origin"` configurato in
   `.git/config` -- non ha mai ricevuto un push diretto), ma **non ripararlo da qui**: il modo
   più sicuro è che Gabriel cloni fresco l'ultimo bundle in una cartella FUORI da iCloud (es.
   `~/dev/`, non `~/Desktop/`), imposti lì il remote (`git@github.com:gab3code/salone-ai-saas.git`
   o la versione HTTPS) e pushi da lì, lasciando perdere la copia corrotta.
4. **Connettore Vercel non interrogabile da questa sessione (12/09/2026)**: risulta "connected"
   e abilitato in chat, ma `mcp__Vercel__list_teams` restituisce sempre una lista vuota (anche
   dopo un refresh del connettore) e le altre chiamate (progetti, deployment) fanno tutte da
   `teamId`, quindi falliscono senza un team da passare. Il progetto e il deploy live esistono
   di sicuro (vedi punto 2 sopra, https://salone-ai-saas.vercel.app), quindi non è un problema
   del progetto Vercel in sé -- sembra un'autorizzazione OAuth di questa sessione specifica
   rotta o scaduta. Non risolto: se serve di nuovo operare su Vercel da qui, riprovare prima a
   riconnettere il connettore dalle impostazioni di Claude.
4. ~~Nessun test automatico per `booking-engine.server.ts`~~ **RISOLTO 11/09/2026**: 29 test
   nuovi in `booking-engine.server.test.ts`, con un client Supabase finto
   (`src/test/supabase-finto.ts`, riutilizzabile per testare altri file `*.server.ts` in
   futuro -- code FIFO per tabella/operazione, cattura i payload scritti per verificarli).
   Copertura: `parsaOrarioLocale` (formati validi/invalidi, prima non testato affatto),
   `caricaContestoBooking` (mapping + fusione impegni esterni + propagazione errori),
   `verificaConflittoTenant` (conflitto sì/no, esclusione dell'appuntamento in modifica,
   impegni esterni), `creaAppuntamentoTenant`/`modificaAppuntamentoTenant` (tetto mensile
   Free, servizio non trovato, conflitto bloccante, **conversione fuso orario corretta
   scritta su Postgres** -- verificato anche "in negativo": reintrodotto di proposito il
   vecchio bug del fuso e confermato che i test lo beccano, poi ripristinato il codice
   corretto -- cliente trovato/creato, mapping dell'errore Postgres `23P01`),
   `cancellaAppuntamentoTenant`. Suite totale ora 93/93 verde, build pulita.
5. **Concorrenza non testata su questo progetto**: il vincolo DB esiste ma non è stato
   ancora verificato con un vero test a due richieste simultanee (era stato fatto con
   successo sul progetto precedente con un meccanismo diverso).
6. ~~Region Supabase EU non ancora confermata~~ **RISOLTO 11/09/2026**: confermato via MCP
   diretto al progetto (`weeaggiqovnmtovdjzxy`) — region `eu-west-1`. Possiamo dichiarare "dati
   in Europa" come Estetia.
7. **Migrazione 0006 (`identificatore_sessione` su `conversazioni`)**: applicata da Gabriel
   direttamente nell'SQL Editor di Supabase il 02/09/2026 (non verificata da questa sessione con
   una query -- nessun modo autonomo di leggere lo schema senza toccare credenziali che non
   sono mie da usare, vedi DECISIONS.md). La conferma reale arriverà collegando il motore di
   conversazione (Fase 2) che la userà per davvero.
8. **No-show non ancora tracciato**: nessun flusso della dashboard marca oggi un appuntamento
   come `no_show` (solo `confermato`/`cancellato` esistono nei dati reali) -- la metrica esiste
   già in `metriche.ts` mostra onestamente 0 finché non c'è un'azione "cliente non si è
   presentato" da qualche parte nella UI. Da aggiungere insieme al resto del CRM/calendario.
9. ~~`ANTHROPIC_API_KEY` in `.env.local` solo nel sandbox cloud~~ **RISOLTO 02/09/2026**:
   Gabriel l'ha aggiunta a mano nel suo `.env.local` locale (il bridge blocca di proposito la
   scrittura di quel file) e l'ha verificata con `grep` -- confermata presente.
10. ~~`service_role` senza GRANT di base su nessuna tabella `public`~~ **RISOLTO 02/09/2026**:
    scoperto dal vivo durante il primo vero test della chat AI (Task #66) -- `risolviTenantIdDaSlug`
    falliva con `permission denied for table tenants` (Postgres 42501), non con "0 righe".
    L'assunzione scritta nel commento originale di 0005 ("service_role ha già pieno accesso di
    default") era sbagliata: bypassa le POLICY di RLS ma non i GRANT di tabella, due controlli
    indipendenti. Fix in `0007_grant_service_role.sql`, eseguita da Gabriel nell'SQL Editor --
    confermato dal vivo che risolve.
11a. ~~Manca il GRANT per `authenticated` su `collegamenti_calendario_esterni`/
    `eventi_calendario_esterni`~~ **RISOLTO 11/09/2026** (migrazione 0009): stesso identico bug
    del problema #10 (RLS corretta ma GRANT di tabella mancante), stavolta per il ruolo
    `authenticated` invece di `service_role` -- scoperto dal vivo con un 500 reale su
    `/dashboard/impostazioni/calendari` non appena un utente vero ha provato la pagina sul
    deploy Vercel. La migrazione 0008 aveva concesso i permessi solo a `service_role`.
12. **Il modello non conosceva la data odierna**: senza contesto esplicito, `costruisciSystemPrompt`
    non passava la data reale, quindi il modello chiedeva al cliente di calcolare "domani" da
    solo (pessima UX, e un rischio di dato sbagliato se il cliente sbagliava il calcolo). Fix:
    la data/ora reale (`adesso: Date`, iniettabile nei test) è ora nel system prompt --
    verificato dal vivo che il modello calcola correttamente "domani" senza chiederlo.
12. **`eseguiStrumento` non manteneva davvero la sua promessa di non lasciar scappare eccezioni**:
    scoperto dal vivo -- il modello ha passato il NOME di un servizio ("taglio") invece del suo
    uuid a `verifica_disponibilita`, e `caricaServizi` in `booking-engine.server.ts` lancia
    un'eccezione su un id in formato non valido (contratto corretto per la dashboard, dove un
    umano vede una pagina d'errore) che però rompeva l'intera richiesta HTTP della chat con un
    500 invece di lasciare che l'AI si correggesse nello stesso turno. Fix su più livelli: (a)
    `eseguiStrumento` ora avvolge davvero ogni chiamata in un try/catch, (b) validazione esplicita
    del formato uuid per ogni id in input PRIMA di interrogare il database, con un messaggio che
    dice esplicitamente all'AI di usare l'id restituito da elenca_servizi/elenca_operatori, non il
    nome, (c) la regola 1 del system prompt lo dice esplicitamente. Test di regressione aggiunti
    in `tools.test.ts`.
13. ~~Struttura piani decisa ma parzialmente applicata~~ **RISOLTO 02/09/2026**: sia la chat AI
    (`src/lib/ai/limiti.ts`, gate + quota mensile + anti-burst, collegati in
    `api/chat/[slug]/route.ts`) sia il tetto di 60 prenotazioni/mese sul piano Free
    (`src/lib/piani.ts`, controllo dentro `creaAppuntamentoTenant` -- vale sia da dashboard che
    da AI, stessa funzione) ora sono applicati tecnicamente, non solo decisi. Verificato con
    `npx vitest run` (47/47) e `npm run build` puliti; il tetto prenotazioni non è ancora stato
    verificato dal vivo nel browser con un vero tenant Free (nessun modo pratico di creare 60
    prenotazioni reali per il test) -- rischio residuo basso, la stessa query count/head è già
    usata e verificata altrove nel progetto. Nota operativa: il tenant di test di Gabriel
    ("Salone Test Fase1", slug `salone-ad2fec99`) è stato alzato a `piano = 'growth'` per poter
    continuare a testare la chat AI dal vivo.
14. **Apple/iCloud CalDAV probabilmente inutilizzabile da hosting cloud standard (Vercel)**:
    scoperto dal vivo l'11/09/2026 con Gabriel dopo tre giri di fix reali e verificati sul
    client CalDAV (User-Agent mancante, `Authorization` perso su un presunto redirect,
    un'eccezione non gestita che lasciava una richiesta appesa -- tutti e tre bug veri,
    confermati leggendo il codice, non ipotesi) -- la stessa identica richiesta PROPFIND con
    le stesse credenziali (password app-specifica reale, verificata funzionante) torna
    `207 Multi-Status` da `curl` lanciato dal Mac di Gabriel e `400` senza corpo/header utili
    quando parte da una funzione serverless su Vercel. Diagnosi: non è più un problema di
    codice (le credenziali sono confermate corrette, il client CalDAV è confermato corretto
    via test comparativo diretto), ma un blocco lato Apple sul traffico CalDAV che origina da
    IP di data center/cloud (pattern noto e documentato altrove per iCloud). **Non risolvibile
    lato nostro senza instradare le chiamate attraverso un IP non-datacenter** (proxy
    residenziale a pagamento, comunque non garantito nel tempo). Raccomandazione: non investire
    altro tempo a rincorrere il client CalDAV Apple da Vercel; trattare Google Calendar (OAuth,
    non CalDAV grezzo, nessun blocco di questo tipo riscontrato) come l'unico canale di
    sincronizzazione calendario personale realmente affidabile per ora, e documentare Apple
    come "supportato solo se il salone gestisce la connessione da un ambiente non-cloud" o
    non supportato, a seconda di cosa deciderà Gabriel.

15. **Prenotazione pubblica (`/s/[slug]`) senza anti-abuso dedicato**: a differenza di
    `/api/chat/[slug]` (anti-burst + quota mensile, perché ogni messaggio ha un costo Anthropic
    reale), le server action pubbliche di prenotazione (`src/app/s/[slug]/azioni.ts`) non hanno
    nessuna difesa specifica oltre al tetto mensile già esistente del piano Free -- una
    prenotazione costa quasi zero da salvare, ma uno script potrebbe comunque riempire il
    calendario di un salone con prenotazioni finte (righe `clienti`/`appuntamenti` spazzatura).
    Accettabile per ora (nessun salone reale ancora pubblico), ma da rivedere prima che un
    salone vero pubblichi il link -- possibili opzioni: conferma via SMS/WhatsApp del numero
    prima di bloccare lo slot, un semplice rate-limit per IP, o un CAPTCHA invisibile.

## Mappa dei file principali

- `src/lib/booking-engine.ts` — motore di disponibilità puro (nessuna query DB), 16 test.
- `src/lib/booking-engine.server.ts` — collegamento a Supabase, delega sempre al motore puro;
  espone anche `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`/`cancellaAppuntamentoTenant`
  (scrittura, client-agnostiche) e `parsaOrarioLocale` (validazione rigida di un orario in
  arrivo da fuori, usata sia dalla dashboard sia dagli strumenti AI).
- `src/lib/ai/tools.ts` — strumenti dell'AI receptionist (Fase 2), wrappano il booking engine
  con un client admin/service_role; 9 test di validazione in `tools.test.ts`.
- `src/app/dashboard/clienti/` — elenco clienti con ricerca + scheda cliente (dati anagrafici
  modificabili, storico prenotazioni completo).
- `src/lib/metriche.ts` / `metriche.server.ts` — metriche dashboard (logica pura + collegamento
  Supabase, stesso pattern del booking engine).
- `src/lib/supabase/{client,server,admin,tenant}.ts` — client browser/server/service-role e
  helper "utente loggato -> tenant_id".
- `src/app/registrati`, `src/app/accedi` — funnel di ingresso self-service.
- `src/app/dashboard/{page,azioni}.tsx` — dashboard minima + logout.
- `src/app/dashboard/configura/` — onboarding orari/operatori/servizi.
- `src/app/dashboard/calendario/` — vista calendario, creazione/modifica/cancellazione.
- `src/lib/calendario-esterno/{ics,caldav.server,google.server,collegamenti.server}.ts` —
  sincronizzazione calendari personali (Fase 6bis): parser ICS puro e testato, client CalDAV,
  client OAuth2/Calendar API Google, collegamento al motore di disponibilità.
- `src/app/api/calendario/google/{connect,callback}/route.ts` — flusso OAuth2 Google Calendar.
- `src/app/dashboard/impostazioni/calendari/` — UI collega/scollega calendario Apple/Google per
  operatore.
- `src/proxy.ts` — refresh sessione Supabase (era `middleware.ts`, rinominato per Next 16).
- `supabase/migrations/0001-0008` — schema multi-tenant, chiusure, prep WhatsApp,
  provisioning automatico, fix GRANT (x2), sessione conversazioni, calendari esterni.
- `docs/analisi-estetia.md` — analisi competitiva (screenshot + giro dal vivo sul sito).
- `docs/verifica-stack-automazione.md`, `docs/verifica-fattibilita-33-punti.md` — verifica
  che lo stack supporti il funnel self-service richiesto.
- `docs/embedded-signup-whatsapp.md` — guida tecnica Embedded Signup Meta.
- `docs/librerie-ui.md` — quali connettori/librerie UI usare (21st, OriginKit, Framer Motion,
  GSAP) per superfici rivolte all'esterno (landing, pagina pubblica) -- leggere PRIMA di
  costruire una nuova sezione visuale, non riscoprire da zero ogni volta.
- `src/lib/pagina-pubblica.server.ts` — loader del profilo pubblico di un salone (tenant +
  servizi/operatori attivi) per slug, client admin, solo colonne pensate per essere pubbliche.
- `src/app/s/[slug]/` — pagina pubblica del salone (Fase 4): `page.tsx` (Server Component),
  `azioni.ts` (server action pubbliche `cercaSlotPubblici`/`prenotaPubblico`),
  `FlussoPrenotazione.tsx` (stepper client di prenotazione), `ChatWidgetPubblico.tsx` (widget
  chat AI flottante, riusa l'endpoint `/api/chat/[slug]` già esistente).
- `src/app/page.tsx` + `src/components/landing/` — landing page di marketing: `Nav`, `Hero`
  (+ `AnteprimaProdotto`, parola che ruota, sfondo a fasci di luce), `ProdottoScroll` (dashboard
  vero stile "MacBook scroll"), `ComeFunziona`, `PrimaDopo` (confronto trascinabile), `Vetrina`
  (showcase scroll-driven GSAP solo desktop via `gsap.matchMedia()`, 6 scene reveal-only su
  mobile -- vedi sessione 12/09/2026 sopra), `ImpattoEconomico` (calcolo economico a due colonne
  con numero animato, due catene di ipotesi -- messaggi senza risposta e appuntamenti
  dimenticati, aggiornato nel secondo giro del 12/09/2026), `PercheNoi` (differenziatori reali
  senza nominare concorrenti + timeline verticale del flusso, riscritta nel secondo giro),
  `Funzionalita` (bento grid asimmetrica, tutte le funzioni allo stesso livello -- niente più
  badge "in arrivo", riscritta nel secondo giro), `PerChi` (bento grid, 6 categorie incluso un
  "chiunque altro lavori su appuntamento", riscritta nel secondo giro), `Prezzi`, `Faq` (7
  domande pre-footer), `CTAFinale` (sfondo a particelle), `Footer`, più i primitivi riusabili
  `Reveal.tsx`, `MagneticButton.tsx`, `Grana.tsx`, `RaggiSfondo.tsx`, `SpotlightCard.tsx`,
  `TiltCard.tsx`, `CompareSlider.tsx` (bordo animato + maniglia con icona drag, dal secondo giro),
  `FlipWords.tsx`, `Lampada.tsx`, `VorticeSfondo.tsx`, `BorderBeam.tsx`, `GlowBorder.tsx`
  (dettagli di ognuno in `docs/librerie-ui.md`).
- `src/app/not-found.tsx` — 404 brandizzata (nuovo 12/09/2026).

## Prossimo passo pianificato

**Landing page (`/`, `/registrati`, `/accedi`): il ciclo "Claude rifinisce -> Gabriel prova dal
vivo -> nuove correzioni puntuali" può considerarsi concluso con questo terzo giro** -- tre
round di correzioni via screenshot reali, l'ultimo dei quali (questo) ha risolto gli ultimi bug
di layout genuini (bento grid, allineamento testo, timing di un'animazione) invece di preferenze
di stile ancora aperte. Resta comunque raccomandato un ultimo giro di Gabriel sul deploy reale
(non lo stesso della sandbox) prima di condividere il link pubblicamente, perché alcuni effetti
dipendono da hardware/browser reale e non sono mai stati (e non possono essere, dal sandbox)
verificati lì: il glow del mouse sull'Hero (`LiquidMetal`), la showcase scroll-driven desktop di
`Vetrina.tsx` (pin+scrub GSAP), i bottoni magnetici. Se quel giro non trova altro, la landing è
pronta per il traffico reale.

**Il vero prossimo passo del progetto, dopo la landing, è verificare dal vivo (fuori sandbox,
serve Gabriel) tutto ciò che è già scritto e testato ma mai provato in un browser reale contro
Supabase/Stripe/Google veri** -- in ordine di blocco:
1. **Deploy su Vercel** (già collegato, deploy automatico ad ogni push su `main` -- vedi
   "Problemi noti aperti" #2) del codice di questo giro, appena committato e consegnato.
2. **Fase 4, pagina pubblica per-salone (`/s/[slug]`)**: codice scritto e testato l'11/09/2026,
   **mai aperta in un browser reale** -- provare l'intero flusso (cercare slot, prenotare,
   parlare con il widget chat AI) su un salone di test vero.
3. **Checkout Stripe (Fase 5, task #21)**: codice collegato per intero l'11/09/2026 sera, **mai
   verificato con un pagamento di test reale** -- serve anche configurare il webhook lato Stripe
   Dashboard (endpoint pubblico + signing secret), possibile solo ora che l'app ha un dominio
   pubblico. Include verificare dal vivo che il trial resti solo su Growth dopo il cambio di
   questo giro (checkout su Pro senza alcun periodo di prova).
4. **Anti-abuso della prenotazione pubblica** (problema noto #15): da valutare prima di
   pubblicare il link di un salone vero, non prima -- nessun salone reale è ancora pubblico.
5. Dopo questi 4 punti, i pezzi rimasti prima di un lancio commerciale vero sono quelli già
   elencati in "Cosa è mock, incompleto o non ancora iniziato": WhatsApp (bloccato su business
   verification Meta, non su di noi), pannello admin per Gabriel, PWA, analytics avanzate,
   sincronizzazione calendari in direzione export -- nessuno di questi blocca l'apertura dei
   pagamenti reali (il commitment di DECISIONS.md, voce "Il sito descrive il prodotto al
   lancio", è costruirli PRIMA di aprire i pagamenti veri, non prima del deploy).

Cleanup manuale non urgente da fare quando Gabriel ha un minuto sul Mac: rimuovere
`src/components/primitives/` e `src/app/beautifui/` (codice morto, mai collegato a nessuna
route, non cancellabile da questa sessione per il blocco del classificatore su operazioni
distruttive).
