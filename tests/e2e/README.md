# Scenari E2E (punto 30 di CLAUDE.md) -- Task #190 CHIUSO

**16/09/2026: `npm run test:e2e` -- 18 passed, zero fallimenti.** Tutti e 15 gli scenari del
punto 27 di CLAUDE.md (18 test in 15 file) sono verdi INSIEME in un'unica run, non solo nei run
mirati dei giri precedenti -- vedi DECISIONS.md, "Task #190 chiuso", per il riepilogo completo
del percorso (4 giri di run reali, 2 bug reali nel prodotto trovati e corretti lungo la strada).

Automatizzano con Playwright alcuni dei 15 scenari end-to-end elencati in CLAUDE.md
("## 27. Test completo"). Girano SOLO in locale, a comando -- non in CI, non ad ogni push
(decisione con Gabriel il 16/09/2026, vedi DECISIONS.md): ogni test crea e ripulisce un
tenant vero su Supabase, e gli scenari con la chat AI chiamano il vero Claude (costo
qualche centesimo di token a run).

## Prima di lanciarli

1. `.env.local` presente e valorizzato (stesso file che usa `npm run dev` -- servono
   soprattutto `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`).
2. Se non l'hai già fatto: `npx playwright install chromium` (scarica il browser che
   Playwright guida -- va lanciato una volta sola, dal Terminal vero del tuo Mac, MAI
   tramite il bridge/device_bash: vedi DECISIONS.md 16/09/2026 sul perché).
3. Non serve avere `npm run dev` già acceso in un altro terminale: `playwright.config.ts`
   lo avvia da solo se la porta 3000 è libera (e lo riusa se è già acceso).

## Come lanciarli

```bash
npm run test:e2e                 # tutti gli scenari disponibili
npx playwright test 01-           # solo lo Scenario 1 (o qualunque prefisso di file)
npx playwright test --headed      # con la finestra del browser visibile, utile per capire un fallimento
npx playwright show-report        # apre il report HTML dell'ultimo run (screenshot sui fallimenti)
```

## Scenari coperti finora

