# Avanzamento

Fotografia al **18/09/2026, sera**. Conta le caselle di `PIANO.md` e dice,
fase per fase, cosa manca davvero. Non sostituisce il PIANO: lo riassume per
poterci ragionare sopra senza rileggere duemila righe.

Regola di lettura: **"aperte" non vuol dire "da fare adesso"**. Delle 44 voci
aperte, una ventina sono impostazioni da cliccare su Stripe o sono bloccate
dalla partita IVA, e non dipendono da una riga di codice.

Seconda regola, meno comoda: **il numero delle aperte puo' salire**. Un elenco
che scende sempre non e' un elenco onesto, e' un elenco che non guarda.

Terza regola, imparata il 18/09/2026 di sera: **una casella aperta non vuol
dire che la cosa non sia fatta.** Quella sera, controllando ogni voce aperta
contro il codice vero invece che fidandosi del documento, tre sono risultate
gia' chiuse da giorni (Sentry, la rubrica clienti chiusa a PostgREST, la
cifratura delle credenziali dei calendari) e una risultava aperta ma descritta
male (la 0035, gia' applicata in produzione). Vale la pena rifare quel
controllo ogni tanto: un documento che dice "manca" quando non manca fa
perdere tempo nello stesso modo di uno che dice "fatto" quando non e' fatto.

---

## 19/09/2026, notte -- quello che e' cambiato dopo la foto del 18

**I numeri aggiornati**: 1160 test unitari in 83 file (erano 991), 70 scenari Playwright in 30
file (erano 63), 69 migrazioni scritte e tutte applicate a produzione e al database di test
(la 0069 e' stata creata e ritirata la notte stessa, vedi DECISIONS.md). Build, tipi e lint
puliti. La tabella delle fasi qui sotto vale ancora: nessuna casella si e' spostata, il lavoro
di oggi e' tutto correzione.

**Il costo dell'AI non e' piu' una stima.** La migrazione 0068 ha raccolto i primi dati veri:
166 chiamate su 70 messaggi di cliente, **$0,0079 a messaggio** contro gli $0,008 stimati. Il
costo per prenotazione non e' ancora leggibile (quasi tutte le chat erano prove che non
prenotavano). `npm run costi-ai` legge la tabella.

**Nove pannelli si resettavano da soli.** `<form action={...}>` di React 19 resetta il form
quando l'azione finisce: misurato, tornano indietro checkbox, radio e select, non testo e
textarea. Era la causa di tre segnalazioni che sembravano diverse (la spunta della caparra, il
tono che tornava predefinito). Corretto con `alInvio` (onSubmit) e un test che scandisce il
codice e blocca ogni `<form action>` con dentro una spunta, un radio o una select.

**Quattro difetti dell'assistente, tre trovati usandolo e non leggendolo:**
- l'ora confermata diversa da quella prenotata (09:00 nel database, "09:30" nel messaggio);
- "alle 16" scambiato per un orario inventato -> il cliente riceveva "non riesco a dirti gli
  orari liberi" proprio mentre diceva l'ora che voleva;
- i due tetti anti-abuso tagliavano **sulla conferma**, perche' la parte finale di una
  prenotazione non chiama strumenti: ora 10 messaggi senza strumenti e 30 totali (erano 5 e 15);
- **"Tutto fatto, ci vediamo mercoledi'" senza aver prenotato niente**: la frase era un esempio
  di tono aggiunto tre ore prima, e la rete anti-bugia non la riconosceva. Ora gli esempi del
  prompt sono una struttura e un test verifica che ogni conferma sia riconosciuta dai controlli.

**Il tono dell'AI** ora si insegna con otto esempi per stile invece che con una riga di
aggettivi, e le emoji fuori tono le toglie il codice. Verificato dal vivo: il tono si vede in
ogni messaggio, non solo nel saluto.

**Un giorno passato** non dice piu' "la giornata e' gia' piena".

**Documento nuovo**: `docs/prompt-agente-autonomo.md`, il prompt da dare a un altro agente per
una sessione autonoma, con i limiti scritti.

---

## Il quadro in una tabella

| Fase | Cosa copre | Fatte | Aperte | Stato |
|---|---|---|---|---|
| 0 | Fondamenta | 8 / 8 | 0 | **chiusa** |
| 1 | Booking engine | 8 / 8 | 0 | **chiusa** (16/09) |
| 2 | AI conversazionale | 8 / 9 | 1 | **chiusa tranne WhatsApp** |
| 3 | CRM e dashboard | 9 / 9 | 0 | **chiusa** (17/09) |
| 4 | Pagina pubblica, foto, PWA | 9 / 9 | 0 | **chiusa** |
| 5 | Billing self-service e admin | 12 / 12 | 0 | **chiusa** (17/09) |
| 6 | Automazioni e sicurezza | 14 / 15 | 1 | **chiusa**, resta solo cio' che dipende dalla P.IVA |
| 6bis | Calendari esterni | 7 / 7 | 0 | **chiusa** (18/09) |
| 6ter | Quello che serve per vendere | 21 / 53 | 32 | il grosso del lavoro |
| 7 | Estetica e responsive | 2 / 10 | 8 | non iniziata |
| 8 | Dopo la pubblicazione | 0 / 2 | 2 | **nuova** (18/09), roba che ha senso con clienti veri |

Non esistono fasi oltre la 8.

---

## 18/09, sera tardi -- Fase 2, 6 e 6bis quasi chiuse

**Fase 2 resta aperta solo su WhatsApp.** Il contesto persistente della conversazione e' stato
guardato e scartato, non rinviato: sul web le chat non diventano lunghe (tre ore di inattivita'
e riparte pulita), e nella forma ovvia -- lo stato lo scrive il modello -- peggiorerebbe proprio
le chat lunghe, perche' un valore sbagliato entrato una volta si ripropone come fatto a ogni
turno. Il ragionamento per esteso sta in PIANO.md, perche' la tentazione torna.

**Fase 6: da sei aperte a tre.** Chiuse: i collegamenti dei calendari leggibili solo dal server
(0065 -- applicata alla produzione la sera del 18/09, dopo il deploy, e verificata: i due
database hanno ora la stessa identica impronta dei permessi, zero divergenze), la revisione
sicurezza verificata pezzo per pezzo, la sospensione che adesso dice
apertamente che l'addebito continua. Chiusa anche PostHog, come decisione: si fa quando ci sara' traffico vero da capire, e la
condizione e' scritta.

**Resta una voce sola, e dipende dalla P.IVA**: il link di gestione mandato al cliente, che
passa dagli SMS. Pacchetti prepagati e tessera fedelta' sono usciti da qui il 18/09 e sono
diventati la **Fase 8**: hanno senso quando ci sono clienti veri che pagano, e i pacchetti
richiedono comunque Stripe Connect prima.

**Fase 6bis: CHIUSA.** La direzione export e' stata fatta la sera del 18/09: gli appuntamenti
del salone si scrivono nel calendario Google personale dell'operatore, spenti per tutti finche'
non li accende chi quel calendario lo possiede. Due delle tre difficolta' previste non
esistevano (lo scope era gia' di scrittura, quindi nessuna ri-autorizzazione); la terza,
l'anello di sincronizzazione, era quella vera ed e' risolta marcando i nostri eventi e
saltandoli in lettura.

**Un metodo nuovo.** Per la prima volta e' stato lanciato il database linter di Supabase: ha
trovato che `gestisci_nuovo_utente()` era chiamabile via RPC mentre la sua gemella era protetta
dal 17/09. Poca gravita' vera, ma un controllo diverso ha visto una cosa che nessuno dei nostri
guardava -- ed e' il motivo per cui vale la pena averlo fatto. Corretto dalla 0066.

**Lo scenario 13 adesso chiede al trigger di registrazione tutte le cose che deve fare**, una
per una. Stamattina passava pur essendo il trigger mutilato, perche' ne controllava solo tre su
cinque.

44 voci aperte (una in piu' del conto di prima: la voce su pacchetti e fedelta' e' stata divisa in due, perche' erano due cose diverse nella stessa casella).

---

## 18/09, notte -- i piani, la prova gratuita, e due bug miei

Il blocco qui sotto ("18/09, sera") era stato scritto alle 14 e si e' fermato
li'. Quello che e' successo dopo:

**I piani hanno smesso di somigliarsi.** Free e Starter possono assaggiare
l'AI ma contata (3 bozze di configurazione a vita, 10 prove dell'assistente);
la quota di Growth scala con gli operatori invece di essere un numero fisso;
Pro ha finalmente due cose che Growth non ha, il **report mensile** che arriva
da solo il primo del mese e il **richiamo scritto dall'AI** ai clienti fermi.
Delle tre promesse scoperte di Pro ne resta scoperta una e mezza: WhatsApp
(bloccato dalla P.IVA) e "supporto prioritario" (che non dipende da nessuno e
si chiude decidendo).

**La prova gratuita e' una sola.** 14 giorni di Growth alla registrazione,
senza carta, con avviso tre giorni prima e declassamento automatico alla
scadenza. I 10 giorni di trial Stripe sono stati tolti: sommati facevano 24
giorni di prodotto completo prima del primo euro, ed erano due prove diverse
con lo stesso nome.

**`scripts/verifica.sh`**: tipi, lint, 991 test unitari, build, permessi del
database, scenari Playwright. Un comando, e non si ferma al primo rosso.

**Due bug miei, che questo documento esiste anche per ricordare.** La
migrazione 0061 ha riportato indietro di dieci migrazioni il trigger di
registrazione (avevo cercato solo la migrazione che aveva CREATO la funzione,
non tutte quelle che l'avevano riscritta): per qualche ora, in produzione, chi
si registrava non riceveva la riga in `membri_tenant` ne' la regola promemoria.
Tipi, lint, 991 test e build erano verdi -- l'hanno trovato solo gli scenari
Playwright. E gli orari erano l'unico campo dell'onboarding che non passava dal
diff: "il sabato siamo aperti" riscriveva tutta la settimana.

---

## 18/09, sera -- le mezze funzionalita' e l'onboarding che sa correggere

**Ferie e chiusure adesso esistono.** La tabella era letta dal motore dalla
migrazione 0002 e non la scriveva nessuna schermata: un salone non poteva
dire "chiudiamo dal 10 al 20 agosto" da nessuna parte del prodotto. Stessa
famiglia di `bufferMinuti` (parametro con un test verde che nessuna schermata
passava) e della colonna `attivo` (letta dal motore dal primo giorno, mai
scritta). Tutte e tre chiuse.

**L'onboarding AI sa correggere, non solo aggiungere.** Il modello riceve la
configurazione attuale con gli id e restituisce lo stato finale; il confronto
lo fa codice puro. Copre ora anche regole d'agenda, orari del singolo
operatore, contatti, promemoria, caparra e ferie. Le rimozioni proposte
partono sempre non spuntate.

**L'AI usata dalla dashboard consuma la quota** (migrazione 0059). Prima
l'onboarding AI era l'unica strada del prodotto che chiamava Anthropic senza
contatore, senza tetto e senza gate di piano.

**Scenario Playwright 30**, sette test dalla schermata fino agli orari
proposti. Va lanciato in locale: `npx playwright test tests/e2e/30-configurazione-completa.spec.ts`.

---

## 18/09, pomeriggio -- l'agenda smette di essere uguale per tutti

Tre cose, nate da una domanda di Gabriel ("i saloni riescono a riempirsi
l'agenda come preferiscono?") a cui la risposta onesta era no.

1. **La griglia degli orari era sfasata da qualunque impegno fuori orario
   tondo** (evento 13:40-15:40 -> slot 15:40, 15:55, 16:10). Ora il passo e'
   ancorato all'apertura del salone. Difetto reale, non estetica: quella lista
   la legge il cliente.
2. **Il buffer fra appuntamenti era codice morto.** Il parametro esisteva nel
   motore dalla Fase 1, aveva un test, e nessuna delle quattro schermate che
   cercano slot lo passava: in produzione valeva 0 per tutti. Sembrava una
   protezione e non lo era. Ora arriva dal database, con il passo e con la
   modalita' di riempimento (migrazione 0056, sezione "Regole dell'agenda").
3. **Gli orari erano solo del salone.** Un part-time si poteva dire soltanto
   inserendo una chiusura pomeridiana a mano ogni singolo giorno. Ora ogni
   operatore puo' avere i propri orari settimanali (migrazione 0057), che
   valgono in intersezione con quelli del salone: scriverli piu' larghi non
   riapre il salone di nascosto.

Nota di metodo: da oggi la suite completa (991 test) gira davvero prima di
ogni consegna, in un ambiente Linux a parte. Prima si potevano lanciare solo i
file singoli, e infatti tre test rotti da una modifica di questa sessione sono
saltati fuori solo li'.

---

## Fase 2 -- AI conversazionale (2 aperte)

- Contesto persistente in `conversazioni.slot_in_costruzione`: la colonna
  esiste dalla 0001 e non viene usata. Oggi il contesto sta nello storico dei
  messaggi e funziona, quindi e' piu' una pulizia che una mancanza.
- Webhook WhatsApp/Telegram verso lo stesso motore. Bloccato dalla verifica
  business Meta, che a sua volta vuole la P.IVA.

## Fase 6 -- Automazioni e sicurezza (8 aperte)

Delle cinque di sicurezza, **due sono state chiuse il 18/09**:

1. L'invito che si consumava prima della conferma dell'email (migrazione 0050,
   Scenario 29). Era l'unica sfruttabile da un estraneo -- bastava indovinare
   l'indirizzo invitato.
2. La rubrica clienti scaricabile via PostgREST (migrazione 0051). Non era
   chiudibile con una policy: "puo' leggere le righe del suo tenant" e "puo'
   scaricarle tutte" sono la stessa query, e la differenza vive nel
   comportamento, non nei dati. Chiusa togliendo il permesso ad
   `authenticated` -- titolare compreso -- e facendo passare ogni accesso da
   `src/lib/clienti.server.ts` col client admin. Il prezzo e' che dentro quel
   file la rete di RLS non c'e' piu': per questo tutte le query stanno in un
   file solo e un test (`clienti.server.test.ts`) verifica il filtro sul
   tenant su OGNI funzione esportata, e fallisce anche solo se qualcuno ne
   aggiunge una nuova senza il suo test.

Le tre che restano richiedono tutte le credenziali di qualcuno gia' dentro
l'attivita', e sono dichiarate nel PIANO, non nascoste.

- Password CalDAV e refresh token Google. **Meta' fatta il 18/09**: adesso si
  scrivono cifrate (AES-256-GCM, `src/lib/cifratura.ts`, 16 test), quindi un
  collega che interroga PostgREST si porta via del testo illeggibile invece
  della password del calendario di un'altra persona. Resta aperta l'altra
  meta': revocarle quando chi le ha collegate esce dall'attivita'. Il passo
  umano NON serve piu': la sera del 18/09 ho ricontato le righe in chiaro col
  prefisso giusto (`v1.`, non `v1:` come avevo scritto la prima volta) e in
  produzione sono zero -- l'unico collegamento esistente e' gia' cifrato.
- Ridare al cliente l'autonomia in chat in modo sicuro (link di gestione
  mandato al suo numero, mai mostrato in chat). Dipende dagli SMS, quindi
  dalla P.IVA.
- Sospendere un'attivita' non tocca Stripe: continua a pagare il piano pieno.
  Forse voluto, ma va reso esplicito.

**Sentry e' stata chiusa il 18/09** (vedi in fondo): un errore in produzione
adesso lo sa qualcuno.

Le altre, non di sicurezza:

- Pacchetti prepagati / tessera fedelta' digitale.
- PostHog (analytics di utilizzo). Molto piu' in la'.
- La voce generica "revisione sicurezza" resta aperta perche' e' un processo,
  non un compito: l'ultima e' del 17/09 e ha prodotto la 0030.
- ~~Un comando che confronti i permessi VIVI del database con quelli che le
  migrazioni dichiarano~~ **-- FATTA il 18/09: `npm run permessi`.** Vedi in fondo.

## Fase 6bis -- Calendari esterni (2 aperte)

- Direzione export (gli appuntamenti del salone nel calendario personale).
- Cifratura a riposo delle credenziali dei calendari: si lega alla seconda
  voce di sicurezza qui sopra.

## Fase 6ter -- Quello che serve per vendere (33 aperte)

**Bloccate dalla P.IVA: 20 voci.** Tutta l'attivazione Stripe in live (prezzi,
chiavi, webhook, metodi di pagamento, Connect per le caparre, contestazioni,
un pagamento vero di prova), la fatturazione elettronica allo SdI e la
verifica business Meta. Non c'e' niente da programmare finche' non arriva.

**Fattibili adesso, in ordine di quanto spostano:**

1. **Import della rubrica clienti, assistito dall'AI.** Dichiarata nel PIANO
   come "la funzione piu' importante che manca". Un salone che apre il
   gestionale e lo trova vuoto il primo giorno non lo usa il secondo.
2. **Voci di Pro senza codice** ("supporto prioritario", "report avanzati"):
   il listino le promette, il prodotto non le fa. O si costruiscono o si
   tolgono. Non e' un bug, e' una promessa.
3. **Verificare il backup del database.** Mai fatto. Finche' i dati sono di
   Gabriel e' un fastidio; dal primo salone sono i dati dei SUOI clienti, e
   l'accordo sul trattamento impegna formalmente a proteggerli.
4. **Email "la tua prova sta per scadere".** Il trial di 10 giorni oggi
   finisce in silenzio: il primo segnale che il salone riceve e' un addebito.
5. **Recupero dei clienti fermi** e **riempire i buchi dell'agenda**: le due
   leve che usano i dati che il prodotto gia' ha.
5bis. **NUOVA (18/09): "cambia password" dentro la dashboard.** Oggi non
   esiste: un titolare che vuole cambiarla deve passare da "password
   dimenticata", cioe' da una procedura pensata per chi non riesce piu' a
   entrare. Funziona, ma e' la porta sbagliata per una cosa ordinaria, e la
   prima volta che un salone lo chiede la risposta non puo' essere "esci e
   fai finta di averla persa".
6. **Note vocali che diventano scheda cliente** (un parrucchiere non digita).
7. **Bozze di risposta alle recensioni.**
8. **Segnali sulla dashboard del salone.**
9. **Video di sessanta secondi**: ora che la demo esiste e' una registrazione
   di schermo, non una produzione.
10. **La conferma che il cliente vedrebbe, mostrata nella demo.**

## Fase 7 -- Estetica e responsive (8 aperte)

Non iniziata. La direzione colore e' gia' stata scelta il 16/09 (verde
smeraldo) e aspetta solo di essere implementata. Dentro ci sono anche il
design system applicato ovunque, il responsive provato davvero su tre fasce,
la PWA rifinita, il confronto schermata per schermata con Estetia, la passata
sulle performance percepite, e il calendario di disponibilita' nella
prenotazione pubblica.

Vuole ore davanti, non ritagli.

---

## Chiuso il 17 e 18/09, oltre alle caselle del PIANO

Cose fatte in queste due giornate che non hanno una casella propria:

- **Recupero password**: non esisteva. Era l'unica voce dell'audit marcata
  "deve esistere prima del primo cliente pagante".
- **Limiti per IP su tutto l'uso dell'AI**, e tetti rivisti con contatore in
  dashboard e avviso all'80%.
- **Demo pubblica** senza tenant, con tetto mensile per connessione.
- **L'assistente non chiede piu' di ripetere un insulto** (prompt + rete
  deterministica sotto).
- **Database di test separato** da produzione, con guardia che impedisce alla
  suite di partire contro il database vero.
- **Migrazione 0049**: le revoche dei permessi esistevano solo in produzione e
  in nessun file. Ricostruendo il database dal repo, `anon` sarebbe nato con
  scrittura su tutte le tabelle.
- **Tre bug veri corretti**, due dei quali erano gia' in produzione: le Server
  Action del calendario (assenza, cancellazione e spostamento rotti in
  silenzio) e il registro interventi che perdeva il cambio piano con Stripe.

### La nottata del 18/09

- **Migrazione 0052 -- niente autopromozione ad admin.** Su `profiles` il
  ruolo `authenticated` poteva scrivere la colonna `ruolo`, quella che decide
  chi comanda su TUTTA la piattaforma. Non era sfruttabile, e il perche'
  conta: a fermarlo non era una decisione, era l'assenza di una policy di
  UPDATE. Sarebbe bastato che qualcuno ne aggiungesse una per una cosa banale
  ("l'utente puo' cambiare il proprio nome") e l'autopromozione si sarebbe
  aperta nello stesso istante, senza che nessuno la stesse guardando.
  Permesso revocato, test nello Scenario 23.
- **Sentry, con un filtro scritto a mano.** Non la procedura guidata: i loro
  valori predefiniti accendono il Session Replay, che registra lo schermo --
  qui vuol dire la rubrica di un salone. Ogni segnalazione passa da
  `sentry-riservatezza.ts` (12 test) che toglie email, telefoni, termini di
  ricerca (sono nomi di clienti), cookie di sessione e corpo dei moduli, e
  tiene percorso e id. Regione dati europea (Francoforte). Sentry elencato fra
  i fornitori nell'informativa privacy. Bottone di verifica in /admin, perche'
  una diagnostica rotta non da' nessun segno.
- **Il calendario, tre difetti trovati usandolo e non leggendolo.** "Nessuno
  slot libero per questa combinazione" nascondeva la causa vera (un servizio
  senza operatore assegnato) e proponeva tre rimedi tutti sbagliati: venti
  minuti persi a cercare dalla parte opposta. Ora dice il motivo, in ordine di
  precedenza, con il link al posto giusto. Il giorno guardato e il giorno per
  cui si prenota sono tornati due cose distinte. E la data si legge
  "venerdi' 18 settembre 2026", non "2026-09-18".
