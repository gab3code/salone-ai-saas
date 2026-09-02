@AGENTS.md

# Salone AI SaaS — istruzioni permanenti del progetto

**Leggi questo file per intero all'inizio di ogni sessione, prima di fare qualunque cosa.**
Poi leggi `PROJECT_STATUS.md` (stato reale, cosa funziona/cosa manca) e `DECISIONS.md`
(decisioni architetturali già prese, per non rimetterle in discussione senza motivo).
`PIANO.md` resta il piano a fasi con i criteri di "fatta". Questi quattro file insieme sono
la memoria del progetto: non ripartire da zero, non rifare cose già fatte, non richiedere a
Gabriel di rispiegare il contesto.

## Missione

Costruire un SaaS self-service multi-tenant per **qualsiasi libero professionista con
appuntamenti** (non solo centri estetici/parrucchieri — deciso il 02/09/2026, vedi
DECISIONS.md): personal trainer, massaggiatori, consulenti, tatuatori, fisioterapisti, e il
mercato originale (saloni/barbieri) restano il caso d'uso di lancio perché è lo stesso
mercato del benchmark.

**Benchmark funzionale**: https://estetia.tidycode.it/ (analisi completa in
`docs/analisi-estetia.md`). Estetia è la **baseline**, non il tetto. L'obiettivo non è "Estetia
con un'altra grafica" — è un prodotto che, messo accanto a Estetia, faccia pensare
"questo è chiaramente migliore". Non limitarti alle funzionalità o ai casi d'uso specifici di
Estetia: usa anche la visione più ampia di prodotto già definita in questo file e in PIANO.md.

## Come lavoro — ciclo autonomo

Non fermarmi a chiedere "adesso faccio questo?" per ogni passo. Il ciclo è:

**ANALIZZA → PIANIFICA → IMPLEMENTA → TESTA → VERIFICA → CORREGGI → CONTINUA**

Quando una funzionalità è completa e verificata, passo autonomamente alla successiva. Uso
Cowork al massimo per farlo per davvero, non sulla carta:
- lavoro direttamente sui file, ne leggo/analizzo più di uno quando serve
- uso il browser (bridge sul Mac di Gabriel) per verificare comportamento reale, non solo
  leggere il codice — è così che ho trovato e corretto il bug dei GRANT mancanti e verificato
  l'intero ciclo prenotazione/modifica/cancellazione in Fase 1
- eseguo il progetto (`npm run build`, `npm run dev`, `npx vitest run`) ad ogni modifica
  significativa, non solo alla fine
- controllo console/log/errori del browser e del server
- verifico il database vero (query dirette via client autenticato, mai solo assunzioni)
- verifico responsive/mobile quando la UI è la parte in lavorazione
- non mi fermo al primo risultato che "sembra funzionare" — lo riproduco davvero (vedi la
  metodologia già usata: riprodurre un bug nel browser reale prima di dichiararlo risolto)

## Non copiare Estetia ciecamente

Per ogni funzionalità importante: "possiamo costruirla meglio?" — workflow più semplice, meno
click, UX migliore, più automazione, AI più intelligente, migliore gestione degli edge case,
migliore mobile, migliore onboarding, migliore visualizzazione dati, migliore integrazione tra
funzioni. Se la soluzione di Estetia è buona, implementarla e dove possibile migliorarla. Se
esiste un'alternativa **nettamente migliore**, non implementarla di iniziativa — vedi sotto.

## Quando fermarmi e chiedere

Non chiedere per: piccoli bug, micro-miglioramenti UI, refactoring locali, naming, dettagli
reversibili, implementazioni ovvie. Chiedere PRIMA per: architettura, decisioni irreversibili,
modifiche sostanziali al database, cambiamenti importanti al workflow, decisioni che
influenzano il business model, comportamento centrale dell'AI, sistema di prenotazione,
struttura piani/billing, onboarding, multi-tenancy, integrazioni esterne importanti, o
qualunque bivio dove un'alternativa a quella già decisa potrebbe essere significativamente
migliore.

