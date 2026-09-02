# Piano di lavoro -- SaaS saloni/centri estetici

Riferimento studiato: https://estetia.tidycode.it/ (analisi in `docs/analisi-estetia.md`).
Obiettivo: non copiarlo, superarlo -- vedi il messaggio originale del progetto per la lista
completa dei 33 punti richiesti. Qui sotto sono organizzati in fasi eseguibili in sequenza,
ciascuna con un criterio chiaro di "fatta" prima di passare alla successiva (niente teoria,
solo cose costruite e verificate -- stesso metodo usato nell'audit del progetto precedente).

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
      Estetia, vedi `docs/analisi-estetia.md`) -- **non ancora verificato dal vivo** fino in
      fondo: bloccato a metà da un problema di ambiente sul Mac (node_modules corrotto sotto
      Turbopack, probabile causa la sincronizzazione della cartella Desktop -- stesso sospetto
      già annotato in Fase 0), non un bug del nostro codice. Serve un `npm install` pulito sul
      tuo Mac per finire la verifica.
- [ ] Gestione servizi consecutivi, operatore non specificato, cliente nuovo/esistente --
      la logica pura li gestisce già (test verdi), manca collegarli alle schermate/AI
- [ ] Test su tutti gli scenari del punto 30 rilevanti alla prenotazione, contro il DB vero
- [ ] Semplificazione consapevole da risolvere prima della Fase 7: fuso orario del salone
      trattato come UTC per ora (vedi commento in `booking-engine.server.ts`) -- va aggiunto un
      campo fuso_orario su "tenants" prima di considerare la prenotazione "finita davvero"

## Fase 2 -- AI conversazionale (punti 9, 10, 11, 17)
Canale di default: **chat web** integrata nella pagina pubblica del salone (nessuna
approvazione esterna, funziona dal minuto zero) + Telegram opzionale. WhatsApp resta
disponibile come canale "connetti il tuo numero" quando l'Embedded Signup Meta è pronto --
vedi `docs/verifica-stack-automazione.md` per il perché di questa scelta (l'unico punto del
funnel self-service che dipende da un'approvazione esterna a Meta, non dallo stack).
- [ ] Architettura tool-calling: AI interpreta, il backend decide (pattern già validato nel
      progetto precedente con `cervello.py` -- lo riprendiamo, non lo reinventiamo)
- [ ] Contesto di conversazione persistente in `conversazioni.slot_in_costruzione`
- [ ] Canale chat web -> AI -> booking engine -> risposta (motore condiviso con tutti i canali)
- [ ] Collegamento webhook WhatsApp/Telegram -> stesso motore, quando attivati per il tenant
- [ ] Test sugli scenari di conversazione ambigua/interrotta/multi-servizio

## Fase 3 -- CRM e Dashboard (punti 15, 21, 22)
- [ ] Anagrafica cliente con storico completo
- [ ] Dashboard con metriche reali (non finte) e insight (slot liberi, clienti inattivi)
- [ ] Analytics: revenue, retention, no-show, occupazione

## Fase 4 -- Pagina pubblica, foto, PWA (punti 18, 19, 20)
- [ ] Pagina pubblica per-salone generata automaticamente, condivisibile
- [ ] Galleria/upload immagini (Supabase Storage)
- [ ] PWA installabile, notifiche push dove supportato

## Fase 5 -- Billing self-service e admin panel (punti 6, 7, 23, 24)
- [ ] Checkout Stripe, webhook, gestione stato abbonamento, feature gating per piano
- [ ] Piani Free -> Enterprise progettati (non copiati) con limiti applicati tecnicamente
- [ ] Pannello admin per te: saloni, abbonamenti, utilizzo, interventi manuali quando serve

## Fase 6 -- Automazioni e sicurezza (punti 16, 29, 30)
- [ ] Motore di automazioni configurabili (reminder, follow-up, inattività, compleanno)
- [ ] Revisione sicurezza (RLS, permessi tool AI, rate limiting, input validation)
- [ ] Test completo su tutti gli scenari del punto 30

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
3. Ogni tanto: un `npm install` + `npm run dev` sul tuo Mac per testare tu stesso i progressi
   nel browser vero, quando te lo chiedo -- è il modo più veloce per verificare le cose che
   dalla mia rete non riesco a raggiungere direttamente.
