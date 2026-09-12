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

## 2026-09-11 — Repo Git spostata su GitHub reale (gab3code/salone-ai-saas) e primo deploy Vercel

**Decisione**: creata una repo GitHub privata dell'account personale di Gabriel
(`github.com/gab3code/salone-ai-saas`) e collegato un progetto Vercel ad essa via GitHub App
di Vercel (non tramite il token usato per il push iniziale, che serviva solo a quello ed è
stato poi revocato). Deploy automatico ad ogni push su `main` da qui in avanti.

**Perché**: il sandbox cloud effimero era l'unico posto con lo storico commit reale (problema
noto #2 in PROJECT_STATUS.md) -- rischio di perdita in caso di scadenza sessione. La strada
inizialmente tentata (deploy manuale via `deploy_to_vercel` con contenuto file trascritto a
mano nella chat) è stata abbandonata a metà per fragilità: trascrivere ~5900 righe di codice a
mano rischiava errori difficili da individuare, contro l'obiettivo di Gabriel di "fare la cosa
più semplice". Git risolve entrambi i problemi in un colpo solo.

**Ostacolo emerso e aggirato**: né il sandbox cloud né la VM del bridge verso il Mac di Gabriel
possono raggiungere `github.com` (policy di rete bloccano l'host, confermato con un 403 dal
proxy in entrambi gli ambienti) -- il push finale è stato fatto da Gabriel stesso dal Terminale
reale del suo Mac, con un git bundle (tutto lo storico commit) trasferito lì da questa
sessione e un Personal Access Token fine-grained creato da lui apposta (scope Contents:
Read and write, solo su quella repo, scadenza 7 giorni, poi revocato). Nota per il futuro:
qualunque necessità di raggiungere github.com da questa sessione richiederà lo stesso giro
(bundle + push manuale di Gabriel), non è un problema di configurazione risolvibile da qui.

