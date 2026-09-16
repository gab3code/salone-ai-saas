import { defineConfig, devices } from "@playwright/test";
import { config as caricaEnv } from "dotenv";

// I file di test girano come processo Node a sé stante (non dentro il
// bundler di Next, che carica .env.local da solo per il server `npm run
// dev`) -- va caricato esplicitamente qui perché i helper dei test
// (tests/e2e/helpers/supabase-admin.ts) leggano le stesse variabili
// dell'app invece di trovare `process.env` vuoto.
caricaEnv({ path: ".env.local" });

/**
 * Config Playwright per i 15 scenari end-to-end del punto 30 di CLAUDE.md
 * (Task #190). Pensati per girare SOLO in locale, a comando (decisione con
 * Gabriel 16/09/2026, vedi DECISIONS.md) -- non in CI, non ad ogni push:
 * ogni scenario crea un tenant/database vero (Supabase, `SUPABASE_SERVICE_ROLE_KEY`)
 * e alcuni chiamano il vero Claude (`ANTHROPIC_API_KEY`), quindi vanno lanciati
 * con `.env.local` presente e un `npm run dev` raggiungibile.
 *
 * `webServer` avvia da solo `npm run dev` se la porta non è già occupata (utile
 * per lanciare `npx playwright test` senza dover prima aprire un altro terminale
 * con `npm run dev` acceso) -- se il server è già acceso (`reuseExistingServer`),
 * lo riusa invece di provare ad aprirne un secondo sulla stessa porta.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Gli scenari con l'AI vera possono richiedere diversi secondi a risposta
  // (chiamata reale a Claude + eventuale seconda chiamata per il tool use) --
  // un timeout troppo stretto farebbe fallire scenari corretti solo perché
  // Anthropic ha risposto con qualche secondo di ritardo, non per un bug.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // `fullyParallel: false` da solo NON basta a serializzare -- Playwright fa
  // comunque girare file DIVERSI in worker paralleli di default (visto dal
  // vivo il 16/09/2026: "Running 6 tests using 4 workers" nonostante questa
  // opzione). Ogni tenant di prova è isolato (suffisso casuale), quindi
  // andrebbe bene anche in parallelo, ma un solo worker rende log/costo
  // Anthropic più prevedibili mentre si stabilizzano ancora questi scenari.
  workers: 1,
  retries: 0, // un retry nasconderebbe una vera race condition intermittente (proprio quello che alcuni scenari, es. lo Scenario 3, vogliono scoprire)
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