- **Prestazioni.** Le funzioni Vercel giravano a Washington con il database in
  Irlanda: ogni pagina pagava l'Atlantico cinque volte. Spostate a Dublino,
  accanto al database. Aggiunti i `loading.tsx`, che prima non esistevano in
  nessuna sezione, e convertiti 43 link interni da `<a>` a `Link` -- cinque
  lasciati apposta com'erano, a partire dall'export CSV, che con `Link` non
  scaricherebbe piu' niente.
- **Due difetti nei test stessi.** Gli scenari 23 e 26 creavano il salone di
  prova nel database di test e poi facevano il login in PRODUZIONE, perche' si
  costruivano il client a mano leggendo `.env.local`: fallivano con "Invalid
  login credentials", che fa pensare alla password e invece era l'indirizzo.
  E l'esclusione di vitest era `tests/e2e/**`, che portava via anche un file
  di test scritto il giorno prima e mai eseguito nemmeno una volta. Entrambi
  hanno adesso una guardia che li fa fallire se tornano.
- **`npm run permessi`**: confronta i permessi VERI del database con quelli
  che le migrazioni dichiarano, e dice dove divergono. Nasce dai due incidenti
  della notte, in direzioni opposte -- la 0030 (revoca solo in produzione,
  in nessun file) e la 0051 (nel file e nel db di test, non in produzione,
  per ore, con il prodotto che funzionava benissimo). Nessun test poteva
  trovarli: i test girano sul database di test, che era giusto. Migrazione
  0053 per la lettura, 18 test per il calcolo dai file.
