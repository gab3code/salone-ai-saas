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
});
