@AGENTS.md

# Istruzioni del progetto — Salone AI SaaS

Voglio che tu lavori nel modo più efficace possibile sfruttando al massimo Claude Cowork, il
workspace, gli strumenti disponibili, il browser, l'esecuzione del progetto, l'analisi dei
file e tutte le capacità che hai a disposizione.

L'obiettivo rimane quello definito in precedenza:

**COSTRUIRE UN SAAS SUPERIORE A ESTETIA**

Reference: https://estetia.tidycode.it/

Estetia rimane il nostro benchmark funzionale principale, ma continua a tenere presente la
visione più ampia del prodotto che abbiamo già definito: non voglio limitarti alle
funzionalità o ai casi d'uso specifici di Estetia.

## 1. Prima di continuare, capisci dove siamo arrivati

Non ricominciare il progetto.

Prima analizza lo stato attuale del lavoro e ricostruisci:

- cosa hai già implementato
- cosa stai implementando
- cosa manca
- quali decisioni architetturali sono già state prese
- quali componenti sono già stati creati
- quali funzionalità sono realmente funzionanti
- quali sono ancora mock/prototipi
- quali problemi hai già incontrato
- quali problemi sono ancora aperti
- quali parti richiedono un refactoring

Usa il lavoro e il contesto già presenti nel workspace.

Non rifare inutilmente cose già fatte.

## 2. Continua in modo autonomo

Da questo momento non voglio doverti dire continuamente:

"adesso fai questa cosa"

"adesso controlla quest'altra"

Voglio che tu lavori come un senior engineer autonomo.

Il ciclo di lavoro deve essere:

**ANALIZZA → PIANIFICA → IMPLEMENTA → TESTA → VERIFICA → CORREGGI → CONTINUA**

Quando una funzionalità è completa, passa autonomamente alla successiva.

Usa Cowork nel modo più efficace possibile:

- lavora direttamente sui file
- analizza più file quando necessario
- usa il browser per verificare il comportamento
- esegui il progetto
- controlla console/log/errori
- testa i workflow reali
- verifica il database
- verifica le integrazioni
- verifica il responsive
- verifica mobile
- esegui test ripetuti
- correggi autonomamente gli errori che trovi

Non fermarti al primo risultato che "sembra funzionare".

## 2bis. Il principio centrale del prodotto: un dipendente AI, non un gestionale (14/09/2026)

Da questo momento, ogni decisione di prodotto va giudicata con questo principio, non solo con
il confronto diretto con Estetia del punto 3 sotto (i due non sono in conflitto, sono due
strati diversi -- vedi la nota finale di questa sezione).

**Non stiamo vendendo un gestionale per appuntamenti con qualche funzione AI. Stiamo costruendo
un vero "dipendente AI" per professionisti che lavorano su appuntamento.**

La promessa a cui vogliamo arrivare: **"Non devi più gestire l'agenda."** Obiettivo: ZERO
INTERVENTO MANUALE del professionista (non di Gabriel -- quello è già il punto 29, qui parliamo
del titolare che usa il prodotto).

Niente onboarding fatto di "registrazione → configurazione complessa → decine di impostazioni →
template → automazioni → studio del gestionale". Deve essere: "registrazione → il professionista
descrive la propria attività → il sistema capisce come funziona → configura automaticamente ciò
che serve → il professionista è operativo".

Dopodiché il sistema deve lavorare da solo: cliente scrive → AI comprende la richiesta →
controlla disponibilità → propone gli slot migliori → prenota → aggiorna CRM → invia
conferme/reminder → gestisce modifiche e cancellazioni → cerca di recuperare appuntamenti
persi/cancellati → gestisce il follow-up → interviene un umano solo quando realmente necessario.

Ogni funzionalità si valuta rispetto a questo: se una parte del prodotto oggi obbliga il
professionista a fare a mano qualcosa che il sistema potrebbe ragionevolmente fare da solo, è un
problema da segnalare, non un dettaglio. Se una funzione è tecnicamente bella ma non rende il
sistema più autonomo o più utile al cliente, non ha priorità. Il cliente non deve pensare "ho
comprato un gestionale" -- deve pensare "ho assunto un assistente che si occupa dei miei
appuntamenti".

**Nota che evita un equivoco tra questo punto e il punto 23/`docs/analisi-concorrenti-mercato.md`**:
questo è un principio di COSA COSTRUIRE (guida le priorità di prodotto). Il materiale di vendita
resta un problema diverso, già analizzato a parte (competitor reali verificati: Calendix,
Skedula, CutApp hanno già un'AI che prenota da sola su WhatsApp, e Treatwell/Fresha l'hanno
appena lanciata anche loro) -- "l'AI risponde da sola" da solo non è più un argomento di vendita
differenziante, è già commodity. Si continua a vendere sui cinque argomenti verificati in
`docs/analisi-concorrenti-mercato.md` (zero commissione, prezzo mai a consumo, caparra anti-
no-show, target più ampio, fondatore raggiungibile) mentre si costruisce con la mentalità di
questa sezione. Le due cose non si contraddicono: si costruisce come un dipendente AI, si vende
con argomenti più difendibili di "abbiamo l'AI".

## 3. Implementa tutto quello che abbiamo individuato da Estetia

Voglio che tu continui a implementare tutte le funzionalità importanti che abbiamo
individuato analizzando Estetia.

Estetia deve essere la nostra:

**BASELINE FUNZIONALE.**

Quindi, progressivamente, dobbiamo arrivare a coprire tutto ciò che offre:

- gestione attività
- dashboard
- calendario
- prenotazioni
- clienti
- CRM
- professionisti/operatori
- servizi
- disponibilità
- automazioni
- reminder
- AI
- conversazioni
- pagina pubblica
- galleria fotografica
- analytics
- gestione account
- onboarding
- piani
- abbonamenti
- mobile
- eventuali altre funzionalità che scopri analizzando il prodotto

Non fermarti alle funzionalità che avevamo già elencato.

Se durante l'analisi di Estetia scopri altre funzioni o workflow importanti, aggiungili alla
lista di lavoro.

## 4. Ma non copiare Estetia ciecamente

Questa è una regola fondamentale.

Voglio che tu abbia sempre uno sguardo critico.

Estetia è il nostro riferimento, ma NON è necessariamente il modo migliore per fare ogni
cosa.

Per ogni funzionalità importante chiediti:

"Possiamo costruirla meglio?"

Per esempio:

- workflow più semplice
- meno click
- migliore UX
- migliore architettura
- maggiore automazione
- AI più intelligente
- migliore gestione degli edge case
- migliore esperienza mobile
- migliore onboarding
- migliore visualizzazione dei dati
- migliore integrazione tra le funzioni

Se pensi che la soluzione di Estetia sia buona:

implementiamola e, dove possibile, miglioriamola.

Se pensi che esista una soluzione nettamente migliore, NON implementarla automaticamente.

