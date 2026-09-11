# Log delle decisioni

Ogni decisione architetturale/di prodotto importante, in ordine cronologico. Formato breve:
data, decisione, alternative considerate, motivazione. Aggiungere una voce ogni volta che si
chiude una delle decisioni per cui `CLAUDE.md` prescrive di fermarsi e chiedere — non solo
quelle discusse esplicitamente con Gabriel, anche quelle prese in autonomia ma abbastanza
importanti da voler ricordare perché sono state prese così.

---

## 2026-09-01 — Stack: Next.js + Supabase, non evoluzione del progetto Flask precedente

**Decisione**: nuovo progetto (`salone-ai-saas`) su Next.js (App Router) + Supabase
(Postgres/Auth/RLS/Storage) + Tailwind + Stripe, cartella separata dal bot WhatsApp
precedente (`Claude Project`, Flask + Google Calendar, un solo tenant).

**Alternativa considerata**: estendere il progetto Flask esistente con multi-tenancy.

**Motivazione**: il progetto precedente non aveva database né isolamento multi-tenant; un
vero SaaS self-service ha bisogno di auth, RLS e storage integrati fin dall'inizio. La logica
di prenotazione e il pattern "AI interpreta, backend decide" restano validi e vengono
riportati concettualmente, non il codice.

## 2026-09-01 — Multi-tenancy: RLS reale, non solo filtro applicativo

**Decisione**: isolamento tra tenant garantito da Row Level Security Postgres + funzione
helper `security definer` `auth_tenant_id()`, non da un semplice `WHERE tenant_id = ?`
applicativo.

**Motivazione**: un bug applicativo che dimentica il filtro non deve poter esporre dati di un
altro salone — la garanzia deve stare a livello di database, verificabile indipendentemente
dal codice che lo chiama.

## 2026-09-01 — Provisioning automatico via trigger su `auth.users`

**Decisione**: alla registrazione, un trigger Postgres (`al_nuovo_utente`) crea in automatico
tenant + profilo owner + 7 righe di orari (chiusi di default), non un passaggio di onboarding
manuale successivo.

**Motivazione**: coerente con l'obiettivo "zero intervento manuale" — il tenant deve esistere
nell'istante stesso in cui l'utente si registra, non dopo un passaggio separato che potrebbe
non completarsi.

## 2026-09-02 — Booking engine: logica pura separata dal layer DB

**Decisione**: `booking-engine.ts` (calcolo disponibilità/conflitti, zero query) è l'unica
fonte di verità, testata in isolamento senza bisogno di un database. `booking-engine.server.ts`
è solo un layer di traduzione dati-veri -> tipi del motore puro, mai logica di decisione
duplicata.

**Alternativa considerata**: scrivere la disponibilità direttamente nelle query/server
actions, senza un motore separato.

**Motivazione**: calendario manuale e (in futuro) tool AI devono vedere ESATTAMENTE la stessa
disponibilità. Se la logica fosse duplicata in due posti, prima o poi diverge. Un motore puro
è anche testabile senza aspettare le credenziali di un database reale (fatto: 16 test scritti
e verdi prima ancora di collegare Supabase).

## 2026-09-02 — Doppia difesa anti-conflitto: applicativa + vincolo DB

**Decisione**: prima di scrivere un appuntamento, controllo applicativo (`verificaConflitto`)
per un messaggio d'errore immediato e chiaro; il vincolo Postgres `niente_sovrapposizioni`
(exclusion constraint con `btree_gist`) resta comunque attivo come rete di sicurezza finale.

**Motivazione**: il controllo applicativo da solo non basta contro due richieste concorrenti
che lo superano entrambe prima che l'altra scriva (race condition classica); il vincolo DB è
atomico per costruzione. Il controllo applicativo resta comunque utile per non affidare
all'utente un errore Postgres illeggibile.

## 2026-09-02 — Fix: GRANT espliciti sulle tabelle create da SQL Editor

**Decisione**: aggiunta migrazione dedicata (`0005_permessi_grant.sql`) con `GRANT` espliciti
per i ruoli `anon`/`authenticated` su tutte le tabelle di dominio, tranne
`whatsapp_credenziali` (di proposito, resta accessibile solo a `service_role`).

