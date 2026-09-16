# Scenari E2E (punto 30 di CLAUDE.md) -- Task #190

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

**Scenari 2, 4, 7, 8, 10, 11, 13, 14, 15 non ancora scritti** -- prossimo giro di lavoro su
Task #190. Nota su 14/15 (upgrade e cancellazione abbonamento): passano dal Customer
Portal ospitato da Stripe (`pulsante-portale-abbonamento.tsx`), una pagina che non
controlliamo -- da valutare se automatizzarne l'interazione con le carte di test Stripe o
limitarsi a verificare che il nostro codice generi l'URL del portale/riceva correttamente
il webhook, lasciando la UI del portale stesso a Stripe.

## Perché non in CI (per ora)

Ogni test tocca il database reale (seppur con dati usa-e-getta, sempre ripuliti in
`test.afterEach`) e gli scenari con l'AI spendono token Anthropic veri -- va bene lanciarli
a comando quando serve, non ha senso farli girare automaticamente ad ogni push finché il
progetto è uno solo a lavorarci. Se in futuro servisse (più persone sul codice, voglia di
un cancello automatico prima del merge), servirebbe un progetto/branch Supabase DEDICATO
ai test (mai contro produzione) e le chiavi come secret di GitHub Actions -- discorso a
parte, non fatto in questo giro.