**Effetto collaterale positivo**: avendo ora accesso MCP diretto al progetto Supabase reale
(`weeaggiqovnmtovdjzxy`), verificato in questa stessa sessione che: la region è `eu-west-1`
(risolve il problema noto #6, EU confermata), e la migrazione `0008_calendari_esterni.sql`
risulta già applicata sul database vero (le tabelle esistono) -- non tracciata in
`supabase_migrations.schema_migrations` perché applicata a mano da SQL Editor come le
precedenti, ma presente. Avvisi di sicurezza Supabase controllati e invariati rispetto a
quanto già noto (vedi PROJECT_STATUS.md, problemi aperti): nessuna azione presa su questi ora,
restano pianificati per la Fase 6 (revisione sicurezza) per non toccare `SECURITY DEFINER`/RLS
alla leggera senza un giro di test dedicato.

---

## 2026-09-11 — Fuso orario: risolto il problema noto #1 (booking engine "come se fosse UTC")

**Contesto**: la prima verifica dal vivo del sync Google Calendar in questa stessa sessione è
sembrata inizialmente rotta (un evento creato per un orario Rome-locale non risultava bloccato
al posto giusto). Un secondo test controllato (evento allineato a un orario che coincide in UTC
e a Roma) ha confermato che il sync funziona -- il difetto vero era il problema noto #1, mai
prima osservato concretamente: tutto il booking engine tratta i campi UTC di un `Date` come se
fossero l'ora civile del salone ("pseudo-UTC" nei commenti del codice), semplificazione
corretta per i confronti SOLO interni (motore puro, dashboard) ma sbagliata ai due confini dove
il tempo è per forza assoluto: la colonna `timestamptz` di `appuntamenti` e le API di Google/
CalDAV. Prima di questo fix, un salone italiano vedeva ogni appuntamento reale sfasato di 1-2
ore (l'offset di fuso) rispetto a quanto digitato/mostrato -- innocuo finché tutto restava
dentro l'app (stesso "errore" su entrambi i lati del confronto), evidente solo toccando un
sistema realmente esterno come un calendario Google/Apple.

**Decisione**: aggiunta `tenants.fuso_orario` (migrazione 0010, default `'Europe/Rome'` per i
tenant di oggi, applicata al database reale) + nuovo modulo puro `src/lib/fuso-orario.ts`
(`realeAPseudoUtc`/`pseudoUtcAReale`, via `Intl.DateTimeFormat` senza dipendenze esterne,
stesso approccio già usato in `ics.ts` per i TZID). La conversione è applicata SOLO ai due
confini reali (scrittura/lettura di `appuntamenti.inizio/fine`, finestra e risultati di
Google/CalDAV in `collegamenti.server.ts`) e a ogni punto che legge `appuntamenti`/`clienti`
grezzi per mostrarli in dashboard o restituirli all'AI (`calendario/page.tsx`,
`clienti/[id]/page.tsx`, il tool `cerca_prenotazioni_cliente`) -- il motore puro
(`booking-engine.ts`), `parsaOrarioLocale` e la costruzione del system prompt dell'AI restano
INVARIATI, perché continuano a ricevere/produrre solo valori pseudo-UTC come sempre (punto 9:
nessuna logica duplicata). `clienti.created_at`/`appuntamenti.created_at` (generati da
`now()` di Postgres, mai stati pseudo) sono stati lasciati come sono ovunque servano per un
confronto relativo (30/60 giorni, tetto mensile) -- un errore di 1-2 ore è irrilevante su quella
scala, e provare a "correggerli" avrebbe introdotto inconsistenza, non correttezza.

**Alternative scartate**: una libreria tz (es. `date-fns-tz`, `luxon`) -- scartata per lo stesso
motivo per cui il progetto già evita `googleapis`: la superficie di conversione necessaria qui
(civile <-> istante reale per un singolo IANA timezone alla volta) è risolvibile in poche righe
con `Intl.DateTimeFormat`, già nativo, senza una dipendenza in più da mantenere.

**Verifica**: 7 nuovi test per le funzioni di conversione (inverno/estate/round-trip, incluso il
caso noto non invertibile del cambio ora legale di fine ottobre, documentato nel test invece che
nascosto) + tutti i 64 test della suite passano + build di produzione pulita. Verifica dal vivo
contro il database reale tentata da questa sessione con uno script diretto, ma bloccata dalla
STESSA policy di rete che blocca già github.com/Vercel (confermato: `Host not in allowlist:
weeaggiqovnmtovdjzxy.supabase.co` chiamando l'API REST di Supabase direttamente, non tramite gli
strumenti MCP dedicati) -- nota per il futuro, stesso limite strutturale già documentato sopra,
esteso ora anche alle chiamate dirette a Supabase. La verifica dal vivo vera resta da fare dopo
il deploy, con lo stesso approccio già usato per Google Calendar (creare/spostare un
appuntamento reale e controllare l'orario mostrato).

---

## 2026-09-12 — Il sito descrive il prodotto al lancio, non lo stato di oggi

**Contesto**: fino a questo punto la landing seguiva alla lettera CLAUDE.md punto 7 ("l'AI non
deve inventare dati") esteso al marketing -- ogni funzione non ancora costruita portava un
badge "in arrivo" (Prezzi.tsx, Vetrina.tsx, Funzionalita.tsx). Gabriel, in una revisione
approfondita della pagina pubblicata, ha segnalato che l'effetto complessivo era quello di un
prodotto a metà, non di un servizio pronto -- e ha chiesto esplicitamente di togliere le
etichette "in arrivo" ovunque, INCLUSA la pagina Prezzi (quella con le carte di pagamento vere).

**Rischio segnalato prima di agire**: rimuovere "in arrivo" da Prezzi.tsx significa presentare
come già incluse nei piani a pagamento funzioni che al momento non esistono nel prodotto reale:
WhatsApp, SMS, Instagram/Telegram, Analytics, Promemoria automatici, tono AI personalizzabile,
PWA. Alcune (WhatsApp) dipendono da un'approvazione esterna di Meta, non interamente nel
controllo di Gabriel. Questo rischio è stato esposto esplicitamente prima di modificare
Prezzi.tsx (non un'assunzione silenziosa).

**Decisione di Gabriel** (confermata due volte): il sito deve descrivere il prodotto com'è al
lancio commerciale vero, non lo stato di oggi -- "praticamente tutte le cose degli md" verranno
costruite prima di aprire i pagamenti reali. Rimosse tutte le etichette "in arrivo"/"nel
roadmap" dalla landing (Prezzi.tsx, Vetrina.tsx, Faq.tsx, Funzionalita.tsx, ImpattoEconomico.tsx).
Il commitment è reale e va rispettato prima del lancio commerciale, non solo scritto qui: se una
di queste funzioni finisce per non essere pronta, la pagina che la promette deve tornare a dirlo
onestamente PRIMA di aprire i pagamenti, non dopo.

**Scope escluso esplicitamente**: questa decisione riguarda SOLO il linguaggio di marketing
verso il pubblico (cosa il sito promette). Non cambia in alcun modo CLAUDE.md punto 7 per il
prodotto vero -- l'AI in chat continua a non poter inventare dati verso i clienti reali, e la
dashboard non deve mai mostrare come "attivo" qualcosa che non lo è per il tenant che la guarda.

**Decisione collegata, stesso giro**: il calendario esterno mostrato sulla landing (Vetrina.tsx)
e nel prodotto vero (`/dashboard/impostazioni/calendari`) è solo Google -- Apple/iCloud non va
menzionato né mostrato in nessuno dei due posti per ora (Apple era già stato tolto dalla UI
reale l'11/09/2026 per il problema noto #14 -- CalDAV probabilmente bloccato dagli IP data
center di Vercel; questa decisione allinea anche la landing, che fino ad oggi mostrava ancora
un mockup con entrambi i provider).

---

## 2026-09-12 — Seconda revisione landing (uso reale del sito da parte di Gabriel): scope
WhatsApp-only, trial ristretto a Growth, contenuto PercheNoi

**Contesto**: dopo il giro precedente (bento grid, copy onesta, fix mouse/scroll/FAQ), Gabriel ha
scaricato e usato lui stesso il sito pubblicato, con screenshot alla mano -- non più solo
revisione a schermo di Claude. Tre delle segnalazioni sono decisioni di prodotto/business vere,
non solo estetiche, e vanno quindi qui oltre che nel codice.

**1) Multi-canale AI: WhatsApp ora, Instagram/Telegram restano un obiettivo, non una promessa
attuale.** Il tile unito "Assistente AI in chat, WhatsApp, Instagram e Telegram" in
Funzionalita.tsx e la voce Enterprise "Instagram e Telegram" in Prezzi.tsx promettevano oggi
canali che non hanno alcuna integrazione reale né pianificata a breve (a differenza di WhatsApp,
che dipende "solo" dall'approvazione business di Meta, già in corso). Decisione di Gabriel:
tenere l'ambizione multi-canale come direzione futura del prodotto, ma toglierla dal copy
pubblico finché non è concretamente in lavorazione -- "è inutile" promettere oggi qualcosa senza
una data. Funzionalita.tsx ora dice solo "chat e WhatsApp"; la voce Enterprise è diventata
"Multi-sede e ruoli avanzati" (coerente col target dichiarato "catene e gruppi", a differenza di
Instagram/Telegram che non hanno alcun legame con quel target).

**2) Prova gratuita di 10 giorni: solo su Growth, non più su Pro.** Fino a oggi `giorniDiProva`
(src/lib/stripe/piani.ts) e Prezzi.tsx davano il trial sia a Growth che a Pro (voce dell'
11/09/2026 qui sopra: "solo sui piani con l'AI vera, non un trial 'a copertura' su Starter").
Richiesta esplicita di Gabriel: il trial resta SOLO su Growth. Motivazione non registrata nel
dettaglio da Gabriel oltre alla richiesta diretta -- ipotesi ragionevole (non confermata): Growth
è il piano d'ingresso con l'AI vera, quello con cui la maggioranza dei saloni entra nel prodotto,
mentre Pro è un upgrade da chi è già cliente pagante e ha già validato il prodotto, quindi ha
meno bisogno di un periodo di prova per convertire. Cambiato sia il valore mostrato in
Prezzi.tsx sia la funzione `giorniDiProva` (comportamento reale di Stripe via
`/api/stripe/checkout`, non solo il testo in pagina) e il test corrispondente in
`piani.test.ts`.

**3) PercheNoi.tsx: tolti il flusso numerato 1-2-3 e il bagliore viola (Lampada).** Il flusso a 3
passaggi era già stato ridisegnato una volta nel giro precedente (da 3 cerchi in riga con un
pallino animato in loop, a una timeline verticale numerata) su richiesta di Gabriel -- ma vedendo
il risultato pubblicato dal vivo, Gabriel ha segnalato che il contenuto non ha senso in questa
sezione a prescindere dalla messa in scena. Causa reale, non solo di stile: quel contenuto ("un
unico motore decide la disponibilità", "calendario/CRM/AI sempre allineati") è lo stesso concetto
già raccontato per intero dalla scena 0 di Vetrina.tsx, con un'animazione sua propria -- ripeterlo
qui con dei numeri 1-2-3 duplicava sia il contenuto (Vetrina) sia il linguaggio visivo a numeri
(ComeFunziona.tsx, che however conta passaggi di onboarding, non di funzionamento interno) in una
sezione che parla di differenziatori, non di un processo. Rimosso interamente, non ridisegnato
una terza volta. Il bagliore Lampada sopra il titolo è stato tolto per lo stesso principio con cui
esiste (vedi Lampada.tsx): dà peso a un titolo quando non c'è una griglia di card subito sotto --
qui la griglia DIFFERENZIATORI c'è sempre stata, quindi il bagliore non copriva mai il vuoto per
cui è pensato.

**Altre correzioni dello stesso giro, minori/puramente visive (non richiedono una voce qui)**: fix
del buco strutturale nelle bento grid di Funzionalita.tsx e PerChi.tsx (unità di griglia non
multiple del numero di colonne -- vedi i commenti nei due file), fix dell'allineamento della riga
promemoria in ImpattoEconomico.tsx, copy del riquadro verde in ImpattoEconomico.tsx riscritto
senza citare il prezzo di Growth, fix dell'ordine di comparsa dei messaggi nella scena chat di
Vetrina.tsx (le risposte comparivano prima dell'indicatore "sta scrivendo", non dopo), fade in
gradiente in fondo alla Hero per ammorbidire il taglio netto verso ProdottoScroll, TiltCard
aggiunto alle card di Funzionalita.tsx per coerenza con PerChi.tsx.

**Verifica**: vedi PROJECT_STATUS.md per l'esito di test/build/controllo visivo di questo giro.

## 2026-09-12 — Quarto giro: card featured di PerChi, effetto metal graduato sui piani, estensione di Reveal

Dopo aver usato il sito pubblicato dal terzo giro, Gabriel ha mandato 13 nuovi punti e ha chiuso
il messaggio chiedendo esplicitamente domande a risposta multipla prima di agire sui punti
ambigui. Quattro decisioni chiarite così (via `AskUserQuestion`) prima di scrivere codice:

**1) PerChi.tsx: la card featured/grande non deve più essere su parrucchieri/centri estetici.**
Gabriel: "è PER TUTTI quelli che usano appuntamenti, togli la card colorata e più grande per
parrucchieri e centri estetici, usala ma diversamente" -- ambiguo su COSA mettere al suo posto,
non se toglierla. Opzione scelta con Gabriel: la card featured diventa un "chiunque lavori su
appuntamento" esplicito (nuovo testo, stesso trattamento grande/colorato), con le categorie
esistenti (parrucchieri, barbieri, centri estetici, ecc.) presentate esplicitamente come "solo
alcuni esempi, non un elenco chiuso" nel testo della card stessa -- il posizionamento (Salone AI
funziona per QUALUNQUE attività su appuntamento, i saloni sono solo il caso d'uso più visibile)
non cambia, cambia solo quale card lo dice più forte.

**2) Effetto LiquidMetal (lo shader della Hero) sui pulsanti dei piani a pagamento.** Gabriel ha
esplicitamente chiesto di essere consultato ("uso l'effetto metal su growth o su non lo so
fammi delle domande e capiamo insieme"). Risposta: tutti i piani a pagamento (Starter, Growth,
Pro), non solo Growth, con intensità crescente per piano ("più paghi più è bello e premium il
metal") -- Free ed Enterprise restano con i pulsanti pieni/outline esistenti (Free non è un piano
premium da vendere con uno shader, Enterprise è "richiedi info", non un acquisto diretto). Fatto
con lo stesso componente `LiquidMetal` della Hero, un preset di props diverso per piano (palette
più scura/neutra su Starter, più satura su Growth, ancora più intensa su Pro) invece di tre
componenti diversi. Rischio noto e comunicato a Gabriel: 3 shader WebGL simultanei più quello
della Hero potrebbero pesare su hardware/browser deboli -- non verificabile dalla sandbox (vedi
PROJECT_STATUS.md), da controllare sul deploy reale.

**3) CTAFinale: bug reale nel pulsante, non solo "hover orrendo".** Trovato leggendo il codice
prima di rispondere (non ipotizzato): `MagneticButton` sposta il pulsante seguendo il cursore,
`GlowBorder` sotto è un fratello assoluto ancorato al contenitore fisso -- al hover il bordo
luminoso restava fermo mentre il pulsante slittava sopra, sfasandosi. Opzione scelta con Gabriel
tra tre presentate: "fix mirato" (tolto solo l'effetto magnetico da questo pulsante, tenuto tutto
il resto invariato) invece di un redesign completo della card o lasciare l'effetto magnetico e
spostare il GlowBorder a inseguire il pulsante (più complesso, stesso risultato percepito).

**4) Estensione di Reveal a tutto il sito, "anche il testo".** Gabriel ha chiesto che tutto compaia
scendendo nel sito "come la card della dashboard" (ProdottoScroll.tsx, reveal scroll-driven via
GSAP) "senza rovinare tutto quanto". Tre opzioni presentate: (a) lasciare l'effetto ProdottoScroll
un'eccezione voluta per il prodotto, estendendo solo `Reveal`/`RevealStagger` (già usati quasi
ovunque) alle porzioni di testo rimaste ferme; (b) sistema di reveal nuovo e più elaborato per
tutta la pagina; (c) via di mezzo. Scelta (a), esplicitamente indicata come rischio più basso:
rifare da zero il sistema di animazioni di una pagina già rifinita in tre giri precedenti avrebbe
potuto introdurre regressioni proprio dove Gabriel aveva già approvato il risultato. Applicato a
`Footer.tsx` e alla didascalia di `PrimaDopo.tsx`, le uniche porzioni di testo rimaste senza alcun
reveal-on-scroll dopo un audit di tutti i componenti della landing.