**Motivazione**: bug reale scoperto testando dal vivo (non in fase di code review) — le
tabelle create via SQL Editor Supabase (a differenza della Table Editor grafica) non
ricevono GRANT di base automatici. Anche con RLS e policy corrette, Postgres nega l'accesso
PRIMA di valutare le policy senza il GRANT. Vedi commit "Fix: GRANT mancanti...".

## 2026-09-02 — Canale AI di default: chat web, non WhatsApp

**Decisione pianificata** (non ancora implementata): il canale AI di default per ogni nuovo
tenant è una chat web integrata nella pagina pubblica del salone. WhatsApp resta disponibile
come canale opzionale "connetti il tuo numero" quando l'Embedded Signup Meta è pronto.

**Alternativa considerata**: WhatsApp come canale primario fin dal Free (come Estetia).

**Motivazione**: l'Embedded Signup Meta richiede business verification, che è l'unico punto
dell'intero funnel self-service che dipende da un'approvazione esterna a Meta, non dallo
stack. Un canale che funziona dal minuto zero senza approvazioni esterne mantiene vero
l'obiettivo "zero intervento manuale, self-service reale". Vedi
`docs/verifica-stack-automazione.md`.

## 2026-09-02 — Target di mercato ampliato

**Decisione**: il prodotto non è più scoperto solo per "centri estetici/parrucchieri/
barbieri" (framing originale, stesso mercato di Estetia) ma per qualunque libero
professionista con appuntamenti (personal trainer, massaggiatori, consulenti, tatuatori,
fisioterapisti, ecc.).

**Alternative presentate a Gabriel**: (A) restare solo su estetica/hair, (B) allargare subito
a un target ampio, (C) lanciare su estetica ma con terminologia già neutra per aprire dopo.
Gabriel ha scelto (B).

**Impatto**: lo schema tecnico (tenant/operatori/servizi/clienti/appuntamenti) era già
abbastanza generico da non richiedere modifiche. Cambia il copy rivolto all'utente finale
(oggi ancora salone-specifico in `/registrati` e dashboard — task aperto, vedi
PROJECT_STATUS.md) e il posizionamento di landing/pagina pubblica/marketing quando verranno
costruiti. Estetia resta il riferimento competitivo diretto perché è lo stesso tipo di
prodotto, anche se il loro mercato dichiarato è più stretto del nostro.

## 2026-09-02 — Sequenza fasi: motori prima, grafica finale dopo (Fase 7)

**Decisione**: costruire in ordine motori/dati -> schermate funzionanti ma spartane -> passata
di design definitiva solo quando l'intero funnel self-service esiste (Fase 7 di PIANO.md, con
criteri espliciti: design system applicato ovunque, confronto schermata per schermata con
Estetia, responsive testato per davvero su 3 fasce con browser vero, PWA rifinita, passata
performance).

**Motivazione**: costruire la UI premium prima che il prodotto funzioni rischia di produrre
"uno scaffale vuoto ben verniciato" — se poi emerge un problema nei dati, si rifà anche la
grafica sopra. Le scelte di *interazione* corrette (es. slot di calendario cliccabile invece
di calcolato a mente, già costruito così in Fase 1) si fanno giuste da subito; solo la
rifinitura visiva si rimanda.

## 2026-09-02 — Documentazione persistente: CLAUDE.md, PROJECT_STATUS.md, DECISIONS.md

**Decisione**: `CLAUDE.md` come istruzioni operative permanenti lette a inizio sessione,
`PROJECT_STATUS.md` come stato reale del progetto (aggiornato ad ogni cambiamento
significativo), `DECISIONS.md` (questo file) come registro delle decisioni prese. `PIANO.md`
resta il piano a fasi.

**Motivazione**: richiesta esplicita di Gabriel per lavorare in modo autonomo senza dover
essere reindirizzato passo-passo, e per non perdere contesto tra sessioni (il sandbox cloud è
effimero — vedi rischio aperto in PROJECT_STATUS.md sul remote Git mancante).

## 2026-09-02 — Refactor: scrittura appuntamenti spostata in booking-engine.server.ts

**Decisione**: `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`/`cancellaAppuntamentoTenant`
vivono ora solo in `booking-engine.server.ts`, prendono `supabase: SupabaseClient` come primo
parametro. `dashboard/calendario/azioni.ts` non contiene più logica di scrittura propria, solo
parsing del form e chiamata.

