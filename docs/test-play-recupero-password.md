# Test play -- recupero password (17/09/2026)

Fino a oggi un titolare che perdeva la password **non aveva nessun modo di
rientrare**. Era l'unica voce dell'audit segnata come "deve esistere prima del
primo cliente pagante".

**Un blocco alla volta.**

---

## 1. Prima di tutto: due cose da fare nel pannello Supabase

Il codice funziona gia' senza queste, ma con il mailer di default di Supabase,
che concede **poche email all'ora** ed e' documentato come "solo per test". Con
clienti veri non regge.

### 1a. L'indirizzo di ritorno deve essere autorizzato

Supabase rifiuta di rimandare l'utente su un indirizzo che non e' in lista.

Vai su **Authentication -> URL Configuration -> Redirect URLs** e aggiungi:

```
https://salone-ai-saas.vercel.app/reimposta
http://localhost:3000/reimposta
```

Senza il primo, il link ricevuto per email riporta alla home invece che alla
pagina della password nuova. Senza il secondo non puoi provarlo in locale.

### 1b. L'SMTP personalizzato (Mailjet)

Authentication -> Emails -> **SMTP Settings**. Hai gia' Mailjet con 6.000 email
al mese, quindi si tratta di riusare quelle chiavi:

- Host: `in-v3.mailjet.com`
- Porta: `587`
- Username: la tua `MJ_APIKEY_PUBLIC`
- Password: la tua `MJ_APIKEY_PRIVATE`
- Mittente: lo stesso indirizzo verificato che usi gia' per le notifiche

Le chiavi le devi incollare tu: non le tocco io, e non devo.

Da quel momento sblocchi anche la modifica dei template (il messaggio in cima
alla pagina Emails che hai visto stasera) e le email di recupero smettono di
essere razionate.

---

## 2. Le verifiche offline

```bash
npm test
npx tsc --noEmit
npx eslint . --max-warnings=0
```

Atteso: tutto verde. I test nuovi sono gli 11 di `src/lib/password.test.ts`.

---

## 3. Gli E2E su Chromium, gratis

```bash
npx playwright test 28-
```

Atteso: 4 passed.

Nessuno di questi preme "Mandami il link": inviare davvero brucerebbe una delle
poche email all'ora, a ogni run. Verificano la strada dall'accesso al recupero e
-- il punto piu' importante -- che un link scaduto lo **dica**, invece di
mostrare un form che non porta da nessuna parte.

---

## 4. Dal vivo, il giro completo

Questo mandi davvero un'email, quindi fallo una volta.

1. Vai su `/accedi`. Sotto il campo password c'e' **"Password dimenticata?"**.
2. Cliccalo, scrivi la tua email, premi "Mandami il link".
   **Atteso**: la pagina dice di controllare la posta. Dice la stessa cosa
   anche per un indirizzo che non esiste, ed e' voluto: se dicesse "questa
   email non e' registrata" diventerebbe un modo gratuito per scoprire chi sono
   i nostri clienti provando indirizzi a caso.
3. Apri il messaggio e clicca il link.
   **Atteso**: atterri su `/reimposta` con il form per la password nuova.
4. Scrivine una di almeno 8 caratteri, ripetila, salva.
   **Atteso**: entri direttamente nel pannello, gia' loggato.
5. Esci e rientra con la password nuova.

### 4b. La prova che conta: dal telefono

Rifai il punto 2 dal computer, poi **apri l'email dal telefono**.

**Atteso**: funziona lo stesso. E' il motivo per cui il recupero usa il flusso
"implicit" invece di PKCE: con PKCE il link si apre solo nel browser che ha
chiesto il recupero, e chi chiede dal computer del salone e apre la mail dal
telefono -- cioe' meta' delle persone -- troverebbe un errore proprio quando e'
gia' in difficolta'.

### 4c. Il link si usa una volta sola

Torna sul link del punto 3 e riaprilo.

**Atteso**: "Questo link non vale piu'", con il pulsante per chiederne un altro.
Stessa cosa dopo un'ora.

---

## 5. Se qualcosa va storto

- **Il link riporta alla home invece che a /reimposta**: manca il punto 1a.
- **Non arriva nessuna email**: guarda nello spam; se e' vuoto, hai finito le
  poche email all'ora del mailer di default -- e' esattamente il motivo del
  punto 1b.
- **"Questo link non vale piu'" su un link appena ricevuto**: mandami
  l'indirizzo completo su cui sei atterrato (togli la parte dopo il #, che e'
  un token) e guardiamo cosa e' arrivato.