## 5. Quando trovi un'alternativa migliore, fermati e chiedimela

Questo è molto importante.

Se durante il lavoro trovi una decisione significativa in cui ritieni che:

Estetia → soluzione A

ma tu pensi che:

soluzione B → sia migliore

non decidere autonomamente se la differenza può avere un impatto importante sul prodotto.

Fermati e presentami brevemente:

**Soluzione di Estetia**

Cosa fa e come funziona.

**Tua proposta**

Cosa cambieresti.

**Perché**

Vantaggi e svantaggi.

**La mia raccomandazione**

Quale sceglieresti tu e perché.

Poi aspetta la mia decisione.

Non serve chiedermi conferma per ogni piccolo dettaglio.

Chiedimelo solo per decisioni realmente importanti, ad esempio:

- architettura
- database
- UX di un workflow centrale
- comportamento dell'AI
- sistema di prenotazione
- struttura dei piani
- billing
- onboarding
- multi-tenancy
- integrazioni
- modifiche che richiedono una riscrittura importante
- decisioni difficili da invertire

Per dettagli piccoli e reversibili, procedi autonomamente.

## 6. Priorità assoluta: workflow e funzionamento reale

Non voglio che il progetto diventi semplicemente una bellissima UI.

Ogni funzionalità deve avere un funzionamento reale dietro.

Quando implementi una schermata, chiediti:

"Cosa succede veramente quando l'utente usa questa funzione?"

Esempio:

Non basta avere un pulsante:

"Prenota appuntamento"

Deve realmente:

→ verificare disponibilità
→ applicare gli orari dell'attività
→ considerare professionista e servizio
→ evitare conflitti
→ creare il record
→ aggiornare calendario
→ aggiornare CRM
→ attivare eventuali automazioni
→ programmare reminder.

## 7. AI — voglio un sistema reale, non una demo

Continua a sviluppare la parte conversational AI in modo serio.

L'obiettivo è:

**AI RECEPTIONIST / BOOKING AGENT**

che possa realmente:

- comprendere messaggi naturali
- mantenere il contesto
- identificare il cliente
- comprendere il servizio
- comprendere data e ora
- verificare disponibilità
- proporre alternative
- creare appuntamenti
- modificare appuntamenti
- cancellare appuntamenti
- gestire più servizi
- gestire professionisti
- rispondere alle FAQ
- conoscere prezzi e durata
- conoscere orari
- gestire errori
- gestire slot occupati
- trasferire a un umano

E soprattutto:

**L'AI NON DEVE INVENTARE DATI.**

La logica deve essere:

MESSAGGIO
→ AI
→ intent/context
→ tools
→ backend
→ database
→ risultato
→ AI
→ risposta.

La disponibilità deve essere sempre verificata dal sistema reale.

## 8. Conversazioni persistenti

L'AI deve mantenere il contesto.

Esempio:

Cliente: "Vorrei un appuntamento."

AI: "Per quale servizio?"

Cliente: "Taglio."

AI: "Per quale giorno?"

Cliente: "Venerdì."

AI: "Che orario preferisci?"

Cliente: "Il pomeriggio."

L'AI deve ricordare tutto il contesto senza ricominciare da zero.

Gestisci anche:

- messaggi ambigui
- correzioni
- errori
- richieste multiple
- interruzioni
- cliente nuovo
- cliente esistente
- conversazioni lunghe
- passaggio a operatore umano
- eventuali messaggi vocali
- eventuali immagini quando utili

## 9. Booking engine

Implementa una vera booking engine.

Deve gestire:

- servizio
- professionista
- durata
- disponibilità
- orari
- pause
- ferie
- chiusure
- conflitti
- buffer
- slot
- cancellazioni
- modifiche
- no-show
- prenotazioni multiple
- servizi consecutivi

Soprattutto:

**AI e calendario devono utilizzare la stessa booking engine.**

Non voglio due sistemi separati.

## 10. Casi complessi di prenotazione

Testa e implementa:

**Prenotazione semplice**

Servizio → giorno → ora → conferma.

**Professionista specifico**

Servizio → professionista → disponibilità → ora.

**Professionista non specificato**

Il sistema sceglie automaticamente un professionista compatibile.

**Slot occupato durante la conversazione**

L'AI se ne accorge e propone alternative.

**Modifica**

Il cliente chiede di spostare l'appuntamento.

**Cancellazione**

Identificazione corretta della prenotazione e applicazione delle policy.

**Più servizi**

Il cliente richiede più servizi consecutivi.

Il sistema deve calcolare correttamente durata complessiva e disponibilità.

**Cliente nuovo**

Creazione automatica del profilo.

**Cliente esistente**

Riconoscimento tramite telefono/account.

## 11. Calendario

Il calendario deve essere il centro operativo.

Implementa:

- giorno
- settimana
- mese
- professionisti
- drag & drop
- modifica
- creazione rapida
- cancellazione
- spostamento
- filtri
- colori/stati
- conflitti
- disponibilità

Deve essere sincronizzato con tutto il sistema.

Se l'AI crea un appuntamento:

→ appare nel calendario.

Se il titolare sposta un appuntamento:

→ cambia la disponibilità.

Se viene cancellato:

→ lo slot torna disponibile.

Deve esistere una single source of truth.

## 12. CRM

Il CRM deve essere realmente collegato a:

- prenotazioni
- AI
- conversazioni
- servizi
- pagamenti
- reminder
- automazioni

La scheda cliente deve diventare il punto centrale della relazione con il cliente.

## 13. Automation engine

Implementa un vero sistema di automazioni.

Esempi:

**24 ore prima** → reminder.

**2 ore dopo** → follow-up.

**30 giorni senza prenotazione** → messaggio.

**Slot liberato** → possibile notifica ai clienti interessati.

**No-show** → workflow dedicato.

**Compleanno** → messaggio.

**Cliente inattivo** → campagna.

Le automazioni devono essere configurabili.

## 14. WhatsApp

Prepara l'architettura per WhatsApp Business/API.

Flusso ideale:

WhatsApp
↓ Webhook
↓ Conversation Engine
↓ AI
↓ Tools
↓ Booking Engine
↓ Database
↓ WhatsApp Response

Il cliente deve poter fare praticamente tutto tramite conversazione.

## 15. Pagina pubblica

Ogni attività deve poter avere automaticamente una pagina pubblica.

Deve mostrare:

- branding
- logo
- cover
- foto
- servizi
- prezzi
- durata
- professionisti
- disponibilità
- recensioni
- contatti
- posizione

e soprattutto:

**PRENOTA**

Il link deve essere facilmente condivisibile.

## 16. Foto e galleria

Voglio che questa parte sia superiore a Estetia.

L'attività deve poter gestire:

- logo
- cover
- galleria
- lavori
- prima/dopo
- professionisti
- servizi

Upload semplice, gestione ordinata e visualizzazione premium nella pagina pubblica.

