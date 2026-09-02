# Stato del progetto

Ultimo aggiornamento: 02/09/2026 (refactor scrittura appuntamenti). Aggiornare questo file ogni volta che cambia lo stato reale
di qualcosa (una funzionalità passa da mock a vera, un problema si apre/chiude, una fase
si chiude) — non lasciarlo invecchiare. Vedi `CLAUDE.md` per le regole di lavoro,
`DECISIONS.md` per il perché delle scelte architetturali, `PIANO.md` per il piano a fasi.

## In una riga

Fase 0 (fondamenta multi-tenant) e Fase 1 (booking engine collegato al database) **chiuse e
verificate dal vivo con un salone di test reale**. Fase 2 (AI conversazionale) non ancora
iniziata. Tutto il resto (CRM esteso, dashboard con insight, pagina pubblica, automazioni,
billing, admin panel, PWA) non ancora iniziato.

## Stack reale (verificato in `package.json`)

Next.js 16.3.4 (App Router, Turbopack) + React 19.2.8 + TypeScript + Tailwind CSS v4 +
Supabase (`@supabase/ssr` 0.12.5, `@supabase/supabase-js` 2.113.0) + Vitest per i test.
Stripe e Anthropic Claude SDK non ancora integrati nel codice (pianificati Fase 2/5).
Progetto Supabase reale collegato: `weeaggiqovnmtovdjzxy` (region da verificare che sia EU —
vedi "Problemi aperti").

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
- **Scrittura appuntamenti unificata (single source of truth, 02/09/2026)**:
  `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`/`cancellaAppuntamentoTenant` in
  `booking-engine.server.ts` sono ora l'unico punto che scrive create/modifica/cancella —
  prendono un client Supabase come parametro, quindi la dashboard (client RLS) e i futuri tool
  AI (client admin) chiameranno esattamente lo stesso codice, mai due implementazioni separate
  (CLAUDE.md punto 9). `dashboard/calendario/azioni.ts` è ora solo parsing form + chiamata.
  Verificato dal vivo l'intero ciclo (creazione/spostamento/cancellazione) dopo il refactor.

## Cosa è mock, incompleto o non ancora iniziato

- **AI conversazionale**: zero codice. Architettura decisa (tool-calling, "l'AI interpreta il
  backend decide", riprendere il pattern di `cervello.py` dal progetto precedente) ma non
  implementata. Nessun endpoint di chat, nessun tool collegato al booking engine.
- **WhatsApp**: predisposizione tecnica per l'Embedded Signup Meta scritta
  (`src/lib/whatsapp-embedded-signup.ts`, `src/app/api/whatsapp/embedded-signup/callback/
  route.ts`, migrazione 0003) ma **non attivabile**: bloccata dalla business verification
  Meta + P.IVA di Gabriel, in pausa per sua scelta. Il canale AI di default pianificato è
  invece la chat web (nessuna approvazione esterna richiesta) — non ancora costruito.
- **CRM**: la tabella `clienti` esiste ed è popolata automaticamente alla creazione di un
  appuntamento (nuovo/esistente per telefono), ma non esiste nessuna schermata di gestione
  clienti, storico, tag, note.
- **Dashboard**: solo un riepilogo statico del tenant (nome, piano, stato abbonamento). Zero
  metriche reali, zero insight.
- **Pagina pubblica per-attività**: zero codice. `tenants.slug` esiste nello schema ma non è
  servito da nessuna route pubblica.
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

1. **Fuso orario semplificato come UTC** in tutto il booking engine (vedi commento in
   `booking-engine.server.ts`): corretto solo se l'ora del tenant coincide con UTC in quel
   momento. Va aggiunto un campo fuso orario su `tenants` prima che la prenotazione si possa
   considerare davvero finita (vedi Fase 7 in PIANO.md).
2. **Repo Git canonico nel sandbox cloud effimero**, nessun remote GitHub permanente ancora
   configurato — rischio reale di perdita storia se la sessione cloud scade. Da risolvere
   prima possibile (non solo prima della Fase 7).
3. **iCloud Drive che sincronizza la cartella Desktop sul Mac di Gabriel** causa errori
   intermittenti di lettura file dentro `node_modules` sotto Turbopack (`EOF while parsing`,
   `Resource deadlock avoided`). Non blocca (verificato: la pagina carica comunque), ma
   rallenta la compilazione e resta fastidioso. Fix suggerito e non ancora fatto: spostare il
   progetto fuori da una cartella sincronizzata iCloud.
4. **Nessun test automatico per `booking-engine.server.ts`** (il layer collegato al DB): solo
   verificato manualmente nel browser. I 16 test automatici coprono solo `booking-engine.ts`
   (logica pura). Rischio: una regressione nel layer di query/conversione non verrebbe
   presa da `npx vitest run`.
5. **Concorrenza non testata su questo progetto**: il vincolo DB esiste ma non è stato
   ancora verificato con un vero test a due richieste simultanee (era stato fatto con
   successo sul progetto precedente con un meccanismo diverso).
6. **Region Supabase EU non ancora confermata** — rilevante sia per GDPR sia per poter
   dichiarare lo stesso claim di Estetia ("server in Europa").

## Mappa dei file principali

- `src/lib/booking-engine.ts` — motore di disponibilità puro (nessuna query DB), 16 test.
- `src/lib/booking-engine.server.ts` — collegamento a Supabase, delega sempre al motore puro.
- `src/lib/supabase/{client,server,admin,tenant}.ts` — client browser/server/service-role e
  helper "utente loggato -> tenant_id".
- `src/app/registrati`, `src/app/accedi` — funnel di ingresso self-service.
- `src/app/dashboard/{page,azioni}.tsx` — dashboard minima + logout.
- `src/app/dashboard/configura/` — onboarding orari/operatori/servizi.
- `src/app/dashboard/calendario/` — vista calendario, creazione/modifica/cancellazione.
- `src/proxy.ts` — refresh sessione Supabase (era `middleware.ts`, rinominato per Next 16).
- `supabase/migrations/0001-0005` — schema multi-tenant, chiusure, prep WhatsApp,
  provisioning automatico, fix GRANT.
- `docs/analisi-estetia.md` — analisi competitiva (screenshot + giro dal vivo sul sito).
- `docs/verifica-stack-automazione.md`, `docs/verifica-fattibilita-33-punti.md` — verifica
  che lo stack supporti il funnel self-service richiesto.
- `docs/embedded-signup-whatsapp.md` — guida tecnica Embedded Signup Meta.

## Prossimo passo pianificato

Fase 2 — AI conversazionale (vedi PIANO.md e CLAUDE.md): canale chat web di default, stessa
architettura tool-calling/"AI interpreta backend decide" del progetto precedente, stesso
booking engine di Fase 1, conversazioni persistenti in `conversazioni.slot_in_costruzione`.
