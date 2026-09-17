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

## COSA DOBBIAMO FARE, DA OGGI IN POI, IN ORDINE (aggiornato 14/09/2026, richiesta esplicita di Gabriel)

Lista unica e concreta, in ordine di priorità reale -- non un indice delle fasi sotto, ma cosa
fare per davvero prima di cos'altro. Il dettaglio tecnico di ogni punto è nelle fasi più sotto o
nei documenti citati; questa è la vista d'insieme che risponde a "cosa dobbiamo fare".

**Guida attuale (14/09/2026, dettaglio completo in DECISIONS.md)**: si costruisce seguendo il
principio "dipendente AI, non gestionale" (CLAUDE.md punto 2bis) -- ogni funzionalità nuova si
giudica su quanto lavoro manuale toglie al professionista, non solo su quanto è bella. L'ordine
reale delle fasi è:

- **Fase 0 = Gruppo A qui sotto** (già fatto ma non ancora verificato dal vivo). **Chiuso finora
  dal vivo, 14/09/2026**: pagamento Stripe reale, pagamento caparra reale, mittente Mailjet +
  promemoria automatico (email ricevuta per davvero da Gabriel), sync Google Calendar (evento
  reale creato/verificato, slot bloccati correttamente), scope Apple/iCloud deciso (infrastruttura
  CalDAV resta nel codice, non utilizzata/proposta per ora), bug lista d'attesa su giorno di
  chiusura trovato e corretto (fix rivisto e testato indipendentemente, non ancora committato).
  **Ancora aperto**: SMS (credenziali Skebby non ancora impostate, serve un account Skebby
  personale di Gabriel -- vedi DECISIONS.md per il perché non posso crearlo/impostarlo io). Zero
  codice nuovo per questo ultimo punto.
  **AGGIORNAMENTO 16/09/2026 (Gabriel)**: "meta e skebby li attivo appena ho p.iva, tu per ora
  comportati come se gia fossero attivi tenendo conto che non lo sono". Quindi **Skebby e
  WhatsApp/Meta non sono più trattati come bloccanti di pianificazione**: il codice di entrambi i
  canali è scritto e resta com'è, si può continuare a costruire e a vendere il prodotto
  assumendo che ci saranno. L'unica conseguenza pratica che resta è sui test: **non sono
  verificabili dal vivo finché non arriva la P.IVA** -- nessun SMS reale può partire (Skebby
  senza credenziali, fail-open) e nessun messaggio WhatsApp reale può arrivare (App Review Meta).
  Va ricordato solo prima di dire "verificato dal vivo" su qualcosa che passa da quei due canali.
- **Fase 1 = contatto automatico (opzionale) del cliente in lista d'attesa** -- **FATTO e
  VERIFICATO 14-15/09/2026** (vedi DECISIONS.md per il dettaglio completo): un solo toggle per
  tenant in Dashboard -> Impostazioni -> "Contatto automatico lista d'attesa" (default `manuale`,
  Growth in su), che quando attivo fa scrivere subito Salone AI al cliente (email, SMS di
  fallback quando Skebby sarà configurato) invece di lasciare il contatto al titolare.
  `tsc`/`eslint`/`vitest` (265/265)/`build` puliti, migrazione `0020_lista_attesa_contatto_automatico.sql`
  applicata al database reale con l'ok di Gabriel.
