# Test play -- tutto quello che gira su Chromium

Gli E2E sono l'unica parte della suite che apre un browser vero: Playwright
guida **Chromium** contro `npm run dev` sulla tua macchina. Girano solo in
locale, a comando.

Ogni test crea e ripulisce un tenant vero su Supabase. **Otto di loro chiamano
anche il modello vero e costano qualche centesimo a run**: sono separati apposta
qui sotto, cosi' puoi lanciare tutto il resto quante volte vuoi senza spendere.

**Un blocco alla volta.**

---

## 1. Una volta sola, la prima volta

```bash
cd ~/dev/salone-ai-saas
npx playwright install chromium
```

Scarica il browser che Playwright guida. Va lanciato dal Terminal vero del tuo
Mac, mai da qui tramite me.

Serve anche `.env.local` valorizzato (lo stesso che usa `npm run dev`). Non
serve avere `npm run dev` gia' acceso: Playwright lo avvia da solo se la porta
3000 e' libera, e lo riusa se e' occupata.

---

## 2. Prima degli E2E: la suite che non apre nessun browser

Se questa e' rossa, non ha senso accendere Chromium.

```bash
npm test
npx tsc --noEmit
npx eslint . --max-warnings=0
```

Atteso: tutto verde, nessun output dagli ultimi due.

---

## 3. Gli E2E che NON costano niente

```bash
npm run test:e2e:deterministici
```

Copre gli scenari dall'11 al 27: dashboard, permessi, fatturazione, multi-sede,
Stripe (solo il NOSTRO codice, mai una pagina di Stripe), analytics, e il nuovo
**Scenario 27 sui messaggi offensivi**.

Lo Scenario 27 non costa niente per costruzione: un insulto viene riconosciuto
**prima** della chiamata al modello, quindi Anthropic non viene mai interpellato
e la risposta e' una costante del codice, non un testo generato. E' per questo
che puo' stare in una suite che gira spesso.

Due scenari gratis restano fuori da quel comando, per come e' scritto il filtro
sui nomi dei file. Se li vuoi:

```bash
npx playwright test 03- 10-
```

Sono la doppia prenotazione simultanea e la cancellazione con avviso alla lista
d'attesa: nessuno dei due chiama il modello.

---

## 4. Gli E2E che COSTANO (chat AI vera)

Otto scenari: 01, 02, 04, 05, 06, 07, 08, 09. Ognuno fa una conversazione vera
con Claude, quindi una run costa qualche centesimo e la risposta del modello
cambia ogni volta.

```bash
npx playwright test 01- 02- 04- 05- 06- 07- 08- 09-
```

Uno solo, quando stai indagando su qualcosa di preciso:

```bash
npx playwright test 01-
```

---

## 5. Tutto insieme

```bash
npm run test:e2e
```

Lancia ogni scenario, inclusi gli otto a pagamento. E' la conferma finale, non
il comando di tutti i giorni.

---

## 6. Quando qualcosa fallisce

```bash
npx playwright test 08- --headed
npx playwright show-report
```

Il primo riapre quello scenario con la finestra del browser visibile. Il secondo
apre il report dell'ultima run, con screenshot e trace dei fallimenti.

Un fallimento su uno degli otto a pagamento non e' automaticamente un bug: il
modello varia, ed e' gia' successo che uno scenario risultasse rosso per
variabilita' o per crediti Anthropic esauriti. Prima di dare la colpa al codice,
rilancia quel singolo scenario. Sugli altri no: quelli sono deterministici, e un
rosso li' e' un problema vero.

---

## 7. Cosa NON e' coperto qui, di proposito

- **Il pulsante "Guarda cosa avrebbe risposto"** nella prova assistente: fa una
  chiamata vera e consuma una delle dieci prove mensili del tenant. Tutto quello
  che gli sta intorno e' testato, il click no.
- **La richiesta vera che contiene una volgarita'** (*"scusa, ho fatto una
  cazzata, posso spostare l'appuntamento?"*, che deve passare): quella ARRIVA al
  modello, quindi costerebbe a ogni run. E' coperta gratis dai test unitari in
  `src/lib/ai/messaggio-offensivo.test.ts` e dal banco di prova:

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/prova-messaggi-offensivi.mjs
```

- **Le pagine ospitate da Stripe** (Checkout e Customer Portal): non le
  controlliamo noi, si verifica solo che il nostro codice generi l'URL giusto e
  reagisca bene al webhook.