## 17. Mobile

La gestione da smartphone deve essere una funzionalità primaria.

Non voglio semplicemente "responsive".

Voglio una vera esperienza mobile.

Il professionista deve poter essere fuori sede e:

- vedere appuntamenti
- modificare prenotazioni
- vedere clienti
- leggere conversazioni
- vedere dashboard
- gestire professionisti
- controllare revenue
- gestire impostazioni

anche completamente da smartphone.

Valuta seriamente una PWA:

- installazione
- icona
- fullscreen
- app-like experience
- push notifications
- offline handling dove sensato

## 18. Dashboard

La dashboard deve rispondere immediatamente:

"COME STA ANDANDO LA MIA ATTIVITÀ?"

Mostra:

- appuntamenti oggi
- revenue
- nuovi clienti
- clienti di ritorno
- cancellazioni
- no-show
- occupazione
- servizi
- professionisti
- slot vuoti

Ma voglio anche insight intelligenti.

Esempi:

"Domani hai 4 slot ancora disponibili."

"Il martedì ha un'occupazione inferiore del 22% rispetto alla media."

"12 clienti non prenotano da oltre 60 giorni."

E possibilmente:

**AZIONE** → "Contatta questi clienti."

## 19. Analytics

Implementa:

- revenue
- appuntamenti
- clienti
- retention
- churn
- no-show
- cancellazioni
- servizi
- professionisti
- occupazione
- valore medio
- nuovi clienti
- clienti di ritorno
- canale di acquisizione

## 20. Piani Free → Enterprise

Analizza i piani di Estetia:

- Free
- Starter
- Growth
- Pro
- Enterprise

Studia:

- cosa includono
- cosa escludono
- limiti
- posizionamento
- perché un cliente dovrebbe fare upgrade

Poi progetta una struttura migliore.

Non copiare semplicemente.

Il Free deve essere abbastanza potente da far innamorare il cliente del prodotto.

I piani premium devono avere un ROI evidente.

Il sistema deve tecnicamente applicare i limiti.

## 21. Admin panel

Voglio anche un pannello amministrativo per me.

Deve permettermi di vedere:

- attività
- utenti
- piani
- abbonamenti
- utilizzo
- AI usage
- WhatsApp usage
- metriche
- problemi
- account

e intervenire quando necessario.

Ma la piattaforma deve essere autonoma per la maggior parte delle operazioni.

**Vincolo aggiunto il 14/09/2026 (segnalato da Gabriel, giustamente)**: tutto quanto sopra è
metriche/utilizzo/account -- va bene senza limiti. Diverso il discorso per **leggere le
conversazioni AI vere tra un salone e i SUOI clienti finali**: lì Gabriel/Salone AI è
processore di dati per conto del titolare (che è il titolare del trattamento verso il proprio
cliente), non il proprietario di quel dato -- un accesso libero e non giustificato dal
fondatore della piattaforma è un problema di conformità reale (GDPR/Codice Privacy), non solo
di privacy percepita. Prima di costruire QUALUNQUE vista che mostri contenuto di conversazioni
reali tra un salone e i suoi clienti, serve una base giuridica chiara (es. clausola esplicita
nei termini di servizio verso il titolare, finalità limitata alla sola assistenza tecnica/
sicurezza, log di ogni accesso, mai un accesso "di curiosità"). Finché questo non è definito,
il pannello admin resta a metriche aggregate/anonime (quante conversazioni, quanti handoff,
quanti errori) e NON a trascrizioni leggibili -- rimosso dal piano attivo il 14/09/2026 per
questo motivo (vedi DECISIONS.md).

## 22. Workflow 02 → 03

Dai particolare attenzione ai workflow 02 e 03 di Estetia.

Analizzali in maniera estremamente dettagliata.

Non voglio una copia.

Voglio una versione migliore.

Se devi cambiare:

- layout
- componenti
- navigazione
- database
- flusso
- interazioni

fallo.

L'obiettivo è ridurre:

click + tempo + confusione

e aumentare:

automazione + chiarezza + velocità + valore percepito.

Questo deve diventare uno dei punti di forza assoluti del prodotto.

## 23. Trova le debolezze di Estetia

Dopo aver studiato Estetia, individua:

- funzioni mancanti
- workflow migliorabili
- UX migliorabile
- problemi di usabilità
- AI migliorabile
- automazioni mancanti
- analytics insufficienti
- problemi mobile
- funzioni nascoste
- passaggi inutili

Poi implementa le soluzioni quando hanno senso.

Non voglio essere:

"Estetia ma con un'altra grafica."

Voglio essere:

"Estetia evoluta."

## 24. UI / UX

Il prodotto deve sembrare un SaaS premium.

Ispirazione qualitativa:

- Apple
- Stripe
- Linear
- Notion
- modern SaaS

Ma con identità propria.

Evita:

- dashboard affollate
- card inutili
- gradienti esagerati
- troppe ombre
- UI da template
- tabelle inutilmente complesse
- componenti enormi
- colori casuali

## 25. Architettura

Se utilizziamo Supabase, analizza e migliora:

- database
- schema
- relazioni
- RLS
- Auth
- Storage
- Realtime
- Edge Functions
- API
- webhook
- AI architecture
- multi-tenancy

Progetta tutto per scalare.

## 26. Security

Controlla seriamente:

- RLS
- authentication
- authorization
- tenant isolation
- API
- webhook
- secrets
- storage
- AI tool permissions
- prompt injection
- input validation
- rate limiting
- access control

L'AI non deve poter eseguire operazioni pericolose senza controlli.

## 27. Test completo

Non fare test superficiali.

Crea scenari realistici.

**Scenario 1** — Nuovo cliente → conversazione → AI → prenotazione → calendario → CRM →
reminder.

**Scenario 2** — Cliente esistente → modifica appuntamento → verifica disponibilità →
aggiornamento.

**Scenario 3** — Due clienti cercano contemporaneamente lo stesso slot.

**Scenario 4** — Cliente chiede un servizio inesistente.

**Scenario 5** — Professionista assente.

**Scenario 6** — Attività chiusa.

**Scenario 7** — Servizio incompatibile con professionista.

**Scenario 8** — Slot occupato durante la conversazione.

**Scenario 9** — Cliente richiede più servizi consecutivi.

**Scenario 10** — Cliente cancella.

**Scenario 11** — Cliente non si presenta.

**Scenario 12** — Professionista crea manualmente una prenotazione.

**Scenario 13** — Nuova attività si registra e completa onboarding.

**Scenario 14** — Cliente effettua upgrade del piano.

**Scenario 15** — Cliente cancella abbonamento.

Testa anche moltissimi altri edge case.

## 27bis. Verifica dal vivo da solo, con l'estensione Chrome (14/09/2026)

Richiesta esplicita di Gabriel: quando una verifica si può fare dal vivo con l'estensione
Chrome sul suo browser reale già autenticato, falla tu -- non chiedere a lui di cliccare al
posto tuo. Vale per cose come:

- provare `/s/[slug]` dal vivo (ricerca slot, prenotazione, chat AI)
- il pannello Stripe (Dashboard, Checkout, webhook) in modalità TEST
- il pannello Vercel (env var, deployment, log, cron)
- il pannello Supabase (tabelle, SQL editor, log) quando non serve una migrazione che il
  classificatore della sandbox blocca
- il pannello Mailjet (mittenti, log invii)
- schermate di consenso OAuth (Google) per aggiungersi come utente di test

Restano validi i vincoli di sicurezza già in vigore in questa sessione (mai inserire password/
credenziali per suo conto, mai un pagamento/trasferimento reale, permesso esplicito prima di
modificare impostazioni di account -- permesso che per questo tipo di verifica di routine
Gabriel ha già dato con questa richiesta, ma resta comunque solo per operazioni non distruttive/
in modalità test). Se un passaggio richiede aprire la sua casella email personale (es. un link
di conferma mandato da Mailjet o Google), chiedi prima -- è un tipo di accesso diverso dal
navigare un pannello, non incluso automaticamente in questa richiesta.

## 27unvicies. Una funzione Postgres non ha una storia (18/09/2026)

Costata cara, quindi scritta per esteso.

La migrazione 0061 doveva aggiungere due campi alla riga `tenants` creata alla
registrazione. Per riscrivere `gestisci_nuovo_utente` ho cercato le migrazioni che la
definivano con un grep sbagliato (`al_nuovo_utente|provisioning`), che ha trovato solo la
0004 -- quella che l'aveva CREATA. Ho riscritto la funzione partendo da quel corpo.

Ma quella funzione era stata riscritta cinque volte dopo la 0004: 0017 (regola promemoria
predefinita), 0020, 0027 (la riga in `membri_tenant`), 0037, 0050 (l'invito che aspetta la
conferma dell'email). `create or replace` non fonde niente: sostituisce. In un colpo solo
il trigger di registrazione e' tornato indietro di dieci migrazioni, in silenzio.

Cos'e' rimasto rotto, in produzione, per ore: chi si registrava non aveva la riga in
`membri_tenant` (niente multi-sede, niente permessi di membro), non aveva la regola
promemoria predefinita, e chi arrivava da un invito si prendeva un tenant tutto suo invece
di entrare in quello che lo aveva invitato.

**Nessuno dei controlli veloci poteva vederlo.** Tipi, lint, 979 test unitari e `next build`
parlano del codice TypeScript. Cosa c'e' dentro il corpo di una funzione Postgres non lo
sanno e non lo possono sapere. L'hanno trovato gli scenari Playwright: 18, 19, 20 e 29
rossi tutti insieme, che e' esattamente la forma che ha un danno al trigger di
registrazione.

Le due regole che ne escono:

1. Prima di un `create or replace function`, cercare TUTTE le migrazioni che definiscono
   quel nome (`grep -l '<nome_funzione>' supabase/migrations/*.sql`), non solo quella che
   l'ha creata, e ripartire dall'ULTIMA. Una funzione Postgres non ha una storia leggibile
   nel database: l'ultima versione cancella le precedenti senza lasciare traccia, e nessuna
   query puo' dirti cosa c'era prima.
2. Se una funzione esiste in due copie che fanno la stessa cosa (qui
   `gestisci_nuovo_utente` e `gestisci_email_confermata`, che creano entrambe un tenant), la
   modifica va fatta a tutte e due nello stesso momento. La 0061 non aveva nemmeno guardato
   la seconda.

E la regola che vale anche fuori da qui: **un cambiamento al database si verifica solo con
uno scenario end-to-end.** Non esiste un controllo piu' economico che lo veda.

## 27vicies. I numeri li contiamo noi, le parole le scrive il modello (18/09/2026)

Due funzioni nuove fanno scrivere all'AI qualcosa che parte da solo verso una
persona vera, senza che nessuno lo rilegga: il richiamo ai clienti che non
tornano (Pro) e il report mensile (Pro).

E' una categoria diversa da tutto quello che l'AI faceva prima. Un errore
dell'assistente in chat lo vede il cliente e si corregge nella frase dopo; un
errore dentro un messaggio spedito a nome del salone diventa un impegno
commerciale che il titolare scopre alla cassa.

Le due regole che ne escono, e che vanno tenute per qualunque cosa simile:

1. **Quello che il modello non deve poter fare si blocca con un controllo, non
   con una richiesta nel prompt.** "Non inventare sconti" nel system prompt e'
   un'istruzione; il controllo che rifiuta un testo contenente "sconto", una
   cifra con l'euro o un link e' una garanzia. Il prompt lo si scrive
   comunque, ma la garanzia sta nel codice, con i suoi test.
2. **Nel report i numeri li calcola il codice e il modello non puo' scriverne
   nemmeno uno** (il commento con dentro una cifra viene scartato). Cosi'
   l'errore peggiore -- un titolare che decide qualcosa su un numero
   ricordato male -- non dipende da quanto e' bravo il modello: non puo'
   proprio succedere.

Terza regola, sul degrado: quando il controllo boccia il testo, o la quota e'
finita, il messaggio parte lo stesso nella versione fissa. Saltare il
contatto per un problema nostro farebbe perdere al salone un cliente vero.

## 27novodecies. Le mezze funzionalita' (18/09/2026)

Tre cose trovate nello stesso giorno, tutte della stessa forma: un pezzo
c'era, il pezzo che lo rendeva vero no.

- `chiusure`: tabella dalla 0002, letta dal motore, scritta da nessuna
  schermata. Le ferie non erano inseribili dal prodotto.
- `bufferMinuti`: parametro nel motore, documentato, con un test verde. Non
  lo passava nessuna delle quattro schermate che cercano slot: valeva zero
  per tutti, in produzione, da sempre.
- `attivo` su operatori e servizi: colonna dalla 0001, letta dal motore, mai
  scritta. Il "disattiva" esisteva a database e non esisteva nel prodotto.

Sono tutte peggio di una funzionalita' mancante, perche' si presentano come
fatte: il codice le nomina, i commenti le spiegano, un test le copre. La
domanda che le smaschera non e' "c'e' il codice?" ma **"un utente puo'
arrivarci da una schermata?"**.

Da qui la regola di verifica che vale per tutto il progetto: quando un dato
attraversa piu' livelli, il test che conta e' quello sul livello piu' esterno
che l'utente tocca davvero. Lo scenario Playwright 30 esiste per questo.

## 27octodecies. Un rifiuto che nessuno vede (18/09/2026)

Aggiunta la guardia che impedisce di cancellare un operatore con
appuntamenti, il bottone Elimina ha smesso di fare qualunque cosa: il valore
di ritorno della server action finiva nel vuoto, perche' i form della pagina
lo scartavano. L'utente cliccava e non succedeva niente.

Togliere la cosa pericolosa e mettere al suo posto una schermata che non
risponde e' un peggioramento, non un miglioramento: prima almeno il prodotto
era coerente. Da qui `BottoneAzione.tsx`, che mostra quello che l'azione
risponde -- e il messaggio non dice solo di no, dice cosa fare invece.

Nota per il futuro: in questa dashboard TUTTE le altre azioni scartano il
proprio valore di ritorno allo stesso modo. Non e' un problema finche'
falliscono solo per errori tecnici, lo diventa il giorno in cui una di loro
comincia a rifiutare per una ragione di prodotto.

## 27septdecies. L'AI propone uno stato finale, il diff lo calcoliamo noi (18/09/2026)

L'onboarding AI sapeva solo aggiungere. Gabriel ha detto "siamo in due" a un
salone che aveva gia' due operatori e se ne e' ritrovati quattro. Non era un
difetto del modello: la bozza non conteneva nessun riferimento a cio' che
esisteva, quindi non c'era proprio modo di riconoscere una riga gia' li'.

La soluzione NON e' stata chiedere al modello di emettere operazioni ("crea
questo, cancella quello"). Il modello vede la configurazione attuale con gli
id e restituisce lo STATO FINALE; il confronto fra prima e dopo lo fa
`src/lib/onboarding-ai-diff.ts`, che e' puro, deterministico e coperto da
test. Un modello che sbaglia produce al massimo uno stato finale strano, che
si vede in revisione. Non produce mai una DELETE che nessuno aveva chiesto.

Tre regole che valgono oltre questo file:

1. **Il silenzio non e' un ordine.** Una riga esistente che il modello non
   nomina diventa una PROPOSTA di rimozione, che in revisione parte non
   spuntata. Vale anche per i campi: durata e prezzo non ripetuti a voce non
   si azzerano, restano quelli.
2. **"Vuoto" e "non ne ha parlato" sono cose diverse** dove possono esserlo.
   Per le associazioni, elenco vuoto = "nessuno fa piu' niente", campo assente
   = "lascia stare quello che c'e'". Un solo tipo per tutti e due avrebbe
   cancellato collegamenti veri.
3. **Il modello non tocca il database.** Ogni scrittura passa dalle azioni
   granulari che esistevano gia', con i loro limiti di piano e le loro
   guardie. Questo livello decide l'ORDINE (creazioni, poi collegamenti, poi
   rimozioni), non le regole.