**Un punto chiarito senza bisogno di scegliere tra opzioni**: la riga del promemoria automatico
in ImpattoEconomico.tsx, segnalata da Gabriel come "ancora" spostata a destra -- verificata di
nuovo nel codice e con uno screenshot Playwright fresco, già corretta dal fix del terzo giro.
Comunicato a Gabriel come probabile cache/build non aggiornata dal suo lato invece di modificare
codice già corretto alla cieca.

**Verifica**: vedi PROJECT_STATUS.md, sezione "Quarto giro", per l'esito di test/build/controllo
visivo.

## 2026-09-12 — Quinto giro: sfondo CTA finale (seconda riscrittura) e pulsanti metal come anello

**1) Sfondo di CTAFinale.tsx, seconda riscrittura.** Il quarto giro aveva già sostituito lo shader
LiquidMetal con un bagliore ambientale a due ellissi statiche -- Gabriel ha segnalato che non gli
piaceva "per niente" e ha chiesto esplicitamente di proporre alternative invece di riscrivere
alla cieca una terza volta di fila sulla stessa sezione. Mostrate 4 direzioni via screenshot
(non codice, solo mockup statici): (A) aurora multicolore animata, (B) griglia tecnica in stile
"prodotto SaaS", (C) spotlight scuro -- un solo bagliore che si muove, (D) piatto/minimale senza
bagliore. Scelta: C. Reso interattivo (segue il puntatore con smoothing a molla sul contenitore
intero, non un div interno più piccolo, così reagisce anche quando il mouse è sopra testo/
pulsante) con una deriva lenta automatica quando non c'è interazione -- coerente con la
preferenza esplicita di Gabriel per interfacce "fluide, interattive e dinamiche" (vedi
preferenze salvate).

