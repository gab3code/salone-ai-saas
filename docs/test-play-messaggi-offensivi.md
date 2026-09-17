# Test play -- messaggi offensivi (17/09/2026, notte)

Nasce da una tua prova sulla demo: a un insulto secco l'assistente ha risposto
*"Mi dispiace, ma non ho capito bene. Puoi ripetere?"*. Ha chiesto di ripetere
un insulto. Il taglio dopo N turni fuori tema c'era gia' e ha funzionato -- la
chat si e' chiusa al secondo turno -- ma cosa l'assistente dicesse **durante**
quei turni non lo decideva nessuno. Sul salone vero i turni sono tre, con il
nome del salone sopra la chat.

**Un blocco alla volta.**

---

## 1. Verifica di avere il lavoro

```bash
cd ~/dev/salone-ai-saas
ls src/lib/ai/messaggio-offensivo.ts
git status --porcelain
```

Atteso: il file esiste, e lo status non stampa niente.

---

## 2. Le verifiche offline

Queste sono quelle che contano: se passano tutte, il comportamento e'
garantito dal codice, non dal fatto che il modello si comporti bene.

```bash
npm test
```

Atteso: tutto verde. Fra i file c'e' `messaggio-offensivo.test.ts` con 48
test, e in `agente.test.ts` ce n'e' uno nuovo che controlla che la regola
anti-insulto sia davvero dentro il system prompt (se qualcuno un giorno la
cancella, quel test diventa rosso).

```bash
npx tsc --noEmit
npx eslint . --max-warnings=0
```

Atteso: nessun output da entrambi.

---

## 3. Il banco di prova, senza spendere niente

Non chiama il modello e non tocca il database, quindi puoi lanciarlo quante
volte vuoi.

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/prova-messaggi-offensivi.mjs
```

Atteso: `Tutte e 17 le frasi di controllo si comportano come previsto.`

E qui puoi provare le TUE frasi, che e' la parte utile:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/prova-messaggi-offensivi.mjs "una frase tua" "e un'altra"
```

Stampa `BLOCCATO` o `passa` per ognuna. Se trovi un insulto che passa, o una
frase normale che viene bloccata, mandamela e aggiusto la lista: e' molto piu'
veloce che scoprirlo dal vivo.

---

## 4. Come funziona, in due righe

Due livelli, non una lista sola, perche' una lista sola avrebbe un difetto
grave su un salone vero.

- **Livello odio** (`frocio`, `ricchione`, `vaffanculo`, ...): parole che in
  italiano non hanno nessun altro uso. Bloccano sempre, anche dentro una
  frase lunga. Reggono maiuscole, accenti, `Fr0ci0`, `frooocio`, `f.r.o.c.i.o`
  e `f r o c i o`.
- **Livello volgare** (`cazzo`, `stronzo`, `negro`, `troia`, ...): bloccano
  **solo** se il messaggio e' in sostanza solo quello. Questo e' il punto:
  *"scusa, ho fatto una cazzata, posso spostare l'appuntamento di domani?"* e'
  un cliente vero con una richiesta vera, e passa. Cosi' passano anche *"sono
  il signor Negro"* e *"sono di Troia in provincia di Foggia"*.

Quello che la lista non copre (provocazioni senza parolacce, sgarbo sottile)
resta al system prompt, che adesso ha una regola sua, e al contatore dei turni,
che chiude comunque.

---

## 5. Dal vivo, dopo il deploy

### 5a. La demo

Apri **/demo** e manda un insulto secco.

**Atteso**: *"Su questo non posso aiutarti. Se vuoi prenotare, spostare o
disdire un appuntamento dimmelo pure."* Niente "non ho capito", niente "puoi
ripetere", niente morale e niente scuse.

Mandane un secondo.

**Atteso**: la chat si chiude come prima, con il messaggio che invita a
registrarsi, e l'input si disabilita.

### 5b. Non e' costato niente

```sql
select chiave, mese, usati from contatori_globali where chiave = 'demo_messaggi';
```

**Atteso**: `usati` NON e' salito per i due messaggi del punto 5a. Un insulto
non arriva mai al modello, quindi non consuma la quota condivisa della demo.
Consuma pero' i venti messaggi mensili di quella connessione, altrimenti chi
insulta avrebbe tentativi infiniti.

### 5c. Il salone vero

Su un salone **Growth o Pro**, dalla pagina pubblica, manda un insulto secco.

**Atteso**: stessa frase asciutta. Al terzo turno senza strumenti scatta il
blocco che c'era gia', con il numero di telefono del salone.

Il messaggio resta salvato e il titolare lo vede in conversazione: e' voluto,
deve poter sapere cosa gli e' stato scritto.

### 5d. Il falso positivo che conta

Sempre su un salone vero, scrivi una richiesta normale che contiene una
volgarita':

> scusa, ho fatto una cazzata, posso spostare l'appuntamento di domani?

**Atteso**: l'assistente risponde normalmente e prova a spostare
l'appuntamento. Se invece risponde con la frase asciutta, fermati e dimmelo:
vuol dire che la soglia e' troppo stretta e stiamo bloccando clienti veri.

---

## 6. Se qualcosa va storto

Mandami la frase esatta e cosa ti ha risposto. Il livello volgare ha una
soglia (quante parole restano dopo aver tolto l'insulto) che si alza e si
abbassa in una riga sola, in `messaggio-offensivo.ts`.
