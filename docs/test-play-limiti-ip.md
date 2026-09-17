# Test play -- limiti, quote e fuori tema (push del 17/09/2026, sera)

Copre tre push del 17/09: i limiti per IP (`abb7f271`), il suo test play
(`33204763`) e le quote riviste (`b68ff252`).
**Un blocco alla volta**, come sempre.

---

## 1. Verifica di essere sul lavoro giusto

Questo controllo non chiede una punta precisa: chiede che il codice da testare
sia **presente nella storia**. Cosi' resta valido anche dopo i commit successivi.

```bash
cd ~/dev/salone-ai-saas
git merge-base --is-ancestor b68ff252 HEAD && echo "codice dei limiti presente"
git status --porcelain
```

Atteso: la prima riga stampa `codice dei limiti presente`, la seconda non stampa
niente (working tree pulito). Se la prima non stampa niente, ti manca il lavoro:
fermati e dimmelo.

Niente bundle e niente `npm install`: e' tutto gia' mergiato e pushato, e non ci
sono dipendenze nuove.

---

## 2. Le verifiche offline

```bash
rm -rf .next
npm run build
npx tsc --noEmit
npx eslint src tests --max-warnings=0
npm test
```

**Atteso**: build pulita, zero errori, zero warning, **705 test verdi** (erano 691).

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

### 4b. Il tetto MENSILE per connessione sulla demo

Sulla demo, manda **21 messaggi** (anche cliccando i suggerimenti). Non serve
farli di fila: il tetto e' del mese, non dell'ora.

**Atteso**: al ventunesimo compare *"Hai già provato la demo per questo mese.
Se vuoi vedere l'assistente sul TUO salone, registrati..."*. La pagina resta
navigabile.

Per sbloccarti subito:

```sql
delete from contatori_globali where chiave like 'demo_ip:%';
```

### 4c. Un altro dispositivo non è bloccato

Subito dopo aver raggiunto il tetto al punto 4b, apri **/demo dal telefono in
rete mobile** (non dal wi-fi di casa: serve un indirizzo diverso).

**Atteso**: funziona normalmente. È il punto della richiesta — un visitatore
non si mangia la demo degli altri, e la demo non si spegne per tutti.

### 4c-bis. La demo non si blocca tutta

```sql
select chiave, mese, usati from contatori_globali where chiave = 'demo_messaggi';
```

**Atteso**: `usati` è molto sotto 3000. Con 20 messaggi a testa servono 150
connessioni diverse per arrivarci: a quel punto la demo sta funzionando, e
quegli ~8$ li paghiamo volentieri.

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

### 4f. L'assistente chiude se si parla d'altro (demo)

Sulla demo scrivi due domande completamente fuori tema di fila, per esempio
*"quanto fa 12 per 8?"* e poi *"scrivimi una poesia sul mare"*.

**Atteso**: alla seconda risponde *"Qui posso aiutarti solo con gli
appuntamenti di questo salone di prova..."* e **la casella di testo si spegne**.
Per ricominciare basta ricaricare.

Poi rifai la prova ma **in mezzo chiedigli un orario** (*"avete posto
giovedì?"*): il contatore si azzera e la conversazione continua. È così che
deve comportarsi con un cliente che si esprime in modo strano ma sta
davvero prenotando.

### 4g. Su un salone vero è più paziente

Su un salone **Growth o Pro**, dalla chat della pagina pubblica fai **due**
domande fuori tema.

**Atteso**: risponde ancora. Lì il limite è più alto (tre) apposta: dall'altra
parte c'è un cliente che paga quel salone, e cacciarlo per un giudizio
sbagliato costa più di qualche messaggio sprecato.

---

## 4bis. Il contatore dei messaggi in dashboard

Serve un account **Growth o Pro**.

1. Apri la **dashboard**.

**Atteso**: fra i dati dell'attività c'è una riga nuova, **"Messaggi
dell'assistente: N di 2500 questo mese"**. Prima questo numero non era scritto
da nessuna parte, e la quota finiva senza preavviso.

2. Per vedere l'avviso senza aspettare, alza finta l'uso: non c'è un modo
   pulito da SQL (il conteggio legge i messaggi veri), quindi fidati del
   numero che vedi — se è corretto rispetto a quanto hai chattato, funziona.

**Nota sul tetto di Growth**: è passato da 1.000 a **2.500**. Mille erano circa
4-5 conversazioni al giorno, troppo poco per un salone che va bene — e quando
finivano, l'assistente smetteva di rispondere ai clienti di chi paga.

---

## 5. Pulizia automatica

Non serve fare niente: le finestre più vecchie di 48 ore le cancella il giro
notturno delle 8:00 (`/api/cron/promemoria`), che ora restituisce anche
`limitiIpCancellati` nel suo JSON. Se vuoi controllare domani:

```sql
select count(*) as finestre_vecchie from limiti_ip
 where finestra < now() - interval '48 hours';

select count(*) as contatori_vecchi from contatori_globali
 where chiave like 'demo_ip:%' and mese < to_char(now() - interval '1 month', 'YYYY-MM');
```

**Atteso**: 0 e 0. Il giro notturno restituisce anche `limitiIpCancellati`,
`contatoriDemoCancellati` e `avvisiQuota` nel suo JSON.

### L'avviso all'80%

Parte dallo stesso giro notturno, una volta sola per mese e per salone. Per
provarlo senza aspettare di consumare 2.000 messaggi, azzera la marcatura e
guarda cosa succede alla prossima esecuzione:

```sql
update tenants set avviso_quota_ai_mese = null where slug = 'tuo-slug';
```

(Poi serve comunque essere sopra l'80% della quota: se non ci sei, non parte
niente — ed è giusto.)

---

## 6. Se qualcosa va storto

- **Qualcuno si lamenta di essere bloccato senza motivo**: `delete from limiti_ip;`
  sblocca tutti all'istante, poi ne parliamo e alziamo i numeri (stanno in
  `src/lib/limiti-ip.ts`, sono due costanti).
- **Un salone dice che i suoi clienti non riescono a scrivere**: controlla se
  arrivano tutti dallo stesso indirizzo. I numeri sono tarati per una persona,
  non per un centralino: se serve, per la chat dei saloni si alzano senza
  rischio, perché il tetto vero contro la spesa resta la quota mensile.