**2) Titolo della Hero, "mai più senza risposta".** Già cambiato una volta nel terzo giro (da
gradient viola/fucsia con bg-clip-text, che spariva contro lo sfondo shader alla stessa fase
cromatica, a bianco pieno con un bagliore text-shadow colorato). Gabriel ha segnalato che quel
bagliore leggeva come un'"evidenziazione" indesiderata e ha chiesto un colore vero sul testo che
non si confondesse con lo sfondo. Scelto ambra pieno (nessun text-shadow proprio, solo l'ombra
neutra già ereditata dall'h1): lontano su qualunque ruota cromatica dal viola/fucsia/magenta
dello shader dietro, quindi mai un tono vicino con cui confondersi a nessuna fase
dell'animazione -- a differenza del tentativo precedente (bianco + bagliore COLORATO, che poteva
comunque leggere come un alone indesiderato indipendentemente dalla fase).

**3) Pulsanti "metal" dei piani a pagamento: anello invece di riempimento.** Gabriel ha detto che
i pulsanti "non sono male ma sono un po' strani" e ha chiesto di continuare in quella direzione
cercando ispirazione sui connettori (21st.dev/OriginKit). Trovato un componente pertinente
("metal-fx" di larsen66 su 21st.dev): un bordo/anello metallico animato attorno a un elemento
qualunque, non uno shader che riempie tutta la superficie -- probabilmente la causa reale dello
"strano": un vortice colorato che riempie l'INTERA area cliccabile di un pulsante piccolo non
legge come un pulsante normale. Deciso di NON installare la libreria di terze parti (dipendenza
esterna con licenza non verificata, per un progetto a budget zero non vale il rischio per un
dettaglio estetico) ma di ricreare la stessa idea con `LiquidMetal`, già nel codice e già
verificato: pulsante scuro pieno e leggibile, con 2px di anello animato attorno (stessa tecnica
già usata in questo file per il bordo del piano "Consigliato" -- un contenitore con qualche px di
padding, l'effetto animato sotto, un elemento pieno sopra).

**Verifica**: vedi PROJECT_STATUS.md, sezione "Quinto giro", per l'esito di test/build/controllo
visivo e per la nota sui limiti di verifica visiva della sandbox riguardo a Hero/pulsanti metal.

## 2026-09-12 — Quinto giro, seconda parte: colore anello Pro e sfondo delle pagine di autenticazione

**1) Colore dell'anello metallico di Pro.** Gabriel ha visto l'effetto anello (punto 3 sopra) sul
sito reale e ha confermato che gli piace, ma ha chiesto di cambiare il colore di Pro "per renderlo
ancora più pro" -- prima usava la palette di default di `LiquidMetal` (la stessa della Hero:
viola scuro -> viola -> fucsia -> rosa chiaro), la STESSA famiglia cromatica dell'anello di Growth
appena sopra nella griglia dei piani. Le due leggevano come varianti di intensità dello stesso
colore, non come due livelli chiaramente diversi. Scelto oro/champagne (`#3d2c0a` -> `#8a6116` ->
`#d4a017` -> `#f2cf7a` -> `#fff3d6`): è il codice colore quasi universale per il livello "top" di
un prodotto (carte Gold/Platinum, badge premium in molti SaaS) -- un'unica interruzione
dall'identità viola/fucsia che identifica il resto del sito, contenuta in un solo anello sottile
su un solo pulsante, non una reinterpretazione del brand.

