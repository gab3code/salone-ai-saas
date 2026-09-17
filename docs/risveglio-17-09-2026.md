# Al risveglio -- 17/09/2026

Lista ordinata di cosa lanciare e cosa fare a mano dopo il lavoro notturno.
Segui l'ordine: i passi dopo il 3 danno per scontato che i primi tre siano verdi.

---

> **Aggiornamento della mattina.** La migrazione `0035` (passo 3) **l'ho applicata io** quando
> me l'hai chiesto: le quattro policy su `clienti` ci sono, verificate. È arrivata anche la
> `0039` (numero WhatsApp + preferenze di notifica), anch'essa già applicata. Nessuna
> migrazione in sospeso.

## 1. Prendi il lavoro e mandalo su

```bash
cd ~/dev/salone-ai-saas
git log --oneline -10         # devono esserci 7 commit nuovi sopra a5abc90
git push
```

Il push lo devi fare tu: dal mio lato il proxy git lo blocca.

---

## 2. Le verifiche veloci (un minuto, nessuna rete)

```bash
rm -rf .next
npm run build
npx tsc --noEmit
npx eslint src tests --max-warnings=0
npm test
```

**L'ordine conta, ed è il contrario di quello che verrebbe da fare.** `tsconfig.json` include
`.next/types/**/*.ts`, cioè i tipi che Next genera per le rotte. Da lì arrivano due cose:
i moduli di ogni pagina esistente E i tipi globali `LayoutProps`/`PageProps` che il codice usa.
Quindi:

- con un `.next` **vecchio**, `tsc` cerca una rotta cancellata (in questo giro
  `/prova-chat/[slug]`) e fallisce con `Cannot find module .../prova-chat/[slug]/page.js`;
