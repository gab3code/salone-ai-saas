# Stato del progetto

Ultimo aggiornamento: 11/09/2026 (fuso orario reale del tenant risolto e verificato dal vivo;
Apple/iCloud CalDAV probabilmente inutilizzabile da Vercel per un blocco lato Apple sugli IP di
data center -- vedi problema noto #14 -- Google Calendar resta il canale affidabile; Fase 4,
pagina pubblica del salone, codice scritto e testato ma non ancora verificato dal vivo -- vedi
sotto). Aggiornare questo file ogni volta che cambia lo stato
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
Free) -- manca ancora Stripe/checkout reale (oggi il piano si cambia solo a mano nel database) e
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
reale** -- da fare dopo il deploy (vedi sopra il perché). Tutto il resto (automazioni, PWA,
Stripe/checkout) non ancora iniziato.

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
- **Billing/Stripe**: zero integrazione. Colonne `piano`/`stato_abbonamento`/
  `stripe_customer_id`/`stripe_subscription_id` esistono sullo schema ma senza checkout,
  webhook, o applicazione tecnica dei limiti di piano.
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
- `src/lib/pagina-pubblica.server.ts` — loader del profilo pubblico di un salone (tenant +
  servizi/operatori attivi) per slug, client admin, solo colonne pensate per essere pubbliche.
- `src/app/s/[slug]/` — pagina pubblica del salone (Fase 4): `page.tsx` (Server Component),
  `azioni.ts` (server action pubbliche `cercaSlotPubblici`/`prenotaPubblico`),
  `FlussoPrenotazione.tsx` (stepper client di prenotazione), `ChatWidgetPubblico.tsx` (widget
  chat AI flottante, riusa l'endpoint `/api/chat/[slug]` già esistente).

## Prossimo passo pianificato

Fase 4 (pagina pubblica) ha il codice scritto e testato -- resta da: 1) fare il deploy e
verificare dal vivo in un browser reale (Gabriel, vedi sopra il perché non può farlo Claude dal
sandbox), 2) task #21, Stripe Checkout + webhook (connettore Stripe già collegato l'11/09/2026
in vista di questo), 3) valutare l'anti-abuso della prenotazione pubblica (problema noto #15)
prima di pubblicare il link di un salone vero.
