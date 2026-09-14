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
3. ~~**Provare dal vivo `/s/[slug]`** (pagina pubblica del salone) con un salone di test: cercare
   slot, prenotare, parlare con il widget chat AI.~~ **FATTO 14/09/2026** (confermato da Gabriel
   in un browser vero, non solo scritto/testato in automatico). Confermato nello stesso giro anche
   il click reale sul link "gestisci la tua prenotazione" ricevuto per email (vedi Fase 4 --
   chiudeva il limite di verifica onestamente segnalato lì, la sandbox non può raggiungere
   Supabase direttamente per questo test).
4. **Provare un pagamento di test reale su Stripe Checkout** + configurare il webhook lato
   Stripe Dashboard (serve un dominio pubblico, quindi va fatto dopo il deploy) -- il codice è
   scritto e testato, mai verificato con un pagamento vero. **Unico punto rimasto aperto** del
   giro di test dal vivo del 14/09/2026 (tutto il resto di quel giro è confermato funzionante).
5. **Aggiungerti come "utente di test"** nella schermata di consenso OAuth Google (Google Cloud
   Console), poi provare "Collega Google" dal vivo in `/dashboard/impostazioni/calendari`.
6. **Decidere cosa fare di Apple/iCloud Calendar**: non risolvibile da un hosting cloud standard
   come Vercel (blocco di Apple sul traffico da IP di data center, vedi PROJECT_STATUS.md
   "Problemi noti aperti" #14) -- o lo dichiariamo non supportato, o si accetta il limite e si
   documenta così nel materiale di vendita quando esisterà.
7. **Applicare la migrazione `0011_deposito_caparra.sql` e provare un pagamento di test della
   caparra** (nuovo, 13/09/2026): il codice del Deposito/caparra è scritto e verificato
   (`tsc`/`eslint`/`vitest`/`build` puliti) ma la migrazione non è ancora sul database reale --
   bloccata di proposito dal classificatore di sicurezza della sandbox perché tocca un database
   condiviso, serve il tuo ok esplicito (dall'SQL Editor di Supabase, il file è pronto così
   com'è, o dimmi di applicarla e lo faccio). Dopo: attivare la caparra su un salone di test in
   `/dashboard/impostazioni/caparra` e completare un pagamento di test reale su `/s/[slug]`.
8. ~~Applicare la migrazione `0013_lista_attesa.sql`~~ **FATTO 13/09/2026** (applicata al
   database reale con il tuo ok). ~~Provare dal vivo la lista d'attesa~~ **FATTO 13/09/2026**
   (verificato su un tenant di prova dedicato, non sui tuoi dati reali -- vedi Fase 6 per il
   dettaglio completo): iscrizione, cancellazione, match automatico, banner e "segna risolto"
   tutti confermati funzionanti in un browser vero. Nello stesso giro trovato e corretto un bug
   critico che bloccava ogni prenotazione pubblica diretta (vedi DECISIONS.md).
9. **Validare un mittente su Mailjet e impostare `MJ_APIKEY_PUBLIC`/`MJ_APIKEY_PRIVATE`/
   `MAILJET_FROM_EMAIL`** (nuovo, 13/09/2026, provider deciso lo stesso giorno -- avevi già un
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
1. ~~**Deposito/caparra anti-no-show** (Fase 6)~~ **CODICE FATTO 13/09/2026** (vedi Fase 6 e
   DECISIONS.md 13/09/2026 per il dettaglio) -- resta da fare solo la parte che tocca a Gabriel:
   applicare la migrazione al database reale e verificare un pagamento di test dal vivo (Gruppo
   A).
2. ~~**Tono dell'AI personalizzabile** (Fase 5)~~ **CODICE FATTO 13/09/2026** (vedi Fase 5 per
   il dettaglio) -- resta solo la verifica dal vivo con un salone di test reale, non urgente
   finché non ci sono clienti Pro paganti.
3. ~~**Lista d'attesa automatica alla cancellazione** (Fase 6)~~ **CODICE FATTO 13/09/2026** (vedi
   Fase 6 per il dettaglio) -- resta da fare solo la parte che tocca a Gabriel: applicare la
   migrazione al database reale (Gruppo A).

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
3. **Completare la generalizzazione del copy** oltre "salone" (deciso il 02/09/2026, mai
   finito): `/registrati` e la dashboard usano ancora "Crea il tuo salone" e testi
   settore-specifici in alcuni punti.

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
6. Multi-sede e ruoli avanzati (Enterprise) -- task in Fase 5 (bloccante prima di vendere
   Enterprise).
7. App installabile/PWA (elencata sia come funzione generale in `Funzionalita.tsx` sia come voce
   specifica Enterprise in `Prezzi.tsx`) -- task già in Fase 4/7, **non era ancora collegato
   esplicitamente al fatto che è anche una voce di prezzo Enterprise**: stesso livello di urgenza
   degli altri bloccanti sopra, non solo un "nice to have" generico.
8. ~~"1 operatore" sul piano Free~~ **CODICE FATTO 13/09/2026** -- vedi Fase 5 (`limiteOperatori`
   in `piani.ts`, applicato in `creaOperatore`).
9. **Automazioni extra / promemoria di compleanno (Pro)** -- aggiunta 14/09/2026 (rielaborazione
   prezzi/margini, prezzo Pro portato a 89,90€ in cambio di "vantaggi seri" scelti da Gabriel,
   vedi DECISIONS.md). La tabella `automazioni` (migrazione 0001) ha già un `tipo = 'compleanno'`
   previsto ma mai implementato -- serve: colonna data di nascita su `clienti` (raccolta
   opzionale, non oggi richiesta da nessun form), un cron giornaliero che trova i compleanni del
   giorno per tenant Pro/Enterprise e manda email/SMS con `inviaSmsSeInclusoNelPiano`/
   `inviaEmail` (stesso pattern di `promemoria.server.ts`), e un modo per il titolare di
   attivare/disattivare/personalizzare il messaggio (probabilmente in
   `/dashboard/impostazioni/promemoria`, stessa pagina dei promemoria esistenti).
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
- [ ] **Raccolta recensioni post-appuntamento** (nuovo task, stesso giro): nessun gestionale
      italiano verificato lo fa nativamente -- messaggio automatico dopo l'appuntamento che
      chiede una valutazione, mostrata poi sulla pagina pubblica del salone (Fase 4). Si appoggia
      alla stessa infrastruttura di reminder/automazioni pianificata in Fase 6, non un sistema
      separato.

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
- [ ] Galleria/upload immagini (Supabase Storage) -- zero codice, colonne `logo_url`/`cover_url`
      esistono nello schema ma senza upload configurato.
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
      `notifiche.server.test.ts`. **"Sposta" (riprogrammare) NON incluso**: richiede un vero
      selettore di slot liberi (la stessa UI del flusso di prenotazione pubblica) -- lavoro a
      parte, non "contenuto" come la sola cancellazione. **Verifica dal vivo limitata dalla
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
- [ ] Pannello admin per te: saloni, abbonamenti, utilizzo, interventi manuali quando serve --
      zero codice.
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
- [ ] **BLOCCANTE prima di vendere Enterprise a un cliente vero** (stesso problema del Tono AI,
      trovato nel secondo giro del mega-controllo, 12/09/2026): `Prezzi.tsx` pubblicizza
      "Multi-sede e ruoli avanzati" su Enterprise, ma nello schema non esiste NESSUN concetto di
      "sede" (un tenant è un unico luogo fisico) e la colonna `profiles.ruolo` (owner/staff/
      admin_piattaforma) non è controllata da nessuna parte del codice -- ogni account che entra
      in dashboard ha accesso pieno, non esiste un vero "staff" con permessi limitati. Vedi anche
      il task "Multi-utente/team reale" in Fase 6 sotto, che è il prerequisito dei ruoli.

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
      `tsc`/`eslint`/`vitest` (119/119)/`build` puliti. **Non ancora verificato dal vivo**:
      migrazione `0011_deposito_caparra.sql` non applicata al database reale (serve l'ok di
      Gabriel, vedi DECISIONS.md 13/09/2026) + nessun pagamento di test reale ancora fatto.
      Vedere `docs/analisi-concorrenti-mercato.md`, sezione "AGGIORNAMENTO CRITICO", punto 3.
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
- [ ] **Multi-utente/team reale** (nuovo task, secondo giro mega-controllo 12/09/2026): dare a
      ogni "operatore" un proprio login (invito via email, permessi limitati alla propria
      agenda) invece di essere solo un record gestito dal titolare -- prerequisito tecnico dei
      "ruoli avanzati" venduti su Enterprise (vedi Fase 5) e della persona di marketing "salone
      con team" già usata in `PerChi.tsx`, che oggi non è ancora mantenuta tecnicamente.
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