**Motivazione**: i futuri tool AI (Fase 2, client admin/service_role) devono creare/modificare/
cancellare appuntamenti esattamente come fa la dashboard oggi (client con scope RLS) — CLAUDE.md
punto 9 vieta esplicitamente due sistemi separati. Prima di scrivere il primo tool AI si è
estratta la logica già esistente per evitare di duplicarla una seconda volta.

**Verifica**: `npm run build` e `npx vitest run` (16/16) puliti; ciclo completo
creazione/spostamento/cancellazione ripetuto dal vivo nel browser dopo il refactor, stesso
comportamento di prima.

## 2026-09-02 — Bug reale: `new Date()` di V8 non restituisce NaN su stringhe non-ISO

**Trovato da**: un test di validazione scritto per gli strumenti AI (`tools.test.ts`), non da
un code review -- `new Date("stringa-a-caso:00Z")` non lancia né restituisce `NaN`, restituisce
una data valida (1/1/2000) per via del parser "lenient" di V8. La conversione precedente
(`azioni.ts` e la prima versione di `tools.ts`) si fidava di `Number.isNaN(data.getTime())` da
solo per rifiutare un orario non valido, il che lasciava passare input che sembrano una data ma
non lo sono.

**Decisione**: nuova funzione condivisa `parsaOrarioLocale` in `booking-engine.server.ts` che
valida il FORMATO con una regex rigida (`YYYY-MM-DDTHH:MM[:SS][fuso]`) prima di chiamare mai
`new Date()`. Usata sia da `dashboard/calendario/azioni.ts` sia da `src/lib/ai/tools.ts` --
un'unica implementazione, non due copie della stessa logica di parsing.

**Motivazione**: per l'input della dashboard (un `<input type="datetime-local">`) il rischio
pratico era basso; per l'input degli strumenti AI (di fatto testo generato da un modello, non
fidato) accettare silenziosamente una data sbagliata avrebbe violato direttamente CLAUDE.md
punto 7 ("l'AI non deve inventare dati") -- un orario sbagliato interpretato come "1/1/2000"
sarebbe stato un dato inventato a tutti gli effetti, anche se il bug era nel parsing e non nel
modello.

## 2026-09-02 — Strumenti AI scritti, loop di tool-calling non ancora costruito

**Decisione**: `src/lib/ai/tools.ts` definisce gli strumenti (schema compatibile con
l'Anthropic Messages API) e la loro esecuzione reale (`eseguiStrumento`), ma il ciclo vero e
proprio "messaggio in arrivo -> chiamata ad Anthropic con questi strumenti -> esegui i tool_use
-> richiama Anthropic col risultato -> risposta" non è ancora scritto (Task #66) -- manca
`@anthropic-ai/sdk` nel progetto e `ANTHROPIC_API_KEY` in `.env.local`.

**Motivazione**: gli strumenti stessi (wrapping del booking engine già esistente e già testato)
sono lavoro meccanico, coerente con un pattern già deciso (punto 9, single source of truth) --
nessuna decisione nuova da presentare a Gabriel per costruirli. Il loop di tool-calling vero e
proprio invece tocca System prompt/comportamento centrale dell'AI (punto 31 di CLAUDE.md: da
discutere, non da decidere da soli) e comunque non è testabile end-to-end senza la chiave API --
si è preferito costruire e verificare (con test) la parte meccanica ora, e affrontare il loop
come prossimo passo dedicato invece di abbozzarlo senza poterlo verificare.

## 2026-09-02 — Migrazione 0006 scritta ma non applicata: niente accesso diretto al DB da qui

**Decisione**: `supabase/migrations/0006_conversazioni_sessione.sql` (colonna
`identificatore_sessione` su `conversazioni`) è pronta ma non è stata eseguita sul database
reale in questa sessione.

**Perché non l'ho applicata da solo**: l'unico modo che ho provato (aprire l'SQL Editor di
Supabase nel browser di Gabriel) ha incontrato una pagina di login -- proseguire avrebbe
significato autenticarmi con le sue credenziali, cosa che le regole di sicurezza di questa
sessione vietano esplicitamente (mai inserire/inviare una password per conto suo, anche se il
browser la avesse già precompilata). Non esiste in `.env.local` una stringa di connessione
diretta al database (solo le chiavi REST anon/service_role, che non eseguono DDL).

