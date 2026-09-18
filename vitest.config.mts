import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// "server-only" è pensato per far fallire una build Next.js se un file
// server-side finisce per sbaglio in un bundle browser (prima difesa contro
// una fuga di service_role key, vedi supabase/admin.ts) -- ma fuori da quel
// bundler lancia sempre, quindi sotto vitest va sostituito con un modulo
// vuoto: qui i test girano in Node, non nel browser, la protezione reale
// resta quella di Next in fase di build.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    // tests/e2e/*.spec.ts sono scenari Playwright (Task #190, punto 30),
    // NON test vitest: usano `test`/`expect` di "@playwright/test", che
    // fuori dal runner di Playwright (`npx playwright test`) non funziona --
    // senza questa esclusione il pattern di default di vitest
    // ("**/*.{test,spec}.ts") proverebbe comunque a raccoglierli e fallirebbe.
    //
    // Si escludono i soli `.spec.ts`, non tutta la cartella: `tests/e2e/**`
    // portava via anche `helpers/database-di-prova.test.ts`, che e' un test
    // vitest a tutti gli effetti -- scritto il 18/09/2026, mai eseguito una
    // volta, scoperto il giorno dopo. Un test che non gira e' peggio di un
    // test che non esiste: da' la stessa tranquillita' senza fare niente.
    exclude: ["**/node_modules/**", "tests/e2e/**/*.spec.ts"],
  },
});