- con `.next` **cancellato e basta**, `tsc` fallisce dall'altra parte: `Cannot find name
  'LayoutProps'`.

`npm run build` è quello che li rigenera giusti (e fa già il suo controllo TypeScript per conto
suo), quindi va PRIMA. Il `tsc --noEmit` dopo è un secondo passaggio su tipi aggiornati.

Atteso: **tutto pulito, 604 test verdi**.

### I test sono indipendenti dal fuso orario, e ora è verificato

Il 17/09/2026 un test è passato nel sandbox (che gira in UTC) e fallito sul Mac di Gabriel
(Europa/Roma): usava `new Date(2026, 8, 14)`, cioè la mezzanotte LOCALE, che in Italia è il
giorno prima in UTC. Corretto il test e, già che c'era, altre due date calcolate in ora locale
nel pannello di piattaforma. Se vuoi ricontrollarlo:

```bash
TZ=Europe/Rome npm test
TZ=Pacific/Kiritimati npm test
```

Devono dare lo stesso risultato. **Regola per il futuro**: quando una data serve a verificare
un confine di giorno, mese o settimana, si scrive con `Date.UTC`, mai con `new Date(anno, mese,
giorno)`.

`eslint` ora deve dare **zero errori E zero warning**: se ne compare anche uno solo,
è arrivato con il tuo push, non con il mio -- prima di stanotte il progetto ne aveva
9 errori e 10 warning, tutti dentro una libreria UI mai collegata che ho rimosso.

```bash
npm run build
```

Atteso: build completata, nessuna pagina in errore.

---

## 3. ~~LA MIGRAZIONE CHE DEVI APPLICARE TU~~ -- FATTA

Applicata la mattina del 17/09, su tua richiesta. Se vuoi ricontrollare:

```sql
select policyname, cmd from pg_policies where tablename = 'clienti';
```

Attese **quattro** righe: `lettura_tenant` (SELECT), `scrittura_membri_insert`
(INSERT), `scrittura_membri_update` (UPDATE), `cancellazione_owner` (DELETE).
Se vedi ancora `isolamento_tabella` / ALL, la migrazione non è passata.

Applicate anche **0036**, **0037**, **0038** (notte) e **0039** (mattina: numero WhatsApp e
preferenze di notifica).

---

## 4. Gli scenari end-to-end

```bash
npm run test:e2e:deterministici
```

Sono quelli senza AI (11→25), i più veloci e i più stabili. Atteso: **tutti verdi**.

Se fallisce **solo** il caso nuovo dentro lo Scenario 23
(*"un collaboratore non cancella un cliente nemmeno dal database"*), vuol dire che la 0035
non è più in piedi -- ma l'ho applicata e verificata io, quindi non dovrebbe succedere.

Poi, quando hai qualche minuto e non ti dispiace spendere qualche centesimo di token:

```bash
npm run test:e2e
```

Lo Scenario 1 (chat AI vera) ogni tanto è capriccioso: se fallisce solo lui, rilancia
`npx playwright test 01-` prima di considerarlo un problema.

### Cosa c'è di nuovo da controllare

| Dove | Cosa dovrebbe succedere |
|---|---|
| Scenario **24** (nuovo) | Il titolare cancella una scheda cliente; gli appuntamenti restano, senza nome. Uno staff non vede il pulsante. |
| Scenario **23** (esteso) | Lo stesso confine vale contro il database nudo. |
| Scenario **25** (nuovo) | Contatti (telefono + WhatsApp, con la spunta "stesso numero") e preferenze di notifica, incluse le opzioni SMS chiuse sotto Pro. |
| Scenari **11, 14, 17, 19, 22** | Invariati: servono a dire che non ho rotto niente. |

---

## 5. Guarda con i tuoi occhi (5 minuti)

Dopo che Vercel ha finito il deploy del push:

1. **salone-ai-saas.vercel.app** → sezione Prezzi. I prezzi ora arrivano da
   `lib/piani.ts`, la stessa fonte del checkout: devono dire 19,90 / 39,90 / 89,90 e
   +10 / +15 / +20.
2. Sezione **"Tutto quello che include"**: le voci con un gate di piano ora hanno
   l'etichetta "da Growth" / "da Pro".
3. **FAQ**: "Funziona anche su WhatsApp?" non dice più che l'AI è su tutti i piani.
4. **/privacy**: ci sono i dati di fatturazione, la verifica VIES e le assenze.
5. **Dashboard → un cliente qualsiasi**: in fondo ai dati anagrafici c'è
   "Cancella definitivamente questo cliente". Provalo su un cliente finto.
6. **Impostazioni → Contatti**: metti il tuo numero e guarda l'anteprima -- è la frase vera che
   l'assistente dirà a un cliente, non un esempio.
7. **Impostazioni → Notifiche**: spegni "Avvisami a ogni nuova prenotazione", poi prenota dalla
   pagina pubblica: a te non deve arrivare niente, al cliente sì.
8. **Chat sulla pagina pubblica**: chiedi all'assistente di parlare con una persona. Deve darti
   il numero, e da telefono il WhatsApp deve aprire WhatsApp, non il tastierino.

---

## 6. Le cose da fare su Stripe e Supabase (a mano, 5 minuti in tutto)

### 6a. Stripe → Customer Portal (l'unica ancora aperta di ieri)

Dashboard Stripe → Settings → Billing → Customer portal → *Customer information*.

Oggi il cliente può modificare **nome, email, indirizzo e telefono**. Da ieri
denominazione e indirizzo li teniamo noi e sono quelli che finiscono in fattura: se
li cambia lì, i due archivi divergono in silenzio e la fattura esce con l'indirizzo
vecchio.

Togli la spunta a **name** e **address**. Lascia **email** e **phone** (non entrano
nella fattura elettronica).

*Verificato stanotte via API*: la partita IVA (tax ID) **non** è modificabile dal
portale -- quella era già a posto. Il cambio piano è attivo con
`proration_behavior: always_invoice`, corretto.

### 6b. Stripe → cosa succede quando un pagamento continua a fallire

Dashboard Stripe → Settings → Billing → *Subscriptions and emails* → sezione
"Manage payment retries" / "If all retries fail".

Deve essere **"Cancel the subscription"**. Se fosse "Leave the subscription unpaid" o
"Do nothing", un salone con la carta scaduta resterebbe su un piano a pagamento per
sempre senza pagarlo: il nostro webhook riporta il tenant a Free solo quando Stripe
cancella davvero. È l'unico punto in cui il nostro sistema dipende da
un'impostazione del tuo account, e non l'ho potuta leggere dall'API.

### 6c. Stripe → webhook

**Già a posto, non devi fare niente.** Ho verificato: l'endpoint
`salone-ai-saas.vercel.app/api/stripe/webhook` ha tutti e **9** gli eventi, inclusi
`customer.tax_id.created` e `customer.tax_id.updated` che ieri erano da aggiungere.

### 6d. Supabase → password compromesse -- ~~da fare~~ NON SI PUÒ, ERRORE MIO

**Correzione del 17/09/2026.** Ti avevo scritto "è gratis, è un interruttore". È falso, e
per questo non lo trovavi: la documentazione Supabase dice che *"Leaked password
protection is available on the Pro Plan and above"*, e l'organizzazione
`rzjvstjumkyebnpeuvmn` è sul piano **free**. L'interruttore su quella pagina non
esiste proprio.

Quello che si può fare gratis, stessa pagina (Authentication → Providers → Email):

- **lunghezza minima della password**: alzala a 10-12 caratteri;
- **caratteri obbligatori**: lettere più numeri.

Non è la stessa cosa (non confronta niente con HaveIBeenPwned), ma è l'unica leva
disponibile a costo zero. Quando il progetto passerà a Pro per altri motivi -- e
prima o poi ci passa, il free non regge un prodotto con clienti paganti -- quella
protezione si accende con una spunta. Nel frattempo resta un rischio noto e
accettato, non una dimenticanza: i nostri utenti sono titolari di salone che
riusano le password, quindi va riaperto il giorno dell'upgrade.

### 6e. Stripe sandbox → le dieci sottoscrizioni di prova

Nell'account sandbox ci sono **10 subscription attive** rimaste dai run E2E, tutte su
prezzi vecchi (39,00 e 69,00 €, non il listino di oggi). Non fanno danni, ma
sporcano ogni lettura futura: quando hai un momento, cancellale dalla dashboard di
Stripe. Non le ho toccate io -- cancellare oggetti su Stripe non lo faccio senza che
me lo chiedi esplicitamente.

---

## 7. Se qualcosa va storto

- **Un test E2E fallisce**: `npx playwright show-report` apre il report con lo
  screenshot del momento esatto.
- **Il sito in produzione sbaglia un prezzo**: è la prima volta che la landing legge
  `lib/piani.ts`. Se un numero non torna, la fonte è
  `PREZZO_BASE_CENTESIMI` / `PREZZO_OPERATORE_EXTRA_CENTESIMI` in
  `src/lib/piani.ts`, e va confrontata con i Price su Stripe -- non modificata a mano
  sulla landing, che è esattamente il problema che abbiamo appena tolto.
- **Vuoi tornare indietro su qualcosa**: i commit sono separati per argomento (promesse della
  landing / pagine legali / codice orfano / test / linter Supabase / contatti e notifiche),
  quindi si possono revertire uno alla volta.