**2) Sfondo di `/accedi` e `/registrati`.** Richiesta esplicita ma con la scelta lasciata al mio
giudizio ("card in fondo bellissima, rendi cosi anche lo sfondo di accedi e di registrati, se
pensi possa migliorare, fallo"). Le due pagine avevano solo un alone viola fisso e statico, mai
il risultato di una scelta di design discussa con Gabriel -- semplicemente quello che era stato
messo lì nel controllo pre-pubblicazione del primo giro, prima ancora che esistesse lo "Spotlight
scuro" di CTAFinale.tsx. Applicare lo stesso trattamento interattivo (segue il puntatore, deriva
lenta quando non c'è interazione) dà continuità visiva reale al sito -- le pagine dove si
converte davvero (login, registrazione) non devono sembrare un capitolo a parte rispetto alla
landing -- ed è coerente con la preferenza già espressa da Gabriel per interfacce "fluide e
dinamiche". Estratto l'hook `useSpotlightScuro` da CTAFinale.tsx in un file condiviso
(`SpotlightScuro.tsx`) piuttosto che copiarlo tre volte, così un'eventuale modifica futura
all'effetto (velocità, colore, intensità) si fa in un solo punto per tutto il sito.

**Verifica**: vedi PROJECT_STATUS.md, sezione "Quinto giro, seconda parte", per l'esito di
test/build/controllo visivo.

## 2026-09-12 — Quinto giro, quinta parte: pinnare solo l'elemento piccolo, mai un blocco composito

Bug: la sezione "Vetrina" (scrollytelling) pinnava con GSAP l'INTERA griglia a 2 colonne (lista di
6 voci + palco del mockup) come un unico blocco `position: fixed` per tutta la durata dello
scroll. Su schermi non altissimi, l'ultima voce della lista finiva oltre il bordo inferiore della
finestra e restava lì per sempre -- un `position: fixed` non permette scroll interno, quindi
qualunque contenuto ecceda la sua altezza in quel momento è irraggiungibile finché il pin resta
attivo. Stesso identico bug già trovato e risolto su MOBILE in un giro precedente (lì la scelta fu
un layout non pinnato del tutto sotto `lg`), ripresentato su desktop perché l'assunzione "il
layout a 2 colonne è più corto" era vera in media, non sempre.

