# Al risveglio -- cosa ho fatto e cosa tocca a te (18/09/2026)

Tre commit nuovi, **non pushati** (il push lo fai sempre tu):

- `78d25802` -- `npm run permessi`
- `d46b64ea` -- credenziali dei calendari cifrate
- (piu' `55de1094`, l'AVANZAMENTO di stanotte)

Tipi e lint puliti. **I test unitari NON li ho potuti eseguire**: vitest non
gira nella macchina virtuale da cui lavoro (le librerie native sono compilate
per il tuo Mac). Ho verificato i moduli nuovi in un ambiente separato -- 18
test per i permessi, 16 per la cifratura, tutti verdi -- ma la suite intera
la devi lanciare tu. E' il primo passo qui sotto.

---

## Cosa fare, nell'ordine

### 1. Genera la chiave di cifratura

```
openssl rand -base64 32
```

Mettila in due posti, con questo nome esatto:

- `.env.local` sul Mac: `SALONE_CHIAVE_CIFRATURA=...`
- Vercel -> Settings -> Environment Variables, **spuntando "Sensitive"**,
  per Production e Preview.

Mettila anche in `.env.test` se vuoi che gli scenari E2E la vedano (non e'
obbligatorio: senza, le righe vecchie continuano a funzionare).

**Perche' serve prima di tutto il resto:** senza chiave il codice si rifiuta
di SCRIVERE credenziali nuove -- collegare un calendario dara' un errore
esplicito. Le righe gia' esistenti invece continuano a funzionare, quindi
niente si rompe nel frattempo.

### 2. I test

```
npm test
npx playwright test --project=chromium
```

Attesi 858 unitari e 62 scenari. Se qualcosa e' rosso, fermati e mandamelo.

### 3. La migrazione 0053 sui due database

`supabase/migrations/0053_leggere_i_permessi_veri.sql`, prima sul database di
test, poi in produzione. Crea una funzione di sola lettura che dice quali
permessi esistono davvero, eseguibile solo dalla chiave di servizio.

Puoi applicarla anche prima del deploy: non la usa nessuna pagina, solo il
comando da riga di comando.

### 4. Push

```
git push
```

### 5. Dopo il deploy: cifra le righe gia' esistenti

**Una volta per database.** Prima guarda cosa farebbe:

```
npm run cifra-credenziali -- --test
npm run cifra-credenziali
```

Non scrive niente, dice solo quante righe e quali campi. Poi, per farlo
davvero:

```
npm run cifra-credenziali -- --test --applica
npm run cifra-credenziali -- --applica
```

Rilanciandolo deve dire "niente da fare": e' sicuro eseguirlo piu' volte.

Non stampa mai il contenuto di un segreto. Uno script che ti mostra la
password che sta proteggendo ha appena fatto il contrario del suo lavoro.

### 6. Il controllo nuovo

```
npm run permessi -- --test
npm run permessi
```

Atteso: "Nessuna divergenza". Se dice che manca la 0053, non l'hai applicata
su quel database.

### 7. Due minuti a mano

Se hai un calendario collegato, apri Impostazioni -> Calendari e controlla che
risulti ancora connesso, poi guarda il calendario della dashboard: gli impegni
esterni devono comparire come prima. E' il punto che la cifratura potrebbe
rompere, ed e' l'unico che i test non coprono (serve un iCloud vero).

---

## Cosa ho chiuso, e cosa no

**Chiuso: il confronto permessi.** Era la voce nuova nata dai due incidenti
della notte. `npm run permessi` legge le migrazioni, calcola lo stato finale
dei permessi e lo confronta con quello vero del database. 18 test, quattro
dei quali girano contro le migrazioni vere: verificano che dopo la 0051
nessun ruolo pubblico legga `clienti`, che dopo la 0052 `authenticated` legga
il proprio profilo ma non lo scriva, e che il titolare possa ancora cambiare
il nome del proprio salone.

Un test mi ha gia' salvato: nella prima versione scartavo
`on all tables in schema public` perche' contiene la parola "schema", e cosi'
facendo facevo sparire dal calcolo proprio le revoche della 0049 -- il
confronto avrebbe dato per buono un database spalancato.

**Meta' chiuso: le credenziali dei calendari.** La cifratura c'e' ed e'
testata. La revoca quando un membro esce **no**, e ho preferito lasciarla a
te sveglio: "membro" e "operatore" sono due cose diverse nel database (i
collegamenti appartengono a un operatore, che non e' un account utente), e
prima di scrivere codice va deciso cosa deve succedere davvero quando un
collaboratore se ne va. E' una decisione di prodotto, non una riga di SQL.

**Non toccato, e perche':**

- *Sospensione e Stripe*: serve una tua decisione prima del codice.
- *Link di gestione via SMS*: bloccato dalla partita IVA.
- *Pacchetti prepagati*: e' una funzione di prodotto intera, non una voce di
  sicurezza.
- *PostHog*: serve un account e una decisione.

**Quindi la Fase 6 non si chiude oggi**, e dirtelo adesso e' piu' utile che
scoprirlo stasera: delle sette voci aperte, tre dipendono da una tua
decisione o dalla P.IVA, e una e' una funzione di prodotto. Quello che si
poteva chiudere senza di te l'ho chiuso.