## 27sexdecies. Un test verde su una funzione non e' un test sul prodotto (18/09/2026)

Trovato mentre si collegavano le regole d'agenda, ma il punto e' generale.

`bufferMinuti` esisteva nel motore dalla Fase 1, era documentato, aveva un
test verde -- e nessuna delle quattro schermate che cercano slot lo passava.
In produzione valeva zero per tutti. Il test dimostrava che la funzione sa
usare il buffer, non che il prodotto lo usi.

Stessa famiglia, stesso giorno: le associazioni operatore-servizio venivano
calcolate e passate correttamente, ma la schermata di revisione non le
mostrava affatto -- e se il titolare correggeva un nome, sparivano in
silenzio, perche' il collegamento era per nome. Nessun test era rosso.

Regola: quando un dato attraversa piu' livelli, il test che conta e' quello
sul livello piu' esterno che l'utente tocca davvero. E se un dato esiste ma
non si vede da nessuna parte nell'interfaccia, non e' "quasi fatto": e'
qualcosa su cui nessuno potra' mai accorgersi di un errore.

## 27quindecies. Le regole d'agenda sono del salone, non del codice (18/09/2026)

Migrazioni 0056 e 0057. Tre parametri che erano costanti nel codice (passo,
buffer, modalita' di riempimento) e gli orari del singolo operatore.

Il pezzo che vale la pena ricordare non e' la funzionalita', e' come si era
nascosto il buco: `bufferMinuti` esisteva nel motore dalla Fase 1, era
documentato, aveva un suo test verde -- e nessuna delle quattro schermate che
cercano slot lo passava. Il test provava che la funzione sa usare il buffer,
non che il prodotto lo usi. Per un anno intero avremmo potuto dire "c'e' il
buffer" in buona fede.

Regola: quando un parametro attraversa piu' livelli, il test che conta e'
quello sul livello piu' esterno che l'utente tocca davvero. Un test sulla
funzione pura dimostra solo che la funzione e' scritta bene.

Seconda cosa, sulle intersezioni: gli orari dell'operatore si INTERSECANO con
quelli del salone, non li sostituiscono. Scrivere 07:00-22:00 nella scheda di
un dipendente non deve poter riaprire il salone di nascosto -- e' lo stesso
principio dei permessi, il livello piu' restrittivo vince sempre.

## 27quattuordecies. La suite intera gira in un container Linux (18/09/2026)

Sul Mac di Gabriel, attraverso il ponte, `vitest` non parte: i binari nativi
installati in `node_modules` sono quelli di macOS e la VM del ponte e' Linux.
Per mesi questo ha voluto dire eseguire solo i file di test che si riuscivano a
copiare a mano in un sandbox -- cioe' non eseguire la suite.

Il modo che funziona: `tar` di `src/`, `supabase/`, `package.json`,
`package-lock.json`, `tsconfig.json` sul Mac, staging dell'archivio,
estrazione in un container Linux, `npm ci --legacy-peer-deps`, `vitest.config.mts`
ricreato identico (alias `@` e stub di `server-only`), `npx vitest run`.
Meno di un minuto in tutto, e la prima volta ha trovato subito tre test che i
file singoli davano per verdi.

Regola: **una modifica non e' verificata finche' non e' passata la suite
intera.** `tsc --noEmit` sul Mac va bene per i tipi e non dice niente sul
comportamento.

## 27terdecies. La griglia degli slot si ancora all'apertura (18/09/2026)

Gabriel ha messo un evento 13:40-15:40 e gli slot liberi dopo sono usciti
15:40, 15:55, 16:10. Non era un bug di fuso ne' di import: `calcolaSlotDisponibili`
faceva ripartire il passo di 15 minuti dall'inizio di OGNI finestra libera, quindi
qualunque impegno che finisce fuori griglia sfasava tutto il resto della giornata.

Ora il passo e' ancorato all'apertura del giorno (`apertura[0].inizioMin`) e ogni
finestra libera salta al primo punto di griglia utile. Il prezzo e' esplicito e
accettato: si perdono al massimo `passoMinuti - 1` minuti di poltrona dopo un
impegno fuori griglia, in cambio di orari che un cliente sa leggere. L'altra
scelta (riempire al minuto, orari brutti) e' arrivata poche ore dopo, ed e'
stata davvero un parametro in piu' e non una riscrittura: modalita'
"attaccato", vedi 27quindecies.

Regola generale dietro: quando un calcolo produce una LISTA che un umano dovra'
leggere, l'allineamento non e' un dettaglio estetico -- e' parte della correttezza.

## 27duodecies. I segreti che non sono nostri si cifrano (18/09/2026)

Nella tabella `collegamenti_calendario_esterni` ci sono la password specifica
per app di un calendario iCloud e il refresh token Google di un account
personale. Non sono dati del salone: sono le chiavi di casa di una persona,
lasciate in custodia. Dal 18/09 si scrivono cifrate (`src/lib/cifratura.ts`,
AES-256-GCM, chiave in `SALONE_CHIAVE_CIFRATURA`).

Tre cose da sapere prima di toccare quel codice:

1. **`decifra` accetta anche il testo in chiaro, ed e' voluto.** Le righe
   scritte prima esistono ancora: se pretendesse il formato nuovo, al deploy
   tutti i calendari gia' collegati smetterebbero di sincronizzare insieme.
   Cosi' invece continuano a funzionare e si cifrano alla prima riscrittura.
   `npm run cifra-credenziali -- --applica` le converte tutte in una volta,
   ed e' un passo da fare UNA VOLTA per database: finche' non e' stato
   lanciato, il lavoro e' fatto a meta'.
2. **Senza chiave non si scrive.** `cifra` lancia: meglio un collegamento che
   non si salva e lo dice, che il segreto di qualcun altro finito in chiaro
   senza che nessuno se ne accorga. La lettura delle righe vecchie invece
   continua a funzionare anche senza chiave.
3. **Cifrare non difende da chi ha la service_role key** -- quella legge anche
   la chiave. Difende da tutti gli altri modi in cui una riga finisce dove non
   dovrebbe: un collega che interroga PostgREST, un backup nel posto sbagliato,
   una copia del database su un portatile.

Resta aperto l'altro mezzo punto della stessa voce: revocare le credenziali
quando chi le ha collegate esce dall'attivita'.

## 27undecies. `npm run permessi` prima di dire "fatto" (18/09/2026)

Dopo OGNI migrazione che tocca grant, revoke o policy, su OGNI database a cui
e' stata applicata:

    npm run permessi            # produzione (.env.local)
    npm run permessi -- --test  # database di test (.env.test)

Confronta i permessi VERI con quelli che i file delle migrazioni dichiarano,
e dice dove divergono. Esce con codice 1 se trova qualcosa.

Esiste perche' il 18/09 lo stesso errore e' successo due volte in direzioni
opposte, e nessuna delle due era visibile:

- **0030**: revoche fatte a mano in produzione e mai scritte in un file.
  Ricostruendo il database dal repo sarebbe nato spalancato.
- **0051**: revoca nel file e nel database di test, dimenticata in produzione
  per ore, con il codice gia' online. Il prodotto funzionava benissimo --
  quel permesso non lo usa piu' nessuno. Cambiava solo chi poteva scaricarsi
  la rubrica clienti saltando l'applicazione.

Nessun test poteva accorgersene: i test girano sul database di test, che era
giusto. E il prodotto non da' nessun segno, ne' in un caso ne' nell'altro.

Il calcolo dai file sta in `src/lib/permessi-attesi.ts` ed e' puro e testato.
La lettura del database vivo passa dalla funzione `permessi_correnti()`
(migrazione 0053), eseguibile solo da `service_role`.

Due cose da non semplificare in quel file: una REVOKE sulla tabella porta via
anche i grant di COLONNA (e' la trappola che nella prima 0049 annullava la
0030), e `on all tables in schema public` contiene la parola "schema" ma NON
e' un grant sullo schema -- scartarla farebbe sparire dal calcolo le revoche
piu' importanti che abbiamo.

## 27decies. Sentry: cosa NON deve uscire da qui (18/09/2026)

La diagnostica degli errori e' accesa (`@sentry/nextjs`), con tre scelte che
NON vanno annullate da una procedura guidata o da un "aggiorniamo la
configurazione":

1. **Niente Session Replay.** E' quello che il wizard di Sentry accende da
   solo, e registra lo schermo dell'utente: qui vuol dire la rubrica di un
   salone. Se un giorno servisse, si decide con l'informativa privacy in mano.
2. **`beforeSend` passa da `sentry-riservatezza.ts`**, che toglie email,
   telefoni, termini di ricerca (sono nomi di clienti), cookie di sessione e
   corpo dei form, e tiene percorso e id. Ha i suoi test: se qualcuno li
   cancella perche' "danno fastidio", il filtro smette di funzionare in
   silenzio, che e' il peggio che possa capitare a un filtro.
3. **Tracce di prestazione a zero** (`SENTRY_TRACCE_CAMPIONE`): il piano
   gratuito ha una quota e le tracce la bruciano molto prima degli errori.

La regione dei dati e' **europea** (Francoforte, `de.sentry.io`), scelta alla
creazione dell'organizzazione e non piu' modificabile. Per il caricamento
delle source map serve `SENTRY_URL=https://de.sentry.io`, altrimenti il
plugin parla col dominio americano e non trova il progetto.

Nota su Turbopack: questo progetto compila con Turbopack, quindi le opzioni di
`withSentryConfig` che appartengono al builder webpack (`disableLogger`,
`automaticVercelMonitors` e le altre sotto `webpack.`) non hanno alcun effetto.
Non aggiungerle: il build le segnala come deprecate e restano righe che
sembrano fare qualcosa senza farla.

Sentry e' elencato fra i fornitori nell'informativa privacy: chi aggiunge un
fornitore che tocca dati dei clienti aggiorna anche quella pagina, sempre.

Verifica: pannello /admin, bottone "Prova la diagnostica errori". Esiste
perche' la diagnostica rotta non da' nessun segno -- il silenzio e' anche il
risultato che ci si aspetta quando funziona.

## 27novies. `Link` ovunque, tranne i quattro casi in cui rompe (18/09/2026)

Nella dashboard i link interni usano `Link` di next/link: un `<a href>` fa
ricaricare il documento intero e rieseguire tutto il JavaScript a ogni clic.

Quattro eccezioni, che devono restare `<a>` e che un "convertiamoli tutti"
romperebbe in silenzio:

1. **`/dashboard/clienti/export`** -- non e' una pagina, e' una rotta che
   restituisce un file. Con `Link` il download non parte.
2. **`target="_blank"`** (anteprima pagina pubblica, demo).
3. **`download=`** (il QR code in CondividiLink.tsx).
4. **href non letterali verso `/api/...`** (il collegamento Google in
   pannello-calendari.tsx).

Il criterio in una riga: `Link` serve a navigare fra PAGINE dell'app. Se
l'indirizzo produce un file, apre un'altra scheda o parla con una rotta API,
resta un `<a>`.

Sempre dalla stessa sessione: ogni sezione della dashboard ha un
`loading.tsx` che disegna la forma della pagina in arrivo (vedi
`scheletro-caricamento.tsx`). Senza, il browser resta fermo sulla pagina
vecchia mentre il server lavora, e mezzo secondo di immobilita' si legge come
"non ha registrato il clic".

## 27octies. Un test non si costruisce il client Supabase da solo (18/09/2026)

Con il database di test separato, `.env.local` punta a PRODUZIONE e `.env.test`
al database dei test. Un file di test che fa

  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

sta quindi parlando con la produzione, mentre i helper creano il tenant di
prova nel database di test. L'errore che ne esce e' `Invalid login
credentials`: sembra la password, e' l'indirizzo.

Il client si prende sempre da `tests/e2e/helpers/supabase-admin.ts`
(`creaClientAdminTest` per la service_role, `creaClientAnonimoTest` per la
chiave pubblica): passano entrambi da `risolviDatabaseDiProva`, che e' l'unico
posto che decide quale database. `database-di-prova.test.ts` ha una guardia che
legge il testo dei `.spec.ts` e fallisce se qualcuno torna a leggere quelle
variabili a mano.

Sempre da qui: l'esclusione di vitest e' `tests/e2e/**/*.spec.ts`, non
`tests/e2e/**`. La seconda portava via anche i test vitest che stanno dentro
`tests/e2e/helpers/` -- scritti e mai eseguiti nemmeno una volta.

## 27septies. La tabella `clienti` si tocca solo da `clienti.server.ts` (18/09/2026)

Dalla migrazione 0051 il ruolo `authenticated` su `clienti` non ha piu' nessun
permesso: ne' lettura ne' scrittura, titolare compreso. Vuol dire che

  supabase.from("clienti")...

con il client di una pagina o di una server action NON funziona piu', e non
fallisce sempre in modo rumoroso: una lettura senza permesso puo' tornare zero
righe, che dal codice sembra "nessun cliente" invece di "non ti e' permesso".
Lo stesso vale per un embed PostgREST: `select("..., clienti(nome)")` dentro
una query su `appuntamenti` torna semplicemente `null` al posto del nome.

Ogni accesso passa da `src/lib/clienti.server.ts`, che usa il client admin. Il
client admin bypassa RLS, quindi dentro quel file il filtro sul tenant e'
l'unica difesa rimasta: due regole, scritte anche nell'intestazione del file,
`tenantId` sempre primo parametro e `.eq("tenant_id", tenantId)` su ogni
query, anche quando sembra ridondante. `clienti.server.test.ts` le verifica su
ogni funzione esportata e fallisce se ne aggiungi una senza aggiungere il suo
caso alla lista `INVOCAZIONI` -- e' voluto, non e' un test da aggirare.

Restano legittime le query dirette fatte col client admin (webhook, cron,
strumenti dell'AI, pagina pubblica): quelle non passano da `authenticated` e la
0051 non le tocca. Se pero' stai scrivendo codice che gira per conto di un
utente loggato, la risposta e' sempre il gateway.

## 27sexies. Aspettare il secondo effetto, non solo il primo (18/09/2026)

Quando un'azione ha piu' effetti in sequenza, un test che aspetta il PRIMO e
poi legge il secondo una volta sola e' una race condition travestita da
asserzione.

Lo Scenario 10 lo faceva: `expect.poll` fino a "appuntamento cancellato", poi
una lettura secca dello stato in lista d'attesa. Ma nella server action la
cancellazione viene prima, e la ricerca del candidato dopo, con altre due o
tre query di mezzo. Nell'istante in cui il poll esce, la seconda riga non e'
ancora cambiata.

Col server caldo passava, col server freddo no. Ed e' il modo peggiore di
fallire: dava la colpa al prodotto, che faceva la cosa giusta, e mandava a
cercare un bug che non c'era -- sono stati tre giri prima di capirlo.

Regola: ogni effetto che arriva DOPO quello su cui si sincronizza il test va
aspettato a sua volta con `expect.poll`, non letto.

## 27quinquies. Cosa puo' catturare una Server Action inline (18/09/2026)

Una Server Action scritta dentro il JSX (`action={async () => { "use server"; ... }}`)
cattura le variabili che la circondano, e Next PROVA A SERIALIZZARLE tutte.
Quindi puo' catturare solo valori serializzabili: stringhe, numeri, booleani,
array e oggetti semplici. **Mai una funzione, mai un oggetto come
URLSearchParams, Date o Map.**

Costato caro una volta: la correzione dell'audit sugli errori silenziosi aveva
messo un helper `tornaConErrore` come chiusura dentro il componente. Le tre
azioni del calendario lo catturavano, Next lanciava "Functions cannot be
passed directly to Client Components", e segnare un'assenza, cancellare e
spostare un appuntamento dalla pagina piu' usata della dashboard smettevano di
funzionare -- in silenzio: nessun messaggio, il pulsante cliccato, la pagina
ricaricata identica. Ed era gia' in produzione.

Come si evita: l'helper va a livello di MODULO e riceve quello che gli serve
come parametri (un riferimento di modulo non viene serializzato, una chiusura
si). Se serve un URLSearchParams dentro l'azione, si cattura la stringa
(`.toString()`) e lo si ricostruisce dentro.

Come si scopre: un test che controlla il DATABASE dopo il clic, non lo schermo.
Lo Scenario 11 ha trovato questo bug proprio perche' rileggeva lo stato
dell'appuntamento invece di fidarsi di quello che la pagina mostrava. Un test
che guardasse solo la UI sarebbe passato.

## 27quater. Git sul Mac di Gabriel attraverso il ponte (17/09/2026)

Il ponte monta la cartella del progetto senza permesso di cancellare file, se
non lo si chiede. Git invece cancella file a ogni scrittura: crea
`.git/index.lock` e `.git/HEAD.lock`, scrive, e li rimuove. Senza permesso di
cancellare, la scrittura RIESCE ma i lock restano, e il comando git successivo
muore con "Another git process seems to be running in this repository".

E' successo davvero: un `git gc` lanciato in automatico da git ha lasciato 26
file `.lock` (compresi `HEAD.lock` e `refs/heads/main.lock`), e da li' in poi
ogni comando git falliva. Disattivare `gc.auto` NON risolve: il problema e' di
ogni scrittura, non solo del gc.

La soluzione e' chiedere il permesso di cancellare sulla cartella del progetto
(`device_request_delete_permission`) PRIMA di fare commit da qui. Con quello
git si comporta normalmente.

Se il permesso non c'e' e non si puo' chiedere: non fare commit da qui. In
emergenza i lock si tolgono spostandoli (`mv`) in una sottocartella, ma e' una
pezza che va rifatta a ogni singola scrittura.

Da notare: il Terminal vero del Mac di Gabriel non ha nessuna di queste
limitazioni. I suoi `git push`, `git commit`, `git status` funzionano sempre.

## 27ter. Come si scrive la precondizione di un test play (17/09/2026)

Sbagliata tre volte nello stesso giorno, quindi vale la pena scriverla.

Un test play apre sempre con "sei sul lavoro giusto?". La versione sbagliata e':

    git log --oneline -1
    Atteso: <hash>

Quell'hash scade da solo. Scade quando il bundle viene mergiato (l'atteso era la
base, non la punta), scade a ogni push successivo, e scade perfino per il commit
che corregge il test play. Gabriel si e' fermato a meta' test play per questo, e
ha fatto bene a fermarsi: il documento gli stava dicendo che mancava del lavoro
che invece c'era.

La versione giusta chiede che il codice da testare sia **presente nella storia**,
non che sia la punta:

    git merge-base --is-ancestor <hash del lavoro> HEAD && echo "codice presente"
    git status --porcelain

Il primo comando resta vero per sempre; il secondo deve stampare niente. Un hash
si cita come punta attesa solo dentro il blocco che fa il merge di un bundle, e
quel blocco va marcato come storico appena il merge e' avvenuto.

Corollario: niente commenti con `#` in coda a una riga di comando data a Gabriel
-- la sua zsh non ha `interactive_comments` e se lo mangia come argomento.

Due corollari sul blocco SQL, imparati lo stesso giorno sulla sezione 3 dei
limiti per IP:

- **Una query per blocco.** L'editor SQL di Supabase mostra solo il risultato
  dell'ULTIMA query eseguita. Cinque controlli incollati insieme danno un solo
  risultato a schermo e sembrano quattro controlli persi. In piu', se
  l'autocompletamento storpia una riga a meta' incolla, salta tutto il blocco
  invece di un controllo solo.
- **Mai affidarsi all'ordine di valutazione di `union all`.** Postgres non lo
  garantisce. Una sequenza di chiamate a una funzione che scrive va incatenata
  con CTE `materialized` dove ogni passo legge dal precedente, cosi' l'ordine
  nasce da una dipendenza vera e non dalla fortuna.

## 28. Self-service SaaS

Continua verso un sistema completamente self-service.

Il flusso finale deve essere:

LANDING
↓ REGISTRAZIONE
↓ SCELTA PIANO
↓ PAGAMENTO
↓ CREAZIONE AUTOMATICA ACCOUNT
↓ ONBOARDING
↓ CONFIGURAZIONE ATTIVITÀ
↓ SERVIZI + PROFESSIONISTI + ORARI
↓ AI
↓ PAGINA PUBBLICA
↓ ATTIVITÀ OPERATIVA

Io devo avere il minimo intervento possibile.

## 29. Zero configurazione manuale da parte mia

Questo è un requisito fondamentale.

Immagina:

Un nuovo professionista entra sul nostro sito alle 14:00.

Alle 14:15 deve poter avere:

- account
- abbonamento
- attività
- servizi
- professionisti
- orari
- pagina pubblica
- calendario
- CRM
- AI
- sistema prenotazioni

operativi.

Io non devo:

- creare database manualmente
- creare account
- configurare attività
- attivare AI
- creare pagine
- configurare calendario
- modificare codice
- attivare manualmente l'abbonamento

Deve essere tutto automatizzato.

## 30. Non avere paura del refactor

Se scopri che una parte implementata precedentemente non è abbastanza solida:

non costruire sopra una base sbagliata solo per evitare di rifarla.

Se serve:

- refactoring
- riscrittura
- migrazione
- nuovo componente
- nuovo schema
- nuova API
- nuova architettura

fallo.

Preferisco avere una base solida piuttosto che accumulare workaround.

## 31. Quando devi chiedermi

Voglio un equilibrio tra autonomia e collaborazione.

NON chiedermi per:

- piccoli bug
- piccoli miglioramenti UI
- refactoring locali
- naming
- piccoli dettagli
- errori facilmente risolvibili
- implementazioni ovvie

CHIEDIMI prima per:

- cambiamenti architetturali importanti
- decisioni irreversibili
- modifiche sostanziali al database
- cambiamenti importanti al workflow
- decisioni che influenzano il business model
- comportamento centrale dell'AI
- scelte tra due approcci molto diversi
- integrazioni esterne importanti
- qualsiasi cosa per cui ritieni che una soluzione alternativa possa essere significativamente
  migliore

Quando mi chiedi qualcosa, non limitarti a:

"Posso fare A o B?"

Dammi invece:

**A** — vantaggi / svantaggi

**B** — vantaggi / svantaggi

**La mia raccomandazione** — X

e decidiamo insieme.

## 32. Non voglio una roadmap teorica

Non voglio che il risultato finale sia:

"Potremmo implementare X, Y e Z."

Se una cosa è necessaria:

**IMPLEMENTALA.**

Puoi:

- modificare componenti
- eliminare componenti
- riscrivere pagine
- creare nuove pagine
- modificare database
- creare tabelle
- creare API
- creare funzioni
- modificare UX
- cambiare workflow
- cambiare architettura
- aggiungere funzionalità

Hai libertà di modificare radicalmente il progetto.

## 33. Definizione di "finito"

Il lavoro NON è finito quando:

"La UI sembra bella."

Il lavoro è finito quando un'attività completamente nuova può:

entrare nel sito
↓ registrarsi
↓ scegliere un piano
↓ pagare
↓ configurarsi
↓ aggiungere servizi/professionisti/orari
↓ pubblicare automaticamente la propria pagina
↓ ricevere una prenotazione
↓ farla gestire dall'AI
↓ vederla nel calendario
↓ avere il cliente nel CRM
↓ inviare automaticamente il reminder
↓ gestire tutto da smartphone

senza che io debba intervenire manualmente.

Questo è il vero obiettivo.

## Regola definitiva

Voglio che tu lavori come se fossi parte del team fondatore.

Non limitarti a eseguire istruzioni.

Pensa al prodotto.

Se Estetia fa qualcosa bene:

→ capiscilo e implementalo.

Se Estetia fa qualcosa male:

→ proponi qualcosa di migliore.

Se manca qualcosa:

→ individua il problema e proponi una soluzione.

Se la soluzione che hai in mente è significativamente migliore di quella che stavamo
progettando:

→ FERMATI, SPIEGAMELA E DECIDIAMO INSIEME.

Per tutto il resto:

non aspettare me. Lavora autonomamente e porta avanti il progetto.

Continua quindi dal punto esatto in cui sei arrivato e sfrutta al massimo Cowork e tutti gli
strumenti disponibili.

L'obiettivo non è creare una copia di Estetia.

L'obiettivo è creare un prodotto che possa essere messo accanto a Estetia e far pensare:

**"Questo è chiaramente migliore."**

---

*Riferimenti*: `PIANO.md` (piano a fasi con criteri di "fatta"), `PROJECT_STATUS.md` (stato
reale del progetto, aggiornato ad ogni cambiamento), `DECISIONS.md` (registro delle decisioni
prese), `docs/analisi-estetia.md` (analisi del benchmark).