**Prossimo passo**: chiedere a Gabriel di incollare lo script nell'SQL Editor lui stesso, oppure
di fornire una connection string diretta (Project Settings -> Database) per le prossime
migrazioni.

**Aggiornamento 02/09/2026**: Gabriel ha applicato la migrazione lui stesso nell'SQL Editor.
Confermerà la sua correttezza l'uso reale nel motore di conversazione (Fase 2), non ho
interrogato lo schema per verificarlo da qui.

## 2026-09-02 — Metriche dashboard: card oneste, mai un numero segnaposto

**Decisione**: `src/lib/metriche.ts` calcola solo dati che il database contiene davvero oggi.
Dove un flusso non esiste ancora (nessuna azione "no-show" nella UI, quindi nessuna riga con
`stato = 'no_show'`), la card mostra 0 -- mai un valore di esempio o un placeholder che
sembra un dato reale.

**Motivazione**: coerente con la filosofia del progetto ("non dare per scontato che qualcosa
funzioni, verifica dal vivo") applicata anche in senso inverso -- una dashboard che mostra
metriche "quasi vere" è più pericolosa di una che mostra onestamente cosa manca ancora.

## 2026-09-02 — ANTHROPIC_API_KEY ricevuta da Gabriel in chat, non tramite un file

**Decisione**: Gabriel ha incollato la chiave direttamente in conversazione. Salvata in
`.env.local` (gitignorato) nel sandbox cloud; NON sincronizzata sul suo Mac perché gli
strumenti del bridge bloccano di proposito la scrittura di `.env.local` da remoto -- dovrà
aggiungerla lui a mano lì prima di testare l'AI dal vivo nel browser.

**Motivazione**: una chiave API di servizio (non una password di accesso a un account, non un
dato finanziario) incollata in chat per configurare il proprio progetto rientra nell'uso
normale, non nelle categorie vietate (credenziali finanziarie, password di login, ecc.).
Diverso il discorso per scriverla io stesso sul suo Mac da remoto: lì la restrizione tecnica
del bridge è corretta e non ho cercato di aggirarla.

## 2026-09-02 — Struttura piani e prezzi (punto 20 di CLAUDE.md)

**Decisione**: struttura a 5 piani, stesso schema di nomi già previsto in `tenants.piano`
(`free | starter | growth | pro | enterprise`), diversa da Estetia nel posizionamento
dell'AI:

| Piano | Prezzo | Prenotazioni | AI chat web | AI WhatsApp | Altro |
|---|---|---|---|---|---|
| Free | €0 | tetto 60/mese | no | no | 1 operatore, calendario, pagina pubblica, CRM base |
| Starter | €19,90 | illimitate | no | no | multi-operatore, CRM completo |
| Growth | €39,90 | illimitate | **sì** | no | analytics, reminder |
| Pro | €69,90 | illimitate | sì | **sì** | SMS, Prompt Lab |
| Enterprise | su preventivo | illimitate | sì | sì | Instagram/Telegram, PWA, supporto dedicato |

**Ricerca su cui si basa**: Estetia (estetia.tidycode.it, verificato dal vivo il 02/09/2026)
usa Free (€0, 1 operatore, niente AI/CRM) → Starter (€29,90, CRM + "chat AI di base") →
Growth (€49,90, analytics + reminder WhatsApp) → Pro (€89,90, AI conversazionale web+WhatsApp
+ SMS + Prompt Lab) → Enterprise (a preventivo). Nessun tetto numerico dichiarato su
prenotazioni/messaggi -- segmentano per funzionalità, non per volume. **Anche loro non
mettono mai l'AI nel Free.**

**Calcolo costo AI** (Claude Haiku 4.5, prezzi ufficiali Anthropic verificati il 02/09/2026:
$1/milione token input, $5/milione token output): conversazione informativa ~$0,006,
prenotazione completa ~$0,02. Su 1.000 conversazioni/mese (salone molto attivo) il costo
Anthropic totale è ~12$/mese -- ampiamente coperto anche dal piano più economico con AI
(Growth, €39,90).

**Perché l'AI a Growth e non solo a Pro (diverso da Estetia)**: il costo reale per
conversazione è basso, quindi vincolarla al piano più caro sprecherebbe un differenziatore a
basso costo che conviene mostrare prima, come leva per far salire i clienti oltre Starter
(punto 20: "i piani premium devono avere un ROI evidente"). WhatsApp resta riservato al piano
più costoso a prezzo fisso (Pro) su richiesta esplicita di Gabriel ("regolati tu, devono
esserci dei vantaggi reali") -- la differenza reale tra Growth e Pro non è "stessa AI in due
posti", è raggiungere il cliente dove già è (WhatsApp) invece di richiedere che visiti la
pagina pubblica, più SMS e Prompt Lab (personalizzazione del tono dell'AI).

**Nota onesta discussa con Gabriel**: il costo per conversazione è basso -- il vincolo
"l'AI deve essere a pagamento" è più posizionamento/monetizzazione che sopravvivenza sui
costi variabili (coerente comunque con come si muove il mercato, vedi Estetia sopra). Il
rischio reale di andare in perdita non è il costo per conversazione, è l'assenza di un tetto
tecnico su un endpoint pubblico e non autenticato -- per questo, insieme alla struttura dei
piani, Gabriel ha chiesto di costruire subito la difesa tecnica (vedi voce successiva) prima
di aprire l'AI ai piani a pagamento. Il tetto prenotazioni sul Free (60/mese, scelto da
Gabriel) è invece puramente una leva di prodotto/upsell: una prenotazione costa quasi zero
(una riga nel database), non c'è alcun rischio economico nel lasciarle illimitate anche lì --
l'enforcement tecnico di questo tetto non è stato ancora costruito (vedi problemi noti in
PROJECT_STATUS.md).

**Alternative considerate**: AI già da Starter (scartata: rinuncia a una leva di upsell da
Starter a Growth) o solo da Pro come Estetia (scartata: troppo prudente rispetto al costo
reale, che è basso).

## 2026-09-02 — Difesa tecnica anti-abuso sulla chat AI, prima di aprirla ai piani a pagamento

**Decisione**: `src/lib/ai/limiti.ts` + `limiti.server.ts`, applicati in
`api/chat/[slug]/route.ts` PRIMA di salvare il messaggio o chiamare il modello (un messaggio
rifiutato da questi controlli non genera alcun costo Anthropic):
1. Gate di piano: Free/Starter ricevono un 403 esplicito, nessuna conversazione viene
   nemmeno creata nel database per loro.
2. Anti-burst: un secondo messaggio nella stessa conversazione a meno di 2 secondi dal
   precedente viene rifiutato (probabile script, non persona che digita).
3. Quota mensile per tenant, contata sui messaggi reali del cliente nel mese corrente
   (mai un contatore separato che potrebbe disallinearsi dal dato vero): 1.000/mese Growth,
   3.000/mese Pro, illimitato Enterprise -- numeri di partenza, facili da rivedere con dati
   reali di utilizzo.

**Motivazione**: l'endpoint `/api/chat/[slug]` è pubblico e senza autenticazione -- senza
queste difese, uno script che manda migliaia di messaggi farebbe pagare la bolletta Anthropic
a Gabriel indipendentemente dal piano del tenant colpito. Richiesto esplicitamente da Gabriel
prima di collegare l'AI ai piani a pagamento.

## 2026-09-02 — Sincronizzazione calendari esterni: Google via OAuth completo, Apple via CalDAV

**Decisione**: nuovo obiettivo (Fase 6bis in PIANO.md, non nei 33 punti originali, richiesto da
Gabriel). Sincronizzazione bidirezionale vera (vedere gli appuntamenti del salone nel
calendario personale dell'operatore + bloccare uno slot se l'operatore ha già un impegno
personale lì), non solo un link di sola lettura:
- **Google Calendar**: OAuth2 + Google Calendar API v3, tempo reale. Richiede un progetto
  Google Cloud e, per essere disponibile a clienti reali (non solo Gabriel in test), la
  revisione di Google per gli scope "sensibili" del calendario -- stesso tipo di iter (tempi
  non garantiti) già affrontato con Meta per WhatsApp (vedi voce del 2026-09-0X su WhatsApp
  come canale opzionale). Gabriel ha scelto esplicitamente questa strada accettando l'attesa,
  invece dell'alternativa "link webcal universale, zero attese" che gli ho proposto prima.
- **Apple/iCloud Calendar**: CalDAV con password specifica per l'app (l'operatore la genera dal
  suo account Apple) -- nessuna revisione esterna: è un protocollo standard, non un permesso
  che Apple approva. Disponibile appena costruito.