- **Fase 2 = AI receptionist conversazionale + knowledge base dell'attività** -- **CODICE FATTO E
  VERIFICATO 15/09/2026** (vedi DECISIONS.md per il dettaglio completo), richiesta esplicita di
  Gabriel il 15/09/2026: l'AI in chat pubblica ora ha uno strumento dedicato (`info_attivita`,
  visibile solo ai piani Pro/Enterprise) per rispondere anche a domande informative generali
  (descrizione, indirizzo, parcheggio, metodi di pagamento, policy di cancellazione, FAQ libere) e
  non solo a quelle transazionali di prima -- obiettivo farla sentire come una vera receptionist,
  non "un gestionale con un chatbot che prenota". Decisioni prese con Gabriel prima di scrivere
  codice: campi strutturati (descrizione, indirizzo, parcheggio, metodi di pagamento, policy di
  cancellazione riusata da dove già esiste) + una FAQ libera per il resto; riservata a
  Pro/Enterprise (non allo stesso gate della chat AI base); se un'informazione manca, l'AI lo
  dichiara onestamente e invita a contattare l'attività (mai un trasferimento automatico a un
  operatore per questo). `tsc`/`eslint`/`vitest` (276/276)/`build` puliti. Migrazione
  `0021_knowledge_base_attivita.sql` applicata al database reale il 15/09/2026 con l'ok di
  Gabriel (colonne/tabella/RLS verificate via query dirette, nessun nuovo avviso di sicurezza).

  **Bug reale trovato e mitigato in due passaggi durante la verifica dal vivo (15/09/2026, vedi
  DECISIONS.md per il dettaglio)**: su un follow-up secco tra due servizi ("Quanto costa la
  pedicure?" -> "e la manicure?") Haiku 4.5 inventava prezzo/durata nonostante i dati corretti già
  nel contesto. Rafforzato il system prompt (0/2 -> 2/3 corretti, non sufficiente su un dato che
  tocca i soldi del cliente) e poi aggiunta una rete di sicurezza deterministica a livello di
  codice (`src/lib/ai/verifica-numeri.ts` + `correggiSeIncongruente` in `agente.ts`): controlla il
  numero dichiarato dall'AI contro il dato reale prima di mandarlo al cliente, tenta un giro di
  autocorrezione col modello, e se anche quello fallisce genera la frase direttamente dal codice
  (garantita corretta). Scelta di Gabriel: restare su Haiku (costo) invece di cambiare modello.
  `tsc`/`eslint`/`vitest` (291/291)/`build` puliti. **Verificato dal vivo 15/09/2026 dopo il
  deploy**: 3 conversazioni pulite su 3 corrette (prima 2/3) -- il rafforzamento del prompt ha già
  coperto la stragrande maggioranza dei casi, la rete di sicurezza di codice resta la garanzia per
  i residui (non ancora osservata scattare dal vivo, coperta dai test di integrazione).

  **Feedback diretto di Gabriel il 15/09/2026 (con trascrizione reale) -- CORRETTO 15/09/2026**: le
  risposte di `info_attivita` a una domanda generica come "dammi informazioni aggiuntive" erano un
  "malloppone noioso di testo" -- l'AI riversava TUTTA la knowledge base in un unico paragrafo denso
  (descrizione + indirizzo + parcheggio + pagamenti + policy di cancellazione + una FAQ non
  richiesta + giorno di chiusura) e in coda riproponeva comunque la prenotazione. Riscritta la
  regola 11 del system prompt (vedi DECISIONS.md) per rispondere in modo selettivo a quanto
  effettivamente chiesto invece di recitare tutto il risultato dello strumento. `tsc`/`eslint`/
  `vitest` (292/292)/`build` puliti. **Ancora da fare**: verifica dal vivo dopo il deploy.

  **Terzo bug trovato durante la verifica dal vivo del 15/09/2026 -- CORRETTO lo stesso giorno**: su
  "che servizi offrite?" la risposta arrivava come un unico paragrafo illeggibile con trattini in
  mezzo ("Offriamo due servizi: - Manicure... - Pedicure..."). Due cause distinte: (1) il widget
  (`ChatWidgetPubblico.tsx`) non preservava gli a capo reali del modello (mancava
  `whitespace-pre-wrap`, li collassava in un'unica riga); (2) il modello continuava a scrivere
  elenchi puntati con trattini nonostante la regola 9 lo vieti esplicitamente -- non è la prima
  volta che il solo prompt non basta su questo (vedi il precedente fix sugli asterischi letterali
  più sotto in questo stesso file). Aggiunto `src/lib/ai/pulisci-markdown.ts` (rete di sicurezza
  deterministica, stesso principio di `verifica-numeri.ts`) che ripulisce grassetto/corsivo/titoli/
  elenchi puntati dalla risposta finale prima di mandarla al cliente. `tsc`/`eslint`/`vitest`
  (303/303)/`build` puliti. **Verificato dal vivo 15/09/2026**: "dammi informazioni aggiuntive" ora
  risponde con 2-3 frasi naturali invece del malloppone originale.

  **Suggerimento iniziale sul widget (richiesta di Gabriel 15/09/2026)**: un visitatore non ha modo
  di sapere, guardando la sola icona della chat, che può sia prenotare sia chiedere qualunque cosa
  sull'attività. Aggiunto un fumetto che appare 1,5s dopo il caricamento (una sola volta per
  browser, testo diverso se il tenant ha o no la knowledge base della Fase 2). Nuovo campo
  `haInformazioniAttivita` in `ProfiloPubblico` per calibrare il testo.

  **Rivisto lo stesso giorno dopo il primo giro dal vivo di Gabriel**: tolto il pallino animato e
  la X per chiuderlo -- vincolo di business chiarito da Gabriel, ogni prenotazione fatta in chat ha
  un costo AI in più per il titolare, quindi l'obiettivo è far scoprire l'AI, non incoraggiarla
  attivamente. Ora il fumetto compare e sparisce da solo con una dissolvenza (nessuna azione
  richiesta), tono del testo "via di mezzo" invece che invitante ("Sai che qui puoi anche
  chiedermi..." invece di "Puoi prenotare subito qui..."). `tsc`/`eslint`/`vitest` (305/305)/
  `build` puliti.

  **Rifinito lo stesso giorno, verificato visivamente prima del deploy (screenshot locali, non solo
  codice) per richiesta esplicita di Gabriel**: click sul fumetto ora lo chiude e basta (non apre
  più la chat per sbaglio); il saluto 👋 è diventato un'etichetta rotonda che sbuca dall'angolo in
  alto a sinistra del fumetto invece di stare inline nel testo; testo di apertura più diretto
  ("Qui puoi chiedermi..."). In parallelo Gabriel ha trovato dal vivo, sul suo telefono, due bug
  nella chat aperta (non nel fumetto): l'input dei messaggi faceva zoommare Safari su iOS al focus
  (font sotto i 16px, portato a `text-base`) e il pannello non era centrato sullo schermo (un tetto
  fisso di larghezza rompeva la simmetria dei margini su schermi >368px, quindi su quasi ogni
  telefono -- ora la larghezza segue sempre la viewport sotto il breakpoint `sm`). Aggiunto anche
  un leggero sfondo sfocato (`backdrop-blur-sm`) dietro il pannello quando la chat è aperta, con
  tap fuori per chiuderla. `tsc`/`eslint`/`vitest` (305/305)/`build` puliti, verifica visiva locale
  su desktop e su emulazione di telefoni reali (iPhone SE/13, Pixel 7) -- vedi DECISIONS.md per il
  dettaglio tecnico. **Confermato da Gabriel sul sito vero dopo il deploy** (commit `bb1939a`).

  **Italiano innaturale trovato dal vivo da Gabriel** ("Interessa a te uno di questi?" invece di
  "Ti interessa..."): aggiunta una regola dedicata nel system prompt sui verbi pronominali italiani
  (interessare, piacere, servire, ecc.), con l'esempio sbagliato/corretto specifico. Non è un bug
  deterministico come prezzo/durata o markdown -- riduce la frequenza dell'errore ma un'istruzione
  nel prompt da sola non la azzera del tutto (vedi DECISIONS.md). **Sample-check dal vivo fatto il
  15/09/2026**: diverse conversazioni mirate a far emergere questi costrutti, nessuna ricorrenza
  dell'errore trovata. Resta un problema probabilistico, non un fix deterministico: se Gabriel
  segnala di nuovo lo stesso tipo di errore in futuro, il prossimo passo è un giro di correzione col
  modello (come `correggiSeIncongruente`) o un cambio di modello per questo compito.

  **Backlog UI, esplicitamente rimandato da Gabriel a una fase di rifinitura**: il "thinking orbs"
  (indicatore di caricamento della chat) compare ma non è animato.
- **Fase 3 = onboarding AI-assisted**: descrizione testuale della propria attività → bozza
  generata dall'AI → compilata sui form di `/dashboard/configura` che esistono già, il
  titolare conferma/corregge invece di partire da campi vuoti. La bozza generata dall'AI
  compila ANCHE i campi della knowledge base della Fase 2 sopra (descrizione, parcheggio, metodi
  di pagamento, FAQ) quando il piano li include, non solo orari/operatori/servizi -- un solo giro
  di onboarding per tutto, zero dati duplicati da far scrivere due volte al titolare (richiesta
  esplicita di Gabriel il 15/09/2026). **Codice completo e testato in locale il 15/09/2026**
  (dettaglio in DECISIONS.md): modulo di estrazione (`onboarding-ai.ts` + `onboarding-ai.server.ts`,
  stesso tool-calling forzato e la stessa regola "mai inventare un numero" già in uso per l'AI
  cliente), azioni server che riusano quelle granulari già esistenti invece di scrivere query
  dirette (`onboarding-ai-azioni.ts`), pannello "Compila con l'AI" in `/dashboard/configura`
  (`PannelloOnboardingAI.tsx`, revisione/esclusione riga per riga prima di applicare, mai un
  salvataggio automatico). 35 test nuovi (15+8+12), `tsc`/`eslint`/`npm run build` puliti, e verifica dal
  vivo contro il modello Anthropic reale su 4 scenari (completo, prezzo mancante non inventato,
  testo fuori tema, gate di piano rispettato) -- tutti corretti. **FATTO e verificato dal vivo nel
  browser vero il 15/09/2026** dopo il deploy di Gabriel: descrizione libera -> bozza corretta
  (orario domenica, un servizio nuovo con durata/prezzo, finestra di cancellazione) -> applicata
  -> confermato in `/dashboard/configura` e `/dashboard/impostazioni/cancellazione` che i dati ci
  sono davvero, incluso il telefono del tenant NON cancellato dall'apply (la guardia funziona).
  Fase 3 chiusa.

  **Bug UI trovato e corretto il 15/09/2026, durante un test dal vivo nei panni di un cliente vero
  richiesto esplicitamente da Gabriel** (dettaglio completo in DECISIONS.md): subito dopo "Applica
  alla configurazione" la tabella "Orari di apertura" restava visivamente su "tutto chiuso" anche
  se i dati salvati erano già corretti (si vedeva solo ricaricando la pagina) -- causa un
  `router.refresh()` che non rimonta input non controllati già presenti a schermo. Corretto con
  una `key` sul form che cambia insieme ai dati, così il form si rimonta da zero. Stessa
  verifica completa di prima (410/410 test, `tsc`/`eslint`/`build`). **Verificato dal vivo dopo il
  deploy**: checkbox lun-ven correttamente scaricate subito dopo l'apply, senza reload -- confermato
  risolto. Raccolte anche osservazioni di prodotto più ampie sull'onboarding
  (percorso guidato assente, "Compila con l'AI" non conversazionale, nome operatore generico).

  **Onboarding a domande guidate, sostituisce il testo libero per chi parte da zero (15/09/2026,
  dettaglio completo in DECISIONS.md)**: Gabriel ha chiesto un onboarding vero invece della sola
  casella di testo -- "una vera e propria onboarding con delle domande, chiuse o aperte... e con
  l'aiuto dell'AI setta tutto il negozio". Deciso con lui: sequenza fissa di 3 passi (chi lavora
  qui, orari, servizi), non una conversazione AI dinamica -- più veloce, prevedibile, una sola
  chiamata AI a persona. Il wizard traduce le risposte in una descrizione naturale e riusa la
  STESSA pipeline AI/validazione di sempre, zero rischio nuovo sull'estrazione. Mostrato solo
  quando l'attività è ancora vuota; chi ha già configurato qualcosa non vede nessuna differenza.
  Corregge di riflesso anche il nome operatore generico (ora usa il nome vero del titolare quando
  lavora da solo). 8 test nuovi (418/418 totali), `tsc`/`eslint`/`build` puliti. **Verificato dal
  vivo dopo il push**: registrazione di prova, wizard mostrato subito su attività vuota, chip
  "Altro" testato (il bug pre-consegna non si ripresenta), operatore creato come "Sara" (nome
  vero, non etichetta generica), bozza applicata correttamente, interfaccia normale al posto del
  wizard dopo l'apply, dati persistiti giusti in tutte le sezioni. Tenant di prova ripulito da
  Supabase dopo il test.
- **Fase 4 = riprogrammazione cliente self-service + promemoria di compleanno**. Riprogrammazione:
  **VERIFICATA DAL VIVO E CHIUSA 16/09/2026** -- vedi Gruppo B-bis per il dettaglio. Promemoria
  di compleanno: **CODICE FATTO 15/09/2026** (Gabriel ha approvato la funzione con "va bene ma
  rendi tutto personalizzabile dallo staff" dopo la spiegazione del meccanismo -- vedi
  DECISIONS.md 15/09/2026 per tutti i dettagli di design), testato (451/451), migrato in
  produzione, **VERIFICATO DAL VIVO 16/09/2026** (vedi DECISIONS.md, "2026-09-16 — Promemoria di
  compleanno verificato dal vivo"). Risolve il CONFLITTO Pro/`Prezzi.tsx` descritto più sotto.
  Galleria foto/upload immagini: **CODICE FATTO 16/09/2026, VERIFICATO DAL VIVO 16/09/2026**
  (vedi voce dedicata più sotto e DECISIONS.md, "2026-09-16 — Galleria foto verificata dal vivo con
  account di test"). **Fase 4 quindi chiusa del tutto, sia lato codice sia lato verifica.**
- **Rimosso dal piano attivo**: un pannello che mostri le trascrizioni vere delle conversazioni
  AI cliente-salone -- vincolo legale reale (Salone AI è processore di dati per conto del
  titolare, non proprietario di quella conversazione), dettaglio in CLAUDE.md punto 21 e
  DECISIONS.md 14/09/2026. Il pannello admin per metriche/utilizzo/account (CLAUDE.md punto 21)
  resta valido, solo senza trascrizioni leggibili.
- **Fuori scope per ora**: ruoli/staff reali con login separato (bloccante solo per Enterprise,
  nessun lead concreto oggi), report/analytics avanzati di Pro (scope ancora da definire),
  follow-up marketing ricorrente oltre i 60 giorni già automatizzati (serve prima un consenso
  GDPR esplicito, non ancora deciso), canale vocale (Skedula ce l'ha già, richiede Twilio/
  speech-to-text, fuori scala per ora).

Il resto di questa sezione (Gruppo A/B/B-bis) è il dettaglio tecnico della Fase 0 e dei gap già
mappati -- resta valido, non riscritto da zero.

### Gruppo A -- Serve solo il tuo ok o un tuo test, zero nuovo codice (sblocca tutto il resto)
1. **Dare l'ok al push di quanto già pronto e in attesa da questa sessione**: titolo Hero con i
   colori Growth, fix del clipping desktop su Vetrina, titolo interattivo (tilt al mouse + bande
   che seguono l'inclinazione), fix del CompareSlider ("Trascina per vedere la differenza").
   Tutto committato in locale, non ancora pushato -- appena dici ok ti mando il bundle e le
   istruzioni per `git pull`+`git push` dal tuo Mac.
2. **Deploy Vercel** del codice sopra una volta pushato (automatico ad ogni push su `main`, già
   collegato).
3. ~~**Provare dal vivo `/s/[slug]`** (pagina pubblica del salone) con un salone di test: cercare
   slot, prenotare, parlare con il widget chat AI.~~ **FATTO 14/09/2026** (confermato da Gabriel
   in un browser vero, non solo scritto/testato in automatico). Confermato nello stesso giro anche
   il click reale sul link "gestisci la tua prenotazione" ricevuto per email (vedi Fase 4 --
   chiudeva il limite di verifica onestamente segnalato lì, la sandbox non può raggiungere
   Supabase direttamente per questo test).
4. ~~**Provare un pagamento di test reale su Stripe Checkout** + configurare il webhook lato
   Stripe Dashboard~~ **FATTO** (confermato in un giro precedente al 14/09 -- attivazione e
   cancellazione abbonamento via webhook verificate, vedi commit `d4be5d4`). Questa voce era
   rimasta scritta come aperta per un disallineamento tra PIANO.md e lo stato reale, corretto il
   14/09/2026 sera dopo una verifica diretta sul database invece di fidarsi solo del testo qui.
5. **Aggiungerti come "utente di test"** nella schermata di consenso OAuth Google (Google Cloud
   Console), poi provare "Collega Google" dal vivo in `/dashboard/impostazioni/calendari`.
6. **Decidere cosa fare di Apple/iCloud Calendar**: non risolvibile da un hosting cloud standard
   come Vercel (blocco di Apple sul traffico da IP di data center, vedi PROJECT_STATUS.md
   "Problemi noti aperti" #14) -- o lo dichiariamo non supportato, o si accetta il limite e si
   documenta così nel materiale di vendita quando esisterà.
7. ~~**Applicare la migrazione `0011_deposito_caparra.sql` e provare un pagamento di test della
   caparra**~~ **FATTO 14/09/2026** (migrazione già applicata in un giro precedente, pagamento di
   test verificato dal vivo il 14/09 sera senza intervento di Gabriel -- vedi DECISIONS.md).
   Fatto esattamente questo -- attivata la caparra su un salone di test in
   `/dashboard/impostazioni/caparra` e completato un pagamento di test reale su `/s/[slug]`.
8. ~~Applicare la migrazione `0013_lista_attesa.sql`~~ **FATTO 13/09/2026** (applicata al
   database reale con il tuo ok). ~~Provare dal vivo la lista d'attesa~~ **FATTO 13/09/2026**
   (verificato su un tenant di prova dedicato, non sui tuoi dati reali -- vedi Fase 6 per il
   dettaglio completo): iscrizione, cancellazione, match automatico, banner e "segna risolto"
   tutti confermati funzionanti in un browser vero. Nello stesso giro trovato e corretto un bug
   critico che bloccava ogni prenotazione pubblica diretta (vedi DECISIONS.md).
9. ~~**Validare un mittente su Mailjet e impostare `MJ_APIKEY_PUBLIC`/`MJ_APIKEY_PRIVATE`/
   `MAILJET_FROM_EMAIL`**~~ **VERIFICATO DAL VIVO 14/09/2026**: email di promemoria automatico
   inviata dal cron reale e ricevuta per davvero da Gabriel nella sua casella (vedi Fase 6 e
   DECISIONS.md) -- il mittente è validato e le chiavi funzionano in produzione, non solo nei
   test automatici. (nuovo, 13/09/2026, provider deciso lo stesso giorno -- avevi già un
   account Mailjet con una subaccount key dedicata al progetto, e a piano gratis ha il doppio
   dei volumi di Resend, vedi DECISIONS.md): il codice delle notifiche email è scritto e
   verificato (`tsc`/`eslint`/`vitest`/`build` puliti, 11 test dedicati) ma senza le due chiavi
   il modulo resta silenziosamente disattivato (fail-open by design -- nessuna prenotazione si
   rompe, semplicemente non parte nessuna email). A differenza di Resend, Mailjet richiede anche
   un mittente validato PRIMA di poter inviare qualunque email (un click di conferma via email
   dal pannello Mailjet, Account -> Sender addresses & domains -- vedi `.env.example`). Deciso di
   usare per ora la tua Gmail personale come mittente di test (sapendo che rischia lo spam per
   mancato allineamento SPF/DKIM col dominio gmail.com, non adatta a clienti reali -- da rivedere
   con un dominio tuo quando ce l'avrai). ~~Applicare la migrazione
   `0015_email_cliente_caparra.sql`~~ **FATTO 13/09/2026** (applicata da me al database reale su
   tuo ok esplicito, verificata in `supabase_migrations.schema_migrations`). Dettaglio completo
   in `.env.example` e Gruppo B-bis punto 1 sotto.
10. ~~**Applicare la migrazione `0016_finestra_cancellazione.sql`**~~ **FATTO 14/09/2026**
    (primo tentativo bloccato dal classificatore di sicurezza della sandbox nonostante l'ok già
    dato in chat -- diverso dalle migrazioni precedenti; riprovato su richiesta esplicita di
    Gabriel e stavolta passato, applicata al database reale e verificata in
    `information_schema.columns`). Resta da fare solo la parte tua: impostare le ore minime e il
    numero di telefono dell'attività in `/dashboard/impostazioni/cancellazione` (vedi Fase 4).

### Gruppo B -- Nuovo codice a priorità alta, trovato nel mega-controllo competitor di oggi
1. ~~**Deposito/caparra anti-no-show** (Fase 6)~~ **VERIFICATO DAL VIVO 14/09/2026** (vedi
   DECISIONS.md 14/09/2026, "Fase 0, primo item chiuso dal vivo"): migrazione applicata, caparra
   attivata su un tenant di prova reale, pagamento di 8€ completato su Stripe Checkout TEST con
   carta `4242...`, appuntamento creato e collegato correttamente nel database reale. Chiuso
   senza intervento di Gabriel, verificato con l'estensione Chrome + query dirette sul DB.
2. ~~**Tono dell'AI personalizzabile** (Fase 5)~~ **CODICE FATTO 13/09/2026** (vedi Fase 5 per
   il dettaglio) -- resta solo la verifica dal vivo con un salone di test reale, non urgente
   finché non ci sono clienti Pro paganti.
3. ~~**Lista d'attesa automatica alla cancellazione** (Fase 6)~~ **CODICE FATTO 13/09/2026** (vedi
   Fase 6 per il dettaglio) -- resta da fare solo la parte che tocca a Gabriel: applicare la
   migrazione al database reale (Gruppo A).
4. ~~**Bug grave trovato dal vivo 15/09/2026: la caparra (punto 1 sopra) valeva SOLO per il form
   pubblico, l'AI la bypassava del tutto**~~ **CODICE FATTO 15/09/2026** (vedi DECISIONS.md
   15/09/2026 per il dettaglio completo): `crea_prenotazione` ora controlla la caparra prima di
   confermare, tramite una logica di pagamento condivisa col form (`src/lib/stripe/caparra.server.ts`)
   -- se richiesta, l'AI condivide il link di pagamento in chat invece di confermare subito, la
   prenotazione vera nasce solo al pagamento come nel form. **VERIFICATO DAL VIVO 15/09/2026**
   (vedi DECISIONS.md, sezione "lavoro autonomo"): tenant di prova, prenotazione via chat AI
   pubblica, pagamento Stripe TEST completato con `4242...`, confermato via query diretta che
   l'appuntamento nasce solo dopo il pagamento (prima solo una `richieste_caparra` in attesa).
5. ~~**Bug trovato dal vivo 15/09/2026, stesso giro di test: l'AI proponeva la lista d'attesa anche
   per un giorno di chiusura settimanale**~~ **CODICE FATTO 15/09/2026** (vedi DECISIONS.md
   15/09/2026 per il dettaglio completo): `verifica_disponibilita` ora usa
   `trovaSlotEStatoGiornoTenant` e restituisce `giorno_chiuso`, il system prompt distingue chiuso da
   pieno, e `aggiungiListaAttesaTenant` rifiuta lato server una `data_preferita` su un giorno chiuso
   per qualunque canale (dashboard/AI/pubblico). **VERIFICATO DAL VIVO 15/09/2026** (vedi
   DECISIONS.md, sezione "lavoro autonomo"): l'AI distingue correttamente "chiuso" da "pieno" e
   rifiuta esplicitamente di iscrivere in lista d'attesa su un giorno di chiusura, confermato anche
   via query diretta (nessuna riga scritta).
7. **Bug NUOVO trovato dal vivo 15/09/2026 durante il sample-check dei verbi pronominali: l'AI
   dichiarava chiuso un giorno che invece era aperto**, con testo internamente coerente (giorno e
   data corrispondevano fra loro) ma falso rispetto agli orari reali -- diverso e più insidioso del
   bug già noto su giorno/data testualmente incoerenti (`giorni-settimana.ts`), perché lì il
   controllo esistente non trova nulla da correggere. **CODICE FATTO 15/09/2026** (vedi
   DECISIONS.md per il dettaglio completo e l'ipotesi di causa): `verifica_disponibilita` ora
   restituisce anche `giorno_settimana_richiesto` (il vero nome del giorno per la data
   interrogata, calcolato dal codice) e lo strumento istruisce il modello a usarlo sempre invece di
   ricalcolarlo. Test aggiunti, tutto pulito. **VERIFICATO DAL VIVO 15/09/2026 dopo il deploy**
   (vedi DECISIONS.md, sezione "lavoro autonomo"): in una conversazione veramente fresca su un
   tenant di test con la stessa configurazione del bug originale, l'AI risponde correttamente sia
   sul giorno aperto sia su quello chiuso. Una vecchia conversazione già "inquinata" da risposte
   sbagliate pre-deploy continua a sbagliare se richiesta di nuovo -- comportamento atteso (il
   modello resta coerente con quanto già detto nella stessa chat, il fix non riscrive la
   cronologia), non una ricaduta del fix.
6. ~~**Bug di isolamento multi-tenant trovato in audit notturno 15/09/2026 (non dal vivo): scrivere
   un appuntamento non verificava mai che l'operatore appartenesse al tenant giusto**~~ **CODICE
   FATTO 15/09/2026** (vedi DECISIONS.md 15/09/2026 per il dettaglio completo): nuova
   `verificaOperatoreCompatibile` chiamata da `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`
   prima di scrivere -- verifica tenant, `attivo`, e che l'operatore esegua davvero il servizio.
   Nessun exploit reale osservato, trovato per audit del codice di scrittura, non da un test dal vivo.

### Gruppo B-bis -- Altre funzioni che mancano davvero, trovate in un secondo giro (12/09/2026)

Continuando il controllo su richiesta di Gabriel ("altre funzioni che dobbiamo e possiamo
mettere"): confronto punto-per-punto tra cosa il codice fa oggi e cosa un titolare si
aspetterebbe da un prodotto di questa categoria (non solo dal confronto competitor). Ordinate
per quanto sono urgenti/dovute, non per quanto sarebbero belle da avere.

**Dovute (mancano, e sono cose che qualunque prodotto di booking ha)**:
1. ~~**Nessuna notifica email, né per il titolare né per il cliente**~~ **CODICE FATTO
   13/09/2026**: ogni volta che `creaAppuntamentoTenant` crea un appuntamento (dashboard, AI,
   pubblico diretto o caparra/Stripe -- unica funzione di scrittura, punto 9 di CLAUDE.md) parte
   ora, in modo fail-open (mai bloccante per la prenotazione stessa, vedi
   `src/lib/email/mailjet.server.ts`), un'email al titolare (sempre, indirizzo risolto da
   `auth.users.email` via `profiles.ruolo = 'owner'`, non da `tenants.email` che esiste ma non è
   mai popolata) e una email di conferma al cliente (solo se ha lasciato un'email -- oggi raccolta
   solo nel flusso pubblico `/s/[slug]`, campo facoltativo). Provider: Mailjet (piano gratuito,
   6.000 email/mese, nessuna approvazione esterna a differenza di WhatsApp/Meta -- inizialmente
   scritto su Resend, cambiato lo stesso giorno perché Gabriel aveva già un account Mailjet con
   key dedicata e a piano gratis ha il doppio dei volumi, vedi DECISIONS.md). Dettaglio completo,
   alternative considerate e limitazioni oneste in DECISIONS.md.
   **Resta da fare, tocca a te (Gruppo A)**: validare un mittente sul pannello Mailjet (Account ->
   Sender addresses & domains, un click di conferma via email -- obbligatorio, Mailjet non ha un
   mittente di test universale come Resend; per ora userai la tua Gmail solo per il test, sapendo
   che rischia lo spam per mancato allineamento SPF/DKIM, vedi PROJECT_STATUS.md) e impostare
   `MJ_APIKEY_PUBLIC`/`MJ_APIKEY_PRIVATE`/`MAILJET_FROM_EMAIL` su Vercel (spunta "Sensitive"
   consigliata per entrambe le chiavi). ~~Applicare la migrazione
   `0015_email_cliente_caparra.sql` al database reale~~ **FATTO 13/09/2026** (applicata
   direttamente da Claude su ok esplicito di Gabriel).
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
4. ~~**Incassi previsti**~~ **CODICE FATTO 13/09/2026** (chiesto esplicitamente da Gabriel il
   13/09/2026, dopo aver visto l'esclusione della "Cassa" sotto -- domanda giusta, sono due cose
   diverse): una proiezione dei guadagni futuri (prezzo servizi × appuntamenti confermati nei
   prossimi 7/30 giorni), non un incasso reale registrato. Zero pagamenti, zero fiscalità -- puro
   calcolo su dati già in database, stessa natura degli altri numeri di `metriche.ts` (punto 21).
   **Non ha nulla del rischio della Cassa esclusa sotto**: quella è un registro di pagamenti REALI
   incassati, con tutti gli obblighi fiscali che ne conseguono; questa è solo un numero
   previsionale, come "quanto ti aspetti di incassare questa settimana in base a chi ha già
   prenotato". Vedi Fase 3 per il dettaglio implementativo.

**Possibili, da valutare (non urgenti, ma rafforzano il prodotto se costruiti bene)**:
5. **Multi-utente/team reale**: conseguenza diretta del punto 3 -- dare a ogni "operatore" un
   proprio login (invito via email, permessi limitati alla propria agenda) invece di essere solo
   un record gestito dal titolare. Rilevante per la persona di marketing "salone con team" che
   già usiamo in `PerChi.tsx` -- oggi quella promessa non è ancora mantenuta tecnicamente.
6. **Raccolta recensioni post-appuntamento**: nessun gestionale italiano verificato la fa
   nativamente (Estetia mostra solo testimonianze statiche in home page, non vere recensioni
   raccolte); i marketplace (Fresha/Treatwell/Booksy) invece fondano parte della fiducia proprio
   sulle recensioni. Un messaggio automatico post-appuntamento che chiede una valutazione,
   mostrata sulla pagina pubblica del salone, sarebbe un differenziale vero e non richiede
   grande lavoro sopra quello che già esiste (stessa infrastruttura di reminder/automazioni
   pianificata in Fase 6).
7. **Export/import CSV dei clienti**: Estetia ce l'ha esplicitamente, utile per un titolare che
   migra da un altro gestionale (abbassa l'attrito di switch) o vuole i propri dati per un
   mailing esterno. Lavoro contenuto.
8. **Pacchetti prepagati/tessera fedeltà digitale**: visto su CutApp, comune nel settore beauty
   ("10 sedute prepagate", punti fedeltà). Non urgente, ma un vero differenziale per i saloni
   che già usano questo modello di vendita oggi su carta.

**Da NON fare senza pensarci due volte (rischio di scope creep)**:
9. **"Cassa"/registro incassi REALE dei servizi erogati** -- diverso dagli "incassi previsti" del
   punto 4 sopra: qui si parla di registrare pagamenti VERI incassati in presenza (diverso anche
   dal nostro billing Stripe, che è solo per l'abbonamento SaaS del salone a noi). Presente in
   Estetia ("Cassa" in sidebar) e WeGest ("cassa e magazzino"). Utile in teoria, ma tocca
   fatturazione/ricevute fiscali italiane -- un terreno normativo diverso dal nostro focus
   (booking + AI + CRM) e facile da sottovalutare in complessità. Non aggiunto come task: da
   valutare SOLO se più di un cliente reale lo chiede esplicitamente, non perché un concorrente
   ce l'ha.

### Gruppo C -- Completare le fasi già aperte (dettaglio nelle fasi sotto)
1. Fase 1: ~~collegare alle schermate/AI la gestione di servizi consecutivi e operatore non
   specificato (la logica pura c'è già)~~ **FATTO 16/09/2026**, vedi dettaglio nella fase sotto;
   resta da fare: test sugli scenari di prenotazione del punto 30 contro il DB vero.
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
1. ~~**Anti-abuso sulla prenotazione pubblica** (`/s/[slug]`): oggi solo il tetto mensile del piano
   Free protegge da un uso abusivo -- serve almeno un rate-limit per IP o una conferma
   SMS/WhatsApp del numero prima di bloccare uno slot.~~ **CODICE FATTO 13/09/2026, RIVISTO
   14/09/2026** (chiesto esplicitamente da Gabriel: "altre cose per evitare abusi?", poi lui
   stesso il 14/09 ha segnalato giustamente che il tetto di volume "può causare problemi").
   Tre livelli, dal più economico al più drastico, controllati in quest'ordine:
   1) **campo trappola + tempo minimo di compilazione** (`src/lib/anti-bot.ts`, nuovo il
   14/09/2026): un campo invisibile che un cliente vero non vede mai ma un bot che compila tutti
   gli `<input>` del DOM riempie comunque (tecnica "honeypot", zero CAPTCHA), più un controllo sul
   tempo trascorso dal caricamento della pagina (un umano che ha già scelto servizio/giorno/slot
   non può mai confermare in meno di 3 secondi da lì, un bot che chiama la server action
   direttamente sì). **Zero rischio di falso positivo su un cliente vero** -- è la ragione della
   revisione: il vecchio tetto di volume da solo rischiava di bloccare clienti VERI durante un
   picco di richieste legittime (es. dopo un post social), esattamente il momento in cui un
   salone ha più bisogno che le prenotazioni arrivino, non meno; 2) **anti-burst per telefono**
   (stesso numero, stesso tenant, non due volte a meno di 20 secondi); 3) **tetto di volume per
   tenant**, alzato da 8 a 25 scritture pubbliche ogni 10 minuti proprio perché i livelli 1-2 già
   fermano la maggior parte dei bot senza rischio, quindi questo resta solo l'ultima rete di
   sicurezza contro un attacco vero, non deve essere lui a bloccare un salone impegnato. Zero
   nuove tabelle/migrazioni. Fail-open come tutto il resto del booking engine (un valore
   `iniziatoAlleMs` assente non blocca mai). Resta valido il punto più specifico -- una vera
   conferma SMS/WhatsApp del numero -- ma richiederebbe un provider SMS a pagamento (nessuno
   integrato oggi), quindi non incluso qui. 9 nuovi test (`anti-bot.test.ts`), `tsc`/`eslint`/
   `vitest`/`build` puliti.
2. ~~**Pagine legali** (privacy/termini/cookie): gap reale, mai tracciato come task da nessuna
   parte prima di oggi (solo menzionato in `docs/analisi-estetia.md`) -- il progetto non ne ha
   nessuna. Ogni concorrente verificato le ha.~~ **CODICE FATTO 14/09/2026** -- vedi Fase 4.
3. ~~**Completare la generalizzazione del copy** oltre "salone" (deciso il 02/09/2026, mai
   finito): `/registrati` e la dashboard usano ancora "Crea il tuo salone" e testi
   settore-specifici in alcuni punti.~~ **CODICE FATTO 15/09/2026** (chiesto da Gabriel, in vista
   di dare il link a un'attività che non è un salone di bellezza, es. il fratello osteopata):
   `/registrati` ("Crea la tua attività", "Nome dell'attività", messaggio di conferma email),
   tutta la dashboard ("Configura l'attività" al posto di "Configura il salone" in 4 punti,
   "Attività" al posto di "Salone" nella scheda riepilogo, messaggio di provisioning fallito) e
   il messaggio "giorno chiuso" sulla pagina pubblica di prenotazione (era l'unico testo
   salone-specifico visibile al CLIENTE finale, non solo al titolare). Lasciati intenzionalmente
   invariati: il nome del brand "Salone AI" e il copy della landing (`page.tsx`, già scritto in
   modo inclusivo con "liberi professionisti") -- sono scelte di posizionamento/marketing, non
   bug di copy, e cambiarli è una decisione separata da prendere con Gabriel se/quando serve.
   Placeholder di esempio (es. "Salone di parrucchieri..." nei pannelli AI) lasciati anch'essi
   invariati: sono solo esempi illustrativi, non testo prescrittivo. 408/408 test, `tsc`/`eslint`/
   `npm run build` puliti.

### Gruppo E -- Ogni promessa del sito, verificata una per una

Richiesta esplicita di Gabriel, 13/09/2026: "aggiungi negli obiettivi tutte le promesse che ci
sono nel sito se non le hai messe". Contesto: il 12/09/2026 è stata presa la decisione esplicita (vedi DECISIONS.md, "Il sito
descrive il prodotto al lancio, non lo stato di oggi") di togliere le etichette "in arrivo" da
`Prezzi.tsx`/`Vetrina.tsx`/`Funzionalita.tsx`/`Faq.tsx`/`ImpattoEconomico.tsx` e presentare il
prodotto come sarà al lancio commerciale, con l'impegno esplicito di costruire davvero tutto
prima di aprire i pagamenti veri. Questa sezione è l'elenco di verifica completo, promessa per
promessa (letto l'intero copy della landing riga per riga il 13/09/2026), così nessuna resta
implicita/dimenticata. Le promesse VERE (già costruite e verificate) non sono ripetute qui --
sono nella loro Fase con `[x]`.

**Promesse NON ancora mantenute nel codice, con il task che le copre**:
1. ~~Tono dell'AI personalizzabile (Pro)~~ **CODICE FATTO 13/09/2026** -- vedi Fase 5.
2. Assistente AI su WhatsApp (Pro) -- bloccato dall'App Review Meta, task in
   `docs/embedded-signup-whatsapp.md` + Fase 2 (bloccante prima di vendere Pro, ma dipendenza
   esterna non nel nostro controllo).
3. ~~SMS (Pro)~~ **CODICE FATTO 14/09/2026** -- vedi Fase 6 (canale di fallback via Skebby,
   insieme al nuovo prezzo per operatore su Pro deciso nella stessa conversazione).
4. ~~Analytics / "andamento nel tempo" (Growth)~~ **CODICE FATTO 14/09/2026** -- vedi Fase 3.
5. ~~Promemoria automatici (Growth, e usati nel calcolo ROI di `ImpattoEconomico.tsx`)~~ **CODICE
   FATTO 14/09/2026** -- vedi Fase 6.
6. ~~Multi-sede e ruoli avanzati (Enterprise) -- task in Fase 5 (bloccante prima di vendere
   Enterprise).~~ **CODICE FATTO 16/09/2026** -- vedi Fase 5. La voce di `Prezzi.tsx` è stata
   riscritta nello stesso giro in due righe che dicono esattamente cosa si compra: "Più sedi, un
   solo accesso" e "Ruoli e permessi per il personale", al posto dell'unico "Multi-sede e ruoli
   avanzati" che lasciava immaginare un multi-sede dentro un'unica attività.
10. **"disponibilità aggiornata anche su più sedi"** nella card "Personal trainer e centri
   fitness" di `PerChi.tsx` -- **TROVATO E CORRETTO 16/09/2026**, durante il controllo completo
   chiesto da Gabriel ("verifica anche le funzioni che abbiamo menzionato sul sito se ci sono
   tutte"). Era una promessa di multi-sede fatta dentro una card persona, su OGNI piano e senza
   nessun gate, quando nello schema non esisteva alcun concetto di sede. **Perché era sfuggita al
   giro del 13/09/2026** (che pure aveva letto "l'intero copy della landing riga per riga): la
   verifica si era concentrata sulle sezioni dove le promesse sono elencate come tali -- Prezzi,
   Funzionalità, FAQ, ImpattoEconomico -- e una capacità promessa in mezzo a una frase
   descrittiva di una persona di marketing non era stata riconosciuta come promessa. Lezione per
   i prossimi controlli: le promesse non stanno solo negli elenchi puntati.
   Sostituita con "Ogni trainer con i suoi orari e i suoi servizi, su un unico link di
   prenotazione", che è coperto dal multi-operatore già esistente.
7. App installabile/PWA (elencata sia come funzione generale in `Funzionalita.tsx` sia come voce
   specifica Enterprise in `Prezzi.tsx`) -- task già in Fase 4/7, **non era ancora collegato
   esplicitamente al fatto che è anche una voce di prezzo Enterprise**: stesso livello di urgenza
   degli altri bloccanti sopra, non solo un "nice to have" generico.
8. ~~"1 operatore" sul piano Free~~ **CODICE FATTO 13/09/2026** -- vedi Fase 5 (`limiteOperatori`
   in `piani.ts`, applicato in `creaOperatore`).
9. ~~**Automazioni extra / promemoria di compleanno (Pro)**~~ **CODICE FATTO 15/09/2026,
   VERIFICATO DAL VIVO 16/09/2026** -- aggiunta 14/09/2026 (rielaborazione prezzi/margini, prezzo Pro
   portato a 89,90€ in cambio di "vantaggi seri" scelti da Gabriel, vedi DECISIONS.md), poi
   rimandata a dopo il lancio il 15/09/2026 e infine approvata lo stesso giorno con la richiesta
   esplicita "rendi tutto personalizzabile dallo staff" -- vedi DECISIONS.md 15/09/2026 per il
   design completo. `src/lib/compleanno.ts`/`compleanno.server.ts`, migrazione
   `0023_promemoria_compleanno.sql` (`clienti.data_nascita`, raccolta facoltativa su ogni piano
   da `/dashboard/clienti/[id]`; `tenants.compleanno_attivo`/`compleanno_messaggio`), gate
   `pianoHaPromemoriaCompleanno` in `piani.ts`, pagina staff
   `/dashboard/impostazioni/compleanno` (interruttore + messaggio libero con segnaposto `{nome}`
   + anteprima dal vivo), wired nello stesso cron giornaliero di `promemoria.server.ts`. Chiude
   il CONFLITTO descritto subito sotto.
10. **Supporto prioritario (Pro)** -- aggiunta 14/09/2026. Diverso dagli altri due: non è
    codice, è un impegno di processo (rispondere prima ai ticket/email di un cliente Pro). Da
    decidere con Gabriel COME distinguere un cliente Pro quando scrive (probabilmente: chiedere
    sempre l'email del salone, che identifica il piano nel nostro DB) prima di poter dire questa
    promessa onestamente mantenuta -- oggi non c'è nemmeno un canale di supporto strutturato
    (solo email diretta a Gabriel).
11. **Report/analytics avanzati (Pro)** -- aggiunta 14/09/2026. Da scoprire con Gabriel COSA
    significa in concreto oltre l'Analytics già incluso da Growth (`pianoHaAnalytics` in
    `piani.ts`, vedi Fase 3): candidati discussi solo a livello di idea, non ancora scelti --
    un report mensile via email, un confronto periodo-su-periodo, un export dati più ampio
    dell'attuale `/dashboard/clienti/export` (oggi export clienti, non metriche). Nessun codice
    scritto: la voce è stata aggiunta al sito come impegno di lancio, non come funzione pronta.

**Promesse verificate e già vere oggi** (nessuna azione, elencate solo per completezza
dell'audit): pagina di prenotazione pubblica self-service 24/7 anche su Free; calendario unico
senza doppie prenotazioni; CRM con storico unificato dashboard/AI/pubblico; isolamento dati
reale a livello database; sync Google Calendar (import/blocco); assistente AI su chat web
incluso da Growth, con escalation a un operatore umano sui casi ambigui; pagamenti/upgrade
self-service dal pannello (Stripe Customer Portal); cancellazione abbonamento senza vincoli;
registrazione self-service senza intervento manuale; infrastruttura dati in Europa
(`eu-west-1`); Free senza scadenza fino a 60 prenotazioni/mese; trial 10 giorni su Growth con
carta richiesta ma non addebitata prima della fine prova.

**Non un problema, solo una nota per onestà nella FAQ**: `Faq.tsx` risponde "Sì" alla domanda
"Funziona anche su WhatsApp?" specificando "incluso dal piano Pro in su" -- risposta corretta
COME PROMESSA (coerente con la decisione del 12/09/2026), ma da ricontrollare prima di aprire i
pagamenti veri su Pro insieme al punto 2 sopra: se al momento di vendere Pro sul serio WhatsApp
non fosse ancora sbloccato da Meta, questa riga della FAQ andrebbe temporaneamente ammorbidita,
non lasciata a prometterlo mentre non è vero per il cliente che sta pagando.

**CONFLITTO trovato il 15/09/2026, riletta tutta la documentazione competitiva su richiesta di
Gabriel** ("rileggi tutti gli md, capendo cosa avevamo stabilito per battere la concorrenza"):
`Prezzi.tsx` pubblicizza da riga 104 **"Automazioni extra (promemoria di compleanno)"** come voce
inclusa nel piano Pro (89,90€/mese) -- aggiunta l'8/09/2026 insieme a "Supporto prioritario" e
"Report/analytics avanzati" quando Gabriel ha chiesto "vantaggi seri" per giustificare il prezzo
Pro (vedi punto 9 di questo stesso Gruppo E qui sopra, DECISIONS.md). Il 15/09/2026, rispondendo
alle domande fatte prima di iniziare la Fase 4, Gabriel ha detto esplicitamente di rimandare il
promemoria di compleanno **a dopo il lancio**. Le due cose erano in contraddizione diretta: se i
pagamenti veri su Pro aprono prima che questa funzione esista, si vende una funzione che non c'è
-- ESATTAMENTE lo stesso problema di credibilità già trovato e risolto per il "Tono dell'AI
personalizzabile" (`docs/analisi-concorrenti-mercato.md`, "AGGIORNAMENTO CRITICO" punto 4).

**RISOLTO lo stesso giorno**: dopo la spiegazione del meccanismo, Gabriel ha scelto di costruire
la funzione ("va bene ma rendi tutto personalizzabile dallo staff") invece di ammorbidire la
pagina prezzi -- vedi punto 9 del Gruppo E qui sopra e DECISIONS.md 15/09/2026 per il design
completo. Il conflitto non esiste più: quando i pagamenti veri su Pro apriranno, la funzione
pubblicizzata sarà già codice reale (in attesa solo della verifica dal vivo post-deploy).

---

### Gruppo F -- Rileggendo `docs/analisi-estetia.md` e `docs/analisi-concorrenti-mercato.md` per intero, cosa manca ancora dalla lista di lavoro (15/09/2026)

Richiesta esplicita di Gabriel: rileggere tutta la documentazione competitiva e verificare che
non manchi nulla dal piano. Le sezioni sopra (Gruppo E, "Sintesi strategica" sotto) erano già
complete per le PROMESSE del sito -- questi sono invece spunti REALI dei due documenti mai
diventati un task, trovati confrontando riga per riga con quanto già tracciato. Nessuno di questi
è bloccante prima del lancio (a differenza dei punti del Gruppo E sopra): sono differenziali in
più da valutare, non buchi che rompono una promessa già fatta.

1. **Concetto opzionale di "postazione/risorsa fisica" nel booking engine** (`docs/analisi-estetia.md`,
   sezione "Gestione avanzata"): Estetia previene conflitti anche per risorsa fisica condivisa
   (una cassa, un lavabo), non solo per operatore -- utile per un salone con team dove le
   postazioni sono meno degli operatori, irrilevante per il professionista singolo (la
   maggioranza del nostro target attuale). **Non deciso, tocca lo schema del booking engine
   (CLAUDE.md punto 5, da fermarsi e chiedere)**: aggiungerlo ora sarebbe prematuro senza un
   salone con team reale che lo richieda esplicitamente -- candidato per Fase 7/Gruppo C quando
   ci sarà un cliente "salone con team" pagante, non prima.
2. **Metrica "Tasso AI" in dashboard/analytics** (% di conversazioni gestite dall'AI senza
   passaggio a un operatore, vista sulla dashboard di Estetia come KPI in prima pagina): oggi
   `metriche.ts` non calcola nulla del genere. Coerente col punto 21 di CLAUDE.md (insight
   azionabili) e più forte della versione di Estetia -- la loro è "un numero secco senza un
   perché" (debolezza osservata in `docs/analisi-estetia.md`), la nostra dovrebbe accompagnarla
   con un'azione se il tasso scende (es. "rivedi il system prompt" o "controlla le conversazioni
   con handoff"). Candidato per Fase 3 (analytics), non urgente.
3. **Calcolatore prezzi interattivo** ("quanti operatori/clienti ti servono?" su `Prezzi.tsx`) --
   proposto in `docs/analisi-estetia.md` come contromisura diretta alla "paralisi da scelta"
   osservata sulla griglia prezzi di Estetia (5 piani + 5 add-on). Candidato per quando si
   rifinisce la pagina prezzi definitiva (Fase 7), non un blocco per il lancio.
4. **Demo pubblica realmente interagibile prima della registrazione** (dati finti ma prodotto
   vero, non un'animazione statica come quella di Estetia in homepage) -- differenziale di
   fiducia per chi valuta il prodotto senza ancora registrarsi. Candidato per dopo il lancio,
   richiede un tenant demo dedicato mantenuto a parte.
5. **Onboarding cronometrato e testato per restare sotto i 10 minuti** dichiarati da Estetia come
   riferimento ("attivo in 10 minuti, zero competenze tecniche") -- oggi verificato dal vivo che
   funziona, mai misurato il tempo reale contro quel benchmark esplicito. Candidato per un giro
   di test dal vivo quando si chiude Fase 7 (parità/superiorità UX).
6. **Messaggi vocali (speech-to-text) quando WhatsApp sarà attivo** (CLAUDE.md punto 8, "eventuali
   messaggi vocali"; Estetia dichiara gestione "anche vocale", Skedula ha un vero assistente
   telefonico vocale) -- oggi irrilevante perché WhatsApp è bloccato dalla business verification
   Meta e il canale attivo (chat web) è solo testo. Non dimenticare quando si sblocca WhatsApp:
   serve gestire lo speech-to-text del canale PRIMA di passare il testo all'AI, non è automatico.
7. **"Fallback umano" come funzionalità di marketing a sé stante** (Estetia la vende come card
   separata in prima pagina, non solo come dettaglio nell'onboarding) -- noi la citiamo solo
   dentro la descrizione della card "Assistente AI" in `Funzionalita.tsx`, funzionalmente
   identica (passaggio a operatore, Fase 2) ma meno in vista nel copy. Minore, puro copy, nessun
   codice: valutare se separarla in una card propria quando si rivede la landing (Fase 7).

**Cosa NON è un buco, verificato in questo giro** (per chiarezza, non un elenco a caso):
recensioni post-appuntamento già tracciate (Fase 3, sopra); segmentazione "per tipo di attività"
sulla landing già fatta e più ampia di quella di Estetia (`PerChi.tsx`, per professione invece che
per dimensione del salone); canale vocale come funzione telefonica reale già esplicitamente
"fuori scope per ora" (sopra); region EU di Supabase già verificata (`eu-west-1`); pagine legali
già fatte.

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
   **Nota di Gabriel (15/09/2026), da tenere per quando si scriverà il copy definitivo della
   landing/materiale di vendita**: il punto da far capire chiaramente al titolare non è solo
   "zero commissione" in astratto, ma il confronto diretto con Fresha/Treatwell -- loro sono un
   motore di ricerca/marketplace e trattengono una percentuale su ogni prenotazione portata da
   loro; noi vendiamo un software in abbonamento e basta, nessun pagamento aggiuntivo legato alle
   prenotazioni del titolare. Va reso esplicito e concreto in landing page (non lasciato
   implicito in una frase generica su "nessuna commissione"), è un argomento di vendita diretto
   contro i due concorrenti più grandi.
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

## Fase 1 -- Booking engine (punti 12, 13, 14) -- FATTA (chiusa 16/09/2026 con Task #190)
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
- [x] Gestione servizi consecutivi, operatore non specificato, cliente nuovo/esistente --
      **FATTO 16/09/2026**. Alla verifica del codice, 2 dei 3 punti erano già completi ovunque
      (operatore non specificato: `verificaOperatoreCompatibile` già gestiva "qualsiasi
      operatore compatibile"; cliente nuovo/esistente: `trovaOCreaClienteTenant` già in uso da
      dashboard e tool AI). Restava solo "servizi consecutivi" (es. manicure + pedicure con la
      stessa operatrice, senza buchi tra i due): nuova colonna nullable
      `appuntamenti.gruppo_prenotazione_id` (migrazione 0025, applicata al DB reale) invece di
      un array `servizio_id[]` o una tabella ponte -- così tutto il resto (metriche, CRM, export
      CSV, notifiche) continua a leggere "un appuntamento = un servizio" senza modifiche, una
      prenotazione multi-servizio diventa N righe che condividono lo stesso
      `gruppo_prenotazione_id`. Scritta ovunque si crea un appuntamento (single source of truth,
      punto 9): `creaAppuntamentoTenant`, tool AI `crea_prenotazione` (`servizio_ids: string[]`),
      form dashboard (checkbox multipli in `/dashboard/calendario`). Tre limiti di scope
      deliberati, vedi DECISIONS.md 16/09/2026: (1) caparra non supportata su una catena
      multi-servizio (errore esplicito invece di gestirla male); (2) una notifica per riga
      invece di una cumulativa; (3) la pagina pubblica `/s/[slug]` NON permette ancora di
      scegliere più servizi insieme (resta a un servizio per prenotazione lato cliente finale,
      da valutare in futuro). 5 nuovi test su `booking-engine.server.test.ts` (creazione multi-
      riga, compatibilità singolo servizio, operatore non compatibile con tutta la catena,
      conflitto sull'intera durata, rollback se una riga a metà catena fallisce per race
      condition) + 3 su `tools.test.ts` (array inoltrato intero, blocco caparra+multi-servizio,
      singolo servizio invariato) -- suite completa 469/469 verde, `tsc`/`eslint`/`build` puliti.
      **Non verificato dal vivo su produzione**: il codice non è ancora deployato (nessuna
      credenziale di push in sandbox, consegna via bundle come sempre) -- una volta che lo
      pushi/Vercel lo pubblica, verifico io stesso la UI dal vivo se preferisci, oppure la provi
      tu direttamente.
- [x] ~~Test su tutti gli scenari del punto 30 rilevanti alla prenotazione, contro il DB vero~~
      **FATTO 16/09/2026, Task #190 CHIUSO**: run completo di tutti e 18 gli scenari insieme
      (`npm run test:e2e`, un solo worker) -- **18 passed (4.0m)**, zero fallimenti. Percorso
      completo in 4 giri di run reali (12/14 -> 15/18 -> 16/18 -> 18/18), vedi DECISIONS.md
      "Task #190 chiuso" per il riepilogo. Infrastruttura Playwright pronta (`playwright.config.ts`,
      `tests/e2e/helpers/`: tenant di prova usa-e-getta creato/ripulito per ogni test, login,
      chat AI, calcolo date) e 6 dei 15 scenari scritti: #1 (nuovo cliente via chat AI vera),
      #3 (doppia prenotazione simultanea, RACE VERA contro il DB, non simulata come nell'unit
      test), #5 (professionista assente), #6 (attività chiusa, ri-verifica un bug già corretto),
      #9 (servizi consecutivi via chat AI, la funzionalità appena costruita), #12 (prenotazione
      manuale da dashboard). Girano SOLO in locale a comando (`npm run test:e2e`), non in CI
      (decisione con Gabriel, vedi DECISIONS.md 16/09/2026): toccano un database vero e gli
      scenari con l'AI chiamano il vero Claude (costo reale, seppur minimo, per run). Primo run
      reale di Gabriel: tutti e 6 falliti per una collisione tra l'helper e il trigger di
      provisioning automatico (`profiles_pkey`) -- **CORRETTO 16/09/2026**, vedi DECISIONS.md
      "Bug profiles_pkey nei test E2E". Secondo run: 3/6 passati, 2 falliti per un bug VERO nella
      checkbox servizi del pannello dashboard (si spegneva da sola per un re-render prematuro) --
      **CORRETTO 16/09/2026**, vedi DECISIONS.md "Bug vero (non solo di test) trovato dagli
      scenari E2E". Terzo run: **6/6 VERDI** (1.7 min totali) -- questi 6 scenari sono chiusi.
      Confermato con Gabriel (16/09/2026) come testare 14/15: solo il nostro codice (URL del
      portale + reazione al webhook), non la UI ospitata da Stripe -- vedi DECISIONS.md.
      Scritti anche gli scenari #2 (modifica prenotazione via chat), #4 (servizio inesistente),
      #7 (servizio incompatibile con l'operatore), #8 (slot occupato durante la conversazione),
      #10 (cliente cancella + avviso lista d'attesa), #11 (no-show, ridotto a solo verifica
      DB/vincolo Postgres perché non è un flusso di prodotto implementato oggi -- vedi
      DECISIONS.md), #13 (registrazione reale + completamento onboarding manuale). Scritti
      anche gli ultimi due scenari, #14 (upgrade piano) e #15 (cancellazione abbonamento) --
      **tutti e 15 gli scenari del punto 27 di CLAUDE.md sono ora scritti** (18 test in 15
      file). **Primo run reale di tutti e 18, 16/09/2026: i 4 test Stripe verdi al primo colpo**
      (Price ID reali presi dalla Dashboard, `STRIPE_WEBHOOK_SECRET` generato al volo -- non
      serve il vero secret di Stripe per questi due scenari). Sui 14 rimanenti, **15/18 verdi**
      in totale: Scenario 8 e 13 erano ancora bug nei TEST (margine anti-burst troppo risicato +
      retry che non rispondeva alla domanda dell'AI; locator ambiguo sulla pagina pubblica) --
      **CORRETTI**. **Scenario 10 (cliente cancella) restava aperto**: causa reale non ancora
      isolata, aggiunto un log diagnostico temporaneo. Secondo run: **Scenario 10 passato** (log
      non scattato, nessuna certezza), 2 nuovi bug di TEST in 8 (conferma ancora troppo vaga) e 9
      (servizi consecutivi, mancava un ritentativo) -- **CORRETTI**; Scenario 2 fallito con causa
      non chiarita, non toccato alla cieca (poi confermato variabilità AI da crediti esauriti).
      Terzo run: **16/18 verdi** -- Scenario 2 e 9 confermati sani. Scenario 8, terzo bug nello
      stesso punto (l'AI chiede un'ulteriore riconferma dopo un orario esplicito) -- **CORRETTO**
      alternando offerta-orario e riconferma nello stesso messaggio. Scenario 10, sintomo nuovo:
      l'AI dichiara una cancellazione riuscita col DB ancora "confermato" -- diagnosticato (dal
      loop di tool-calling in `agente.ts`, che esegue sempre per davvero ogni `tool_use`) come il
      modello che NON chiama affatto lo strumento e dichiara il successo a memoria: non un bug di
      test ma una lacuna reale del prompt, **corretta** estendendo REGOLA ASSOLUTA 1 a vietare di
      dichiarare un'azione completata senza un risultato di strumento fresco in quel turno.
      Aggiunto anche un secondo log diagnostico incondizionato per confermarlo con certezza al
      prossimo run. **Confermato dal vivo**: rilanciati solo Scenario 8 e 10
      (`npx playwright test 08- 10-`) -- **2 passed**, il log ha mostrato il modello correggersi
      da solo un id non valido nello stesso turno, esattamente il comportamento voluto dal fix.
      Rimossi entrambi i log diagnostici, non più necessari. Resta solo un run completo di tutti
      e 18 insieme come conferma finale. Verificato `tsc`/`eslint`/`vitest`/`build` puliti.
      Dettaglio completo in `tests/e2e/README.md` e in DECISIONS.md.
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
- [x] ~~Prompt caching sul system prompt e sugli strumenti (nuovo task, 16/09/2026)~~ **FATTO**:
      Gabriel ha chiesto se il progetto sprecasse crediti AI da qualche parte -- trovato che
      `agente.ts` non usava mai `cache_control` di Anthropic, pur avendo un SDK che lo supporta,
      ritrasmettendo a prezzo pieno system prompt (~1.500 token) e strumenti (~8KB) identici a
      ogni chiamata di un turno (fino a 8 per il loop di tool-calling, più un'eventuale chiamata
      extra di `correggiSeIncongruente`). Corretto marcando system+ultimo strumento con un
      breakpoint di cache, costruiti una sola volta per turno. Zero cambio di comportamento per
      il cliente -- solo di cosa viene fatturato. Verificato `tsc`/`eslint`/`vitest`
      (469/469)/`build`/`playwright test --list` puliti. **Confermato dal vivo**: Gabriel ha
      rilanciato `npm run test:e2e` con l'API reale -- **18/18 ancora verdi**, nessuna
      regressione. Vedi DECISIONS.md per il dettaglio completo.

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
- [x] ~~**Analytics -- BLOCCANTE prima di aprire pagamenti veri sul piano Growth**~~ **CODICE
      FATTO 14/09/2026, PARZIALE PER SCELTA ONESTA** (trovato nel controllo promesse del sito
      13/09/2026: `Prezzi.tsx`/`Funzionalita.tsx` pubblicizzano "Analytics" con "Andamento
      prenotazioni e clienti nel tempo, non solo i numeri di oggi" da Growth in su, la dashboard
      mostrava solo finestre fisse). Costruita esattamente la promessa scritta, non di più: nuova
      pagina `/dashboard/analytics`, gate di piano (`pianoHaAnalytics` in `src/lib/piani.ts`,
      stessa forma di `pianoHaTonoPersonalizzato`, upsell se il piano non include la funzione),
      due grafici a barre (prenotazioni confermate e nuovi clienti, ultime 12 settimane) costruiti
      a mano con `div` ad altezza percentuale -- niente Recharts/Chart.js, due serie su 12
      colonne non giustificano una nuova dipendenza. Logica pura e testata in
      `src/lib/analytics.ts` (`calcolaAndamentoSettimanale`, 5 test), layer di collegamento in
      `analytics.server.ts` che riusa la stessa identica forma di query di `metriche.server.ts`.
      **Retention e no-show reale DELIBERATAMENTE NON inclusi**: rileggendo il sito riga per riga,
      nessuno dei due è promesso da nessuna parte (solo "andamento nel tempo" lo è) -- erano una
      mia nota "da costruire" in una versione precedente di questo stesso punto, non un impegno
      preso con un cliente. Costruirli oggi vorrebbe dire o inventare una definizione di
      "retention" mai discussa con Gabriel, o cambiare il significato di `appuntamenti.stato` (un
      vero cambio al booking engine: serve una migrazione E una decisione su come lo staff marca
      un no-show dall'interfaccia) -- entrambe scelte che secondo CLAUDE.md/AGENTS.md richiedono
      il suo confronto prima, non dopo. Lasciati esplicitamente aperti sotto, non dimenticati.
      Verificato: query e struttura dati confermate corrette contro il database reale (tenant
      "Salone Test Fase1", piano growth, 5 appuntamenti reali nella finestra) via SQL diretto,
      `tsc`/`eslint`/`vitest` (201/201, +8 da questo giro)/`build` puliti (nuova rotta
      `/dashboard/analytics`).
- [x] **No-show: adesso si può segnare davvero** (17/09/2026). Lo stato `no_show` esisteva dalla
      migrazione 0001 nello schema, nel motore di prenotazione, nelle metriche e nei test -- ma
      NESSUNA schermata lo scriveva mai. Il tasso di no-show era strutturalmente zero in ogni
      punto che lo mostra, pannello di piattaforma compreso: un numero che non poteva essere
      diverso da zero, con l'aria di essere un dato. Ed è la promessa centrale del prodotto.
      Adesso sugli appuntamenti GIÀ FINITI compare "Non si è presentato" nel calendario, con
      l'annullamento accanto; lo può usare anche uno staff, perché è chi sta alla cassa a vedere
      che il cliente delle 15 non è arrivato. **Nessun pulsante "completato"**, di proposito: si
      marca solo l'eccezione. Chiedere di confermare a mano ogni appuntamento andato bene
      significa che dopo tre giorni nessuno lo fa più, e allora il dato è peggio di non averlo --
      sembra vero ed esprime solo chi si è ricordato di cliccare. Il tasso si calcola sul totale
      degli appuntamenti passati, che il database conosce già. Due test nello Scenario 11
      (marcatura e annullamento, e che su un appuntamento futuro il pulsante non ci sia).
      Resta aperta la sola definizione di "retention", sotto.
- [x] **Le assenze finiscono nella scheda del cliente** (17/09/2026, decisione di Gabriel): sulla
      pagina di un cliente compare "3 assenze su 12 appuntamenti già passati", solo quando ce n'è
      almeno una. È l'unico numero di quella pagina su cui un titolare agisce davvero -- decide
      se chiedergli una caparra o chiamarlo il giorno prima. Il denominatore sono gli
      appuntamenti PASSATI, non tutti, altrimenti tre prenotazioni future diluirebbero la
      percentuale da sole.
- [ ] **Retention e no-show reale** (separato da Analytics sopra il 14/09/2026, non erano promesse
      scritte sul sito): due decisioni da prendere PRIMA di scrivere codice, non durante --
      1) definire cosa vuol dire "retention" per un titolare (es. % di clienti con almeno 2
      prenotazioni confermate, o che tornano entro N giorni dalla precedente); 2) per il no-show
      reale, decidere se aggiungere uno stato `no_show` a `appuntamenti.stato` (richiede una
      migrazione sulla CHECK constraint, se esiste, da verificare) e COME lo staff lo marca
      dall'interfaccia (un bottone sul calendario per un appuntamento passato? automatico se
      "confermato" e mai spostato a "completato", che oggi non esiste nemmeno come stato?). Non
      urgente finché non ci sono clienti Growth paganti reali che lo richiedono esplicitamente.
- [x] ~~**Incassi previsti**~~ **CODICE FATTO 13/09/2026** (nuovo task, chiesto esplicitamente da
      Gabriel il 13/09/2026, DA NON confondere con la "Cassa"/registro incassi reale esclusa
      deliberatamente in DECISIONS.md): `src/lib/metriche.ts` oggi calcola solo
      `valorePrenotazioniOggiCentesimi` (guarda indietro/oggi, appuntamenti confermati di oggi) --
      manca una proiezione in AVANTI (somma prezzo dei servizi × appuntamenti confermati nei
      prossimi 7/30 giorni). Zero pagamenti reali, zero fiscalità: è puro calcolo su dati che il
      database ha già, stessa natura degli altri numeri in dashboard (punto 21) -- non ha nulla
      del rischio normativo della cassa esclusa in DECISIONS.md, quindi resta dentro il perimetro
      del prodotto. Aggiunto qui, non in Fase 6bis con la cassa. Implementato in
      `calcolaMetriche()` (due nuovi campi `incassiPrevistiCentesimi7Giorni`/`30Giorni`) + due
      nuove card in dashboard, test dedicato in `metriche.test.ts` (150/150 verdi).
- [x] ~~**Export CSV clienti**~~ **CODICE FATTO 13/09/2026** (nuovo task, secondo giro
      mega-controllo 12/09/2026): route `/dashboard/clienti/export` (GET, autenticata) genera un
      CSV con BOM UTF-8 (Excel su Windows non rompe gli accenti), rispettando gli stessi filtri
      `q`/`filtro=inattivi` già presenti in `/dashboard/clienti` -- "esporta quello che vedi".
      Formattazione CSV in una funzione pura dedicata (`src/lib/csv.ts`, escaping RFC 4180), 8
      test dedicati. **Import NON incluso**: leggere un CSV esterno richiede validazione, anteprima
      e gestione dei duplicati (telefono già esistente, righe malformate) -- lavoro non "contenuto"
      quanto l'export, resta da fare a parte.
- [x] ~~Raccolta recensioni post-appuntamento~~ **FATTA 16/09/2026**: email 2 ore dopo la fine
      dell'appuntamento (`ORE_ATTESA_RICHIESTA_RECENSIONE` in `src/lib/recensioni.ts`) con un
      link monouso per lasciare 1-5 stelle + commento facoltativo, mostrate poi sulla pagina
      pubblica del salone (sezione nuova in `/s/[slug]/page.tsx`, sparisce se il titolare spegne
      l'interruttore). Disponibile da **Free** in su (decisione di Gabriel: le recensioni si
      lasciano già su Google, nessun gate di piano). Decisioni di scope (16/09/2026, vedi
      DECISIONS.md per il dettaglio completo): verifica-visita (solo chi ha un appuntamento
      confermato riceve il link, come booking.com), una recensione per appuntamento (vincolo
      unique = link monouso), il titolare non può MAI modificare/cancellare una recensione (solo
      rispondere pubblicamente sotto) -- applicato anche a livello di permessi Postgres, non solo
      in codice (`authenticated` ha SOLO `select` su `recensioni`, stesso pattern già usato per
      `richieste_caparra`), nessun hide/delete per singola recensione, un solo interruttore per
      tenant che controlla insieme invio di nuove richieste E visibilità pubblica (mai
      separatamente). Programmazione via **Upstash QStash** (non Vercel Cron: il piano Hobby lo
      limita a una volta al giorno, non basta per un ritardo di poche ore calcolato per ogni
      singolo appuntamento) -- webhook dedicato con verifica della firma HMAC
      (`src/app/api/webhooks/qstash/richiedi-recensione/route.ts`), claim-before-send sullo
      stesso principio di `promemoria_appuntamento_inviati` per non mandare la stessa richiesta
      due volte su una doppia consegna QStash. Nuova migrazione `0026_recensioni.sql`. `tsc`/
      `eslint`/`vitest` (478/478, +9 da questo giro)/`build`/`playwright test --list` (18 test,
      invariato) puliti. **Non incluso in questo giro**: nessun nuovo scenario Playwright
      dedicato (richiederebbe simulare il trigger QStash e l'attesa delle 2 ore) -- verificato
      solo con test unitari sulla logica pura.
      **VERIFICATO DAL VIVO 16/09/2026** (Claude in prima persona via Chrome, richiesta esplicita
      di Gabriel, tenant "Salone Test Fase1"): prenotazione reale con l'email di Gabriel, QStash
      conferma la chiamata `publishJSON` riuscita (log Vercel, nessun errore) ma con `notBefore`
      reale a ~2h di distanza -- per non aspettare in sessione, pubblicato lo stesso identico
      messaggio JSON in modalità immediata dal Request Builder della console QStash (nessuna
      modifica al database: `elaboraRichiestaRecensione` non controlla affatto i timestamp
      dell'appuntamento, solo stato/toggle/email cliente). Email ricevuta e recensione lasciata
      da Gabriel stesso (5 stelle, commento) prima ancora che Claude completasse la verifica.
      Confermato via query dirette: claim `recensione_richiesta_inviata_at` scattato una sola
      volta, riga in `recensioni` corretta. Pagina pubblica: media "5 su 5 (1 recensioni)", nome
      in formato "Nome I." corretto. Link monouso: riaprendolo dopo l'invio mostra "Hai già
      lasciato una recensione", invio bloccato come da design. Risposta pubblica del titolare da
      dashboard NON verificata dal vivo in questo giro (nessun accesso disponibile all'account di
      quel tenant di test durante la sessione) -- UI semplice, stesso pattern già in uso altrove,
      rischio basso. Dati di test ripuliti dal database subito dopo (appuntamento e recensione di
      prova cancellati, email dell'account di test riportata al placeholder originale).

## Fase 4 -- Pagina pubblica, foto, PWA (punti 18, 19, 20)
- [x] Pagina pubblica per-salone generata automaticamente, condivisibile -- **scritta
      11/09/2026** (corretto qui il 12/09/2026, era rimasta indietro): `/s/[slug]`, loader in
      `src/lib/pagina-pubblica.server.ts`, flusso di prenotazione self-service completo
      (`FlussoPrenotazione.tsx`). Test automatici puliti (98/98). **VERIFICATA DAL VIVO
      14/09/2026** (trentunesimo giro, browser reale contro `salone-ai-saas.vercel.app`, tenant
      "Salone Test Fase1"): intero flusso (scegli servizio -> giorno -> slot reali -> dati cliente
      -> conferma) funziona, l'appuntamento finisce davvero sul DB, la pagina `/gestisci/[id]`
      mostra i dati giusti e applica la finestra minima di cancellazione. Trovato e corretto un
      bug reale nello stesso giro: il primo tentativo di conferma è fallito con "Attività non
      trovata" (blip di rete/cold-start verso Supabase in `risolviTenantIdDaSlug`, non un bug di
      logica -- nessuna scrittura parziale, il secondo tentativo identico è riuscito subito).
      Aggiunto un singolo retry in `risolviTenantIdDaSlug` (src/lib/ai/tools.ts), condiviso da
      tutti i punti di ingresso pubblici (chat AI, checkout caparra, le 4 server action di
      `azioni.ts`), attivo SOLO su un errore vero della query (mai su uno slug che semplicemente
      non esiste, altrimenti ogni URL sbagliato pagherebbe un retry inutile).
- [x] Widget chat AI mostrato SOLO se `tenant.piano` la include (vedi `src/lib/ai/limiti.ts`,
      `pianoHaAccessoAIChatWeb`) -- un salone Free/Starter non deve vedere nemmeno il box della
      chat, non un box che dice "non disponibile" (deciso con Gabriel il 02/09/2026). Il blocco
      lato server in `api/chat/[slug]/route.ts` resta comunque, indipendentemente da questo --
      qui è solo UX, non l'unica difesa. **Scritto 11/09/2026** (`ChatWidgetPubblico.tsx`),
      **verificato dal vivo 14/09/2026** insieme al punto sopra: la chat risponde con dati reali
      (prezzo/orari corretti). Trovata e corretta una rifinitura nello stesso giro: le risposte
      usavano markdown (`**grassetto**`) che il widget (testo semplice) mostrava con gli
      asterischi letterali -- aggiunta una regola assoluta al system prompt
      (`src/lib/ai/agente.ts`): mai markdown, solo testo semplice.
- [x] ~~Galleria/upload immagini (Supabase Storage)~~ **CODICE FATTO 16/09/2026** (le colonne
      `logo_url`/`cover_url` esistevano dallo schema iniziale ma senza nessun modo di caricarle,
      gap trovato mentre si riprendeva la Fase 4 con Gabriel dopo la verifica del promemoria di
      compleanno -- vedi DECISIONS.md, "2026-09-16 — Galleria foto: upload logo/copertina"). Nuovo
      bucket Storage `media-tenant` (migrazione `0024_storage_media_tenant.sql`, pubblico in
      lettura, scrittura riservata al proprio tenant via lo stesso helper `auth_tenant_id()` già
      usato per isolare tutte le altre tabelle -- limite 4MB, solo jpg/png/webp lato bucket).
      Percorso fisso senza estensione (`<tenant_id>/logo`, `<tenant_id>/cover`, upsert: un nuovo
      caricamento sovrascrive il precedente, niente file orfani) con cache-busting nell'URL
      salvato (altrimenti un browser/CDN continuerebbe a mostrare l'immagine vecchia dopo un
      nuovo upload, visto che il percorso non cambia mai). Nuova pagina staff
      `/dashboard/impostazioni/pagina-pubblica` (disponibile su TUTTI i piani, nessun gate: ogni
      salone ha una pagina pubblica fin dal piano Free), con upload/sostituzione/rimozione per
      logo e copertina, che alimentano `/s/[slug]` (già pronta a mostrarle da prima, mai
      collegata). Nessuna libreria di elaborazione immagini in questo giro (niente resize/crop
      server-side): scope tenuto volutamente piccolo, validazione solo su tipo/dimensione.
      10 nuovi test sul modulo puro di validazione (`src/lib/storage/media-tenant.ts`), 461/461
      totali, `tsc`/`eslint`/`build` puliti, bucket e policy applicati al database reale via
      `execute_sql` (`apply_migration` bloccato dal classificatore, stesso workaround di sempre).
      **VERIFICATO DAL VIVO 16/09/2026**: sessione della dashboard reale scaduta al momento del
      test (mai inserite credenziali di Gabriel, come da regola) -- verificato invece con un
      account di test creato ad hoc (`claude.test.galleria@example.com`, tenant "Salone Test
      Galleria"), su indicazione esplicita di Gabriel ("fai tu il login con un account test come
      hai sempre fatto"). Upload di logo e copertina riusciti dalla UI reale, entrambi confermati
      anche sulla pagina pubblica `/s/[slug]` (`<img>` caricate correttamente, URL con
      cache-busting corretto) e via query diretta su `tenants.logo_url`/`cover_url`. Tenant,
      profilo, utente auth e i due file nel bucket ripuliti da produzione subito dopo, come da
      prassi per ogni account di test. Dettaglio completo in DECISIONS.md.
- [x] ~~PWA installabile~~ **BASE FATTA 13/09/2026, rifinitura in Fase 7** (notifiche push
      ancora NON incluse -- richiedono un provider push + permesso utente, lavoro a parte):
      `src/app/manifest.ts` (file speciale dell'App Router, Next lo serve da solo su
      `/manifest.webmanifest` e collega da solo il `<link rel="manifest">`), `public/sw.js`
      (service worker minimo, SOLO per il criterio di installabilità di Chrome -- niente
      strategia di cache di proposito, per non rischiare di servire contenuto vecchio durante lo
      sviluppo attivo), icona placeholder generata nei colori del sito (noir + viola, non ancora
      il logo vero -- vedi `public/icons/`). `start_url` punta a `/dashboard` (chi installa è il
      titolare che lavora, non un cliente finale). Verificato dal vivo col server locale:
      `/manifest.webmanifest`, `/sw.js` e le icone rispondono 200, il tag `<link rel="manifest">`
      è presente nell'head. `tsc`/`eslint`/`vitest` (178/178, invariato)/`build` puliti.
- [x] ~~**Pagine legali (privacy/termini/cookie)**~~ **CODICE FATTO 14/09/2026** (trovato nel
      mega-controllo competitor del 12/09/2026: gap reale, il progetto non ne aveva nessuna, ogni
      concorrente verificato le ha). Tre pagine nuove, `/privacy` `/termini` `/cookie`, stessa
      identità dark/viola di `/accedi`/`/registrati` (componente condiviso
      `src/components/legale/PaginaLegale.tsx`), linkate dal footer della landing e, come
      promemoria informativo (non una checkbox obbligatoria -- passo successivo possibile, non
      fatto qui per non aggiungere attrito solo per creare le pagine mancanti), sopra il bottone
      di `/registrati`. Contenuto scritto sul comportamento REALE del codice (letti
      `booking-engine.server.ts`, `stripe/`, `email/mailjet.server.ts`, `ai/`, calendario Google),
      non un template generico: la Privacy distingue esplicitamente i due ruoli GDPR di Salone AI
      -- Titolare del trattamento per i dati di account/fatturazione dei titolari di attività,
      Responsabile del trattamento per conto loro sui dati dei LORO clienti finali (nome,
      telefono, storico appuntamenti) -- ed elenca i fornitori terzi reali (Supabase eu-west-1,
      Stripe, Mailjet, Google Calendar opzionale, WhatsApp/Meta quando attivo). La Cookie Policy
      dichiara solo il cookie di sessione tecnico di Supabase Auth: verificato nel codice che non
      esiste nessuno script di analytics/tracking/marketing in tutto il progetto, quindi
      **nessun banner di consenso necessario** (i cookie strettamente tecnici non lo richiedono
      per legge) -- se in futuro si aggiungerà analytics, questa pagina e il banner andranno
      aggiornati PRIMA, non dopo. **NON è consulenza legale**: il placeholder `[NOME_TITOLARE]`
      nella Privacy va completato da Gabriel quando avrà un'identità legale definita (oggi persona
      fisica senza P.IVA), e resta consigliato un controllo di un professionista prima di aprire i
      pagamenti veri a clienti reali -- non per sfiducia nel testo, ma perché il trattamento dei
      dati dei clienti finali dei saloni ha implicazioni GDPR reali che vanno oltre quello che un
      assistente AI può garantire da solo. `tsc`/`eslint`/`vitest` (193/193, invariato)/`build`
      puliti (3 nuove rotte statiche, nessuna dipendenza da Supabase).
- [x] **Notifiche email (conferma al cliente + avviso al titolare)** -- **CODICE FATTO
      13/09/2026** (vedi Gruppo B-bis punto 1 in cima al file per il dettaglio completo):
      provider Mailjet, agganciato dentro `creaAppuntamentoTenant`. Resta solo la parte che
      tocca a Gabriel (Gruppo A punto 9): validare un mittente su Mailjet + applicare la
      migrazione `0015_email_cliente_caparra.sql`.
- [x] **Gestione della prenotazione lato cliente -- SOLO cancellazione, CODICE FATTO 13/09/2026**
      (il "sposta" resta da fare, vedi sotto): nuova pagina pubblica `/gestisci/[id]` (nessun
      login, stesso modello di sicurezza di Calendly/Google Calendar -- il possesso dell'id
      dell'appuntamento, un UUID v4 non indovinabile, ricevuto SOLO via il link nell'email di
      conferma), con un pulsante di cancellazione a doppia conferma. Riusa
      `cancellaAppuntamentoTenant` (punto 9 di CLAUDE.md, stessa funzione di dashboard/AI/pubblico)
      -- la cancellazione lato cliente attiva quindi GRATIS anche la lista d'attesa automatica già
      esistente. Link aggiunto nell'email di conferma cliente (`notifiche.server.ts`), con
      `NEXT_PUBLIC_SITE_URL` o fallback sugli header della richiesta, omesso del tutto se
      nessuno dei due è disponibile (mai un link rotto). 2 nuovi test in
      `notifiche.server.test.ts`. ~~**"Sposta" (riprogrammare) NON incluso**: richiede un vero
      selettore di slot liberi (la stessa UI del flusso di prenotazione pubblica) -- lavoro a
      parte, non "contenuto" come la sola cancellazione.~~ **"Sposta" -- vedi voce dedicata più
      sotto per il dettaglio, CODICE FATTO 15/09/2026.** **Verifica dal vivo limitata dalla
      sandbox**: `tsc`/`eslint`/`vitest` (178/178)/`build` puliti, e la query è verificata
      correttamente contro il database reale via SQL diretto (join risolti, dati completi per un
      appuntamento di test vero) -- ma un `curl` alla pagina vera dal server dev locale di questa
      sandbox fallisce con "Host not in allowlist" (le chiamate dirette a Supabase dalla rete di
      questa sandbox sono bloccate, limite già noto per altri strumenti, diverso da un bug reale).
      **Confermato da Gabriel il 14/09/2026**: click reale sul link ricevuto per email, verificato
      funzionante end-to-end in un browser vero. Chiuso il limite di verifica sopra.
      **Aggiunta 14/09/2026, richiesta esplicita di Gabriel**: la cancellazione online ora rispetta
      una finestra minima decisa dal titolare (`tenants.ore_minime_cancellazione`, migrazione
      `0016_finestra_cancellazione.sql`, default 24h, 0 = nessun limite) -- sotto quella soglia il
      link mostra il numero di telefono dell'attività invece del bottone, con l'invito a chiamare.
      Regola pura e testata in `src/lib/finestra-cancellazione.ts` (5+3 test), applicata sia come
      controllo autorevole in `gestisci/[id]/azioni.ts` sia in anteprima in `page.tsx` (per
      nascondere subito il bottone, stesso principio del doppio controllo già usato altrove --
      un link riaperto da cache non deve mai bypassare la regola vera). Configurabile da una
      nuova pagina `/dashboard/impostazioni/cancellazione`, che salva anche il numero di telefono
      dell'attività: girando il codice è emerso che `tenants.telefono` (colonna già esistente,
      usata sulla pagina pubblica) non aveva NESSUNA pagina delle impostazioni da cui modificarlo
      -- gap onestamente segnalato e sistemato nello stesso giro, era il punto più naturale visto
      che è esattamente il numero che serve perché questa funzionalità sia utile. Migrazione
      applicata al database reale il 14/09/2026 (primo tentativo bloccato dal classificatore di
      sicurezza della sandbox, riprovato su richiesta esplicita di Gabriel -- vedi Gruppo A punto
      10). `tsc`/`eslint`/`vitest` (193/193, +15 da questo giro)/`build` puliti.
- [x] **Gestione della prenotazione lato cliente -- "Sposta" (riprogrammare)** -- **CODICE FATTO
      15/09/2026** (vedi DECISIONS.md, "Fase 4: spostamento self-service"): completa il punto
      sopra, bottone `ModuloSpostamento.tsx` sopra il modulo di cancellazione su `/gestisci/[id]`,
      stesso modello di sicurezza (nessun login), stesso operatore/servizio dell'appuntamento
      originale -- il cliente sceglie solo un nuovo giorno/orario, non un nuovo trattamento. Riusa
      `trovaSlotEStatoGiornoTenant`/`modificaAppuntamentoTenant` (punto 9 di CLAUDE.md, stessa
      ricerca/scrittura di dashboard/AI/pubblico). Anti-abuso (scelta di Gabriel del 14/09/2026,
      tra le opzioni proposte) = stessa finestra minima di ore della cancellazione
      (`ore_minime_cancellazione`, riusata direttamente non riscritta) + massimo 1 spostamento per
      appuntamento (nuovo contatore `appuntamenti.spostamenti_effettuati`, migrazione `0022`,
      applicata al database reale via `execute_sql` dopo che `apply_migration` è stato bloccato dal
      classificatore, stesso limite già noto). 10 test nuovi in `finestra-spostamento.test.ts` + 2
      in `booking-engine.server.test.ts` (433/433 totali), `tsc`/`eslint`/`build` puliti.
      **VERIFICATO DAL VIVO 16/09/2026** dopo il push/deploy di Gabriel, su un tenant di test
      dedicato ("Test Sposta"): primo spostamento riuscito (nuovo orario scelto, messaggio di
      conferma corretto, `spostamenti_effettuati` passato da 0 a 1 verificato via query diretta);
      secondo tentativo sulla stessa pagina ricaricata correttamente bloccato dal tetto di 1
      spostamento, messaggio giusto mostrato al posto del bottone. **Fase 4 chiusa**. Tenant di
      prova ripulito da Supabase. Dettaglio completo in DECISIONS.md, "16/09/2026 — Fase 4
      verificato dal vivo, chiusa".
- [x] **Condividi la tua pagina (link + QR code)** -- **CODICE FATTO 15/09/2026** (richiesta
      esplicita di Gabriel: "serve un modo per condividere il link del proprio negozio sui siti
      come Google o sulla pagina Instagram"). Prima di oggi la dashboard mostrava lo slug come
      testo grezzo ("Slug pagina pubblica: xyz"), inutilizzabile da incollare in un profilo Google
      Business o in una bio Instagram. Ora: riquadro nella home della dashboard con il link
      completo copiabile (bottone "Copia", clipboard) e un QR code scaricabile come PNG (bottone
      "Scarica"), pensato per una storia/post Instagram o per la stampa in negozio. QR generato
      SERVER-SIDE (`src/lib/qrcode.server.ts`, libreria `qrcode`, nessun `<canvas>` richiesto in
      Node) e passato già pronto come data URL al componente client (`CondividiLink.tsx`), che si
      occupa solo di clipboard/download -- niente libreria QR nel bundle browser. URL costruito
      con `urlBaseSito()` (già esistente in `notifiche.server.ts`, riusato invece di reinventarlo,
      stessa funzione già usata per il link nell'email di promemoria). 2 nuovi test
      (`qrcode.server.test.ts`), suite completa `npx vitest run` (410/410), `tsc --noEmit`,
      `eslint`, `npm run build` tutti puliti.

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
      `stato_abbonamento`), `/api/stripe/portal` (Customer Portal self-service). 14 test verdi.
      **CORREZIONE 14/09/2026: la riga "chiavi sandbox reali già configurate" qui sopra era
      sbagliata** -- controllato solo ora, in produzione su Vercel non c'era NESSUNA chiave Stripe
      (`STRIPE_SECRET_KEY` e i tre `STRIPE_PRICE_*` mancavano del tutto). Sistemato: webhook creato
      su Stripe, tutte le chiavi impostate su Vercel, **e verificato dal vivo con un pagamento di
      test reale in test-mode fino in fondo** (checkout completato, `piano`/`stato_abbonamento`/
      `stripe_subscription_id` scritti per davvero dal webhook, poi cancellazione testata anche
      quella e riportata correttamente a `free`/`cancellato`). Vedi PROJECT_STATUS.md per il
      dettaglio. Resta da fare solo quando si aprono i pagamenti veri: stessa procedura in modalità
      live (chiavi `sk_live_...`, webhook live, price ID live) -- oggi tutto test-mode, zero soldi
      veri.
- [x] ~~Pannello admin per te: saloni, abbonamenti, utilizzo, interventi manuali quando serve --
      zero codice.~~ **CODICE FATTO 16/09/2026**: `/admin`, protetto da
      `profiles.ruolo = 'admin_piattaforma'` -- il ruolo esisteva nello schema dalla migrazione
      0001 ma non era mai stato controllato da nessuna parte, questo è il primo posto che lo usa
      (`eAdminPiattaforma` in `src/lib/ruoli.ts`). Mostra TUTTE le attività registrate con piano,
      stato abbonamento, data di registrazione, email dei titolari, numero di membri/operatori/
      clienti e appuntamenti totali + ultimi 30 giorni, con ricerca e quattro totali di
      piattaforma in cima. Legge con il service_role (RLS mostrerebbe solo l'attività attiva di
      chi guarda): `src/lib/admin.server.ts`, tipi puri separati in `src/lib/admin.ts` perché un
      componente client non può importare un valore da un modulo "server-only".
      **Intervento manuale sul piano** (migrazione `0028_piano_manuale.sql`): il webhook Stripe
      resta "unica fonte di verità", ma esistono due casi in cui Stripe non sa nulla del piano --
      Enterprise è a preventivo e non passa mai dal checkout, e gli account omaggio/demo non
      hanno un abbonamento. La nuova colonna `tenants.piano_manuale` a true fa sì che il webhook
      lasci stare piano e stato di quel tenant e continui a fare tutto il resto (guardia in
      `sincronizzaAbbonamento` e nel ramo `checkout.session.completed`). Deliberatamente NON una
      seconda colonna da leggere al posto di `piano`: `piano` resta l'unico campo che tutto il
      codice legge, quindi non c'è nessun punto del progetto in cui ci si possa dimenticare
      dell'override. Il pannello mostra l'etichetta "manuale" su quei tenant e ha il pulsante per
      ridare il controllo a Stripe. `profiles.ruolo` di Gabriel messo a `admin_piattaforma` sul
      database reale nella stessa sessione (la sua dashboard non cambia:
      `normalizzaRuolo('admin_piattaforma')` restituisce 'owner').
      **Non incluso di proposito**: nessuna impersonificazione ("entra come questo salone"). È la
      funzione più comoda di un pannello del genere ed è anche la più pericolosa -- un bug lì
      vale l'accesso completo a qualunque attività, e per assistere i primi clienti bastano i
      dati letti da qui. Da rivalutare quando il supporto sarà un lavoro vero.
      **Non verificato dal vivo**: nessun giro nel browser su produzione (la pagina compila, le
      migrazioni sono applicate al database reale, ma il pannello non è ancora stato aperto).
- [x] **Pannello admin: metriche vere e cambio piano che tocca Stripe -- CODICE FATTO
      17/09/2026** (due richieste esplicite di Gabriel del 16/09/2026: "aumenta le analytics che
      ho, la mia facciata admin deve essere molto molto utile" e "qualcosa che faccia decidere a
      me se modificare Stripe quando modifico l'abbonamento, così non devo cancellarlo o aprire
      Stripe").

      **Difetto trovato e chiuso nello stesso giro**: la stima dei ricavi contava come pagante
      qualunque attività con `stato_abbonamento = 'attivo'`, compresi gli account a cui il piano
      era stato assegnato a mano dal pannello -- cioè quelli che NON pagano. Adesso il ricavo
      richiede anche un `stripe_subscription_id`, e gli omaggio compaiono contati a parte. Era il
      modo peggiore in cui quel numero potesse sbagliare: restando credibile.

      **Metriche aggiunte** (`src/lib/admin-metriche.ts`, puro e testato -- 13 test; più 10
      nuovi in `admin.test.ts`): composizione del MRR fra prezzo dei piani e quota per operatore
      (dice se il modello per posto sta funzionando), ARPA, MRR per piano, **concentrazione** sul
      cliente più grande e **MRR a rischio** (le paganti con un segnale grave: i segnali
      diventano soldi, che è ciò che fa agire); **imbuto di attivazione** a quattro gradini
      (iscritte -> configurate -> con prenotazioni -> paganti) con mediana dei giorni alla prima
      prenotazione -- con pochi clienti è la metrica più utile che esista, il MRR dice poco
      mentre "otto iscritte, sei configurate, due con una prenotazione vera" dice dov'è rotto il
      prodotto; **coorti per mese di iscrizione** con quante sono ancora vive; **serie a 12
      settimane** delle prenotazioni divise fra assistente AI e inserimento manuale; e i numeri
      di prodotto (quota AI, no-show, cancellazioni, conversazioni passate a una persona, media
      recensioni). Nuovo segnale per riga: "paga per l'AI ma non l'ha mai usata" (>= 10
      prenotazioni, zero dall'assistente, su Growth/Pro) -- è il profilo che disdice al rinnovo, e
      si vede con mesi di anticipo.

      Due regole rispettate ovunque: **nessuna percentuale senza il suo valore assoluto** accanto
      (con dieci saloni "il 30%" vuol dire "tre", e la percentuale da sola fa sembrare statistica
      quella che è aritmetica su numeri piccoli), e **nessun dato personale** -- si contano
      conversazioni e appuntamenti, non si legge mai chi li ha fatti né cosa contengono. Colori
      del grafico: coppia blu/arancio della palette categorica standard, verificata per il
      daltonismo con lo script del caso (ΔE 24.7 protanopia) invece che scelta a occhio.
      Letture invariate: appuntamenti letti UNA volta sola per righe e metriche insieme
      (`caricaPannelloPiattaforma`), non due.

      **Cambio piano con Stripe** (`src/lib/stripe/cambio-piano.server.ts`): tre principi, nessuno
      negoziabile. (1) Prima di qualunque scrittura c'è un'anteprima che mostra riga per riga cosa
      paga adesso quel salone e cosa pagherebbe dopo, con le cifre lette DA STRIPE e non dal
      listino salvato in `admin.ts` -- se i due non coincidessero, quello che il cliente vede
      addebitato è il primo. Finché l'anteprima non è stata letta, il pulsante di conferma resta
      disabilitato. (2) Se il cambio fa pagare di PIÙ, la UI lo dice a chiare lettere: un aumento
      va concordato col cliente, non applicato da un pannello. Il codice non lo impedisce (una
      correzione concordata al telefono è legittima) ma non lo lascia passare in silenzio. (3)
      Portare un'attività a Free o Enterprise non cancella l'abbonamento di colpo: imposta
      `cancel_at_period_end`, così il servizio resta al cliente fino alla data che ha pagato e
      l'operazione si annulla ancora. Si sceglie anche QUANDO: conguaglio subito o dal prossimo
      rinnovo. Quando si allinea Stripe, `piano_manuale` viene SPENTO (i due sistemi ora
      concordano) e lo stato non è quello scelto nel menu ma quello che Stripe riporta. Se Stripe
      rifiuta, il database non viene toccato -- qui niente fail-open, al contrario della
      sincronizzazione degli operatori: là un errore non doveva impedire di creare un operatore
      vero, qui l'azione ERA toccare Stripe. Tutto finisce nel registro interventi con le cifre
      prima/dopo. Nuovo Scenario E2E 22, due test simmetrici: quello che tocca Stripe è verificato
      anche sul database, quello che NON deve toccarlo è verificato anche su Stripe (che sia
      rimasto identico byte per byte).

      **Effetto collaterale già emerso**: il registro degli interventi si riempie di righe che
      contengono i nomi delle attività, e gli scenari 20 e 21 cercavano un `<li>` per testo --
      hanno smesso di passare appena il registro ha cominciato a riempirsi. Risolto con
      `data-testid="elenco-attivita"`. Vale la pena ricordare che quel registro si sporca a ogni
      run dei test E2E, perché girano sul database vero: è un argomento in più per il database di
      test separato, già in Fase 6ter.

- [x] ~~**"1 operatore" sul piano Free pubblicizzato ma non applicato tecnicamente**~~ **CODICE
      FATTO 13/09/2026** (trovato nel controllo promesse del sito 13/09/2026): aggiunta
      `limiteOperatori(piano)` in `src/lib/piani.ts` (stessa forma di `limiteMensilePrenotazioni`),
      applicata in `creaOperatore` (`dashboard/configura/azioni.ts`) prima dell'insert -- un tenant
      Free che prova a creare un secondo operatore riceve un errore esplicito invece che
      silenziosamente riuscirci. **Limite onesto**: la pagina `/dashboard/configura` è "Server
      Component puro" per scelta (vedi commento in testa al file, passata di design vera in Fase 7)
      -- nessun messaggio d'errore dei form viene mostrato a schermo oggi (vale per TUTTE le azioni
      di questa pagina, non solo questa: `creaServizio` ha lo stesso limite). L'inserimento viene
      comunque bloccato lato server (la promessa è tecnicamente rispettata), ma il titolare Free
      non vede ancora scritto IL PERCHÉ finché la pagina non avrà un vero stato d'errore. 3 nuovi
      test in `piani.test.ts` (161/161 verdi).
- [x] **Tono dell'AI personalizzabile -- CODICE FATTO 13/09/2026** (trovato nel mega-controllo
      del 12/09/2026, vedi `docs/analisi-concorrenti-mercato.md`): `Prezzi.tsx` pubblicizza
      "Tono dell'AI personalizzabile" su Pro -- costruito guidato a 3 opzioni fisse
      (professionale/amichevole/informale con emoji, `docs/analisi-estetia.md` punto 3: più
      accessibile di un prompt libero) + una nota libera opzionale (max 300 caratteri,
      sanitizzata e incorniciata nel system prompt come non-sovrascrivente delle regole
      assolute). Migrazione `0012_tono_ai.sql` applicata al database reale, colonna su
      `tenants` (`tono_ai`, `tono_ai_nota`), UI in `/dashboard/impostazioni/tono-ai` (gate di
      piano Pro/Enterprise sia in UI sia nella server action), iniezione nel system prompt di
      `agente.ts`, gate ricontrollato anche in `api/chat/[slug]/route.ts` prima di applicarlo
      (mai fidarsi solo del valore salvato). `tsc`/`eslint`/`vitest` (125/125, +6 test su
      `agente.test.ts` + 1 su `limiti.test.ts`)/`build` puliti. Non ancora verificato dal vivo
      con un salone di test reale (nessun cliente Pro reale ancora, coerente con "non bloccante
      finché Stripe non è verificato dal vivo").
- [x] ~~**BLOCCANTE prima di vendere Enterprise a un cliente vero** (stesso problema del Tono AI,
      trovato nel secondo giro del mega-controllo, 12/09/2026): `Prezzi.tsx` pubblicizza
      "Multi-sede e ruoli avanzati" su Enterprise, ma nello schema non esiste NESSUN concetto di
      "sede" (un tenant è un unico luogo fisico) e la colonna `profiles.ruolo` (owner/staff/
      admin_piattaforma) non è controllata da nessuna parte del codice -- ogni account che entra
      in dashboard ha accesso pieno, non esiste un vero "staff" con permessi limitati.~~
      **CODICE FATTO 16/09/2026** (migrazione `0027_membri_tenant.sql`). Chiude anche
      "Multi-utente/team reale" di Fase 6, che era il prerequisito dei ruoli: un lavoro solo
      invece di due.

      **Decisione sul multi-sede, presa con Gabriel il 16/09/2026** dopo che lui ha chiesto la
      cosa giusta ("qual è la cosa che funziona meglio per il cliente, quella che gli fa
      scegliere noi e non un competitor?"): una catena con più negozi NON diventa un tenant con
      dentro tante "sedi", ma resta più tenant separati collegati a un unico account che ci passa
      in mezzo con un selettore. Tre ragioni, in ordine di peso:
      1) `auth_tenant_id()` è il perno di OGNI policy RLS del progetto -- restando "un tenant = un
         luogo", quella funzione e tutte le policy esistenti non vengono toccate: zero rischio di
         aprire un buco di isolamento sui dati già in produzione;
      2) è come lavorano davvero due negozi della stessa catena (orari propri, personale proprio,
         numero di telefono proprio), e ogni sede mantiene la SUA pagina pubblica `/s/[slug]` con
         il suo indirizzo -- due pagine indicizzabili su Google invece di una sola con un menu a
         tendina;
      3) la versione "vera" (tabella `sedi` + `sede_id` su orari/operatori/servizi/appuntamenti +
         scelta della sede nel booking engine, nella pagina pubblica e nell'AI) sarebbe la
         migrazione più invasiva mai fatta sul progetto, sul codice più delicato e testato, per un
         piano che oggi è a preventivo, senza checkout Stripe e senza un solo cliente.
      Nota commerciale messa a verbale nella stessa conversazione: il multi-sede NON è il motivo
      per cui un cliente sceglie Salone AI -- è una casella da spuntare per non essere scartati a
      priori. Chi ha 2+ sedi oggi sta su Fresha o Booksy, che ce l'hanno maturo da anni e gratis.
      Il differenziale vero resta l'assistente AI e zero commissioni.
      **Limite dichiarato e accettato**: niente report aggregati fra sedi e niente rubrica clienti
      condivisa fra sedi. Si aggiungono sopra questa stessa struttura il giorno in cui un cliente
      vero li chiede, non prima.

      **Cosa è stato costruito**: tabella `membri_tenant(user_id, tenant_id, ruolo)` con backfill
      da `profiles` (3 righe sul database reale, tutte owner, verificate dopo l'applicazione) più
      `inviti_membro` per far entrare una seconda persona. `profiles.tenant_id` non cambia
      significato per il database -- resta quello che RLS legge -- e diventa "la sede attiva" per
      l'applicazione: cambiare sede è aggiornare quella colonna dopo aver verificato
      l'appartenenza. `profiles.tenant_id` reso nullable: serve perché un dipendente rimosso che
      non fa parte di nient'altro resti davvero senza accesso (con `auth_tenant_id()` a null ogni
      policy confronta `tenant_id = null`, che non è mai vero -- nessuna policy toccata).
      Gli inviti NON passano dai metadata di `auth.signUp`, che li sceglie il browser di chi si
      registra: chiunque potrebbe registrarsi dichiarando "sono staff del tenant X". Una riga di
      invito può nascere solo da una server action eseguita da un owner ed è legata all'email, che
      Supabase verifica. Il trigger `gestisci_nuovo_utente` controlla se esiste un invito valido
      per quell'email PRIMA di creare una nuova attività -- senza, ogni dipendente invitato si
      ritroverebbe un salone fantasma vuoto collegato al proprio account. Chi ha già un account
      trova l'invito in cima alla dashboard, da accettare.
      Nessuna policy di scrittura su `membri_tenant`/`inviti_membro`, di proposito: ogni scrittura
      passa dal service_role in `src/lib/membri.server.ts` dopo un controllo di ruolo, così un
      client autenticato non può aggiungersi a un'attività né promuoversi da staff a owner
      chiamando direttamente le API REST di Supabase.

      **Permessi dello staff, scelti da Gabriel il 16/09/2026** (`src/lib/ruoli.ts`, logica pura,
      9 test in `ruoli.test.ts`). Uno staff NON vede fatturato e analytics (è il motivo più citato
      dai titolari per cui non danno un accesso ai dipendenti sugli altri gestionali: preferiscono
      non darlo affatto), NON tocca servizi/prezzi/orari/impostazioni (un prezzo cambiato per
      sbaglio si propaga su pagina pubblica, AI e caparre), NON gestisce abbonamento e
      fatturazione, e NON esporta l'intera rubrica clienti in CSV (aggiunto da Claude e segnalato:
      guardare i clienti dentro il prodotto e portarsi via il database in un file sono due cose
      diverse). Uno staff PUÒ vedere e gestire l'agenda di TUTTI gli operatori, deciso
      esplicitamente contro l'alternativa "solo la propria": in un salone piccolo chi è alla cassa
      risponde al telefono e deve poter prenotare per la collega.
      `normalizzaRuolo` fa cadere qualunque valore non riconosciuto su 'staff' (concedere MENO
      potere, mai di più) e tratta `admin_piattaforma` come owner della propria attività.
      **Dove il permesso è applicato davvero**: `richiediPermesso` in `src/lib/permessi.server.ts`,
      dentro ogni server action di configurazione e impostazioni (13 file), nelle route Stripe
      checkout/portal, nell'export CSV clienti e nel collegamento Google Calendar. I `layout.tsx`
      su `/dashboard/impostazioni` e `/dashboard/analytics` e la vista di sola lettura su
      `/dashboard/configura` sono comodità, non sicurezza: una server action è un endpoint POST
      richiamabile da chiunque abbia una sessione valida, anche senza mai aprire la pagina.
      Trovati e chiusi nello stesso giro due punti che non avevano NESSUN controllo applicativo e
      si affidavano solo a RLS: `eliminaServizio` e `impostaAssociazioneOperatoreServizio`.

      **Gate di piano -- la conclusione è "nessun gate", e ci si è arrivati per gradi** nella
      stessa sessione: prima si era ipotizzato Pro in su, poi Gabriel ha detto Growth, poi ha
      cambiato impostazione decidendo la quota per operatore su tutti i piani (vedi il task sulla
      asimmetria Starter sotto). Con il personale già monetizzato lì, mettere ANCHE un tetto agli
      accessi vorrebbe dire far pagare due volte la stessa cosa e frenare esattamente ciò che
      l'add-on per operatore serve a vendere. Quindi `limiteMembri` limita **solo Free** a un
      accesso (è già un piano da una persona sola: un operatore, 60 prenotazioni al mese) e tutti
      i piani a pagamento hanno accessi liberi. La voce è su Starter in `Prezzi.tsx`, ereditata a
      cascata dagli altri.
      Resta agli atti la risposta alla domanda di Gabriel ("ma il margine rimane alto?"), perché
      vale anche per decisioni future: **un accesso in più non incide sul margine**. Gli utenti
      Supabase Auth sono gratis a questi volumi, e i costi reali -- messaggi AI, SMS Skebby, email
      Mailjet, cron -- scalano con appuntamenti e operatori, non con quante persone fanno login.
      Qualunque gate sugli accessi sarebbe stato una leva di prezzo, mai una difesa di costo.
      **Comportamento in downgrade** (vale per Free, e per qualunque tetto futuro): si conta e si
      blocca solo il PROSSIMO invito, non si rimuove mai nessuno. Togliere di colpo l'accesso a un
      dipendente che sta lavorando sarebbe un danno al salone, non una difesa del ricavo.
      Fail-open sulla lettura del piano, come in `creaOperatore`.
      **Multi-sede solo su Enterprise** (Gabriel, 16/09/2026): nessun gate tecnico, di proposito.
      Non esiste alcun modo self-service di creare una seconda attività -- la collega Gabriel a
      mano in fase di onboarding -- quindi un controllo di piano difenderebbe una porta che non
      c'è. Se un giorno si aggiunge un pulsante "crea un'altra attività", quel gate va messo
      CONTESTUALMENTE, altrimenti si apre anche un buco sul piano Free (N attività gratuite da 60
      prenotazioni ciascuna per lo stesso account).

      **Scenari E2E scritti il 16/09/2026, DA ESEGUIRE** (`npm run test:e2e`, servono `.env.local`
      e rete verso Supabase/Stripe): 16 fatturazione dell'operatore extra, 17 cambio piano con
      sostituzione dell'add-on, 18 multi-sede e isolamento dei dati fra sedi, 19 permessi del
      collaboratore (più la controprova sul titolare, indispensabile: senza, un bug che blocca
      TUTTI farebbe passare lo scenario a pieni voti). Nuovi helper
      `abbonamento-di-prova.ts` (abbonamento Stripe vero in test-mode, creato con
      `payment_behavior: "default_incomplete"` -- ha line item veri senza metodo di pagamento e
      senza muovere un centesimo) e `membri-di-prova.ts`.
      `playwright.config.ts` ora legge `PLAYWRIGHT_CHROMIUM_PATH`, per ambienti che hanno già un
      Chromium e non devono scaricarne un altro; sulla macchina di Gabriel la variabile non esiste
      e non cambia nulla.
      **Perché non li ho eseguiti io**: la sandbox cloud e la VM collegata al Mac hanno entrambe un
      allowlist di rete che blocca `weeaggiqovnmtovdjzxy.supabase.co`, `api.stripe.com` e
      `api.mailjet.com` (verificato: CONNECT rifiutato con 403). Nella VM inoltre i `node_modules`
      sono compilati per macOS, quindi vitest non parte nemmeno. `npx tsc --noEmit` eseguito sul
      Mac dopo il merge: pulito.
      **Non verificato dal vivo**: nessun giro nel browser (invito reale, accettazione, cambio
      sede, dipendente che prova ad aprire le impostazioni, upsell del team su un tenant non Pro).
      `tsc`/`vitest` (493/493, +15 da questo giro)/`build` puliti; `eslint` riporta 9 errori
      preesistenti in `src/components/primitives/` (file non toccati in questo giro). Migrazioni
      0027 e 0028 applicate al database reale, backfill verificato con query dirette (3 profili ->
      3 appartenenze, tutte owner) e `profiles.ruolo` di Gabriel portato a `admin_piattaforma`.

- [x] ~~**Asimmetria di margine su Starter**: "Operatori illimitati" a 19,90€/mese a prescindere
      da quanti sono -- la stessa asimmetria "chi genera il costo non è chi lo paga" chiusa su Pro
      il 14/09/2026, rimasta aperta su Starter.~~ **DECISA E IMPLEMENTATA 16/09/2026**, stessa
      sessione in cui è stata trovata: la quota per operatore si estende a tutti e tre i piani a
      pagamento. **10€ Starter, 15€ Growth, 20€ Pro**, sempre con il primo operatore incluso nel
      prezzo base. Gli operatori restano illimitati come numero da Starter in su (il tetto a 1
      resta solo su Free): quello che scala è il prezzo, non un limite.
      **Onestà sul perché**: su Starter e Growth NON c'è nessun costo SMS da recuperare
      (`PIANI_CON_SMS` è solo pro/enterprise), quindi quelle due quote sono quasi interamente
      margine. Non è recupero di costo come su Pro, è cattura di valore per posto di lavoro --
      lo stesso modello di Booksy, che fa pagare per operatore già dal piano d'ingresso. Le cifre
      sono più basse proprio perché il costo sottostante non c'è.
      **Numeri tondi, non civetta** (Gabriel aveva proposto 9,99/14,99/19,99, poi ha scelto i
      tondi): il prezzo civetta serve sul cartellino, cioè sul prezzo base, dove il cliente
      confronta a colpo d'occhio -- e lì c'è già (19,90/39,90/89,90). Sull'add-on serve la
      leggibilità, perché viene MOLTIPLICATO: 4 operatori a 19,99€ fanno 79,96€, un numero che il
      cliente deve calcolare e che nessuno ripete in trattativa; a 20€ fanno 80€. Stessa scelta di
      Booksy (base 29,99$, operatore aggiuntivo 20$ tondi). Da non "sistemare" in futuro mettendo
      i ,99 per coerenza: la coerenza giusta è base civetta + unità tonda.
      **Implementazione**: `priceIdOperatoreExtra(piano)` e `tuttiPriceIdOperatoreExtra()` in
      `stripe/piani.ts` (al posto di `priceIdOperatoreExtraPro`), checkout e
      `sincronizzaQuantitaOperatoriStripe` aggiornati, 5 test nuovi. Il pezzo delicato è il CAMBIO
      PIANO: chi passa da Starter a Growth con 4 operatori si porta dietro la riga "operatore
      extra Starter" a 10€, che va riconosciuta e SOSTITUITA con quella da 15€, non affiancata --
      altrimenti continua a pagare la quota vecchia o si ritrova due add-on sulla stessa fattura.
      È il motivo per cui `tuttiPriceIdOperatoreExtra` esiste.
      **Ancora da fare, blocca l'attivazione ma non il codice**: Gabriel deve creare su Stripe due
      prodotti/prezzi nuovi -- `Starter - Operatore extra` (10,00€/mese) e `Growth - Operatore
      extra` (15,00€/mese), stessa forma di `Pro - Operatore extra`
      (`price_1UFYAXCTPsGON8WAVPINXkXj`, 20,00€/mese): prezzo ricorrente mensile in EUR, prodotto
      separato, nessuna fascia di quantità. Poi vanno in
      `STRIPE_PRICE_STARTER_OPERATORE_EXTRA`/`STRIPE_PRICE_GROWTH_OPERATORE_EXTRA`. Finché quelle
      variabili non esistono, `priceIdOperatoreExtra` restituisce null e quei due piani
      semplicemente non applicano la quota, senza errori. Claude non può creare oggetti su un
      account Stripe (vedi il commento in testa a `stripe/piani.ts`: azione bloccata da un
      classificatore di sicurezza, e passare dal browser invece che dall'API sarebbe aggirare quel
      blocco, non rispettarlo).

- [ ] **Riquadro di upsell Starter -> Growth dentro la dashboard** (idea di Claude accettata da
      Gabriel il 16/09/2026, non ancora costruita): il momento giusto per vendere l'assistente a
      un cliente Starter è subito dopo che ha risposto LUI a mano a una richiesta -- lì gli si
      mostra cosa avrebbe risposto l'AI al posto suo. Converte più di qualunque tabella prezzi
      perché arriva mentre sta facendo la fatica che l'AI gli toglierebbe.
      Da progettare con attenzione su un punto: mostrare una risposta AI vera costa una chiamata
      al modello per un tenant che l'AI non la paga -- va deciso se vale (probabilmente sì, è
      marketing a pochi centesimi) o se basta un esempio statico ben scritto.
- **Vincolo di prodotto, non un task** (deciso 16/09/2026): a Starter non va data MAI "un po' di
  AI", nemmeno una quota simbolica di messaggi omaggio. L'AI è l'unica linea netta della scala dei
  piani e, a differenza di tutto il resto, ha un costo per messaggio: diluirla toglie a Starter la
  sua identità e a Growth la sua ragione. Linea dura più una demo, mai una quota simbolica.

- [ ] **Starter: tenerlo, ma con la scheda giusta** -- decisione di Gabriel del 16/09/2026, contro
      il mio consiglio di cancellarlo. La sua motivazione ("è il piano con più margine") non regge
      da sola e va corretta in fase di vendita: il margine percentuale non è il profitto. Starter
      al 95% lascia ~18,90€/mese, Growth anche stimando l'80% ne lascia ~31,90€: Growth rende il
      70% in più per cliente. Quello che si incassa è margine × prezzo × numero di clienti, e
      Starter ottimizza solo il primo dei tre fattori.
      **Le due ragioni vere per tenerlo, entrambe solide**: intercetta chi a 39,90€ non pagherebbe
      affatto (0€ -> 18,90€ è sempre meglio), ed è una destinazione di DOWNGRADE invece che di
      abbandono -- chi lascia Growth atterra su Starter anziché cancellare.
      **Correzione a un'obiezione mia, sbagliata**: avevo scritto che Starter senza AI non ha armi
      contro Fresha. Falso: Fresha gratis non lo è davvero, monetizza su commissioni e marketplace
      e spinge i clienti dentro il suo. "Zero commissioni, i tuoi clienti restano tuoi" è un
      differenziale vero anche senza AI, ed è l'argomento di vendita di Starter -- non il prezzo.
      Scheda di `Prezzi.tsx` già riscritta di conseguenza nella stessa sessione (descrizione da
      "Quando il salone cresce", che descrive Growth, a "Il gestionale, senza l'AI"; aggiunte in
      cima le due voci sul differenziale vero, che prima non comparivano nella card).
      **Tensione da tenere d'occhio in trattativa**: Starter è il piano "economico" ma con +10€ per
      operatore un salone con 4 poltrone paga 49,90€. Resta davvero a buon mercato solo per chi
      lavora da solo o in due.

## Fase 6 -- Automazioni e sicurezza (punti 16, 29, 30)
- [x] **Promemoria automatici -- CODICE FATTO 14/09/2026** (era bloccante prima di aprire
      pagamenti veri sul piano Growth; trovato nel controllo promesse del sito 13/09/2026,
      richiesto da Gabriel: "aggiungi tutte le promesse del sito"): pubblicizzati come voce
      inclusa da Growth in su (`Prezzi.tsx`, `Funzionalita.tsx`: "Reminder prima
      dell'appuntamento e follow-up ai clienti inattivi") e usati esplicitamente nel calcolo ROI
      della landing (`ImpattoEconomico.tsx`). Costruite ESATTAMENTE le due cose promesse, non di
      più (niente promemoria di compleanno, mai stato scritto da nessuna parte sul sito nonostante
      fosse nella lista di idee del 13/09/2026): job schedulato una volta al giorno
      (`/api/cron/promemoria`, Vercel Cron -- vedi `vercel.json`, protetto da `CRON_SECRET`),
      logica di decisione pura e testata in `src/lib/promemoria.ts` (13 test), connessione DB in
      `src/lib/promemoria.server.ts`. Reminder pre-appuntamento: finestra 24-48h prima (non
      "esattamente 24h", vedi il commento in `promemoria.ts` sul perché -- un cron che gira una
      volta al giorno a un'ora fissa mancherebbe sistematicamente metà degli appuntamenti con una
      finestra più stretta), una volta sola per appuntamento (`appuntamenti.promemoria_inviato_at`,
      migrazione `0017_promemoria_automatici.sql`). Follow-up clienti inattivi: riusa
      `elencaClientiInattivi` (src/lib/metriche.ts, stessa regola già in dashboard, non
      ricalcolata), al massimo una volta ogni 60 giorni per cliente
      (`clienti.promemoria_inattivita_inviato_at`). Gate di piano dedicato
      (`pianoHaPromemoria`/`PIANI_CON_PROMEMORIA` in `src/lib/piani.ts`, stessa forma di
      `pianoHaAnalytics`). **Aggiornamento stesso giorno, richiesto da Gabriel**: "vorrei che lo
      staff possa decidere quanto tempo prima mandare il promemoria e anche se averne più di uno"
      -- schema riscritto (nessuna migrazione ancora applicata al DB reale, nessun danno a
      riscriverla) da singola colonna a tabella `regole_promemoria` per-tenant + tabella
      `promemoria_appuntamento_inviati` per tracciare gli invii per coppia appuntamento/regola,
      così più regole (es. "72 ore prima" E "24 ore prima") possono scattare indipendentemente
      sullo stesso appuntamento. Nuova pagina `/dashboard/impostazioni/promemoria`: elenco regole,
      aggiungi/rimuovi, avviso in UI se il preavviso scelto è sotto le 24 ore (il cron gira una
      volta al giorno sul piano Vercel Hobby di Gabriel, sotto quella soglia non è garantito che
      scatti in tempo). Ogni tenant esistente riceve una regola di default a 24 ore (stesso
      comportamento di prima, zero configurazione richiesta), e ogni nuovo tenant che si registra
      da qui in avanti pure (aggiunto al trigger di provisioning automatico,
      `gestisci_nuovo_utente`). `tsc`/`eslint`/`vitest` (216/216)/`build` puliti. `CRON_SECRET`
      impostato su Vercel (fatto da Gabriel) e migrazione `0017_promemoria_automatici.sql`
      applicata al database reale (con l'ok esplicito di Gabriel) -- verificata via query diretta:
      tutti e 3 i tenant esistenti hanno ricevuto la regola di default a 24 ore. **Giro di revisione
      stesso giorno, richiesto da Gabriel**: "verifica che non ci sono miglioramenti [...] se ci
      sono applicali". Trovate e applicate due cose: (1) il reminder pre-appuntamento non aveva il
      link "gestisci/cancella la prenotazione" che invece l'email di conferma prenotazione ha
      sempre avuto (`notifiche.server.ts`) -- aggiunto, stesso link generico verso
      `/gestisci/[id]`. (2) entrambe le email (reminder e follow-up inattività) segnavano
      l'invio DOPO aver mandato l'email, non prima -- corretto a "prenota prima, invia dopo"
      (claim-before-send): il reminder inserisce la riga in `promemoria_appuntamento_inviati`
      PRIMA di mandare l'email, usando il vincolo `unique(appuntamento_id, regola_id)` come
      lucchetto (un conflitto, codice Postgres 23505, vuol dire "già in carico da un altro giro",
      si salta senza errore); il follow-up fa un `update` condizionato sullo stesso filtro che
      decide l'idoneità e salta l'invio se zero righe vengono toccate. In entrambi i casi evita
      email doppie se il cron dovesse sovrapporsi con se stesso (ritardo di Vercel Cron, retry,
      esecuzione manuale mentre quella schedulata è ancora in corso). Rivista anche la query
      dell'inattività (`avvisaClientiInattivi`, storico non filtrato per data) -- lasciata
      volutamente com'era: stesso pattern già usato e documentato in `metriche.server.ts`
      (`elencaClientiInattivi`), corretto per i volumi attuali, da rivedere insieme quando un
      tenant avrà migliaia di appuntamenti storici. `tsc`/`eslint`/`vitest` (216/216)/`build`
      puliti di nuovo dopo questo giro. Nessuna nuova migrazione richiesta (solo riordino di
      query/logica e una stringa HTML in più).
      **VERIFICATO DAL VIVO 14/09/2026** (vedi DECISIONS.md): prenotato un appuntamento reale
      dentro la finestra 24-48h su un tenant Growth, rilanciato manualmente `/api/cron/promemoria`
      da Vercel invece di aspettare le 08:00 -- riga scritta in `promemoria_appuntamento_inviati`,
      log Vercel puliti (200, nessun errore reale), ed email di promemoria **ricevuta per davvero**
      da Gabriel nella sua casella. Reminder pre-appuntamento chiuso end-to-end, non solo a
      livello di test automatici. Follow-up clienti inattivi resta verificato solo a livello di
      test automatici (nessun cliente "inattivo da 60 giorni" disponibile nei tenant di prova per
      un giro dal vivo).
- [x] **SMS** (trovato 13/09/2026, CODICE FATTO 14/09/2026): `Prezzi.tsx` elenca "SMS" come voce
      inclusa da Pro in su, e `Funzionalita.tsx` la descrive esplicitamente ("Promemoria e
      conferme anche senza WhatsApp o smartphone"). Costruito come canale di FALLBACK (mai in
      aggiunta all'email, solo in sua sostituzione quando il cliente non ha lasciato un
      indirizzo) sia per la conferma di nuova prenotazione (`email/notifiche.server.ts`) sia per
      ENTRAMBI i Promemoria automatici del punto sopra (`promemoria.ts`/`.server.ts`). Provider:
      **Skebby** (scelto sopra Twilio dopo un confronto costi -- vedi DECISIONS.md 14/09/2026),
      integrazione REST fail-open in `src/lib/sms/skebby.server.ts`, punto di ingresso unico
      `inviaSmsSeInclusoNelPiano` (`sms/invio.server.ts`) che centralizza gate di piano
      (`pianoHaSms`/`PIANI_CON_SMS`, pro+enterprise) e tetto mensile (`limiteMensileSms`, 100
      SMS/operatore/mese, tracciato nella nuova tabella `sms_inviati`, migrazione applicata al
      DB reale). Nella stessa conversazione, Gabriel ha chiesto di affrontare anche il prezzo per
      operatore su Pro (un salone con più operatori genera più SMS ma pagava lo stesso fisso):
      69,90€/mese ora includono 1 operatore, +20€/mese ciascuno oltre il primo (secondo Price
      Stripe dedicato, sincronizzato automaticamente al checkout e quando gli operatori cambiano
      dopo l'attivazione -- vedi `stripe/operatori.server.ts`). `vitest` (242/242)/`tsc`/`eslint`/
      `build` puliti. **Ancora da fare, non bloccante**: Gabriel deve creare un account Skebby e
      fornire `SKEBBY_EMAIL`/`SKEBBY_PASSWORD` prima che un SMS possa davvero partire (fail-open
      nel frattempo, come per Mailjet).
- [x] **Deposito/caparra anti-no-show** (nuovo task, mega-controllo competitor 12/09/2026,
      CODICE FATTO 13/09/2026): gap reale verificato in TUTTO il software italiano di categoria
      (Estetia, Calendix, Skedula, WeGest, CutApp -- nessuno lo offre), standard invece nei
      marketplace internazionali (Fresha, Booksy). Costruito: pagamento anticipato via Stripe
      Checkout ("payment", non `PaymentIntent` grezzo -- più semplice, coerente con il checkout
      abbonamenti già esistente) al momento della prenotazione pubblica (`/s/[slug]`,
      `FlussoPrenotazione.tsx` + `avviaPagamentoCaparra` in `azioni.ts`), configurabile per
      tenant (attivo/disattivo, percentuale o importo fisso, `/dashboard/impostazioni/caparra`).
      `tsc`/`eslint`/`vitest` (119/119)/`build` puliti. **VERIFICATO DAL VIVO 14/09/2026 (form
      pubblico) e 15/09/2026 (anche via chat AI, vedi Gruppo B punto 4)**: migrazione applicata al
      database reale, pagamenti Stripe TEST completati, appuntamento creato solo dopo il
      pagamento su entrambi i canali. Vedere `docs/analisi-concorrenti-mercato.md`, sezione
      "AGGIORNAMENTO CRITICO", punto 3.
- [x] **Lista d'attesa automatica alla cancellazione** (vista su Calendix e CutApp, non su
      Estetia; CODICE FATTO 13/09/2026): tabella `lista_attesa`
      (tenant/servizio/operatore opzionale/cliente/data preferita opzionale, migrazione
      `0013_lista_attesa.sql`) + `trovaEAvvisaListaAttesa` dentro `cancellaAppuntamentoTenant`
      (booking-engine.server.ts) -- a ogni cancellazione cerca il primo cliente in coda (FIFO su
      `created_at`) per lo stesso servizio che accetta anche l'operatore e il giorno liberati (o
      non ne ha chiesti di specifici), e marca la sua riga "proposto". **Notifica al CLIENTE non
      automatica**: zero provider email/SMS nel progetto oggi (Gruppo B-bis punto 1), quindi
      questa prima versione notifica il TITOLARE -- banner immediato in
      `/dashboard/calendario` appena dopo la cancellazione + vista completa in
      `/dashboard/lista-attesa` (aggiungi/segna risolto/rimuovi a mano), da lì il contatto resta
      manuale (telefonata/messaggio). Tre punti di ingresso, stessa unica funzione di scrittura
      (punto 9 CLAUDE.md): form manuale in dashboard (un cliente chiama e chiede di essere messo
      in lista), nuovo strumento AI `aggiungi_lista_attesa` (se `verifica_disponibilita` non
      trova nulla, l'AI offre di iscrivere il cliente invece di dire solo "non c'è
      disponibilità" -- regola 8 del system prompt in agente.ts), e -- aggiunto lo stesso giorno
      dopo la domanda diretta di Gabriel -- iscrizione diretta dal flusso di prenotazione
      passo-passo (`iscrivitiListaAttesaPubblico` in `src/app/s/[slug]/azioni.ts`, quando
      `cercaSlotPubblici` non trova slot per il giorno scelto: prima si vedeva solo "prova un
      altro giorno" e si usciva dal sito senza lasciare traccia). Il match alla cancellazione
      resta silenzioso lato AI: se un cliente in chat cancella un appuntamento e scatta un
      match, il titolare lo vede in dashboard, ma l'AI non rivela mai dati di un altro cliente
      alla persona con cui sta chattando. `tsc`/`eslint`/`vitest` (136/136)/`build` puliti.
      Migrazione `0013_lista_attesa.sql` **applicata al database reale il 13/09/2026** (stesso
      via libera già dato per 0011/0012); `0014_lista_attesa_pubblico.sql` (allarga
      `creato_da` a `'pubblico'`) **applicata anche questa il 13/09/2026**. **Verificato dal
      vivo il 13/09/2026** su un tenant di prova dedicato ("Salone Test Claude", per non toccare
      i dati reali): iscrizione pubblica dal flusso di prenotazione diretto, prenotazione e
      cancellazione dello stesso slot da dashboard, match automatico scattato correttamente
      (banner "🔔" in calendario + riga "proposto" in `/dashboard/lista-attesa`), "segna
      risolto" verificato -- intera catena confermata funzionante in un browser reale, non solo
      con `vitest`. Nello stesso giro trovato e corretto anche un bug critico scoperto dal vivo:
      `parsaOrarioLocale` rifiutava i millisecondi che `cercaSlotPubblici` genera con
      `Date.toISOString()`, quindi la prenotazione pubblica diretta falliva SEMPRE per
      qualunque tenant (vedi DECISIONS.md 13/09/2026) -- corretto e riverificato in produzione.
- [x] ~~**Multi-utente/team reale** (nuovo task, secondo giro mega-controllo 12/09/2026): dare a
      ogni "operatore" un proprio login (invito via email, permessi limitati alla propria
      agenda) invece di essere solo un record gestito dal titolare -- prerequisito tecnico dei
      "ruoli avanzati" venduti su Enterprise (vedi Fase 5) e della persona di marketing "salone
      con team" già usata in `PerChi.tsx`, che oggi non è ancora mantenuta tecnicamente.~~
      **CODICE FATTO 16/09/2026 insieme ai ruoli di Fase 5** (migrazione
      `0027_membri_tenant.sql`): invito via email da `/dashboard/team`, ruoli owner/staff
      applicati per davvero, pagina Team riservata al titolare. Vedi Fase 5 per il dettaglio
      completo.
      **Una correzione rispetto a come era scritto qui**: i permessi NON sono "limitati alla
      propria agenda". Gabriel ha scelto esplicitamente il contrario il 16/09/2026 -- uno staff
      vede e gestisce l'agenda di TUTTI gli operatori, perché in un salone piccolo chi è alla
      cassa risponde al telefono e deve poter prenotare per la collega. I limiti veri sono
      altrove: niente fatturato/analytics, niente configurazione, niente fatturazione, niente
      export CSV della rubrica.
      **Nota**: un "operatore" (record dell'agenda) e un "membro del team" (account che entra in
      dashboard) restano due cose separate, non collegate fra loro. Sono davvero distinte -- un
      salone può avere un operatore che non usa mai il gestionale e una receptionist che lo usa
      senza erogare servizi -- ma se un giorno si vorrà dire "questo login È questo operatore"
      (per esempio per aprire il calendario già filtrato sulla propria agenda) servirà un
      collegamento esplicito fra `membri_tenant.user_id` e `operatori.id`, che oggi non esiste.
- [ ] **Pacchetti prepagati/tessera fedeltà digitale** (nuovo task, stesso giro): visto su
      CutApp, comune nel settore beauty ("10 sedute prepagate", punti fedeltà). Non urgente, ma
      differenziale vero per i saloni che già usano questo modello di vendita su carta.
- **NON aggiunto come task, deliberatamente** (visto su Estetia/WeGest, "Cassa"/registro di
  pagamenti REALI incassati -- diverso dagli "incassi previsti" aggiunti in Fase 3, che sono
  solo una proiezione, zero pagamenti/fiscalità, vedi DECISIONS.md 13/09/2026): tocca
  fatturazione/ricevute fiscali italiane, un terreno normativo diverso dal nostro focus
  (booking + AI + CRM) e facile da sottovalutare in complessità. Da valutare SOLO se più di un
  cliente reale lo chiede esplicitamente, non perché un concorrente ce l'ha -- vedi PIANO.md
  "Gruppo B-bis" punto 9 per il ragionamento completo.
- [ ] Revisione sicurezza (RLS, permessi tool AI, rate limiting, input validation)
- [x] ~~Test completo su tutti gli scenari del punto 30~~ **FATTO 16/09/2026, Task #190**: vedi
      il dettaglio completo in Fase 1 e in DECISIONS.md "Task #190 chiuso" -- 18/18 scenari E2E
      verdi in un'unica run.
- [ ] **Sentry (error tracking)** -- deciso il 16/09/2026 (Gabriel ha chiesto un parere su un
      post generico "stack per startup a $21/mese" visto sui social, vedi DECISIONS.md):
      unica aggiunta reale di quella lista, priorità vicina -- oggi un errore in produzione si
      scopre solo da un utente che si lamenta o controllando i log Vercel a mano, rischio
      concreto con Stripe live in avvicinamento. Nessuno swap sul resto (Clerk/Resend
      restano fuori, Supabase Auth e Mailjet funzionano già, cambiarli sarebbe solo churn).
- [ ] **PostHog (analytics di utilizzo)** -- stessa occasione, priorità molto più lontana:
      utile quando ci sarà acquisizione vera da ottimizzare (funnel di prenotazione, traffico),
      prematuro con zero clienti paganti. Non uno swap delle metriche di prodotto già in
      dashboard (quelle restano come sono, è un'altra cosa).

### Revisione sicurezza -- FATTA 17/09/2026 (codice), migrazione DA APPLICARE

Revisione avversariale della Fase 6 su quattro assi (isolamento fra saloni, soldi, input
non fidato, segreti). **Nessun dato di un salone finisce a un altro salone**: RLS regge, i 14
usi del service_role risolvono sempre il tenant dalla sessione o dallo slug, le 20+ tabelle
hanno tutte RLS, nessuna policy `using (true)`, gli id di `/gestisci` e `/recensisci` sono UUID
non enumerabili, e i tool dell'AI non possono operare su un tenant diverso da quello della
conversazione. Quello che è emerso sta un livello sotto, ed era peggio.

**1. I permessi esistevano solo nell'applicazione** (migrazione `0030_permessi_a_livello_database.sql`,
DA APPLICARE A MANO). RLS isolava i tenant ma non sapeva niente dei ruoli, e le tabelle sono
raggiungibili direttamente da PostgREST con la anon key -- pubblica per definizione, sta nel
bundle del browser -- più il JWT dell'utente, che è nei suoi cookie. Due conseguenze verificate
leggendo policy e grant: (a) `create policy tenant_update on tenants for update using (id =
auth_tenant_id())` autorizzava l'UPDATE di TUTTE le colonne, quindi una PATCH su
`/rest/v1/tenants` con `{"piano":"enterprise","piano_manuale":true}` regalava a chiunque il piano
più caro in modo PERMANENTE (con `piano_manuale` acceso il webhook Stripe smette di correggere:
il meccanismo della 0028 rivoltato contro di noi), e `{"sospesa":false}` annullava una
sospensione decisa dal pannello admin; (b) le policy `for all` sulle tabelle di configurazione
non distinguono owner da staff, quindi un dipendente poteva cancellare servizi e cambiare prezzi
-- esattamente ciò che `puoConfigurareAttivita` gli nega. La regola stabilita da qui in avanti:
**un permesso che esiste solo nel codice dell'applicazione non è un permesso.** La migrazione
aggiunge `auth_ruolo()`/`e_owner()` (stessa definizione di `normalizzaRuolo`, ruolo sconosciuto =
meno potere), GRANT per colonna su `tenants` con elenco esplicito, e policy separate
lettura/scrittura sulle tabelle di configurazione.

**2. Chiunque poteva leggere e cancellare le prenotazioni di chiunque, dalla chat pubblica.**
`cerca_prenotazioni_cliente` accettava un numero di telefono qualsiasi e restituiva nome e
appuntamenti futuri di quella persona; `modifica_prenotazione` e `cancella_prenotazione`
accettavano quegli id verificando solo l'appartenenza al tenant. Nessun controllo che chi
scriveva possedesse quel numero -- l'unica cosa che ci somigliava era una frase nel system
prompt, che non è un controllo. Bastava conoscere un cellulare per farsi dare nome e agenda di
una persona e poi svuotarle l'agenda. Chiuso con `ContestoStrumento.telefonoVerificato`:
**un'identità dichiarata non è un'identità verificata**. Gli strumenti funzionano solo su un
canale che garantisce il numero di chi scrive (WhatsApp, dove il mittente è il canale stesso);
nella chat del sito rispondono sempre la stessa cosa -- identica anche per un numero
inesistente, altrimenti la differenza direbbe a un estraneo chi è cliente di quel salone.
Costo accettato: nella chat del sito il cliente non sposta più da solo. Non è una perdita
grave perché il link personale `/gestisci/<id>` gli arriva già nella mail di conferma e nel
promemoria. Scenari 2 e 10 riscritti: il 2 adesso è la prova che dall'esterno non si tocca
niente, il 10 cancella dal link personale (che è il percorso vero) e continua a verificare la
lista d'attesa.

**3. Doppio abbonamento sullo stesso cliente.** `/api/stripe/checkout` non controllava se il
tenant avesse già un abbonamento vivo, e il webhook si limitava a sovrascrivere
`stripe_subscription_id`. Bastava tornare su `/dashboard?piano=<altro>` -- cosa che succede da
sola, il link di conferma email della registrazione riporta lì con il piano nell'URL -- per
ritrovarsi due abbonamenti attivi, per esempio 19,90 + 89,90 = 109,80 al mese, di cui il
prodotto ne conosce uno solo: il primo diventa invisibile e non verrebbe cancellato nemmeno
cancellando l'attività. Adesso il checkout risponde 409 e rimanda al Customer Portal, che
sostituisce invece di affiancare.

**4. Caparra incassata "a fiducia".** Su `checkout.session.completed` l'appuntamento veniva
creato senza controllare `payment_status`. Basta accendere dalla Dashboard di Stripe un metodo a
notifica differita (SEPA, Bancontact, Klarna) -- un click, zero codice -- perché quell'evento
arrivi con `payment_status: "unpaid"`: appuntamento confermato, slot occupato, e giorni dopo
l'addebito fallisce senza che nessuno se ne accorga. Cioè esattamente il no-show che la caparra
dovrebbe impedire, pagato da noi. Adesso si esce senza toccare niente e si aspetta
`checkout.session.async_payment_succeeded`; `async_payment_failed` ed `expired` chiudono la
richiesta invece di lasciarla "in attesa" per sempre. **Serve aggiungere quei tre eventi
all'endpoint webhook su Stripe.**

**5. Eventi Stripe fuori ordine.** `sincronizzaAbbonamento` si fidava dello snapshot dentro
l'evento. Stripe non garantisce l'ordine e ritenta per giorni: un `updated` vecchio consegnato
dopo un `deleted` riportava il tenant su un piano a pagamento che nessuno paga più, e nessun
evento futuro lo avrebbe corretto perché quella subscription è morta. Adesso l'handler rilegge
la subscription da Stripe: scrive sempre lo stato di ADESSO, quindi è idempotente e insensibile
all'ordine.

**6. La quota "operatore extra" si sceglieva dal piano del DATABASE.** Se il piano è stato
cambiato dal pannello senza toccare Stripe (caso previsto, `azioneStripe: "nessuna"`), la
sincronizzazione attaccava la quota Growth da 15 a un abbonamento che fattura la base Starter da
19,90: 34,90 al mese, una combinazione che non esiste in nessun listino, invisibile perché la
funzione è fail-open. Adesso il piano si legge dalla riga base dell'abbonamento. L'invariante
diventa verificabile a occhio sulla fattura: la riga "operatore extra" appartiene sempre allo
stesso piano della riga base sopra di lei.

**Lo Scenario 17 era questo, non un bug di prodotto.** L'intermittenza aveva una causa
completa: sull'account Stripe sandbox esiste un endpoint webhook (`we_1UFP0R...`, verificato)
che punta alla produzione su Vercel, la quale scrive sull'UNICO progetto Supabase esistente --
lo stesso che usano i test locali. Ogni `subscriptions.update()` fatto da un test genera un
`customer.subscription.updated` consegnato alla produzione, che ricava il piano dai price
dell'abbonamento (base Starter, perché il test non la cambiava mai) e riporta `tenants.piano` a
starter. Se il webhook arrivava prima del terzo operatore il test falliva, se arrivava dopo
passava: una gara fra due latenze, da cui il 50%. Il sistema si stava comportando correttamente
-- Stripe è la fonte di verità -- ed era il test a verificare uno stato incoerente. Riscritto:
adesso cambia davvero il price base, come un upgrade dal Customer Portal. **Un argomento in più
per il database di test separato**, già in Fase 6ter: i test locali scrivono nel database di
produzione e ne fanno partire i webhook.

**Non risolto, dichiarato invece che nascosto:**
- [ ] **Uno staff può portarsi via la rubrica clienti via PostgREST.** Legge legittimamente i
      clienti dentro il prodotto, quindi nessuna policy può distinguere "guardarli uno per uno"
      da "scaricarli tutti": in SQL quella differenza non è esprimibile. Per chiuderla davvero le
      letture dei clienti devono passare solo da server action con service_role. Lavoro separato,
      non banale.
- [ ] **Password CalDAV e refresh token Google leggibili da qualunque membro del tenant.** La
      0030 chiude la scrittura (solo l'owner collega e scollega) ma non la lettura: sono in
      chiaro in colonna, e uno staff può leggerle e usarle fuori dal prodotto, anche dopo essere
      stato rimosso (`rimuoviMembro` non revoca niente). Si lega alla voce già aperta in Fase
      6bis sul cifraggio a riposo: vanno fatte insieme, e prima del primo cliente vero con un
      calendario collegato.
- [ ] **L'invito a un membro viene consumato dal trigger PRIMA che l'email sia confermata.** Se
      la conferma email fosse disattivata sul progetto Supabase (impostazione fuori dal codice,
      e `registrati/page.tsx` gestisce esplicitamente anche quel caso), chi indovina l'indirizzo
      invitato -- tipicamente `info@...` -- entrerebbe nell'attività altrui. Da verificare
      nell'impostazione e, comunque, da rendere indipendente da essa.
- [ ] **Ridare al cliente l'autonomia in chat, in modo sicuro.** Uno strumento che, dato un
      numero, MANDA il link di gestione a quel numero senza rivelare niente in chat: se quel
      numero ha una prenotazione il link arriva solo al suo proprietario, e la chat risponde la
      stessa cosa in ogni caso. Restituisce la funzione tolta al punto 2 senza riaprirla.
      Dipende da SMS (Skebby, quindi P.IVA) o dall'email del cliente quando c'è.
- [ ] **Sospendere un'attività non tocca Stripe**: continua a pagare il piano pieno pur non
      potendo più ricevere prenotazioni. Sembra una scelta deliberata (sospensione punitiva),
      ma va resa consapevole invece che implicita.

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

## Fase 6ter -- Quello che manca per vendere davvero (aggiunta 16/09/2026)

Nata da una domanda di Gabriel ("hai qualche consiglio generale sul sito? processi che possiamo
automatizzare con l'AI, e altri consigli dopo aver esaminato bene progetto e situazione attuale"),
e messa PRIMA della Fase 7 su sua richiesta esplicita: il redesign è l'ultima cosa che serve a un
prodotto che non ha ancora un cliente.

**La diagnosi da cui nasce tutta questa fase, scritta senza addolcirla**: il prodotto è già più
completo di quanto serva ai primi dieci clienti -- booking, assistente, CRM, recensioni,
promemoria, caparre, lista d'attesa, calendari, fatturazione, ruoli, multi-sede, pannello admin --
e i clienti sono zero. Il vincolo non è più una funzione mancante. Ogni funzione aggiunta da qui
in avanti allarga la distanza fra quanto il prodotto è pronto e quanto è venduto, invece di
ridurla. Le voci qui sotto sono le uniche che quella distanza la accorciano.

- [ ] **P.IVA -- il collo di bottiglia vero, e non è sviluppo.** Blocca la verifica business Meta
      (quindi WhatsApp), le credenziali Skebby (quindi gli SMS), Stripe in modalità live, il
      `[NOME_TITOLARE]` nelle pagine legali e la possibilità di firmare l'accordo sul trattamento
      con un cliente. WhatsApp in particolare non è una funzione fra tante: è IL differenziale su
      cui è costruito tutto il posizionamento. Senza, si sta vendendo un booking online contro
      Fresha, che lo dà gratis. È pura amministrazione e va avviata prima di qualunque altra cosa
      in questa lista.

- [ ] **Import della rubrica clienti, assistito dall'AI -- la funzione più importante che manca.**
      Il motivo per cui un salone NON cambia gestionale non è il prezzo: è che ha trecento clienti
      su un quaderno, in un Excel fatto male o dentro la cronologia di WhatsApp, e spostarli a mano
      è una serata di lavoro che nessuno farà mai. Un'AI che prende quel disastro -- un incolla
      sporco, un CSV con le colonne sbagliate, **la foto di una pagina dell'agenda** -- e ne ricava
      clienti strutturati da rivedere e confermare prima di salvare, è letteralmente ciò che rende
      possibile il passaggio da un altro strumento.
      L'export CSV esiste già (`src/lib/csv.ts`); l'import è segnato come mancante da sempre e non
      è mai stato fatto. Stesso schema dell'onboarding AI già costruito: l'AI propone una bozza, il
      titolare la corregge e conferma, nessuna scrittura senza revisione umana.
      Attenzione al confine legale: quei contatti sono dati di terzi che il salone possiede come
      titolare del trattamento -- Salone AI li importa per suo conto, e l'accordo art. 28 copre
      già questo caso.

- [ ] **Note vocali che diventano scheda cliente.** Un parrucchiere non digita: ha le mani
      occupate e le unghie di qualcun altro davanti. Detta trenta secondi a fine servizio e l'AI ne
      ricava formula colore, preferenze, cosa ha funzionato e cosa no.
      **Perché è un differenziale vero e non un vezzo**: la formula colore è il dato che i saloni
      tengono su carta da decenni ed è una delle ragioni per cui non cambiano strumento.
      Confine da rispettare: preferenze e formule sì, condizioni di salute no -- sono categorie
      particolari (art. 9), e l'informativa dichiara già che il prodotto non le prevede.

- [ ] **Bozze di risposta alle recensioni.** La risposta pubblica del titolare esiste già
      (`rispondiRecensione`, Fase 3): aggiungere una bozza generata è poco lavoro e alto valore
      percepito, perché rispondere alle recensioni è una cosa che tutti sanno di dover fare e
      quasi nessuno fa. La bozza si modifica sempre prima di pubblicare, mai invio automatico.

- [ ] **Recupero dei clienti fermi, con l'uomo nel mezzo.** Si lega al punto "retention e no-show
      reale" ancora aperto in Fase 3. L'AI scrive il messaggio personalizzato sullo storico del
      cliente, **il titolare lo manda**. La persona nel mezzo non è una limitazione tecnica da
      togliere un domani: è esattamente ciò che risolve il problema di consenso GDPR già
      identificato il 12/09/2026 sul follow-up oltre i 60 giorni.

- [ ] **Riempire i buchi dell'agenda, non "fare contenuti".** Correzione del 16/09/2026 a una
      riga scritta troppo grossolana poche ore prima (Gabriel ha chiesto il perché del divieto e
      aveva ragione a insistere). La distinzione che conta non è "contenuti sì o no", è **generato
      dal nulla contro generato dai dati veri**:
      - Un post Instagram generico è un no: lo fa ChatGPT gratis in un'altra scheda, non c'è
        nessun vantaggio a rivenderlo, si compete con Canva su un terreno che non è il nostro, ed
        è invendibile perché il risultato non è misurabile (una prenotazione o c'è o non c'è, un
        post è "insomma" e la colpa se la prende il prodotto).
      - Un messaggio che nasce dall'agenda -- "giovedì pomeriggio tre posti liberi per il colore",
        "questo servizio non lo prenota più nessuno da tre settimane" -- **ChatGPT non lo può
        scrivere**, perché quei dati non ce li ha. E non è marketing: è riempire l'agenda, cioè il
        lavoro per cui il salone paga.
      Da costruire nella seconda forma, mai nella prima. Si lega al recupero dei clienti fermi
      qui sopra: stesso principio, l'AI scrive e il titolare manda.

- [ ] **Estendere i segnali sulla dashboard del SALONE.** Stessa idea dei segnali costruiti il
      16/09/2026 per il pannello admin (onboarding incompleto, vicina al tetto, ferma da N
      giorni), ma rivolta al titolare: occupazione bassa in una fascia oraria, servizio che
      nessuno prenota più, clienti che si stanno perdendo. Qualcosa c'è già ("N clienti non
      prenotano da oltre 60 giorni" con il pulsante per contattarli), ed è la direzione giusta.

- **NON fare, deciso 16/09/2026 e precisato lo stesso giorno**: far scrivere a un modello un
  paragrafo di ANALISI sopra i numeri del salone ("i tuoi clienti preferiscono il martedì"), e il
  chatbot sulla landing.
  Il motivo del primo divieto, che è quello meno ovvio: un salone fa 100-300 prenotazioni al mese,
  e su quei volumi quasi tutto ciò che sembra un andamento è rumore -- caso vestito da scoperta.
  Un'osservazione sbagliata scritta con sicurezza fa più danno del silenzio, perché non è
  verificabile prima di mostrarla, e quando il titolare si accorge che è falsa smette di fidarsi
  anche dei numeri veri che ha accanto.
  **La linea è: regola deterministica sì, prosa generata sopra i numeri no.** Una regola o è giusta
  o è sbagliata e si può controllare; un paragrafo è un'opinione che sembra un dato.

- [ ] **Demo pubblica e video di sessanta secondi.** Non esiste un solo cliente vero da mostrare e
      la landing promette senza provare. Un salone demo credibile a un URL fisso, che chiunque può
      aprire e provare a prenotare, più un video breve in cui l'assistente prende un appuntamento,
      sono l'unico materiale di vendita che conta davvero -- e costano un pomeriggio. Oggi non
      esistono. Da tenere popolato con dati verosimili ma palesemente finti, mai con dati di una
      persona reale.

- [ ] **Voci di Pro ancora senza codice: costruirle o toglierle.** "Supporto prioritario" e
      "Report e analytics avanzati" sono su `Prezzi.tsx` dal 14/09/2026 e non hanno una riga sotto.
      Prima del primo cliente pagante va chiuso in un senso o nell'altro -- è la stessa disciplina
      che il 16/09/2026 ha fatto trovare il claim falso sul multi-sede in `PerChi.tsx`.

- [ ] **Verificare il backup del database, prima del primo cliente vero.** Tutto il progetto vive
      su un'istanza Supabase e su un portatile. Finché i dati che si possono perdere sono di
      Gabriel è un fastidio; dal primo salone in poi sono i dati dei SUOI clienti, e l'accordo sul
      trattamento scritto il 16/09/2026 impegna formalmente a proteggerli. Da controllare: che
      piano Supabase è attivo e se include il ripristino a un punto nel tempo. Se non lo include,
      un export periodico automatico è meglio di niente.

- [ ] **Separare il database dei test da quello di produzione.** La suite Playwright crea e
      cancella tenant veri sul database di produzione. Oggi è accettabile (zero clienti reali) ed
      è anche il motivo per cui quei test sono credibili, visto che non simulano nulla. Dal primo
      cliente vero non lo è più: un run interrotto ha già lasciato sei tenant orfani il
      16/09/2026. Serve un secondo progetto Supabase per i test, con le stesse migrazioni.

- [ ] **Email "la tua prova sta per scadere".** Il trial da 10 giorni su Growth è l'imbuto
      principale, e oggi finisce senza che nessuno dica niente al salone: il primo segnale che
      riceve è un addebito, oppure niente. Stripe manda `customer.subscription.trial_will_end`
      tre giorni prima ed è il gancio naturale: un'email che dice quando scade, quanto costerà e
      soprattutto **cosa ha fatto l'assistente in quei dieci giorni** -- quante prenotazioni ha
      preso, quante fuori orario. Non un promemoria di pagamento: un riepilogo di ciò che
      perderebbe smettendo. I numeri esistono già (`appuntamenti.creato_da = 'ai'`). Prima il
      codice, poi si aggiunge l'evento all'endpoint webhook: oggi ne ascolta 7, che sono
      esattamente quelli gestiti, e uno in più consegnato a vuoto è solo rumore.
- [ ] **Contestazioni (`charge.dispute.created`) prima di aprire il live.** Nessuno le gestisce
      oggi e con zero pagamenti reali non serve, ma una contestazione non vista è l'unica cosa che
      costa soldi in silenzio: Stripe trattiene l'importo più la commissione di gestione e, se
      nessuno risponde entro la scadenza, la perdita resta. Serve almeno una notifica. Da rivedere
      insieme a Stripe Connect, perché con le direct charges la contestazione è del salone e non
      nostra -- cambia chi va avvisato, non se avvisare.

- [ ] **Fatturazione elettronica automatica (bloccata dalla P.IVA).** Decisione del 17/09/2026:
      i dati si raccolgono al checkout e la fattura si emette da sola, non a mano. La **raccolta
      è già fatta** (`tax_id_collection`, indirizzo obbligatorio e due campi personalizzati per
      codice destinatario e PEC; migrazione `0031_dati_sdi.sql` **DA APPLICARE**), e il pannello
      admin segnala i paganti di cui mancano quei dati. Resta l'emissione, che richiede la P.IVA:
      un servizio che parli con lo SdI (Fatture in Cloud e simili hanno le API) pilotato dal
      webhook del pagamento. Regole verificate il 17/09/2026: obbligo per tutti dal 2024,
      forfettari inclusi e senza soglie; per il forfettario regime RF19, natura N2.2, IVA 0%;
      bollo da 2 € sopra 77,47 €, dovuto dall'emittente e ribaltabile in fattura -- su un Pro a
      89,90 € scatta ogni mese; conservazione a norma per 10 anni, non basta tenere i file.
      Vedi DECISIONS.md per il perché dei campi al checkout invece che alla registrazione.

### Stripe Connect per le caparre -- BLOCCANTE prima del primo cliente pagante (17/09/2026)

- [ ] **Le caparre devono nascere sull'account del salone, non sul nostro.** Oggi la sessione di
      checkout della caparra è creata sull'account della piattaforma senza Connect: l'anticipo
      del cliente finale finisce sul saldo di Salone AI e non esiste modo di girarlo al salone.
      Decisione di Gabriel del 17/09: **direct charges** su account collegati, i soldi non devono
      passare dal nostro conto nemmeno per un istante (vedi DECISIONS.md per il perché delle tre
      modalità Connect se ne sia scelta una sola). Cambia solo la caparra: l'abbonamento che il
      salone paga a noi resta dov'è.
      Lavoro previsto: scelta fra account Express e Standard (decisione aperta), colonna
      `tenants.stripe_account_id`, passaggio di onboarding per collegare il conto, header
      `Stripe-Account` sulla creazione della sessione e sui rimborsi, gate della caparra su "conto
      collegato", webhook Connect, aggiornamento di termini e informativa perché il ruolo cambia
      (non siamo più noi a incassare).
- [ ] **Script di verifica dei prezzi Stripe prima del passaggio in live.** I sei price ID vivono
      in variabili d'ambiente. Sbagliare quello di un piano base fa esplodere il checkout e te ne
      accorgi subito; sbagliare quello di una quota operatore fa restituire `null` a
      `priceIdOperatoreExtra` e la sincronizzazione **non fa niente in silenzio** -- i saloni con
      più operatori pagherebbero solo la base, e lo scopriresti dai ricavi che non tornano. Uno
      script che verifica che tutti e sei i prezzi esistano su Stripe e costino la cifra attesa,
      da lanciare come primo comando dopo aver messo le chiavi live.

## Fase 7 -- Parità/superiorità estetica con Estetia, responsive completo (punti 25, 26, 27, 28)
Non "una rifinitura", un obiettivo a sé con criteri precisi -- perché sia davvero "fatto" e non
"abbastanza carino":

- [ ] **Landing: modifiche di contenuto accumulate, da applicare quando si rifà la pagina**
      (richiesta esplicita di Gabriel il 16/09/2026: "segnati le modifiche da fare alla landing
      page per quando la rifaremo al punto 7"). Non sono scelte di grafica: sono cose che il sito
      dice e che il prodotto adesso fa diversamente. Nella sessione del 16/09/2026 sono state
      applicate SOLO come modifiche minime ai dati dell'array `PIANI`/`PERSONE` (una riga, non un
      ridisegno), perché lasciare un prezzo o una funzione dichiarati male è peggio che
      aspettare. Qui resta il lavoro vero di riscrittura, da fare con la pagina nuova davanti:
      1. **Starter va raccontato, non elencato.** La card ora dice "Il gestionale, senza l'AI" e
         mette in cima "Zero commissioni" e "I tuoi clienti restano tuoi, nessuna app da far
         scaricare". È il minimo sindacale: quel piano compete contro Fresha, che il booking lo
         dà gratis, e l'unica cosa che lo giustifica è che Fresha gratis non lo è davvero
         (monetizza su commissioni e marketplace, e i clienti se li tiene lui). Quel confronto
         oggi non è spiegato da nessuna parte sulla pagina e merita una sezione sua, non tre
         parole in una card.
      2. **La quota per operatore va spiegata una volta sola, bene.** Adesso è una riga piccola
         sotto ogni prezzo (`notaPrezzo`: "1 operatore incluso, +10/15/20€ ciascuno in più"),
         ripetuta tre volte con tre cifre diverse. Con tre numeri diversi serve un modo di
         mostrarlo che non faccia sembrare il prezzo un trucco -- idealmente un selettore
         "quanti operatori siete?" che ricalcola i tre prezzi davanti agli occhi. È anche la
         risposta alla tensione nota: Starter è il piano "economico" ma a 4 poltrone costa
         49,90€, e scoprirlo dopo è peggio che vederlo subito.
      3. **La voce Enterprise è stata riscritta ma va ripensata.** Da "Multi-sede e ruoli
         avanzati" (promessa senza niente sotto) a "Più sedi, un solo accesso". Resta il fatto
         che Enterprise ha poche argomentazioni proprie ora che i ruoli sono su tutti i piani
         paganti: il multi-sede è l'unica esclusiva vera.
      4. **`PerChi.tsx`, card "Personal trainer e centri fitness"**: conteneva una promessa di
         multi-sede falsa su ogni piano, già corretta (vedi Gruppo E punto 10). Quando si
         riscrivono le persone, ricontrollare TUTTE le card con lo stesso criterio -- le promesse
         non stanno solo negli elenchi puntati, e quella era sfuggita proprio per questo.
      5. **Voci di Pro ancora non costruite**: "Supporto prioritario" e "Report e analytics
         avanzati" sono sulla pagina dal 14/09/2026 e non esistono in codice. O si costruiscono
         prima di aprire i pagamenti veri, o escono dalla lista. **Tracciato come voce a sé in
         Fase 6ter**: va chiuso prima, non quando si rifà la grafica -- qui resta solo perché
         tocca il copy della pagina.

- [ ] **Direzione colore già scelta il 16/09/2026, da implementare qui**: verde smeraldo
      (`#0d7a5f`), un solo accento condiviso tra landing e dashboard, base scura ed espressiva
      sulla landing e chiara/funzionale sulla dashboard. Riferimento visivo: canvas Artifact
      https://claude.ai/artifact/Ge38ZrtWuLSxD2ocrRTfEf ("Salone AI — direzioni colore",
      direzione A rifinita) -- nav reale, texture leggera, indicatore live, bottoni ad accento
      usato con parsimonia (badge/icone/toggle) invece che come riempimento pieno ovunque
      (bug di contrasto WCAG trovato e corretto durante la rifinitura, vedi DECISIONS.md).
      Decisione esplicita di Gabriel: "per ora va bene, salvalo per la fase 7" -- nessun codice
      del repository toccato finora, il lavoro vero di redesign (landing E dashboard, skill
      `salone-ai-taste`/`frontend-design-brief` come riferimento tattico durante
      l'implementazione) parte da qui. Dettaglio completo della scelta in DECISIONS.md,
      "2026-09-16 — Redesign landing+dashboard: direzione colore scelta (verde smeraldo)".
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
- [ ] **Calendario di disponibilità nella prenotazione pubblica** (richiesta di Gabriel,
      13/09/2026): sostituire l'`<input type="date">` nativo del passo "Scegli il giorno" in
      `FlussoPrenotazione.tsx` con un vero calendario a griglia, colorato per far capire a colpo
      d'occhio dove conviene guardare, invece di dover cercare giorno per giorno alla cieca.
      Almeno: grigio per i giorni passati, un colore per "pieno ma ci si può mettere in lista
      d'attesa", un colore per "c'è ancora disponibilità". Discusso se spingersi a più
      gradazioni (es. verde acceso = molti slot liberi, via via più spento = sempre meno posti,
      fino a pieno) -- rimandata anche quella decisione a quando si arriva qui, si valuterà con
      dati reali quanto la densità di prenotazioni la rende utile. Non una modifica piccola:
      serve anche una nuova query che calcoli la disponibilità di più giorni in anticipo (oggi
      `cercaSlotPubblici` calcola un giorno alla volta, solo dopo che il cliente lo sceglie) --
      per questo rimandata qui invece di farla subito, come da decisione con Gabriel lo stesso
      giorno (vedi DECISIONS.md). **Alternativa da valutare quando si arriva qui** (proposta di
      Claude, Gabriel ha chiesto un parere): prima di costruire un calendario a griglia intero,
      considerare un "prossimo posto libero" come scorciatoia principale -- dopo aver scelto il
      servizio, mostrare subito il primissimo slot libero trovato (scansionando in avanti finché
      non se ne trova uno) come pulsante primario, più una manciata di date alternative vicine
      come chip cliccabili, invece di un intero mese colorato. Costa molto meno (nessun
      componente calendario da costruire da zero, nessuna query su un mese intero) e per un
      servizio con pochi slot probabilmente serve a più clienti reali (la maggior parte vuole
      "il prima possibile", non naviga un calendario colorato) -- il calendario a griglia resta
      comunque un miglioramento valido in più, non un'alternativa esclusiva.
- [x] ~~**Colonna "Origine" in `/dashboard/clienti` mostra "pubblico" come "Manuale"**~~ **CODICE
      FATTO 13/09/2026** (trovato 13/09/2026 durante il test dal vivo): ripensato l'approccio
      rispetto a quanto scritto qui inizialmente -- NON serve migrare `clienti.creato_da_ai` da
      booleano a testo su una tabella con dati reali (il rischio segnalato sopra, per questo
      rimandato in un primo momento): il dato giusto (`appuntamenti.creato_da`, tre stati) esiste
      già per ogni riga, basta aggregarlo per cliente invece di leggere il campo sbagliato. Nuovo
      modulo puro `src/lib/origine-cliente.ts` (`origineDalPrimoAppuntamento`/`originePerCliente`
      -- origine = canale del primo appuntamento mai creato per quel cliente, `created_at` più
      vecchio), usato sia nella colonna riassuntiva di `/dashboard/clienti` sia nell'intestazione
      della scheda cliente (`[id]/page.tsx`, che diceva "creato dall'AI"/"creato manualmente",
      stesso identico bug) sia nell'export CSV appena fatto -- **tre punti allineati con un solo
      fix**, zero migrazioni. Fallback sul vecchio booleano SOLO per un cliente senza ancora nessun
      appuntamento (es. inserito solo in lista d'attesa). 7 nuovi test dedicati.
- [x] ~~**Nome mittente delle email fisso a "Salone AI" per tutti i tenant**~~ **CODICE FATTO
      13/09/2026** (trovato lo stesso giorno rileggendo `notifiche.server.ts` per la domanda di
      Gabriel su sicurezza/abusi -- stesso gap già segnalato qui): aggiunto `nomeMittente`
      opzionale a `inviaEmail`/`ParametriEmail` in `mailjet.server.ts`, passato da
      `notifiche.server.ts` come `tenants.nome`. Test dedicato aggiunto (vedi PROJECT_STATUS.md,
      sedicesimo giro).

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
7. ~~Dopo il prossimo deploy: fare login una volta sulla dashboard vera~~ **NON PIÙ
   NECESSARIO**: la galleria foto è stata verificata dal vivo il 16/09/2026 con un account di
   test creato ad hoc, come da tua indicazione ("fai tu il login con un account test come hai
   sempre fatto") -- vedi PIANO.md Fase 4 e DECISIONS.md per il dettaglio.