**Decisione**: quando si pinna per una scrollytelling (un pannello che deve restare fermo mentre
si scorre un elenco a fianco), pinnare SOLO l'elemento la cui altezza è fissa e piccola (qui, il
"palco" del mockup, 20-26rem -- entra in qualunque finestra ragionevole), mai un contenitore
composito la cui altezza dipende dal CONTENUTO (qui, la lista testuale, che cresce se il testo si
allunga, se si aggiunge una settima voce, o se il font è più grande su un altro dispositivo). Un
pin su un elemento a contenuto variabile è una bomba a orologeria: funziona finché il contenuto
resta sotto una soglia mai scritta esplicitamente da nessuna parte, e si rompe silenziosamente il
giorno che qualcuno aggiunge una riga di testo o una voce alla lista. L'elemento a contenuto
variabile va reso `position: sticky` (che permette comunque di restare "agganciato" in vista, ma
senza il rischio di clipping permanente) con un `overflow-y-auto` + `max-height` di sicurezza, così
anche un contenuto futuro più lungo del previsto resta raggiungibile scorrendo, mai tagliato.

**Due insidie CSS non ovvie, trovate solo scrollando davvero con Playwright** (utile per la
prossima volta che si tocca `position: sticky` in questo progetto):
1. Un `overflow: hidden` su QUALUNQUE antenato (qui, sulla `<section>`, per ritagliare una texture
   di sfondo decorativa) disattiva silenziosamente `sticky` su ogni discendente -- la spec CSS lo
   lega al più vicino "contenitore di scroll", e un antenato con overflow diverso da `visible`
   conta come tale anche se in pratica non scorre mai da solo. Va spostato su un contenitore
   dedicato SOLO alla texture, non sulla sezione intera.