Quando chiedo, formato sempre così (mai un semplice "faccio A o B?"):
1. **Soluzione di Estetia (o quella già pianificata)** — cosa fa, come funziona
2. **La mia proposta alternativa** — cosa cambierei
3. **Perché** — vantaggi/svantaggi di entrambe
4. **La mia raccomandazione** — quale sceglierei e perché

Poi aspetto la decisione di Gabriel e la registro in `DECISIONS.md`. Per tutto il resto:
non aspettare, lavorare e portare avanti il progetto.

## Priorità assoluta: funzionamento reale, non solo UI

Ogni schermata deve avere un funzionamento vero dietro. "Prenota appuntamento" non è un
bottone — deve verificare disponibilità, applicare orari del tenant, considerare
professionista+servizio, evitare conflitti, creare il record, aggiornare calendario e CRM,
attivare automazioni, programmare reminder. Se una parte è mock, va dichiarato esplicitamente
in `PROJECT_STATUS.md`, mai lasciato implicito.

## AI — sistema reale, non demo

Obiettivo: un vero AI receptionist/booking agent. Deve comprendere messaggi naturali,
mantenere contesto multi-turno (senza far ripartire la conversazione da zero ad ogni
messaggio), identificare cliente nuovo/esistente, capire servizio/data/ora anche con
messaggi ambigui o corretti a metà, verificare disponibilità vera, proporre alternative
quando uno slot si libera/occupa durante la conversazione, creare/modificare/cancellare
appuntamenti, gestire più servizi consecutivi, rispondere a FAQ su prezzi/durata/orari,
gestire errori ed edge case, e passare a un operatore umano quando serve.

**Regola non negoziabile**: l'AI interpreta, il backend decide. L'AI non inventa mai dati.

```
messaggio -> AI -> intent/contesto -> tools -> backend -> database -> risultato -> AI -> risposta
```

La disponibilità è sempre verificata dal sistema reale (booking engine), mai assunta o
calcolata a mente dal modello. Stesso principio già validato nel progetto precedente
(`cervello.py`), da riprendere architetturalmente, non da reinventare.

## Booking engine — unica fonte di verità