| File | Scenario (punto 30) | Cosa verifica davvero |
|---|---|---|
| `01-nuovo-cliente-ai-prenotazione.spec.ts` | 1 | Chat AI vera prenota un cliente nuovo; l'appuntamento compare su calendario E su CRM |
| `03-doppia-prenotazione-simultanea.spec.ts` | 3 | Due richieste concorrenti vere (non simulate) sullo stesso slot: ne vince esattamente una |
| `05-professionista-assente.spec.ts` | 5 | L'AI non prenota mai un'operatrice con una chiusura quel giorno, anche se il cliente la chiede per nome |
| `06-attivita-chiusa.spec.ts` | 6 | Ri-verifica il bug già corretto (lista d'attesa su un giorno completamente chiuso) |
| `09-servizi-consecutivi.spec.ts` | 9 | Chat AI vera prenota due servizi di fila con lo stesso operatore (funzionalità del 16/09/2026) |
| `12-prenotazione-manuale-dashboard.spec.ts` | 12 | Lo staff crea un appuntamento dal pannello, checkbox+slot+form reali, nessuna AI |
| `24-cancellazione-cliente.spec.ts` | -- (17/09/2026) | Il titolare cancella una scheda cliente: la riga sparisce, gli appuntamenti restano con `cliente_id` a null. Uno staff non vede il pulsante e il cliente sopravvive. |
| `25-contatti-e-notifiche.spec.ts` | -- (17/09/2026) | Telefono e WhatsApp salvati dalle impostazioni (incluso il travaso della spunta "stesso numero", che senza il codice apposta salverebbe vuoto), e le preferenze di notifica: interruttore del titolare, quattro scelte per i clienti, opzioni SMS chiuse sotto Pro, piu' il follow-up ai clienti spariti (soglia che guida anche dashboard e rubrica, pavimento anti-spam a 60 giorni). |

**1-9-12 sono stati eseguiti dal vivo il 16/09/2026 e sono VERDI (6/6)** -- hanno trovato e fatto
correggere due bug reali lungo il percorso, vedi DECISIONS.md.

| `02-modifica-prenotazione-cliente-esistente.spec.ts` | 2 | L'AI trova per telefono una prenotazione esistente e la sposta al nuovo giorno/ora richiesti |
| `04-servizio-inesistente.spec.ts` | 4 | L'AI non inventa né prenota un servizio che il tenant non offre |
| `07-servizio-incompatibile-con-operatore.spec.ts` | 7 | L'AI non prenota mai un servizio con un operatore che non lo esegue |
| `08-slot-occupato-durante-conversazione.spec.ts` | 8 | Uno slot proposto si occupa PRIMA della conferma (insert diretto tra due turni) -- l'AI si accorge del conflitto e propone un'alternativa |
| `10-cliente-cancella.spec.ts` | 10 | Cancellazione via chat (mai una delete fisica) + avviso automatico al primo candidato compatibile in lista d'attesa |
| `11-cliente-non-si-presenta.spec.ts` | 11 | No-show NON è un flusso di prodotto implementato oggi (verificato leggendo il codice) -- il test si limita a verificare che uno stato `no_show` libererebbe davvero lo slot, se mai venisse scritto |
| `13-nuova-attivita-registrazione-onboarding.spec.ts` | 13 | Registrazione reale da `/registrati` (provisioning automatico verificato a prescindere dalla conferma email) + completamento onboarding sulle sezioni manuali di `/dashboard/configura` |

**Primo run reale (16/09/2026): 12/14 verdi**, poi un secondo run di TUTTI e 18 i test: **15/18
verdi**. Scenario 8 e 13 erano ancora bug nei TEST (un margine anti-burst troppo risicato in
`chat.ts` + un retry che non rispondeva alla domanda di conferma dell'AI; un locator ambiguo
sulla pagina pubblica) -- **corretti**, vedi DECISIONS.md. Un terzo run (dopo altri due giri di
fix su 8/9/10, vedi DECISIONS.md) ha portato a **16/18 verdi**, con lo Scenario 2 confermato sano
(era variabilità AI da crediti esauriti, non un bug). Restavano due sintomi nuovi, entrambi
diagnosticati e corretti in questo stesso giro: lo **Scenario 8** aveva ancora un retry troppo
corto per una riconferma esplicita che l'AI a volte chiede dopo aver offerto un orario alternativo
-- corretto alternando offerta-orario e riconferma nel test. Lo **Scenario 10** mostrava l'AI
dichiarare una cancellazione riuscita con il database ancora invariato: non un bug di test, ma una
lacuna reale nel prompt (`agente.ts`) che non vietava esplicitamente di dichiarare un'azione
completata senza aver davvero richiamato lo strumento in quel turno -- **corretto** estendendo
REGOLA ASSOLUTA 1, con un log diagnostico incondizionato aggiunto in `tools.ts` per confermare la
diagnosi al prossimo run. **Confermato dal vivo subito dopo**: `npx playwright test 08- 10-` --
**2 passed**, il log ha mostrato il modello correggere da solo un id non valido nello stesso
turno invece di dichiarare un successo a memoria. Log diagnostici rimossi. Manca solo un run
completo di tutti e 18 insieme come conferma finale del Task #190.

| `14-upgrade-piano-abbonamento.spec.ts` | 14 | (a) il NOSTRO endpoint `/api/stripe/checkout` genera un vero URL di Checkout Stripe e salva il customer sul tenant; (b) il NOSTRO webhook porta il tenant sul piano corretto quando Stripe conferma l'abbonamento attivo |
| `15-cliente-cancella-abbonamento.spec.ts` | 15 | (a) il NOSTRO endpoint `/api/stripe/portal` genera un vero URL del Customer Portal per un tenant con abbonamento attivo; (b) il NOSTRO webhook riporta il tenant a Free quando Stripe conferma la cancellazione |

Decisione presa con Gabriel il 16/09/2026 (vedi DECISIONS.md, "l'opzione più sicura"): questi due
scenari passano dal Checkout/Customer Portal ospitati da Stripe, pagine che non controlliamo --
si testa solo il NOSTRO codice (URL generato correttamente, reazione corretta al webhook Stripe
firmato con `stripe.webhooks.generateTestHeaderString`), MAI navigando dentro quelle pagine e MAI
completando un pagamento vero (solo chiamate test-mode: Sessioni/Customer creati e ripuliti in
`afterEach`, zero rischio finanziario).

**Tutti e 15 gli scenari del punto 27 di CLAUDE.md sono ora scritti E i 4 test Stripe (14/15)
sono verdi dal vivo al primo colpo** (Price ID reali presi dalla Dashboard, `STRIPE_WEBHOOK_SECRET`
generato al volo -- questi due scenari non hanno bisogno del vero signing secret di Stripe, vedi
DECISIONS.md).

## Perché non in CI (per ora)

Ogni test tocca il database reale (seppur con dati usa-e-getta, sempre ripuliti in
`test.afterEach`) e gli scenari con l'AI spendono token Anthropic veri -- va bene lanciarli
a comando quando serve, non ha senso farli girare automaticamente ad ogni push finché il
progetto è uno solo a lavorarci. Se in futuro servisse (più persone sul codice, voglia di
un cancello automatico prima del merge), servirebbe un progetto/branch Supabase DEDICATO
ai test (mai contro produzione) e le chiavi come secret di GitHub Actions -- discorso a
parte, non fatto in questo giro.

---

## Il webhook della sandbox punta alla PRODUZIONE (e i test ci girano dentro)

Da sapere prima di scrivere uno scenario che crea un abbonamento Stripe vero.

L'endpoint webhook configurato sull'account sandbox è
`https://salone-ai-saas.vercel.app/api/stripe/webhook`, cioè il deploy di produzione, che parla
con **lo stesso progetto Supabase** su cui girano questi test. Quindi ogni oggetto Stripe creato
da un test fa partire eventi veri, che un secondo dopo tornano dentro al nostro codice e
possono modificare proprio le righe su cui il test sta per asserire.

Il caso concreto, e non è teorico: `customer.subscription.created` → il webhook chiama
`sincronizzaQuantitaOperatoriStripe` → se il salone ha più operatori di quanti l'abbonamento ne
fatturi, **il prodotto aggiunge la quota da sé**. È il suo mestiere. Ma per un test che aveva
creato l'abbonamento "spoglio" è un terzo incomodo che cambia lo stato a metà corsa.

Ha già rotto due scenari, in momenti diversi:

- **Scenario 17** (16/09/2026): il webhook riscriveva `tenants.piano` dal price della riga base,
  e il test asseriva uno stato incoerente. Risolto riscrivendo il test perché facesse un cambio
  piano vero.
- **Scenario 22** (17/09/2026): il fixture creava un abbonamento Starter senza quota operatore
  per un salone con due operatori, e il webhook la aggiungeva. Passava o falliva a seconda di
  quanto ci metteva ad arrivare.

**La regola che ne esce**: un fixture deve partire **già nello stato su cui la sincronizzazione
converge** -- per questo `creaAbbonamentoDiProva` accetta `operatoriExtra`. E nessuna asserzione
deve appoggiarsi su uno stato che il prodotto ha il diritto di correggere da solo.

**Cosa resta scoperto, dichiarato invece che nascosto**: il caso "Stripe disallineato rispetto
agli operatori" (che l'anteprima del cambio piano serve proprio a mostrare) non è verificabile
in modo stabile finché il webhook della sandbox punta alla produzione. Si sbloccherebbe con un
secondo endpoint webhook verso un deploy di staging, o con un progetto Supabase separato per i
test -- entrambi lavori da fare a mente fredda, non dentro un test.

---

## Scenario 26 e i test che costano soldi veri (17/09/2026)

Lo Scenario 26 copre la pagina Analytics rifatta e la prova dell'assistente dei piani senza
AI. C'è una cosa che **non fa di proposito**: non preme mai il pulsante "Guarda cosa avrebbe
risposto".

Quel pulsante fa una chiamata vera al modello e consuma una delle dieci prove mensili del
tenant. In una suite che gira decine di volte al giorno sarebbero decine di chiamate pagate
ogni giorno, per verificare una risposta che cambia ogni volta -- cioè il test peggiore
possibile: costoso e non deterministico.

**La regola che ne esce, generale**: un test end-to-end non deve mai attraversare un confine
a consumo (il modello, un SMS vero, un pagamento vero) se quello che sta verificando è la
logica *intorno* a quel confine. Qui la logica intorno è tutta coperta -- chi vede il
riquadro, chi no, che il tetto regga contro il database nudo -- e la logica *dentro* (piani,
quota, finestra del mese, strumenti concessi) ha 16 test unitari in
`src/lib/ai/demo-assistente.test.ts`, che non chiamano niente.

Lo stesso principio spiega perché nello Scenario 26 gli appuntamenti si creano dal form della
dashboard e non via service_role: lì il giro completo dall'interfaccia **è** l'oggetto del
test (è quello che fa comparire il riquadro), mentre nel test sulla retention gli appuntamenti
sono solo un dato di partenza e si creano con l'helper, che è più veloce e più stabile.

**Una trappola dell'helper, ora risolta**: `creaAppuntamentoConfermato` faceva sempre un INSERT
su `clienti`, quindi due chiamate con lo stesso telefono producevano DUE clienti con una visita
a testa -- che per una metrica su "quanti clienti tornano" è esattamente il dato opposto, e
sbagliava in silenzio invece di dare errore. Da oggi accetta `clienteIdEsistente`.
