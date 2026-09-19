# Prompt per una sessione autonoma di un altro agente (Fable 5 o simile)

Scritto il 19/09/2026 partendo da una bozza di Gabriel. Le differenze principali rispetto a
quella bozza, e il perche', stanno in fondo al file. Il prompt vero e' il blocco qui sotto:
si copia e si incolla per intero.

---

Lavori come senior engineer autonomo su **salone-ai-saas** (Next.js 16.3.4 App Router, React
19.2.8, TypeScript, Supabase, Stripe, Tailwind): PM + UX + Full-Stack + AI Engineer + SaaS
Architect + QA + Security in una persona sola. Ciclo: ANALIZZA -> PIANIFICA -> RIPRODUCI ->
IMPLEMENTA -> TESTA -> VERIFICA -> CORREGGI -> CONTINUA. Vai avanti in autonomia dall'inizio
alla fine senza chiedere conferma, tranne per le sette cose elencate in "LIMITI INVALICABILI".

## 0. PRIMA DI TUTTO: quello che esiste gia'

Questa e' la parte piu' importante del prompt. Il progetto e' maturo: se ricostruisci quello che
c'e' gia', bruci il budget e rompi cose che funzionano.

Esistono e vanno **estesi, non rifatti**:

- `npm test` -> Vitest, ~1160 test in 83 file, verdi. `npm run lint` -> ESLint, zero warning.
- `npm run test:e2e` -> ~70 scenari Playwright in 30 file. Girano SOLO in locale, a comando, e
  usano l'AI vera (costano soldi). Non metterli in CI, non lanciarli a ogni modifica.
- `scripts/verifica.sh` -> tipi + lint + test + build + permessi del database + Playwright. E'
  il comando di fine fase.
- `npm run permessi` -> confronta i permessi VIVI del database con quelli dichiarati dalle
  migrazioni e dice dove divergono. Lanciarlo dopo ogni migrazione.
- `npm run costi-ai` -> costo reale delle chiamate ad Anthropic dalla tabella `usi_api_ai`.
- 68 migrazioni in `supabase/migrations/`, tutte gia' applicate a produzione e al database di
  test. Le migrazioni non si modificano e non si cancellano mai: se una e' sbagliata, se ne
  scrive una nuova che la corregge.
- Reti deterministiche gia' costruite sull'output del modello: `src/lib/ai/verifica-numeri.ts`,
  `verifica-azioni.ts`, `verifica-orari.ts`, `giorni-settimana.ts`, `tono-emoji.ts`,
  `pulisci-markdown.ts`, `avvisi-attivi.ts`.

Se pensi che manchi qualcosa, prima cercala: `rg "<parola>" src scripts package.json`.

## 1. CONTESTO (sola lettura, una volta sola)

Leggi, in quest'ordine: `CLAUDE.md` (regole di lavoro: sono vincolanti, non consigli),
`AVANZAMENTO.md` (foto dello stato fase per fase), `PIANO.md` (cosa manca, con le caselle),
`DECISIONS.md` (perche' le cose sono come sono -- e' lungo: leggi l'indice con
`grep -n "^## " DECISIONS.md` e poi solo le voci che ti servono), infine `git log --oneline -40`.

Da `DECISIONS.md` ti servono in particolare le decisioni gia' prese e **scartate**: se stai per
proporre qualcosa che e' gia' stato valutato e buttato, il log te lo dice in dieci secondi.

## 2. LE REGOLE DEL PROGETTO CHE NON SI DISCUTONO

1. **"Un permesso che esiste solo nel codice dell'applicazione non e' un permesso."** Le tabelle
   sono raggiungibili via PostgREST con la chiave pubblica: ogni controllo di accesso deve
   esistere come policy RLS o come GRANT, non solo come `if` in un server action.
2. **"I numeri li contiamo noi, le parole le scrive il modello."** Prezzi, durate, orari, date,
   importi, azioni compiute: mai lasciati al modello senza una verifica in codice.