- **Credenziali dei calendari cifrate a riposo** (AES-256-GCM, 16 test). La
  scelta che rende sicuro il passaggio: `decifra` accetta anche il testo in
  chiaro, cosi' al deploy i calendari gia' collegati non smettono di
  sincronizzare tutti insieme. Il passo umano non e' servito: le righe in
  produzione erano gia' cifrate, e la riga "in chiaro" che avevo contato era un
  errore mio di pattern (`v1:` invece di `v1.`).
- **Trenta permessi di lettura che esistevano solo in produzione** (0054 e
  0055), trovati da `npm run permessi` il giorno dopo averlo scritto. Fra
  questi `anon` e `authenticated` con SELECT su `whatsapp_credenziali`, la
  tabella che la 0005 dichiara di voler lasciare senza NESSUN permesso.
  Corregge anche una decisione sbagliata della 0049 ("le SELECT non si
  toccano, la pagina pubblica ne ha bisogno"): in produzione `anon` non ha
  SELECT su nessuna tabella da sempre, e la pagina pubblica funziona --
  parla col server, non col database. Dimostrato dai 63 scenari verdi con le
  revoche applicate.
- **Suite E2E a 63 scenari**, tutti verdi. 991 test unitari.

---

## Il percorso critico, se serve una risposta sola

La P.IVA sblocca 20 voci e non dipende da noi. Nel frattempo, le tre cose che
cambiano davvero qualcosa sono: **l'import della rubrica** (senza, il prodotto
e' vuoto il primo giorno), **il backup verificato** (senza, un incidente e'
definitivo) e **le voci di Pro** (senza, il listino promette cose che non
esistono).

Prima di quelle tre, mezz'ora: **il confronto fra permessi vivi e migrazioni**.
Non sposta niente per un salone, ma stanotte la stessa svista e' costata due
incidenti, e finche' non esiste ogni migrazione di sicurezza va verificata a
mano -- cioe' prima o poi non verra' verificata.

La Fase 7 e' la piu' visibile e la meno urgente: un salone non compra per il
colore, ma non resta se il gestionale e' vuoto.