2. Il contenitore DIRETTO dell'elemento sticky deve essere alto quanto l'intero intervallo di
   scroll per cui lo si vuole "agganciato" -- se la sua altezza è quella naturale del contenuto
   (più corta), lo sticky si stacca non appena quell'altezza viene superata, molto prima della
   fine dello scroll previsto.

**Verifica**: vedi PROJECT_STATUS.md, sezione "Quinto giro, quinta parte" -- scroll programmato a 6
punti distinti dell'intervallo, non 2-3 screenshot presi a caso, proprio perché un bug come questo
(dipendente dall'altezza reale del contenuto rispetto alla finestra) non si vede scorrendo solo
l'inizio o solo un frame casuale.

## 2026-09-12 — Quinto giro, quarta parte: margine di sicurezza sulla tonalità invece di un colore fisso

Gabriel ha segnalato di nuovo, per la stessa animazione dell'anello Pro, che il colore
"tende ancora al verde, fa un po oro e un po verde" -- nonostante la seconda parte di questo
giro avesse già ricalcolato la palette con `colorsys` dopo un reclamo simile ("rendilo un po piu
oro, meno giallo/verde"). Il colore FISSO era corretto in isolamento (~31-42° di tonalità, un oro
vero secondo `colorsys`); il problema mai considerato prima era che quel colore non resta MAI
fisso a schermo -- lo shader (`LiquidMetal.tsx`, funzione `hueShift()`) ruota continuamente la
tonalità dell'intera palette di un'ampiezza legata al parametro `shimmer` (±20° con `shimmer: 7`,
il valore di Pro). Un colore verificato solo al suo valore di riposo può comunque finire, per una
parte del ciclo di animazione, in una zona di tonalità diversa e sgradita -- qui, il picco della
rotazione (+20°) spingeva l'oro (~31-42°) fino a ~51-62°, dentro la zona percepita come
giallo-verde.

**Decisione**: per un colore dietro un'animazione che ruota la tonalità nel tempo, verificare (e
scegliere) non il valore di riposo isolato ma l'INTERO intervallo che il colore attraversa durante
l'animazione, con margine. Ricalcolata la palette di Pro su tonalità molto più basse (~22-34°,
così che anche il picco massimo della rotazione resti saldamente nell'oro/ambra) e ridotta
leggermente anche l'ampiezza stessa (`shimmer` 7 -> 6) per un doppio margine di sicurezza, invece
di limitarsi a spostare di nuovo il singolo valore fisso e sperare che basti. Stesso principio
metodologico della voce precedente (misurare con `colorsys`, non a occhio), esteso a un colore che
si muove nel tempo anziché uno statico.