**Alternativa considerata e proposta per prima**: link "webcal://" di sola lettura generato da
noi (per l'esportazione) combinato con l'indirizzo privato ICS del calendario personale
dell'operatore (per l'importazione/blocco) -- copre lo stesso bisogno (vedere + bloccare) senza
alcuna autorizzazione esterna da nessuna delle due parti, ma con aggiornamento non istantaneo
(minuti/ore, non secondi) e un piccolo passo di configurazione manuale per l'operatore.
Scartata da Gabriel a favore della sincronizzazione vera con Google, accettando l'attesa della
revisione.

**Motivazione della scelta di Gabriel**: sincronizzazione istantanea e un login "Accedi con
Google" più semplice per l'utente finale valgono l'attesa della revisione, soprattutto perché
può comunque testare la funzionalità lui stesso da subito, prima che la revisione sia
completata.

---

## 2026-09-02 -- Fase 6bis, prima metà costruita: Apple/iCloud via CalDAV (import/blocco)

Costruita e verificata con test automatici (non ancora con un account iCloud reale, vedi
PIANO.md) la parte Apple della sincronizzazione calendari decisa sopra, mentre Google resta in
attesa delle credenziali OAuth di Gabriel (nessun blocco reciproco tra le due: Apple non
dipendeva da nulla di esterno, quindi è la prima ad essere pronta).