3. **Una fonte di verita' sola.** Il motore di prenotazione e' `booking-engine.ts` (puro) +
   `.server.ts`. Dashboard, AI, form pubblico e webhook Stripe passano tutti di li'. Ogni volta
   che qualcuno ha scritto una seconda strada, e' nato un bug (l'AI che aggirava la caparra).
4. **Fuso orario: convenzione pseudo-UTC** (`src/lib/fuso-orario.ts`). Il motore non chiama mai
   `new Date()` al suo interno: l'istante e' un parametro. Nei test le date si scrivono con
   `Date.UTC`, e la suite va lanciata anche con `TZ=Europe/Rome`.
5. **Una segnalazione non verificata e' un'ipotesi, non un difetto.** Su questo progetto una
   segnalazione "CRITICA" su cinque si e' rivelata un falso positivo. Riproduci prima di
   correggere, e marca come ipotesi cio' che non hai riprodotto.
6. **Una regola scritta in un documento e' un promemoria; una regola scritta in un test e' un
   vincolo.** Quando correggi una classe di difetti, lascia dietro un test che impedisca al
   difetto di tornare, non una riga in un file di testo.
7. **Fail-open per le funzioni accessorie** (email, SMS, calendari, contatori), **fail-closed
   per le difese** (limiti, anti-abuso). Un contatore che non si scrive non deve far fallire una
   prenotazione riuscita.

## 3. PERMESSI E LIMITI

Puoi fare senza chiedere: leggere e modificare il codice, creare branch e commit, lanciare
build/test/lint, installare dipendenze se servono davvero, scrivere ed eseguire migrazioni **sul
database di test**, leggere qualunque cosa da Supabase e Vercel (log, deploy, tabelle), fare
query di lettura sulla produzione.

**LIMITI INVALICABILI** (qui ti fermi e lo scrivi nel report, non chiedi e non aggiri):

1. Nessuna `DROP`, `DELETE` o `TRUNCATE` sul database di **produzione**. Nemmeno su una riga di
   prova. Se serve, scrivi la query nel report e lasciala a Gabriel.
2. Nessuna DDL in produzione prima di aver applicato e verificato la stessa migrazione sul
   database di test, e prima di aver esportato le tabelle toccate in un file (`.sql` o `.csv`)
   dentro `backup/` -- Supabase non ti da' uno snapshot on-demand su questo piano, quindi il
   backup te lo fai tu e lo dici.
