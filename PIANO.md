# Piano di lavoro -- SaaS per liberi professionisti con appuntamenti

Riferimento studiato: https://estetia.tidycode.it/ (analisi in `docs/analisi-estetia.md`).
Obiettivo: non copiarlo, superarlo -- vedi il messaggio originale del progetto per la lista
completa dei 33 punti richiesti. Qui sotto sono organizzati in fasi eseguibili in sequenza,
ciascuna con un criterio chiaro di "fatta" prima di passare alla successiva (niente teoria,
solo cose costruite e verificate -- stesso metodo usato nell'audit del progetto precedente).

**Target di mercato (deciso 02/09/2026)**: non solo centri estetici/parrucchieri/barbieri come
Estetia -- una fascia ampia di liberi professionisti con appuntamenti (personal trainer,
massaggiatori, consulenti, tatuatori, fisioterapisti, ecc.). Lo schema tecnico (tenant/
operatori/servizi/clienti/appuntamenti) è già generico, non richiede modifiche sotto per
questo. Quello che cambia: il copy/posizionamento (evitare di restare fissi su "salone" nei
testi rivolti all'utente finale -- registrati/dashboard oggi ce l'hanno, da generalizzare
quando si tocca quel testo), la pagina pubblica (Fase 4) e il materiale marketing (Fase 5),
pensati da subito per parlare a qualunque professionista con agenda, non solo al settore
estetico. Estetia resta il riferimento competitivo perché è lo stesso tipo di prodotto
(booking + CRM + AI), anche se il loro mercato dichiarato è più stretto del nostro.

## COSA DOBBIAMO FARE, DA OGGI IN POI, IN ORDINE (aggiornato 12/09/2026, richiesta esplicita di Gabriel)

Lista unica e concreta, in ordine di priorità reale -- non un indice delle fasi sotto, ma cosa
fare per davvero prima di cos'altro. Il dettaglio tecnico di ogni punto è nelle fasi più sotto o
nei documenti citati; questa è la vista d'insieme che risponde a "cosa dobbiamo fare".

### Gruppo A -- Serve solo il tuo ok o un tuo test, zero nuovo codice (sblocca tutto il resto)
1. **Dare l'ok al push di quanto già pronto e in attesa da questa sessione**: titolo Hero con i
   colori Growth, fix del clipping desktop su Vetrina, titolo interattivo (tilt al mouse + bande
   che seguono l'inclinazione), fix del CompareSlider ("Trascina per vedere la differenza").
   Tutto committato in locale, non ancora pushato -- appena dici ok ti mando il bundle e le
   istruzioni per `git pull`+`git push` dal tuo Mac.
2. **Deploy Vercel** del codice sopra una volta pushato (automatico ad ogni push su `main`, già
   collegato).
3. **Provare dal vivo `/s/[slug]`** (pagina pubblica del salone) con un salone di test: cercare
   slot, prenotare, parlare con il widget chat AI -- scritta e testata in automatico, mai aperta
   in un browser reale.
4. **Provare un pagamento di test reale su Stripe Checkout** + configurare il webhook lato
   Stripe Dashboard (serve un dominio pubblico, quindi va fatto dopo il deploy) -- il codice è
   scritto e testato, mai verificato con un pagamento vero.
5. **Aggiungerti come "utente di test"** nella schermata di consenso OAuth Google (Google Cloud
   Console), poi provare "Collega Google" dal vivo in `/dashboard/impostazioni/calendari`.
6. **Decidere cosa fare di Apple/iCloud Calendar**: non risolvibile da un hosting cloud standard
   come Vercel (blocco di Apple sul traffico da IP di data center, vedi PROJECT_STATUS.md
   "Problemi noti aperti" #14) -- o lo dichiariamo non supportato, o si accetta il limite e si
   documenta così nel materiale di vendita quando esisterà.

### Gruppo B -- Nuovo codice a priorità alta, trovato nel mega-controllo competitor di oggi
1. **Deposito/caparra anti-no-show** (Fase 6): gap reale in tutto il software italiano di
   categoria, standard nei marketplace -- Stripe già integrato, da estendere. Il singolo task
   con il miglior rapporto impatto/lavoro trovato oggi: ci mette avanti a TUTTI i concorrenti
   italiani diretti, non solo ai marketplace.
2. **Tono dell'AI personalizzabile** (Fase 5): bloccante prima di aprire pagamenti veri sul
   piano Pro -- oggi pubblicizzato ma inesistente nel codice (nessuna colonna/UI/collegamento al
   prompt). Non urgentissimo solo perché nessun cliente Pro reale esiste ancora.
3. **Lista d'attesa automatica alla cancellazione** (Fase 6): vista su Calendix e CutApp, non
   grande lavoro sopra il booking engine che già esiste.

### Gruppo B-bis -- Altre funzioni che mancano davvero, trovate in un secondo giro (12/09/2026)

Continuando il controllo su richiesta di Gabriel ("altre funzioni che dobbiamo e possiamo
mettere"): confronto punto-per-punto tra cosa il codice fa oggi e cosa un titolare si
aspetterebbe da un prodotto di questa categoria (non solo dal confronto competitor). Ordinate
per quanto sono urgenti/dovute, non per quanto sarebbero belle da avere.

**Dovute (mancano, e sono cose che qualunque prodotto di booking ha)**:
1. **Nessuna notifica email, né per il titolare né per il cliente**: oggi, quando arriva una
   prenotazione (da dashboard, da AI, o dalla pagina pubblica), zero email parte -- il titolare
   se ne accorge solo aprendo la dashboard, e il cliente finale non riceve nessuna conferma
   scritta della propria prenotazione. Prima che WhatsApp sia disponibile (bloccato da Meta),
   l'email è l'UNICO canale di notifica passiva possibile -- senza, un titolare deve tenere la
   dashboard aperta per accorgersi di una prenotazione nuova. Verificato: zero provider email
   (Resend/Postmark/nodemailer) nel progetto. **Priorità alta, manca qualcosa che ogni
   concorrente verificato ha.**
2. **Il cliente finale non può gestire da solo la propria prenotazione** dopo averla fatta su
   `/s/[slug]` (cancellarla, spostarla) -- deve richiamare o riscrivere al salone. Ogni
   concorrente verificato (inclusa Estetia) offre questo. Si lega bene al punto sopra: il modo
   più naturale di offrirlo è un link nell'email di conferma ("gestisci la tua prenotazione"),
   non un login separato per il cliente.
3. **"Multi-sede e ruoli avanzati" venduto sul piano Enterprise ma zero supporto reale**: stesso
   tipo di problema già trovato con "Tono dell'AI personalizzabile" su Pro (vedi Gruppo B) --
   nello schema non esiste nessun concetto di "sede" (un tenant è un unico luogo fisico), e la
   colonna `profiles.ruolo` (owner/staff/admin_piattaforma) esiste ma non è controllata da
   NESSUNA parte del codice: un operatore non può avere un proprio login con permessi limitati,
   solo il titolare (owner) accede mai alla dashboard. Bloccante prima di vendere Enterprise a
   un cliente vero, per lo stesso motivo del Tono AI.

**Possibili, da valutare (non urgenti, ma rafforzano il prodotto se costruiti bene)**:
4. **Multi-utente/team reale**: conseguenza diretta del punto 3 -- dare a ogni "operatore" un
   proprio login (invito via email, permessi limitati alla propria agenda) invece di essere solo
   un record gestito dal titolare. Rilevante per la persona di marketing "salone con team" che
   già usiamo in `PerChi.tsx` -- oggi quella promessa non è ancora mantenuta tecnicamente.
5. **Raccolta recensioni post-appuntamento**: nessun gestionale italiano verificato la fa
   nativamente (Estetia mostra solo testimonianze statiche in home page, non vere recensioni
   raccolte); i marketplace (Fresha/Treatwell/Booksy) invece fondano parte della fiducia proprio
   sulle recensioni. Un messaggio automatico post-appuntamento che chiede una valutazione,
   mostrata sulla pagina pubblica del salone, sarebbe un differenziale vero e non richiede
   grande lavoro sopra quello che già esiste (stessa infrastruttura di reminder/automazioni
   pianificata in Fase 6).
6. **Export/import CSV dei clienti**: Estetia ce l'ha esplicitamente, utile per un titolare che
   migra da un altro gestionale (abbassa l'attrito di switch) o vuole i propri dati per un
   mailing esterno. Lavoro contenuto.
7. **Pacchetti prepagati/tessera fedeltà digitale**: visto su CutApp, comune nel settore beauty
   ("10 sedute prepagate", punti fedeltà). Non urgente, ma un vero differenziale per i saloni
   che già usano questo modello di vendita oggi su carta.

**Da NON fare senza pensarci due volte (rischio di scope creep)**:
8. **"Cassa"/registro incassi reale dei servizi erogati** (diverso dal nostro billing Stripe, che
   è per l'abbonamento SaaS): presente in Estetia ("Cassa" in sidebar) e WeGest ("cassa e
   magazzino"). Utile in teoria, ma tocca fatturazione/ricevute fiscali italiane -- un terreno
   normativo diverso dal nostro focus (booking + AI + CRM) e facile da sottovalutare in
   complessità. Non aggiunto come task: da valutare SOLO se più di un cliente reale lo chiede
   esplicitamente, non perché un concorrente ce l'ha.

### Gruppo C -- Completare le fasi già aperte (dettaglio nelle fasi sotto)
1. Fase 1: collegare alle schermate/AI la gestione di servizi consecutivi e operatore non
   specificato (la logica pura c'è già); test sugli scenari di prenotazione del punto 30 contro
   il DB vero.
2. Fase 2: collegare WhatsApp/Telegram non appena la business verification Meta si sblocca
   (fuori dal nostro controllo); valutare se serve davvero strutturare
   `conversazioni.slot_in_costruzione` invece di rileggere sempre lo storico.
3. Fase 3: analytics più complete -- retention, no-show REALE (oggi nessun flusso marca un
   appuntamento come no-show; si lega bene al lavoro sul deposito/caparra del Gruppo B).
4. Fase 4: galleria/upload foto (Supabase Storage), PWA installabile.
5. Fase 5: pannello admin per te (saloni, abbonamenti, utilizzo, interventi manuali).
6. Fase 6bis: direzione export dei calendari esterni (mostrare gli appuntamenti del salone sul
   calendario personale, non solo leggerne gli impegni); valutare il cifraggio a riposo delle
   credenziali/token salvati in chiaro.
7. Fase 6: motore di automazioni generico (reminder/follow-up/inattività/compleanno), revisione
   di sicurezza completa (RLS, permessi tool AI, rate limiting, input validation).
8. Fase 7: passata di design/responsive finale su tutte le schermate di lavoro (dashboard,
   calendario, CRM -- non solo la landing, già fatta), PWA rifinita, performance percepita.

### Gruppo D -- Prima di pubblicare il link di un salone vero, non prima
1. **Anti-abuso sulla prenotazione pubblica** (`/s/[slug]`): oggi solo il tetto mensile del piano
   Free protegge da un uso abusivo -- serve almeno un rate-limit per IP o una conferma
   SMS/WhatsApp del numero prima di bloccare uno slot.
2. **Pagine legali** (privacy/termini/cookie): gap reale, mai tracciato come task da nessuna
   parte prima di oggi (solo menzionato in `docs/analisi-estetia.md`) -- il progetto non ne ha
   nessuna. Ogni concorrente verificato le ha.
3. **Completare la generalizzazione del copy** oltre "salone" (deciso il 02/09/2026, mai
   finito): `/registrati` e la dashboard usano ancora "Crea il tuo salone" e testi
   settore-specifici in alcuni punti.

---

## Sintesi strategica: come superare i competitor (aggiornata 12/09/2026, mega-controllo)

Ricerca dal vivo completa in `docs/analisi-concorrenti-mercato.md` (leggerla per il dettaglio
verificato, qui solo la sintesi operativa). **Scoperta più importante**: Treatwell ha lanciato
un'AI receptionist il 9/09/2026 (3 giorni prima di questo controllo) e Fresha ha "AI Concierge"
da maggio 2026 -- il nostro claim principale ("un'AI che risponde da sola ai tuoi clienti") sta
diventando table-stakes tra i grandi marketplace, non è più un differenziale raro. Non cambia se
costruire il progetto, cambia SU COSA vincere: non "abbiamo l'AI, loro no" (falso contro CutApp,
in scadenza contro Fresha/Treatwell), ma la combinazione qui sotto, in ordine di priorità:

1. **Zero commissione sui nuovi clienti, zero app obbligatoria per il cliente finale, pagina
   pubblica sul dominio/brand del salone** -- l'unica cosa strutturalmente impossibile da
   replicare per un marketplace senza smettere di essere un marketplace. Già vero oggi (Fase 4),
   va solo comunicato con più forza nel materiale di vendita quando esisterà (Fase 5).
2. **Deposito/caparra anti-no-show** -- gap reale e verificato in TUTTO il software italiano di
   categoria (Estetia/Calendix/Skedula/WeGest/CutApp: nessuno ce l'ha), standard invece nei
   marketplace (Fresha/Booksy). Stripe è già integrato (Fase 5) -- stessa competenza tecnica,
   "solo" da estendere a un pagamento/blocco carta al momento della prenotazione pubblica.
   **Nuovo task, priorità alta, aggiunto in Fase 6 sotto.**
3. **Prezzo tutto incluso, mai a consumo** -- vero solo contro CutApp (l'unico concorrente
   italiano con AI booking reale, ma a pagamento extra per prenotazione gestita dall'AI). Non
   richiede nessun lavoro: è già così nella nostra struttura piani, va solo tenuto fermo quando
   si discute qualunque modifica ai prezzi.
4. **Target volutamente più ampio** di "solo settore beauty" (vero contro Estetia/CutApp/WeGest,
   tutti fermi lì) -- già deciso il 02/09/2026, richiede solo di completare la generalizzazione
   del copy ancora salone-specifico (vedi "Copy generico per il target ampio" in
   PROJECT_STATUS.md, non urgente ma non dimenticarlo prima del lancio pubblico).
5. **Lista d'attesa automatica alla cancellazione** (vista su Calendix e CutApp, non su Estetia)
   -- nessun lavoro architetturale enorme sopra il booking engine esistente. **Nuovo task,
   aggiunto in Fase 6 sotto.**

**Trovato anche un problema nostro, non dei concorrenti**: il piano Pro pubblicizza in
`Prezzi.tsx` un "Tono dell'AI personalizzabile" che **non esiste nel codice** -- nessuna
colonna, nessuna UI, nessun collegamento al prompt (`src/lib/ai/agente.ts`, hardcoded uguale per
tutti). Non urgente finché non esistono clienti Pro paganti reali, ma **bloccante prima di
aprire i pagamenti veri su quel piano** -- aggiunto come task esplicito in Fase 5 sotto, non
dimenticarlo. Vedere `docs/analisi-concorrenti-mercato.md`, sezione "AGGIORNAMENTO CRITICO",
punto 4, per il dettaglio completo di come è stato trovato.

## Perché a fasi e non tutto insieme
Fondamenta sbagliate (schema dati, isolamento multi-tenant) si ripagano care più avanti --
un bug di isolamento tra saloni scoperto dopo aver costruito CRM/dashboard sopra costringe a
rifare anche quelli. Si costruisce dal basso verso l'alto: prima i motori (dati, disponibilità,
AI), poi le schermate che li usano, **poi** la grafica definitiva -- costruire la UI premium
prima che il prodotto funzioni davvero produce uno scaffale vuoto ben verniciato. La UI di
lavoro (registrati/accedi/dashboard) esiste già ma è volutamente spartana: la passata di
design vera arriva quando c'è un funnel intero da vestire, non prima (Fase 4/7 sotto).

## Come uso le capacità di Cowork per andare più veloce
- **Sottoagenti in parallelo** per lavori indipendenti che non si pestano i piedi a vicenda:
  esempio concreto già in corso -- mentre scrivo io la parte DB-collegata del booking engine,
  un sottoagente fa il giro dal vivo di Estetia (browser reale, non solo screenshot) per il
  punto 25/26/27. Uso questo pattern ogni volta che due pezzi di lavoro non condividono gli
  stessi file.
- **Browser sul tuo Mac** (non solo automazione cloud): l'ho scoperto testando il bug del
  provisioning -- riesco ad aprire `localhost:3000` e persino le API di Supabase per davvero,
  quindi posso riprodurre bug e verificare fix io stesso, senza fartelo rifare a mano ogni volta.
- **Task list** sempre aggiornata (la vedi a fianco della chat) invece di lunghe descrizioni a
  parole di cosa sto facendo.
- **Memoria persistente** tra sessioni: non devo farmi rispiegare da zero il progetto se la
  sessione si interrompe.
- **Scheduled task** per cose che devono girare da sole a orari fissi (reminder, controlli di
  inattività) -- non ancora usati, arrivano naturalmente in Fase 6 (automazioni), non prima.
- **Workflow multi-agente** (orchestrazione più pesante, tanti sottoagenti in parallelo su un
  singolo obiettivo): disponibile se vuoi che lo usi esplicitamente per un batch grosso (es.
  costruire in parallelo tutte le schermate CRUD di Fase 3, o testare tutti i 15 scenari del
  punto 30 insieme) -- te lo propongo quando arriviamo a un lavoro di quella scala, o dimmelo tu.

## Fase 0 -- Fondamenta (FATTA, verificata dal vivo)
- [x] Repo Git inizializzato
- [x] Stack scelto: Next.js (App Router) + Supabase (Postgres/Auth/RLS/Storage) + Tailwind + Stripe
- [x] Schema database multi-tenant iniziale con RLS (`supabase/migrations/0001_init.sql`)
- [x] Build verificata in ambiente cloud pulito (risolto problema EPERM della cartella Desktop)
- [x] Progetto Supabase reale creato e collegato (weeaggiqovnmtovdjzxy)
- [x] Migrazione applicata e verificata su un database vero (incluso un bug reale di permessi
      trovato e corretto testando dal vivo, non solo leggendo il codice -- vedi commit
      "Fix: GRANT mancanti sulle tabelle create da SQL Editor")
- [x] Autenticazione base (registrazione/login) funzionante -- testata end-to-end con un
      account vero, non solo compilata
- [x] Provisioning automatico: alla registrazione viene creato un tenant + profilo owner --
      verificato leggendo i dati veri dal database dopo la registrazione, isolamento RLS
      confermato (un utente legge esattamente 1 tenant, il proprio)

## Fase 1 -- Booking engine (punti 12, 13, 14) -- IN CORSO
- [x] Calcolo disponibilità reale (orari, pause, ferie, operatore, durata servizio, buffer) --
      logica pura in `src/lib/booking-engine.ts`, 16 test verdi
- [x] Collegare la logica pura a Supabase: `src/lib/booking-engine.server.ts` legge orari/
      chiusure/operatori/servizi/appuntamenti veri e delega SEMPRE al motore puro per la
      decisione (mai reimplementata)
- [x] Server action creare/cancellare un appuntamento (`dashboard/calendario/azioni.ts`) --
      verifica anti-conflitto applicativa + il vincolo `niente_sovrapposizioni` a livello di
      database come rete di sicurezza finale contro le race condition. Manca ancora
      "modifica" (spostare un appuntamento esistente) -- non urgente finché manca l'AI che la
      userebbe di più.
- [x] Onboarding minimo: `/dashboard/configura` (orari settimanali, operatori, servizi,
      associazione operatore->servizio) -- **verificato dal vivo**: registrazione di un salone
      di test, orari salvati e persistiti dopo reload pagina, operatore "Sara" e servizio
      "Taglio" creati con successo.
- [x] Vista calendario di base: `/dashboard/calendario`, lista appuntamenti del giorno +
      pannello "nuovo appuntamento" con slot liberi calcolati dal motore vero e selezionabili
      con un click (risponde alla debolezza "Primo slot disponibile in un click" osservata in
      Estetia, vedi `docs/analisi-estetia.md`) -- **verificato dal vivo per intero** il
      02/09/2026: creazione appuntamento (slot occupato sparisce correttamente dalla lista),
      spostamento/modifica (esclude se stesso dal controllo conflitto), cancellazione (slot
      tornano liberi). Il blocco node_modules era un problema di ambiente sul Mac (probabile
      iCloud che sincronizza la cartella Desktop), risolto con un `npm install` pulito -- non
      un bug del nostro codice. Nota per dopo: valutare di spostare il progetto fuori da una
      cartella sincronizzata iCloud per eliminare la causa alla radice.
- [ ] Gestione servizi consecutivi, operatore non specificato, cliente nuovo/esistente --
      la logica pura li gestisce già (test verdi), manca collegarli alle schermate/AI
- [ ] Test su tutti gli scenari del punto 30 rilevanti alla prenotazione, contro il DB vero
- [x] ~~Semplificazione consapevole: fuso orario trattato come UTC~~ **FATTO 11/09/2026**
      (corretto qui il 12/09/2026, questa riga era rimasta indietro): colonna
      `tenants.fuso_orario` (migrazione 0010, default `Europe/Rome`, applicata al DB reale),
      modulo `src/lib/fuso-orario.ts` con conversione ai due confini che contano (colonna
      `timestamptz` di `appuntamenti`, API Google/CalDAV). Dettaglio in PROJECT_STATUS.md,
      "Problemi noti aperti" #1.

## Fase 2 -- AI conversazionale (punti 9, 10, 11, 17)
Canale di default: **chat web** integrata nella pagina pubblica del salone (nessuna
approvazione esterna, funziona dal minuto zero) + Telegram opzionale. WhatsApp resta
disponibile come canale "connetti il tuo numero" quando l'Embedded Signup Meta è pronto --
vedi `docs/verifica-stack-automazione.md` per il perché di questa scelta (l'unico punto del
funnel self-service che dipende da un'approvazione esterna a Meta, non dallo stack).
- [x] Precondizione -- refactor "single source of truth" per la scrittura: `creaAppuntamentoTenant`
      / `modificaAppuntamentoTenant` / `cancellaAppuntamentoTenant` estratte in
      `booking-engine.server.ts` (client-agnostiche: prendono `supabase` come parametro, così
      la dashboard usa il client con scope RLS e i futuri tool AI useranno il client admin/
      service_role) -- `dashboard/calendario/azioni.ts` ora è un wrapper sottile. **Verificato
      dal vivo il 02/09/2026**: ciclo completo creazione (slot sparisce)/spostamento (esclude
      se stesso dal conflitto)/cancellazione (slot torna libero) rifatto dopo il refactor,
      stesso comportamento di prima. `npm run build` e `npx vitest run` (16/16) puliti.
- [x] Strumenti AI (`src/lib/ai/tools.ts`): `elenca_servizi`, `elenca_operatori`, `info_orari`,
      `verifica_disponibilita`, `cerca_prenotazioni_cliente`, `crea_prenotazione`,
      `modifica_prenotazione`, `cancella_prenotazione`, `trasferisci_a_operatore` -- ognuno
      wrappa le funzioni già esistenti in `booking-engine.server.ts` con un client
      admin/service_role (il visitatore anonimo del sito non ha un utente Supabase), mai logica
      duplicata. `risolviTenantIdDaSlug` per identificare il tenant dalla pagina pubblica.
      9 test di validazione input verdi (`tools.test.ts`) + bug reale trovato e corretto in
      corso d'opera: `new Date("stringa-a-caso:00Z")` non restituisce `NaN` in V8 ma una data
      valida del 2000 -- ora c'è una validazione rigida del formato PRIMA di `new Date()`
      (`parsaOrarioLocale`, condivisa con la dashboard, che aveva la stessa debolezza).
- [x] Architettura tool-calling: `src/lib/ai/agente.ts`, loop MESSAGGIO -> AI -> tool_use ->
      `eseguiStrumento` (reale, mai simulato) -> risultato -> AI -> risposta, fino a un testo
      finale o al limite di sicurezza (8 iterazioni). `@anthropic-ai/sdk` installato,
      `ANTHROPIC_API_KEY` ricevuta da Gabriel e aggiunta a mano nel suo `.env.local` (il bridge
      blocca di proposito la scrittura remota di quel file). Modello: `claude-haiku-4-5`,
      isolato in una costante, facile da cambiare. 5 test con client Anthropic finto (nessuna
      chiamata di rete reale nella suite).
- [x] Migrazione `identificatore_sessione` su `conversazioni` (0006) applicata da Gabriel
      nell'SQL Editor il 02/09/2026 -- confermata funzionante dal vivo collegando il motore di
      conversazione (una chat di test riconosce e riprende la stessa sessione tra un messaggio
      e l'altro).
- [ ] Contesto di conversazione persistente in `conversazioni.slot_in_costruzione` -- colonna
      esiste nello schema ma non ancora usata: il contesto oggi funziona (verificato dal vivo:
      il modello ricorda servizio/orario/telefono già dati nello stesso turno) semplicemente
      rileggendo tutto lo storico messaggi ad ogni turno, senza uno stato strutturato separato.
      Da valutare se serve davvero (es. per dare a un operatore umano un riassunto strutturato
      al momento del passaggio, invece di fargli rileggere tutta la chat) prima di costruirlo.
- [x] Canale chat web -> AI -> booking engine -> risposta: `api/chat/[slug]/route.ts` (pubblico,
      nessuna autenticazione Supabase, riconosce il visitatore da `identificatoreSessione`) +
      `prova-chat/[slug]` (pagina di test manuale, non la pagina pubblica definitiva --
      quella è Fase 4). **Verificato dal vivo il 02/09/2026, ciclo completo**: "quali servizi
      offrite" -> risposta con prezzo reale; "vorrei prenotare un taglio domani alle 15" ->
      calcola da solo la data (fix dedicato, vedi DECISIONS.md/PROJECT_STATUS.md), verifica
      disponibilità, crea la prenotazione vera -- confermata presente nel calendario dashboard,
      stessa booking engine (punto 9). Un bug reale trovato e corretto nel percorso: il modello
      può passare il NOME di un servizio invece del suo id, ora gestito con validazione +
      messaggio che lo fa autocorreggere invece di un crash 500 (vedi PROJECT_STATUS.md #12).
      Ora protetto anche da gate di piano + quota mensile + anti-burst (Fase 5).
- [ ] Collegamento webhook WhatsApp/Telegram -> stesso motore, quando attivati per il tenant
- [x] Test sugli scenari di conversazione ambigua/interrotta -- **verificato dal vivo il
      02/09/2026** su `/prova-chat/salone-ad2fec99`: (1) richiesta ambigua ("vorrei prenotare
      qualcosa", nessun servizio specificato) -- l'AI ha chiamato elenca_servizi e, essendocene
      solo uno, l'ha proposto direttamente invece di inventare o chiedere inutilmente; (2)
      ripensamento a metà ("mettiamo le 10" poi, nello stesso messaggio del telefono, "in realtà
      alle 11") -- prenotazione creata correttamente alle 11:00, non alle 10:00, confermato nel
      calendario; (3) richiesta fuori competenza (reclamo, "voglio parlare col responsabile") --
      trasferita correttamente a un operatore umano con un messaggio di cortesia, banner
      "passata a un operatore" mostrato. Scenario multi-servizio (più servizi consecutivi nello
      stesso appuntamento) NON testato dal vivo -- il salone di test ha un solo servizio
      attivo; la logica pura lo supporta già (`calcolaSlotServiziConsecutivi`, testata in
      isolamento) ma manca una verifica end-to-end reale con più servizi.

## Fase 3 -- CRM e Dashboard (punti 15, 21, 22)
- [x] Anagrafica cliente con storico completo: `/dashboard/clienti` (elenco con ricerca per
      nome/telefono, conteggio appuntamenti) + `/dashboard/clienti/[id]` (dati anagrafici
      modificabili -- nome/email/tag/note, telefono non modificabile perché è la chiave di
      riconoscimento -- e storico COMPLETO delle prenotazioni con stato ed origine
      manuale/AI). Stessa tabella `clienti` popolata sia dalla dashboard sia (in Fase 2) dagli
      strumenti AI, mai un'anagrafica separata per canale. **Verificato dal vivo il
      02/09/2026**: elenco con i clienti reali creati durante i test di Fase 1/2, modifica di
      tag e note salvata e ricomparsa dopo un reload completo della pagina (non solo stato
      client), ricerca per nome funzionante, storico che mostra correttamente anche
      l'appuntamento cancellato durante i test del refactor.
- [x] Dashboard con metriche reali e un insight azionabile: `src/lib/metriche.ts` (logica pura,
      11 test) + `metriche.server.ts` (collegamento a Supabase) + card in `/dashboard` --
      appuntamenti oggi, valore prenotato oggi (somma prezzo reale dei servizi), occupazione
      oggi (minuti occupati/aperti, pausa esclusa), clienti totali, nuovi clienti (30gg),
      cancellazioni (30gg). Insight "N clienti non prenotano da 60 giorni" con pulsante
      **Contatta questi clienti** che apre `/dashboard/clienti?filtro=inattivi` (stessa
      funzione `elencaClientiInattivi` usata per il conteggio, non una regola scritta due
      volte). **Verificato dal vivo il 02/09/2026**: card a zero corrette a riposo, poi creato
      un appuntamento reale da 25€/30min e verificato che appuntamenti=1, valore=25,00€,
      occupazione=5% (30min su 600min di apertura) -- tutti numeri esatti, non arrotondati a
      caso -- poi cancellato per pulizia.
- [ ] Analytics più complete: retention, no-show reale (nessun flusso ancora marca un
      appuntamento "no_show", solo "confermato"/"cancellato" esistono nei dati veri finora)
- [ ] **Export/import CSV clienti** (nuovo task, secondo giro mega-controllo 12/09/2026): visto
      su Estetia, utile per un titolare che migra da un altro gestionale (abbassa l'attrito di
      switch) o vuole i propri dati per un mailing esterno. Lavoro contenuto.
- [ ] **Raccolta recensioni post-appuntamento** (nuovo task, stesso giro): nessun gestionale
      italiano verificato lo fa nativamente -- messaggio automatico dopo l'appuntamento che
      chiede una valutazione, mostrata poi sulla pagina pubblica del salone (Fase 4). Si appoggia
      alla stessa infrastruttura di reminder/automazioni pianificata in Fase 6, non un sistema
      separato.

## Fase 4 -- Pagina pubblica, foto, PWA (punti 18, 19, 20)
- [x] Pagina pubblica per-salone generata automaticamente, condivisibile -- **scritta
      11/09/2026** (corretto qui il 12/09/2026, era rimasta indietro): `/s/[slug]`, loader in
      `src/lib/pagina-pubblica.server.ts`, flusso di prenotazione self-service completo
      (`FlussoPrenotazione.tsx`). Test automatici puliti (98/98), **non ancora verificata dal
      vivo in un browser reale contro un salone vero** -- va fatto da Gabriel dopo il deploy
      (stesso limite di rete della sandbox già noto per altri strumenti).
- [x] Widget chat AI mostrato SOLO se `tenant.piano` la include (vedi `src/lib/ai/limiti.ts`,
      `pianoHaAccessoAIChatWeb`) -- un salone Free/Starter non deve vedere nemmeno il box della
      chat, non un box che dice "non disponibile" (deciso con Gabriel il 02/09/2026). Il blocco
      lato server in `api/chat/[slug]/route.ts` resta comunque, indipendentemente da questo --
      qui è solo UX, non l'unica difesa. **Scritto 11/09/2026** (`ChatWidgetPubblico.tsx`),
      stesso limite di verifica dal vivo del punto sopra.
- [ ] Galleria/upload immagini (Supabase Storage) -- zero codice, colonne `logo_url`/`cover_url`
      esistono nello schema ma senza upload configurato.
- [ ] PWA installabile, notifiche push dove supportato -- zero manifest/service worker.
- [ ] **Pagine legali (privacy/termini/cookie)** -- nuovo task, trovato nel mega-controllo
      competitor del 12/09/2026: gap reale, il progetto non ne ha nessuna, ogni concorrente
      verificato (Estetia/Calendix/Skedula/Fresha/Treatwell/Booksy) le ha. Non urgente prima del
      deploy di test, ma bloccante prima di pubblicare il link di un salone vero.
- [ ] **Notifiche email (conferma al cliente + avviso al titolare)** -- nuovo task, priorità
      alta, secondo giro mega-controllo 12/09/2026: oggi zero email parte quando arriva una
      prenotazione (da dashboard, AI o pagina pubblica). Prima che WhatsApp sia disponibile,
      l'email è l'unico canale di notifica passiva possibile -- senza, un titolare deve tenere
      la dashboard aperta per accorgersi di una prenotazione nuova. Provider da scegliere
      (Resend è la scelta più semplice con Next.js); zero codice/provider oggi.
- [ ] **Gestione della prenotazione lato cliente** (cancella/sposta da solo): oggi il cliente
      che prenota su `/s/[slug]` deve richiamare il salone per qualunque modifica. Si lega al
      punto sopra -- il modo più naturale è un link "gestisci la tua prenotazione" nell'email di
      conferma, non un login separato per il cliente finale.

## Fase 5 -- Billing self-service e admin panel (punti 6, 7, 23, 24)
- [x] Piani Free -> Enterprise progettati (non copiati), prezzi e posizionamento AI decisi
      il 02/09/2026 -- vedi DECISIONS.md per il confronto con Estetia e il calcolo costi
- [x] Difesa tecnica anti-abuso sulla chat AI (gate di piano, quota mensile, anti-burst) --
      `src/lib/ai/limiti.ts`/`limiti.server.ts`, vedi DECISIONS.md
- [x] Enforcement tecnico del tetto prenotazioni sul piano Free (60/mese) -- `src/lib/piani.ts`
      + controllo in `creaAppuntamentoTenant` (`booking-engine.server.ts`), quindi vale
      automaticamente sia da dashboard che da AI (punto 9, stessa funzione per entrambe). Da
      verificare dal vivo con un vero tenant Free quando possibile (oggi verificato solo con
      `npx vitest run` + `npm run build` puliti, non ancora con un giro nel browser reale)
- [x] Checkout Stripe, webhook, gestione stato abbonamento reale -- **scritto per intero
      11/09/2026 sera** (corretto qui il 12/09/2026, era rimasto indietro, vedi commit
      `faafc55`): `/api/stripe/checkout` (Checkout Session, trial 10 giorni su Growth/Pro),
      `/api/stripe/webhook` (firma verificata, unica fonte di verità per `piano`/
      `stato_abbonamento`), `/api/stripe/portal` (Customer Portal self-service). 14 test verdi,
      chiavi sandbox reali già configurate. **Non ancora verificato dal vivo con un pagamento di
      test reale nel browser** -- il webhook va anche configurato lato Stripe Dashboard (serve
      un dominio pubblico, quindi dopo il deploy). Vedi PROJECT_STATUS.md per il dettaglio.
- [ ] Pannello admin per te: saloni, abbonamenti, utilizzo, interventi manuali quando serve --
      zero codice.
- [ ] **BLOCCANTE prima di aprire pagamenti veri sul piano Pro** (trovato nel mega-controllo del
      12/09/2026, vedi `docs/analisi-concorrenti-mercato.md`): `Prezzi.tsx` pubblicizza "Tono
      dell'AI personalizzabile" su Pro, ma non esiste nessuna colonna/UI/collegamento reale al
      prompt (`src/lib/ai/agente.ts` è hardcoded uguale per tutti i tenant). Da costruire:
      colonna su `tenants` (es. `tono_ai`, testo libero o poche opzioni guidate -- vedi
      `docs/analisi-estetia.md` punto 3: guidato a domande è più accessibile di un prompt
      libero), UI in `/dashboard/impostazioni`, iniezione nel system prompt di `agente.ts`.
      Non bloccante finché Stripe non è verificato dal vivo (nessun cliente Pro reale ancora),
      ma va fatto PRIMA, non dopo il primo incasso su quel piano.
- [ ] **BLOCCANTE prima di vendere Enterprise a un cliente vero** (stesso problema del Tono AI,
      trovato nel secondo giro del mega-controllo, 12/09/2026): `Prezzi.tsx` pubblicizza
      "Multi-sede e ruoli avanzati" su Enterprise, ma nello schema non esiste NESSUN concetto di
      "sede" (un tenant è un unico luogo fisico) e la colonna `profiles.ruolo` (owner/staff/
      admin_piattaforma) non è controllata da nessuna parte del codice -- ogni account che entra
      in dashboard ha accesso pieno, non esiste un vero "staff" con permessi limitati. Vedi anche
      il task "Multi-utente/team reale" in Fase 6 sotto, che è il prerequisito dei ruoli.

## Fase 6 -- Automazioni e sicurezza (punti 16, 29, 30)
- [ ] Motore di automazioni configurabili (reminder, follow-up, inattività, compleanno)
- [ ] **Deposito/caparra anti-no-show** (nuovo task, mega-controllo competitor 12/09/2026): gap
      reale verificato in TUTTO il software italiano di categoria (Estetia, Calendix, Skedula,
      WeGest, CutApp -- nessuno lo offre), standard invece nei marketplace internazionali
      (Fresha, Booksy: carta in garanzia o pagamento anticipato per ridurre i no-show). Stripe
      è già integrato per il billing (Fase 5) -- stessa competenza tecnica: `PaymentIntent`
      con blocco carta o pagamento anticipato al momento della prenotazione pubblica (`/s/
      [slug]`, `FlussoPrenotazione.tsx`), configurabile per tenant (obbligatorio/opzionale/
      importo). Priorità alta: colma un gap reale contro tutti i concorrenti italiani diretti,
      non solo contro i marketplace. Vedere `docs/analisi-concorrenti-mercato.md`, sezione
      "AGGIORNAMENTO CRITICO", punto 3.
- [ ] **Lista d'attesa automatica alla cancellazione** (vista su Calendix e CutApp, non su
      Estetia): a una cancellazione, proporre lo slot liberato al primo cliente in coda invece
      di lasciarlo semplicemente libero. Nessun lavoro architetturale enorme sopra il booking
      engine esistente -- una tabella `lista_attesa` (tenant/servizio/operatore/cliente/data
      preferita) + un trigger o controllo alla cancellazione che notifica il primo in coda.
- [ ] **Multi-utente/team reale** (nuovo task, secondo giro mega-controllo 12/09/2026): dare a
      ogni "operatore" un proprio login (invito via email, permessi limitati alla propria
      agenda) invece di essere solo un record gestito dal titolare -- prerequisito tecnico dei
      "ruoli avanzati" venduti su Enterprise (vedi Fase 5) e della persona di marketing "salone
      con team" già usata in `PerChi.tsx`, che oggi non è ancora mantenuta tecnicamente.
- [ ] **Pacchetti prepagati/tessera fedeltà digitale** (nuovo task, stesso giro): visto su
      CutApp, comune nel settore beauty ("10 sedute prepagate", punti fedeltà). Non urgente, ma
      differenziale vero per i saloni che già usano questo modello di vendita su carta.
- **NON aggiunto come task, deliberatamente** (visto su Estetia/WeGest, "Cassa"/registro
  incassi): tocca fatturazione/ricevute fiscali italiane, un terreno normativo diverso dal
  nostro focus (booking + AI + CRM) e facile da sottovalutare in complessità. Da valutare SOLO
  se più di un cliente reale lo chiede esplicitamente, non perché un concorrente ce l'ha --
  vedi `docs/analisi-concorrenti-mercato.md`/PIANO.md "Gruppo B-bis" punto 8 per il ragionamento
  completo.
- [ ] Revisione sicurezza (RLS, permessi tool AI, rate limiting, input validation)
- [ ] Test completo su tutti gli scenari del punto 30

## Fase 6bis -- Sincronizzazione calendari esterni (deciso con Gabriel il 02/09/2026, non nei 33 punti originali)
Il calendario del database (`appuntamenti`) resta l'unica fonte di verità (punto 9) -- questa
fase aggiunge una sincronizzazione bidirezionale verso il calendario personale
dell'operatore, in entrambe le direzioni: vedere gli appuntamenti del salone nel proprio
calendario personale, E bloccare uno slot se l'operatore ha già un impegno personale lì.
- [x] Schema DB (migrazione `0008_calendari_esterni.sql`, da eseguire da Gabriel in Supabase
      SQL Editor come le precedenti): `collegamenti_calendario_esterni` (credenziali per
      operatore per provider, Google o Apple) + `eventi_calendario_esterni` (mappatura
      appuntamento interno <-> evento esterno, pronta per quando costruiremo anche la
      direzione export). RLS + grant service_role già inclusi nella migrazione, stessa
      disciplina di 0007 dopo il bug reale trovato lì.
- [x] **Apple/iCloud Calendar (direzione import/blocco -- quella che Gabriel ha chiesto per
      prima)**: client CalDAV puro (`src/lib/calendario-esterno/caldav.server.ts`) con
      autodiscovery standard (principal -> calendar-home-set -> elenco calendari, segue i
      redirect di iCloud verso il "pod" giusto dell'account) + parser ICS puro e testato
      (`ics.ts`, 10 test verdi: orari con TZID, tutto il giorno, DURATION, RRULE settimanale
      con BYDAY espansa davvero -- es. "palestra ogni martedì" genera tutte le occorrenze nella
      finestra richiesta, non solo la prima -- EXDATE, eventi CANCELLED esclusi). RRULE
      mensile/annuale non ancora espansa (fallback: mostra comunque la prima occorrenza,
      mai un impegno perso silenziosamente) -- raro per impegni personali, non blocca questa
      fase. NESSUNA revisione esterna da aspettare, funzionante da subito.
- [x] **Google Calendar (direzione import/blocco)**: OAuth2 + Google Calendar API v3 scritti --
      `src/lib/calendario-esterno/google.server.ts` (authorize URL, scambio/rinnovo token,
      `events.list` con `singleEvents=true`, che fa espandere le ricorrenze direttamente a
      Google, molto più semplice del parsing RRULE fatto a mano per CalDAV) + due route
      (`/api/calendario/google/connect` e `/callback`) con verifica anti-CSRF (nonce in cookie
      httpOnly) e controllo che l'operatore collegato appartenga davvero al tenant dell'utente
      loggato in quel momento, non solo a quanto dichiarato nello `state`. Credenziali OAuth di
      Gabriel ricevute e configurate nel suo `.env.local` il 02/09/2026 (progetto Google Cloud
      con Calendar API già abilitata). Per essere utilizzabile da clienti reali (non solo da
      Gabriel in test) resta da fare la revisione di Google per gli scope "sensibili" del
      calendario -- stesso tipo di iter (tempi non garantiti) già affrontato con Meta per
      WhatsApp, vedi `docs/embedded-signup-whatsapp.md` come precedente. **Non ancora
      verificato dal vivo con un consenso Google reale** (solo `npx vitest run` + `npm run
      build` puliti) -- da fare appena Gabriel prova il collegamento dal suo account (deve
      prima essere aggiunto come "utente di test" nella schermata di consenso OAuth).
- [x] UI nelle impostazioni (`/dashboard/impostazioni/calendari`): collega/scollega Apple per
      operatore (Apple ID + password per l'app, verificate DAVVERO collegandosi al server
      PRIMA di salvarle, mai salvate "a scatola chiusa"), collega Google per operatore (redirect
      al consenso vero, non un placeholder), lista dei collegamenti con eventuale errore
      visibile, banner di esito dopo il ritorno dal consenso Google.
- [x] Il motore di disponibilità considera gli impegni esterni come "occupato" per ENTRAMBI i
      provider: sia `caricaContestoBooking` (per la ricerca slot) sia `verificaConflittoTenant`
      (per creare/spostare un appuntamento) ora concatenano gli impegni Apple/CalDAV e Google
      importati agli appuntamenti interni PRIMA di chiamare il motore puro -- stessa forma dati
      (`AppuntamentoEsistente`), stessa funzione di prima, mai una seconda logica di conflitto
      (punto 9). Fail-open per collegamento: un calendario esterno irraggiungibile (o un token
      Google scaduto/revocato) non blocca mai una prenotazione reale, l'errore resta visibile
      nelle impostazioni. **Non ancora verificato dal vivo con account reali** (solo `npx
      vitest run` + `npm run build` puliti finora) -- da fare appena Gabriel ha un momento per
      provare un collegamento vero su entrambi i provider.
- [ ] Direzione export (mostrare gli appuntamenti del salone nel calendario personale
      dell'operatore): tabella `eventi_calendario_esterni` già pronta per questo, ma la
      scrittura vera e propria (creare/aggiornare/cancellare l'evento sul calendario esterno
      quando cambia un appuntamento interno) non è ancora stata scritta -- prossimo pezzo di
      questa fase, indipendente da Google/Apple (funziona sull'uno o sull'altro).
- [ ] Nota sicurezza aperta (vedi commento nella migrazione 0008): oggi sia le credenziali
      CalDAV sia i token OAuth Google (access/refresh token) sono salvati in chiaro nel
      database, come altre colonne token già esistenti nel progetto -- da valutare il
      cifraggio a riposo prima della revisione di sicurezza di Fase 6 (punto 29), non prima di
      avere clienti paganti reali con dati qui dentro.

## Fase 7 -- Parità/superiorità estetica con Estetia, responsive completo (punti 25, 26, 27, 28)
Non "una rifinitura", un obiettivo a sé con criteri precisi -- perché sia davvero "fatto" e non
"abbastanza carino":
- [ ] Design system definito (tipografia, spaziature, colori, componenti shadcn/ui) applicato a
      TUTTE le schermate esistenti, non solo alle nuove
- [ ] Ogni schermata che Estetia ha, la nostra la eguaglia o supera -- confronto punto per punto
      contro `docs/analisi-estetia.md` (che a quel punto conterrà il giro dal vivo, non solo
      screenshot), schermata per schermata, prima di considerarla chiusa
- [ ] Responsive testato per davvero su almeno 3 fasce (mobile ~375px, tablet ~768px, desktop
      ~1440px) con un browser vero su ogni schermata che conta (dashboard, calendario, CRM,
      pagina pubblica, onboarding) -- non solo "si restringe senza rompersi", deve restare
      comodo da usare con un pollice su un telefono vero
- [ ] PWA rifinita: icona, splash screen, installazione, esperienza a schermo intero coerente
      con un'app nativa (punto 20)
- [ ] Passata finale su performance percepita (caricamento, transizioni, feedback immediato sui
      click) -- un SaaS "premium" si sente anche nella reattività, non solo nell'estetica

---

## Cosa serve ancora da te (non blocca l'inizio, ma serve prima della fine della fase indicata)
1. **Un account Stripe** (anche di test per ora) prima della Fase 5.
2. Business verification Meta + P.IVA per attivare WhatsApp -- già in pausa per tua scelta,
   vedi `docs/embedded-signup-whatsapp.md`. Non blocca nulla nel frattempo (canale di default
   è la chat web).
3. ~~Un progetto Google Cloud con OAuth consent screen configurato~~ **FATTO 02/09/2026**:
   Calendar API abilitata, schermata di consenso configurata, Client ID/Secret creati e
   aggiunti a `.env.local`. Resta da fare, quando ti va: aggiungere il tuo account Google come
   "utente di test" nella schermata di consenso OAuth (necessario per poter provare tu stesso
   il collegamento prima che Google completi la revisione per renderlo pubblico a tutti i
   clienti) e poi provare davvero il pulsante "Collega Google" in
   `/dashboard/impostazioni/calendari`.
4. ~~Eseguire la migrazione `0008_calendari_esterni.sql`~~ **FATTO** (confermato 11/09/2026 via
   accesso MCP diretto al progetto Supabase: le tabelle esistono già sul database vero).
5. Ogni tanto: un `npm install` + `npm run dev` sul tuo Mac per testare tu stesso i progressi
   nel browser vero, quando te lo chiedo -- è il modo più veloce per verificare le cose che
   dalla mia rete non riesco a raggiungere direttamente.
6. Aggiungerti come "utente di test" nella schermata di consenso OAuth Google (Google Cloud
   Console -- vedi punto 3 sopra) per poter provare dal vivo "Collega Google" in
   `/dashboard/impostazioni/calendari`. Unico passo rimasto per chiudere la verifica dal vivo
   di Fase 6bis (import/blocco).