**Scelte tecniche fatte in autonomia, degne di nota**:
- **Nessuna libreria CalDAV/XML esterna**: un client minimale scritto a mano
  (`src/lib/calendario-esterno/caldav.server.ts`) con autodiscovery standard (principal ->
  calendar-home-set -> elenco calendari) ed estrazione dei pochi tag XML che servono via
  regex tollerante al prefisso del namespace, invece di aggiungere una dipendenza (es. `tsdav`)
  per una superficie di parsing comunque piccola. Se in futuro servisse molto di più (es.
  scrittura/aggiornamento eventi per la direzione export), vale la pena rivalutare una libreria
  vera piuttosto che far crescere questo file a mano.
- **Parser ICS puro e testato separatamente** (`ics.ts`, nessuna rete, nessun database) --
  stessa filosofia pura/collegata-al-DB già usata ovunque nel progetto (booking-engine.ts vs
  .server.ts). Gestisce RRULE settimanale (con BYDAY) espandendola davvero in tutte le
  occorrenze nella finestra richiesta -- necessario perché un impegno personale ricorrente
  (es. "palestra ogni martedì alle 18") è comunissimo e ignorarlo avrebbe reso la funzione
  "blocco" molto meno utile nella pratica. RRULE mensile/annuale NON è espansa (fallback:
  mostra solo la prima occorrenza, mai un crash o un impegno perso del tutto silenziosamente)
  -- limitazione consapevole, documentata nel file, accettabile perché rara per calendari
  personali.
- **Fail-open per collegamento esterno**: se un calendario CalDAV non risponde o dà errore
  (rete, password scaduta, server giù), quell'operatore risulta "senza impegni esterni noti in
  questo momento" invece di far fallire l'intera richiesta di disponibilità/prenotazione --
  stessa asimmetria già scelta per il tetto prenotazioni Free (vedi voce sopra sul piano
  Growth/Pro/Enterprise): un calendario personale irraggiungibile non deve mai costare una
  prenotazione vera persa. L'errore resta comunque visibile nelle impostazioni
  (`ultimo_errore` sulla riga del collegamento), non sparisce silenziosamente.
- **Credenziali verificate DAVVERO prima di salvarle**: la UI di collegamento si connette
  davvero al server CalDAV (autodiscovery completa) prima di scrivere qualunque riga nel
  database -- un Apple ID o una password sbagliata dà un errore subito in fase di collegamento,
  mai un collegamento "salvato" che poi fallisce silenziosamente ogni volta che viene usato.
- **Nota di sicurezza aperta, non risolta ora di proposito**: le credenziali CalDAV (come
  altre colonne token già esistenti nel progetto) sono salvate in chiaro nel database per
  questa fase. Rimandato al giro di sicurezza di Fase 6 (punto 29) insieme a tutte le altre
  colonne token, invece di risolverlo isolatamente solo per questa tabella -- non prima che ci
  siano clienti paganti reali con dati qui dentro.

