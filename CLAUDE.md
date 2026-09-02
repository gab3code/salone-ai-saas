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