**Verifica**: non possibile in questa sandbox (il contesto WebGL non rende mai i colori veri dello
shader qui, confermato di nuovo in questo giro) -- da confermare sul sito vero da Gabriel, come già
per i round precedenti sullo stesso pulsante. Vedi PROJECT_STATUS.md, sezione "Quinto giro, quarta
parte", anche per gli altri due bug reali risolti nello stesso giro (lettere "p" tagliate dal
contorno del testo che sporgeva oltre un `overflow-hidden` troppo stretto; un secondo alone scuro,
distinto dal `text-shadow` già corretto nella terza parte, dovuto a un `filter: drop-shadow`
separato mai rimosso).

## 2026-09-12 — Quinto giro, terza parte: colore del titolo Hero calcolato, non scelto a occhio

Gabriel ha chiesto esplicitamente: "verifica che si abbini allo sfondo e al colore di tutto il
sito e che non ci siano colori migliori" -- non una preferenza estetica generica, una richiesta di
verifica. Invece di confrontare colori a occhio (fonte di due errori già in questo stesso giro:
sfondo di test sbagliato la prima volta, ombra ereditata non rimossa la seconda), ho misurato la
tonalità (hue, in gradi) dei colori REALI già usati nel sito con `colorsys` invece di stimarla:

- `violet-600` (#7c3aed, bottoni/badge): ~262°
- `PALETTE_DEFAULT` di LiquidMetal.tsx, estremo scuro (#1e0b3d): ~263°
- Colore del bagliore "Consigliato" di Prezzi.tsx (#f0abfc): ~291°
- `PALETTE_DEFAULT`, estremo chiaro (#fae8ff): ~287°
- "Growth-mid" (#c026d3): ~293°

Il pattern è chiaro e coerente su OGNI gradiente reale del sito: scuro = viola freddo (~262°),
chiaro = magenta/fucsia caldo (~289-293°) -- mai un viola piatto e uniforme dal chiaro allo scuro.
Il primo tentativo di tinta viola per il titolo (round precedente in questo stesso giro) aveva
virato TUTTE le bande di metallo verso lo stesso viola freddo (~260-270° su ogni tappa),
catturando solo la metà "scura" dell'identità cromatica del sito e ignorando il magenta caldo che
è altrettanto centrale (badge, bottoni, bagliori). Ricalcolate le bande con la stessa
progressione hue-per-luminosità degli altri gradienti (scuro ~262° -> chiaro ~289°), verificato
con uno swatch affiancato ai colori reali del sito prima di consegnare (screenshot mandato a
Gabriel, non solo asserito).

**Perché non semplicemente riusare i colori del sito 1:1 come fill del testo**: sono troppo
SATURI per leggere come metallo -- un fucsia vivido pieno (#c026d3) su del testo leggerebbe come
"testo colorato", non come "metallo colorato" (i metalli sono per natura desaturati/opachi anche
quando hanno una tinta). Le bande del titolo restano quindi alla stessa tonalità (hue) dei colori
del sito ma con luminosità/saturazione ridotte, la differenza tra "un accento dello stesso colore
del brand" e "una lega di metallo choc con lo stesso brand".

**Verifica**: vedi PROJECT_STATUS.md, sezione "Quinto giro, terza parte".
