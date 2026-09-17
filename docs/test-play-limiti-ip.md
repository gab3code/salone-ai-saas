# Test play -- limiti per IP (push del 17/09/2026, sera)

Un commit solo sopra a quello che hai appena pushato (`5648f3fe`).
**Un blocco alla volta**, come sempre.

---

## 1. Prendi il lavoro

```bash
cd ~/dev/salone-ai-saas
git log --oneline -1
```

Atteso: `5648f3fe`. Se vedi altro, fermati e dimmelo.

```bash
git fetch limiti-ip.bundle main:limiti-ip
git merge --ff-only limiti-ip
git branch -d limiti-ip
rm -f *.bundle
```

Nessun `npm install` stavolta: nessuna dipendenza nuova.

---

## 2. Le verifiche offline

```bash
rm -rf .next
npm run build
npx tsc --noEmit
npx eslint src tests --max-warnings=0
npm test
```

**Atteso**: build pulita, zero errori, zero warning, **700 test verdi** (erano 691).

```bash
TZ=Europe/Rome npm test
```

Stesso numero.

---

## 3. Il database

La migrazione **0046** l'ho già applicata e verificata. Questi controlli sono
per ricontrollare, incollali tutti insieme nell'SQL editor.

```sql
-- 1. La tabella esiste e NON contiene indirizzi IP, solo impronte.
select column_name, data_type from information_schema.columns
 where table_name = 'limiti_ip' order by ordinal_position;

-- 2. Le funzioni sono chiuse a tutti tranne il server.
select has_function_privilege('service_role','consuma_limite_ip(text, integer, integer)','execute') as server_puo,
       has_function_privilege('authenticated','consuma_limite_ip(text, integer, integer)','execute') as titolare_puo,
       has_function_privilege('anon','consuma_limite_ip(text, integer, integer)','execute') as chiunque_puo;

-- 3. Il tetto orario funziona (limite 3): devono uscire 2, 1, 0, -1.
select 'uso 1' as passo, consuma_limite_ip('verifica-gabriel', 3, 100)::text as restano
union all select 'uso 2', consuma_limite_ip('verifica-gabriel', 3, 100)::text
union all select 'uso 3', consuma_limite_ip('verifica-gabriel', 3, 100)::text
union all select 'uso 4 (atteso -1)', consuma_limite_ip('verifica-gabriel', 3, 100)::text;

-- 4. Un altro chiamante non è toccato: deve uscire 2.
select consuma_limite_ip('verifica-gabriel-2', 3, 100) as un_altro_ip;

-- 5. Pulizia della prova.
delete from limiti_ip where chiave like 'verifica-gabriel%';
```

**Attesi**: `chiave/finestra/usati` (nessuna colonna "ip"), poi `true / false / false`,
poi `2, 1, 0, -1`, poi `2`.

---

## 4. Dal vivo, dopo il deploy

### 4a. La demo funziona ancora normalmente

Apri **/demo**, fai una conversazione intera fino a prenotare.

**Atteso**: tutto come prima. I tetti stanno larghi (30 messaggi all'ora) e una
prova completa ne usa cinque o sei: se li senti, qualcosa non va.

### 4b. Il tetto per chi insiste

Sulla demo, manda **31 messaggi brevi di fila** nella stessa ora (vanno bene
anche i suggerimenti cliccati ripetutamente).

**Atteso**: verso il trentunesimo compare *"Hai provato la demo parecchie volte
di fila. Riprova fra un'ora..."*. La pagina resta navigabile.

Per sbloccarti subito senza aspettare un'ora:

```sql
delete from limiti_ip;
```

### 4c. Un altro dispositivo non è bloccato

Subito dopo aver raggiunto il tetto al punto 4b, apri **/demo dal telefono in
rete mobile** (non dal wi-fi di casa: serve un indirizzo diverso).

**Atteso**: funziona normalmente. È il punto della richiesta — un visitatore
non si mangia la demo degli altri.

### 4d. La chat di un salone vero non si è rotta

Su un salone **Growth o Pro**, apri la pagina pubblica e prenota dalla chat.

**Atteso**: funziona come prima. I tetti qui sono più alti apposta (40/ora,
120/giorno) perché dall'altra parte c'è un cliente vero che sta prenotando.

### 4e. Il contatore globale della demo non viene consumato da chi è bloccato

```sql
select chiave, mese, usati from contatori_globali where chiave = 'demo_messaggi';
```

Annota `usati`. Poi fatti bloccare dal tetto orario (4b) mandando altri
messaggi, e rileggi.

**Atteso**: `usati` **non cresce** mentre sei bloccato. È il motivo per cui il
controllo per IP viene per primo: un tentativo respinto non deve togliere
niente a nessun altro.

---

## 5. Pulizia automatica

Non serve fare niente: le finestre più vecchie di 48 ore le cancella il giro
notturno delle 8:00 (`/api/cron/promemoria`), che ora restituisce anche
`limitiIpCancellati` nel suo JSON. Se vuoi controllare domani:

```sql
select count(*) as finestre_vecchie from limiti_ip
 where finestra < now() - interval '48 hours';
```

**Atteso**: 0.

---

## 6. Se qualcosa va storto

- **Qualcuno si lamenta di essere bloccato senza motivo**: `delete from limiti_ip;`
  sblocca tutti all'istante, poi ne parliamo e alziamo i numeri (stanno in
  `src/lib/limiti-ip.ts`, sono due costanti).
- **Un salone dice che i suoi clienti non riescono a scrivere**: controlla se
  arrivano tutti dallo stesso indirizzo. I numeri sono tarati per una persona,
  non per un centralino: se serve, per la chat dei saloni si alzano senza
  rischio, perché il tetto vero contro la spesa resta la quota mensile.
