# Test play -- la rubrica clienti chiusa a PostgREST (18/09/2026)

Questa e' la seconda delle cinque voci di sicurezza della Fase 6, e la piu'
delicata delle due fatte oggi: tocca il CRM, il calendario e le metriche
insieme. Percio' l'ordine dei passi conta piu' del solito -- **prima il
codice, poi la migrazione**. Al contrario, per qualche minuto il prodotto
sarebbe rotto.

**Un blocco alla volta. Se un comando da' un risultato diverso da quello
scritto, fermati e dimmelo.**

---

## Cosa cambia, in una frase

Uno staff (e anche tu) poteva chiedere l'intera rubrica clienti direttamente a
PostgREST con la chiave pubblica, saltando il prodotto. Da adesso il ruolo
`authenticated` su `clienti` non ha piu' nessun permesso, e ogni lettura o
scrittura passa da `src/lib/clienti.server.ts`, che gira sul server con la
service_role key.

Non era chiudibile in altro modo: per il database "guardare la scheda di Anna"
e "scaricarle tutte" sono la stessa identica query. La differenza vive nel
comportamento, non nei dati.

---

## 1. Sei sul commit giusto

```
cd ~/dev/salone-ai-saas
git log --oneline -1
```

Deve comparire il commit con la rubrica chiusa. Se hai ancora `764f151f` in
cima, il commit non c'e' -- dimmelo.

---

## 2. I test unitari (nessun costo, nessuna email)

```
npm test
```

Attesi: **tutti verdi**. Tre cose in particolare sono nuove o toccate:

- `src/lib/clienti.server.test.ts` -- 25 test nuovi. Verificano che OGNI
  funzione che tocca i clienti filtri per tenant, e che il test fallisca da
  solo se un domani se ne aggiunge una senza il suo caso.
- `src/lib/booking-engine.server.test.ts` -- toccato: i clienti non si leggono
  piu' col client passato, quindi il finto admin adesso e' lo stesso finto del
  test.
- tutto il resto deve essere rimasto verde com'era.

Se qui qualcosa e' rosso, **fermati**: la migrazione del passo 4 non va
applicata finche' non e' verde.

---

## 3. La migrazione, sul database di TEST

Apri il progetto Supabase **di test** (quello nuovo, non quello di
produzione), SQL Editor, e incolla il contenuto di:

```
supabase/migrations/0051_rubrica_solo_dal_server.sql
```

Sono due righe di `revoke`, il resto e' commento. Esegui.

Controprova, nello stesso SQL Editor:

```sql
select count(*)
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'clienti';
```

Atteso: **20**. Prima della migrazione sono 25.

Nota (sbagliata nella prima versione di questo file, il 18/09/2026): non ci si
aspetta che `authenticated` e `anon` spariscano del tutto dall'elenco. La
migrazione revoca `select/insert/update/delete`, ma `REFERENCES`, `TRIGGER` e
`TRUNCATE` restano -- non danno modo di leggere ne' di scrivere righe, e
toglierli non c'entra con questa falla. Per questo si conta, invece di
guardare se un nome compare.

---

## 4. Gli scenari Playwright

Il server locale deve girare sul database di test (il solito
`npm run dev` con `.env.test` gia' caricato dalla config dei test).

Prima i due che riguardano direttamente questa modifica:

```
npx playwright test tests/e2e/23-permessi-database.spec.ts --project=chromium
```

Atteso: **4 test verdi**. Quello nuovo si chiama "la rubrica non si legge ne'
si scrive da PostgREST, nemmeno dal titolare" -- e' la dimostrazione che il
buco e' chiuso.

Poi i due che dimostrano che il prodotto **non** si e' rotto (sono la parte
piu' importante di tutto il test play: un permesso tolto che rompe il
prodotto e' peggio del buco):

```
npx playwright test tests/e2e/24-cancellazione-cliente.spec.ts --project=chromium
npx playwright test tests/e2e/12-prenotazione-manuale-dashboard.spec.ts --project=chromium
```

Atteso: tutti verdi. Il primo prova che il titolare cancella ancora una scheda
dal prodotto e che uno staff non ci riesce nemmeno chiamando l'azione a mano;
il secondo che si crea ancora un appuntamento dal calendario, cliente nuovo
compreso.

---

## 5. La suite completa

```
npx playwright test --project=chromium
```

Atteso: tutti verdi. Questa costa qualche centesimo (gli scenari con l'AI).

---

## 6. Il push

```
git push
```

---

## 7. La migrazione, sul database di PRODUZIONE -- solo DOPO il deploy

Questo e' il passo dove l'ordine conta davvero.

1. Aspetta che Vercel abbia finito il deploy del commit appena pushato (il
   pallino verde sulla dashboard Vercel).
2. Apri il progetto Supabase **di produzione**, SQL Editor, incolla lo stesso
   file `0051_rubrica_solo_dal_server.sql`, esegui.
3. Ripeti la stessa query di controllo del passo 3.

**Perche' in questo ordine**: la migrazione toglie un permesso che il codice
vecchio usa ancora. Applicandola prima del deploy, per i minuti della build la
pagina clienti e il calendario di un salone vero mostrerebbero una rubrica
vuota. Applicandola dopo, non c'e' nessun momento scoperto: il codice nuovo non
usa piu' quel permesso da prima che venga tolto.

---

## 8. Due minuti a mano, sul sito vero

Dopo la migrazione in produzione, con il tuo account:

- **/dashboard/clienti** -- l'elenco si vede, la ricerca per nome funziona.
- Apri una scheda cliente, cambia una nota, salva -- deve salvare.
- **/dashboard/calendario** -- gli appuntamenti del giorno mostrano ancora il
  NOME del cliente, non uno spazio vuoto. (Questo e' il punto che si romperebbe
  per primo: il nome li' arrivava da un embed PostgREST, adesso arriva da una
  seconda query.)
- **/dashboard** -- la card "Nuovi clienti (30gg)" mostra un numero.
- **/dashboard/analytics** -- il grafico dei nuovi clienti si disegna.
- **Esporta CSV** dalla pagina clienti -- scarica un file con dentro i clienti.

Se una di queste e' vuota o da' errore, dimmi quale: sono cinque punti diversi
e si riconoscono subito l'uno dall'altro.