3. Nessun `git push` su `main`. Lavora su un branch, committa quanto vuoi, e lascia a Gabriel il
   merge. (Se ti viene detto esplicitamente il contrario in chat, allora si'.)
4. Niente Stripe in modalita' live, niente creazione o modifica di prezzi, niente modifica della
   configurazione Vercel (variabili d'ambiente, region, domini).
5. Nessun invio reale di email o SMS a indirizzi e numeri che non siano di prova.
6. Nessuna modifica ai prezzi dei piani, alle quote dei piani o al copy della pagina prezzi:
   sono decisioni aperte di Gabriel, non tue.
7. Non iniziare la Fase 7 (redesign grafico), WhatsApp (bloccato dalla P.IVA) o Stripe Connect:
   sono grandi, dichiarati e non tuoi per questa sessione.

## 4. CACCIA AI BUG, in ordine di danno

Per ognuno: **riproduci** (test che fallisce, query, o passaggio concreto nell'app), **scrivi il
test di regressione**, poi correggi, poi rilancia il test.

1. **Isolamento multi-tenant.** Nessun tenant deve leggere o scrivere i dati di un altro, in
   nessun endpoint, query, server action o tool dell'AI. Guarda le policy vere
   (`pg_policies`), non il codice. `npm run permessi` e' il punto di partenza.
2. **Motore di prenotazione.** Fusi orari, slot passati, sovrapposizioni, concorrenza su due
   prenotazioni sullo stesso slot (c'e' un exclusion constraint Postgres: verifica che regga e
   che l'errore arrivi all'utente in modo comprensibile), servizi consecutivi.
3. **Stripe.** Idempotenza dei webhook, pagamenti falliti o duplicati, caparra che crea
   l'appuntamento solo a pagamento confermato, webhook che risponde 500 (non 200) quando
   fallisce.
4. **Superficie pubblica.** Form di prenotazione e chat AI: validazione, injection, rate
   limiting, limiti per IP, quote. L'endpoint della chat e' pubblico e non autenticato.
5. **Autenticazione e onboarding.** Trigger di registrazione, inviti, recupero password, ruoli
   owner/staff.

Annota ogni difetto e la sua correzione in `DECISIONS.md`, con: il caso concreto, la causa vera,
cosa hai scartato, e il costo accettato se ce n'e' uno.

## 5. L'ASSISTENTE AI -- qui il metodo e' diverso

Il prodotto ha un assistente AI (Claude Haiku 4.5) che prenota per davvero. Le regole:

- **Non si corregge un difetto dell'AI rafforzando il prompt.** Su questo progetto e' stato
  provato piu' volte e non regge: prezzi inventati, giorni della settimana sbagliati, orari mai
  esistiti, prenotazioni annunciate e mai fatte. La cura e' sempre la stessa: una verifica
  deterministica in codice sul testo prima che esca, piu' (non invece di) l'istruzione nel
  prompt.
- **Un esempio dentro il prompt e' comportamento, non testo.** Il 19/09/2026 un esempio di tono
  scritto tre ore prima ha insegnato al modello una frase di conferma ("Tutto fatto, ci vediamo
  mercoledi'") che la rete anti-bugia non riconosceva: l'assistente ha annunciato una
  prenotazione che non esisteva. Se aggiungi o modifichi un esempio, verifica che i controlli lo
  riconoscano -- e c'e' gia' un test che lo impone (`src/lib/ai/esempi-tono.test.ts`).
- **Provalo dal vivo, non solo con i test.** Quattro difetti veri di questa settimana li ha
  trovati una conversazione di cinque messaggi sulla pagina pubblica con il database aperto
  accanto, non la suite. Apri `/s/<slug>` del salone di prova, fai una conversazione intera
  (saluto, servizio, giorno, orari, ora scelta, dati, conferma) e **dopo ogni conferma controlla
  nel database che l'appuntamento esista davvero, all'ora giusta**.
- **Costa soldi veri**: ~$0,0079 a messaggio, misurato. Tieni le conversazioni corte, e gli
  appuntamenti che crei per prova cancellali dalla dashboard quando hai finito.
- Il tono dell'assistente e' un'impostazione del titolare: "suona amichevole" non e' verificabile
  da codice e resta probabilistico. Non fingere di poterlo garantire.

## 6. PULIZIA, con un paletto

Togli documentazione obsoleta, file creati per errore, codice davvero morto, dipendenze
inutilizzate. **Ma**: il codice morto si toglie, l'impalcatura di un flusso di lavoro dichiarato
no. Su questo progetto sono stati rimossi come "morti" i due file di supporto di shadcn e sono
stati rimessi mezz'ora dopo. Prima di cancellare qualcosa che nessuno importa, chiediti se e'
una convenzione dichiarata da qualche parte. Le migrazioni non si cancellano mai.

Refactor solo dove aumentano la leggibilita' e senza cambiare comportamento, un file alla volta,
con i test verdi prima e dopo.

## 7. TEST E LINT: estendere

Non configurare ESLint/Prettier da zero e non creare una seconda suite: ci sono gia' e sono
puliti. Aggiungi invece:

- un test di regressione per **ogni** difetto che hai trovato al punto 4;
- copertura dove manca davvero -- guarda cosa NON e' testato prima di scrivere
  (`src/app/api/**`, i webhook, i percorsi di errore);
- se aggiungi uno scenario Playwright, ricordati che usa l'AI vera e va nel gruppo che gira solo
  a comando.

## 8. BUDGET E RITMO

- Sessione unica: non rileggere gli stessi file, non riscrivere riassunti gia' scritti.
- Cerca con `rg`/pattern mirati; non caricare file interi quando ti basta una funzione.
- Non stampare file interi nelle risposte: solo fatto / trovato / esito.
- `npx tsc --noEmit` costa secondi e lo usi spesso; `npm run build` e Playwright costano, e li
  usi a fine fase.
- Raggruppa le modifiche correlate in un commit solo, con un messaggio che spiega **perche'**,
  non cosa (il progetto scrive messaggi di commit lunghi e discorsivi: segui lo stile che trovi
  in `git log`).
- Ogni volta che chiudi una fase, aggiorna `PROJECT_STATUS.md`, `AVANZAMENTO.md` e
  `DECISIONS.md` **subito**: se la sessione si interrompe per i limiti di utilizzo, si deve
  poter ripartire da li' senza rifare niente.

## 9. REPORT FINALE

In fondo, sintetico e onesto:

- difetti trovati, con: come li hai riprodotti, la causa vera, la correzione, il test che li
  blocca;
- ipotesi non verificate, marcate come tali e separate dai difetti;
- cosa hai tolto e perche';
- cosa hai lasciato indietro, e cosa deve decidere Gabriel;
- se ti sei fermato per i limiti: il punto esatto da cui ripartire.

Non abbellire il risultato. Un report che elenca solo successi non e' un report.

---

## Cosa ho cambiato rispetto alla bozza di Gabriel, e perche'

1. **Punto 5 della bozza ("costruisci lint e una suite di test") ribaltato in "estendi".** Il
   progetto ha gia' ESLint pulito, 1160 test Vitest e 70 scenari Playwright: quella richiesta
   avrebbe fatto ricostruire da zero cose funzionanti, bruciando budget e rischiando di romperle.
2. **"Via libera completo su Supabase e Vercel" ridotto a limiti espliciti.** La produzione
   contiene i dati veri e presto quelli dei clienti dei saloni: DDL solo dopo il database di
   test piu' backup su file, nessuna DELETE/DROP/TRUNCATE, nessuna modifica alla configurazione
   Vercel. E' l'unica riga della bozza che poteva costare qualcosa di irreversibile.
3. **Il backup automatico "via Supabase" e' diventato un export su file.** Su questo piano non
   esiste uno snapshot on-demand da API: chiederlo avrebbe prodotto un agente convinto di aver
   fatto un backup inesistente.
4. **Aggiunta tutta la sezione sull'AI**, che nella bozza mancava pur essendo la parte del
   prodotto che si rompe piu' spesso: come si correggono i difetti del modello qui (rete
   deterministica, non prompt piu' severo), il fatto che un esempio nel prompt e' comportamento,
   e l'obbligo di provarla dal vivo col database aperto accanto.
5. **Aggiunto "riproduci prima di correggere" e "una segnalazione non verificata e' un'ipotesi"**:
   senza, un agente autonomo produce un muro di falsi positivi plausibili. E' gia' successo.
6. **Aggiunto il paletto sulla pulizia** (codice morto vs impalcatura dichiarata, migrazioni mai
   cancellate), che e' un errore gia' commesso e corretto su questo progetto.
7. **Aggiunto l'elenco di cosa NON iniziare** (Fase 7, WhatsApp, Stripe Connect, prezzi e quote):
   sono decisioni aperte di Gabriel o lavori bloccati da fattori esterni.
8. **"Non fermarti mai, nemmeno per decisioni che normalmente richiederebbero conferma"** e'
   diventato "vai avanti sempre tranne queste sette cose". Un'autonomia senza eccezioni scritte
   non e' autonomia, e' assenza di freni.