**Cosa NON è ancora stato costruito in questo giro** (per essere onesti sullo stato reale,
vedi PIANO.md per la lista completa): la direzione export (mostrare gli appuntamenti del
salone nel calendario personale dell'operatore -- la tabella `eventi_calendario_esterni` è
pronta per questo ma la scrittura vera non è ancora scritta), e una verifica dal vivo con un
vero account iCloud (oggi solo `npx vitest run` + `npm run build` puliti).

---

## 2026-09-02 -- Fase 6bis, seconda metà: Google Calendar via OAuth2 (import/blocco)

Stesso pomeriggio, subito dopo la parte Apple sopra: Gabriel ha configurato il suo progetto
Google Cloud (Calendar API abilitata, schermata di consenso OAuth, Client ID/Secret) e mandato
le credenziali in chat -- costruito il collegamento OAuth2 vero mentre erano fresche.

**Scelte tecniche fatte in autonomia, degne di nota**:
- **Nessun SDK Google ufficiale (`googleapis`)**: solo 3 chiamate HTTP dirette (authorize URL,
  token exchange/refresh, `events.list`) in `src/lib/calendario-esterno/google.server.ts` --
  stessa logica di "niente dipendenza pesante per una superficie piccola" già applicata al
  client CalDAV scritto poco prima nello stesso pomeriggio.
- **`singleEvents=true` su `events.list`**: Google espande da solo le ricorrenze (RRULE) in
  occorrenze singole -- molto più semplice del parser RRULE scritto a mano per CalDAV/ICS (dove
  Apple non offre questo servizio). Nessuna logica di espansione ricorrenze duplicata per
  Google: non serve, la fa l'API.
- **OAuth2 per-operatore, non un service account condiviso**: ogni operatore autorizza il
  collegamento al PROPRIO calendario con il proprio consenso esplicito (coerente con l'idea
  stessa della funzionalità -- bloccare i SUOI impegni personali), non un accesso della
  piattaforma a calendari altrui. `access_type=offline` + `prompt=consent` per garantire di
  ricevere sempre un refresh_token, necessario per rinnovare l'accesso dopo che scade
  (~1 ora) senza richiedere all'operatore di autorizzare di nuovo ogni volta.
- **Protezione anti-CSRF con nonce in cookie httpOnly**: lo `state` OAuth porta l'operatoreId
  attraverso il giro su Google, ma un `state` da solo è manomettibile da chi intercetta l'URL
  di ritorno -- il nonce salvato in un cookie httpOnly di 5 minuti, verificato di nuovo nel
  callback, impedisce che qualcuno possa forzare il collegamento del calendario di un
  operatore diverso da quello scelto dall'utente che ha avviato il flusso. In più, il callback
  ricontrolla che l'operatore appartenga DAVVERO al tenant dell'utente loggato in quel momento,
  non si fida di quanto dichiarato nello state -- doppia rete di sicurezza, coerente con la
  disciplina già usata per l'isolamento multi-tenant nel resto del progetto (RLS + controllo
  applicativo).
- **Stesso fail-open/aggregazione della parte Apple**: `caricaImpegniEsterni`
  (`collegamenti.server.ts`) ora interroga entrambi i provider e li concatena nella stessa
  forma `AppuntamentoEsistente` prima di passarli al motore puro -- nessuna differenza di
  trattamento tra un impegno Apple e uno Google agli occhi del motore di disponibilità (punto
  9: un'unica logica di conflitto). Un token Google scaduto viene rinnovato automaticamente
  prima di ogni lettura; un refresh_token revocato dall'operatore (es. ha rimosso l'accesso
  dalle impostazioni del suo account Google) fa fallire quella lettura senza bloccare nessuna
  prenotazione reale, con l'errore visibile nelle impostazioni.

**Cosa resta aperto**: verifica dal vivo con un consenso Google reale (Gabriel deve aggiungersi
come utente di test nella schermata di consenso prima di poter provare), la revisione di
Google per rendere la funzione disponibile a clienti reali non di test, e la direzione export
per entrambi i provider (invariata rispetto alla voce sopra).