`src/lib/booking-engine.ts` (logica pura, testata) + `src/lib/booking-engine.server.ts`
(collegamento al DB) sono l'UNICO posto dove si decide se uno slot è libero o una
prenotazione è valida. Calendario manuale, tool AI (quando esisteranno) e qualunque canale
futuro chiamano queste funzioni — **mai due sistemi di disponibilità separati**. Deve gestire:
servizio, professionista, durata, disponibilità, orari, pause, ferie/chiusure, conflitti,
buffer, slot, cancellazioni, modifiche, no-show, servizi consecutivi. Doppia difesa contro le
race condition: controllo applicativo (messaggio d'errore chiaro) + vincolo
`niente_sovrapposizioni` a livello Postgres (rete di sicurezza reale contro la concorrenza).

## Casi da testare per davvero (non solo il caso felice)

Prenotazione semplice; professionista specifico; professionista non specificato (il sistema
sceglie); slot occupato durante la conversazione (l'AI se ne accorge, propone alternative);
modifica; cancellazione; più servizi consecutivi (durata totale, stesso operatore per tutta
la catena); cliente nuovo (auto-creato) vs esistente (riconosciuto); due clienti che
richiedono lo stesso slot in concorrenza; servizio inesistente; professionista assente;
attività chiusa quel giorno; servizio incompatibile con l'operatore scelto; prenotazione
manuale da dashboard; onboarding di un'attività nuova end-to-end; upgrade/downgrade piano;
cancellazione abbonamento. Aggiungerne altri quando emergono durante lo sviluppo.

## Superficie prodotto (baseline Estetia + oltre)

Gestione attività, dashboard con insight azionabili (non solo numeri secchi — vedi la
debolezza osservata in Estetia sul "Tasso AI"/"rischio cliente" senza azione consigliata),
calendario (giorno/settimana/mese, multi-operatore, drag&drop se ha senso, filtri,
colori/stati), prenotazioni, clienti/CRM collegato per davvero a prenotazioni/conversazioni/
automazioni, professionisti/operatori, servizi, disponibilità, motore di automazioni
configurabile (reminder 24h, follow-up, inattività 30gg, slot liberato, no-show, compleanno),
AI conversazionale, conversazioni persistenti, pagina pubblica per-attività (branding, foto,
servizi/prezzi, professionisti, prenotazione diretta, link condivisibile), galleria foto
(logo/cover/lavori/prima-dopo — obiettivo: superiore a Estetia su questo punto specifico),
analytics (revenue, retention, churn, no-show, occupazione, valore medio, canale
acquisizione), piani Free→Enterprise con limiti applicati **tecnicamente** (non solo a
livello di copy), gestione account/onboarding self-service, pannello admin per Gabriel
(attività, utenti, piani, utilizzo, AI/WhatsApp usage, metriche, interventi manuali quando
serve), esperienza mobile vera (PWA: installazione, icona, fullscreen, push, offline dove
sensato — non "responsive e basta").

**Attenzione particolare al workflow 02→03 di Estetia** (collega WhatsApp -> guarda crescere
il salone): è il punto dove un self-service o si convince o perde l'utente. Analizzarlo a
fondo, non copiarlo — l'obiettivo è meno click, meno tempo, meno confusione, più
automazione/chiarezza/velocità/valore percepito.

## UI/UX

Deve sembrare un SaaS premium (ispirazione qualitativa: Apple, Stripe, Linear, Notion — non
copia, identità propria). Evitare dashboard affollate, card inutili, gradienti esagerati,
troppe ombre, componenti da template, tabelle inutilmente complesse, colori casuali. **Ma**:
niente passata di design prima che il prodotto funzioni davvero (vedi PIANO.md sull'ordine
fasi — fondamenta poi schermate funzionanti poi grafica finale, Fase 7). Le scelte di
*interazione* corrette (es. slot cliccabile invece di calcolato a mente) si costruiscono giuste
da subito, quello che si rimanda è la rifinitura visiva, non la logica.

## Architettura e sicurezza

Supabase: schema, RLS, Auth, Storage, Realtime, Edge Functions — progettare per scalare.
Isolamento multi-tenant reale (RLS + funzione `auth_tenant_id()`), mai solo filtro
applicativo. Verificare seriamente: authentication/authorization, tenant isolation, permessi
dei tool AI, protezione da prompt injection, validazione input, rate limiting, secrets mai
esposti al client (`server-only` su tutto ciò che tocca service_role), webhook verificati.
L'AI non deve poter eseguire operazioni pericolose senza controlli del backend.

## Self-service end-to-end — il vero obiettivo

```
landing -> registrazione -> scelta piano -> pagamento -> account creato in automatico ->
onboarding -> servizi/operatori/orari -> AI attiva -> pagina pubblica -> attività operativa
```

Zero intervento manuale di Gabriel per attivare un cliente nuovo — non deve creare database,
account, attività, pagine, calendario a mano, né modificare codice o attivare abbonamenti
manualmente. "Finito" non è "la UI è bella" — è: un'attività nuova entra sul sito, si
registra, sceglie un piano, paga, si configura, aggiunge servizi/professionisti/orari,
pubblica la propria pagina, riceve una prenotazione gestita dall'AI, la vede nel calendario,
il cliente finisce nel CRM, il reminder parte da solo, tutto gestibile da smartphone — senza
intervento manuale.

## Refactoring

Non costruire sopra una base che si è scoperta debole solo per evitare di rifarla. Se serve
riscrivere uno schema, un componente, un'API — farlo. Meglio una base solida che workaround
accumulati.

## Regola definitiva

Lavorare come parte del team fondatore, non solo eseguire istruzioni. Se Estetia fa qualcosa
bene, capirlo e implementarlo. Se lo fa male, proporre di meglio. Se manca qualcosa,
individuarlo e risolverlo. Se emerge un'alternativa significativamente migliore a una
decisione già presa: fermarsi, spiegarla nel formato sopra, decidere insieme. Per tutto il
resto: non aspettare, lavorare in autonomia e portare avanti il progetto.
