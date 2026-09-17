# Cosa lanciare -- 17/09/2026, secondo giro

Chiusura della **Fase 3** (retention + Analytics rifatta) e della **Fase 5**
(prova dell'assistente per i piani senza AI).

---

## 1. Prendi il lavoro

```bash
cd ~/dev/salone-ai-saas
git fetch fase3-fase5.bundle main:fase3-fase5
git merge --ff-only fase3-fase5
git branch -d fase3-fase5
rm -f *.bundle
```

**Lancia questi comandi UNA VOLTA SOLA.** Stamattina li hai incollati due volte e la
seconda ha dato tre errori che sembravano gravi e non lo erano: il bundle
era gia' stato consumato e cancellato dal `rm` del primo giro. Se ti
ricapita, `git log --oneline -1` dice la verita' meglio di qualunque
messaggio d'errore.

---

## 2. C'e' una dipendenza nuova, quindi l'install serve per forza

```bash
npm install
```

E' arrivato **recharts**. Insieme a lui recupera anche `motion`, `clsx` e
`tailwind-merge`, che non erano mai stati installati: il comando di stamattina
non era mai partito per colpa di un commento con `#` che avevo messo sulla
stessa riga. Senza questo passo il build fallisce e basta.

---

## 3. Le verifiche

```bash
rm -rf .next
npm run build
npx tsc --noEmit
npx eslint src tests --max-warnings=0
npm test
```

L'ordine conta ed e' il contrario di quello che verrebbe da fare: `tsconfig.json`
include `.next/types/**/*.ts`, quindi senza un `.next` appena rigenerato `tsc`
fallisce da una parte o dall'altra. Il build lo rigenera giusto.

Atteso: **654 test verdi** (erano 604), zero errori, zero warning.

Se vuoi ricontrollare l'indipendenza dal fuso orario, che stamattina ci ha
morso:

```bash
TZ=Europe/Rome npm test
TZ=Pacific/Kiritimati npm test
```

---

## 4. Gli scenari end-to-end

```bash
npm run test:e2e:deterministici
```

Atteso: **tutti verdi**, ora sono 40 (c'e' lo Scenario 26 nuovo, 6 test).

Lo Scenario 26 **non preme mai** il pulsante "Guarda cosa avrebbe risposto":
quello fa una chiamata vera al modello e consuma una delle dieci prove
mensili del tenant. In una suite che gira decine di volte al giorno sarebbe
una spesa continua e un test che cambia risposta ogni volta. Verifica tutto
quello che ci sta intorno, e la logica ha i suoi 16 test unitari.

| Dove | Cosa dovrebbe succedere |
|---|---|
| Scenario 26.1 | Sotto Growth, Analytics mostra l'upsell e nemmeno il selettore di periodo. |
| Scenario 26.2 | Il periodo resta nell'indirizzo, la granularita' lo segue, un periodo inventato non rompe la pagina. |
| Scenario 26.3 | La retention conta solo chi ha avuto il tempo di tornare: sei clienti maturi fanno 100%, il settimo arrivato ieri non abbassa niente. |
| Scenario 26.4 | Uno Starter che inserisce un appuntamento a mano vede la prova dell'assistente. |
| Scenario 26.5 | Un Growth no: l'assistente ce l'ha gia'. |
| Scenario 26.6 | Il tetto delle prove non si azzera parlando direttamente col database. |

---

## 5. Guarda con i tuoi occhi (5 minuti)

Serve un account su un piano **growth** o superiore per Analytics, e uno su
**starter** (o free) per la prova dell'assistente.

1. **Dashboard -> Analytics**. In alto a destra ci sono quattro pillole:
   4 settimane / 3 mesi / 6 mesi / 12 mesi. Cliccandole cambia anche la
   granularita' del grafico (giorni, settimane, mesi), non solo la lunghezza.
2. Le due card sopra il grafico sono **interruttori**: clicca "Nuovi clienti"
   e il grafico cambia serie. Ognuna porta la variazione sul periodo
   precedente.
3. Piu' sotto, **"Quanti clienti tornano"**. Se il salone e' nuovo dira' che
   non ci sono ancora abbastanza dati, ed e' giusto cosi': e' il
   comportamento che volevo vedere, non un errore. Ogni barra ha una parte
   scura (si sono presentati) e una chiara (hanno riprenotato e non sono
   venuti).
4. **Impostazioni -> Promemoria**: cambia la soglia del follow-up e torna su
   Analytics. La frase in fondo al blocco retention deve seguire il numero
   nuovo.
5. **Su un account Starter -> Calendario**: inserisci un appuntamento a mano.
   Sotto al form compare "Questo appuntamento l'hai preso tu". Prova a
   scrivere una domanda vera e premi il pulsante: la risposta deve parlare
   dei TUOI servizi e dei TUOI orari. Consuma una delle dieci prove del mese.
6. Chiudi il riquadro con la X e rifai un appuntamento: non deve ricomparire
   (resta chiuso un mese).

---

## 6. Cose da fare a mano

### 6a. Niente, sul database

La migrazione **0041** (contatore delle prove + `consuma_demo_ai`) l'ho gia'
applicata e verificata io. Se vuoi ricontrollare:

```sql
select has_function_privilege('service_role', 'consuma_demo_ai(uuid, integer)', 'execute') as server_puo,
       has_function_privilege('authenticated', 'consuma_demo_ai(uuid, integer)', 'execute') as titolare_puo;
```

Attesi `true` e `false`. Se fossero tutti e due `false`, la prova
dell'assistente non funziona: manca il `grant` al service_role.

### 6b. Supabase, la correzione di stamattina

La "Leaked password protection" che non trovavi **non esiste sul piano free**:
e' una funzione del piano Pro, e io ti avevo scritto che era gratis.
Sbagliato mio, gia' corretto in `docs/risveglio-17-09-2026.md`. Quello che
puoi fare gratis, stessa pagina (Authentication -> Providers -> Email):
lunghezza minima della password a 10-12 e caratteri obbligatori.

### 6c. Stripe

Restano quelle di stamattina, se non le hai gia' fatte: il Customer Portal
(togliere la spunta a *name* e *address*) e il comportamento dei pagamenti
falliti, che deve essere **"Cancel the subscription"**.
