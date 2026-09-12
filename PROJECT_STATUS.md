# Stato del progetto

Ultimo aggiornamento: 12/09/2026 (sessione di controllo visivo e rifinitura pre-pubblicazione
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
funzionalità (attuali + pianificate, marcate oneste "in arrivo"), una sezione "perché questo"
con i differenziatori reali (senza nominare concorrenti, deciso con Gabriel), una griglia
completa di 15 funzionalità con badge disponibilità, per-chi (5 persone, non solo saloni),
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
  mobile -- vedi sessione 12/09/2026 sopra), `ImpattoEconomico` (nuovo 12/09/2026: calcolo
  economico a due colonne con numero animato), `PercheNoi` (differenziatori reali, senza
  nominare concorrenti), `Funzionalita` (griglia completa, 15 voci con badge "in arrivo"),
  `PerChi` (5 persone), `Prezzi`, `Faq` (nuovo 12/09/2026: 7 domande pre-footer), `CTAFinale`
  (sfondo a particelle), `Footer`, più i primitivi riusabili `Reveal.tsx`, `MagneticButton.tsx`,
  `Grana.tsx`, `RaggiSfondo.tsx`, `SpotlightCard.tsx`, `TiltCard.tsx`, `CompareSlider.tsx`,
  `FlipWords.tsx`, `Lampada.tsx`, `VorticeSfondo.tsx`, `BorderBeam.tsx`, `GlowBorder.tsx`
  (dettagli di ognuno in `docs/librerie-ui.md`).
- `src/app/not-found.tsx` — 404 brandizzata (nuovo 12/09/2026).

## Prossimo passo pianificato

Fase 4 (pagina pubblica) ha il codice scritto e testato -- resta da: 1) fare il deploy e
verificare dal vivo in un browser reale (Gabriel, vedi sopra il perché non può farlo Claude dal
sandbox), 2) verificare dal vivo il checkout Stripe già collegato tecnicamente (task #21 --
codice fatto l'11/09/2026 sera, vedi sopra: manca solo un pagamento di test reale nel browser +
configurare il webhook lato Stripe Dashboard una volta che l'app ha un dominio pubblico), 3)
valutare l'anti-abuso della prenotazione pubblica (problema noto #15) prima di pubblicare il
link di un salone vero. Landing page (`/`, `/registrati`, `/accedi`):
dopo la sessione di rifinitura del 12/09/2026 (vedi sopra) il codice è scritto, verificato
dal vivo in-sandbox su desktop E mobile con scroll reale simulato, e non ancora committato --
**il prossimo passo immediato è commit + build finale + consegna del bundle a Gabriel**, poi
il deploy per una verifica dal vivo definitiva su hardware/browser reale (glow del mouse,
showcase scroll-driven desktop, bottoni magnetici) resta comunque raccomandato prima di
condividere il link pubblicamente, anche se la sessione di oggi ha già coperto la parte di
verifica più a rischio (comportamento reale su mobile). Cleanup manuale non urgente da fare
quando Gabriel ha un minuto sul Mac: rimuovere `src/components/primitives/` e
`src/app/beautifui/` (codice morto, mai collegato a nessuna route, non cancellabile da questa
sessione per il blocco del classificatore su operazioni distruttive).
