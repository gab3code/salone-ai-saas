import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { risolviDatabaseDiProva } from "./database-di-prova";

const PROD = {
  NEXT_PUBLIC_SUPABASE_URL: "https://produzione.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-prod",
  SUPABASE_SERVICE_ROLE_KEY: "service-prod",
};

const PROVA = {
  E2E_SUPABASE_URL: "https://prova.supabase.co",
  E2E_SUPABASE_ANON_KEY: "anon-prova",
  E2E_SUPABASE_SERVICE_ROLE_KEY: "service-prova",
};

describe("il database su cui girano i test", () => {
  it("con .env.test completo usa il database separato", () => {
    const esito = risolviDatabaseDiProva({ ...PROD, ...PROVA });
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.database.url).toBe("https://prova.supabase.co");
    expect(esito.database.eProduzione).toBe(false);
  });

  it("SENZA configurazione non parte, invece di usare quello vero", () => {
    const esito = risolviDatabaseDiProva(PROD);
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errore).toContain("webhook Stripe veri");
    expect(esito.errore).toContain("E2E_SUPABASE_URL");
  });

  it("una configurazione a meta' non passa: indovinare significa scrivere in produzione", () => {
    const esito = risolviDatabaseDiProva({ ...PROD, E2E_SUPABASE_URL: PROVA.E2E_SUPABASE_URL });
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errore).toContain("a meta'");
  });

  it("non accetta un 'database di prova' che e' quello di produzione", () => {
    const esito = risolviDatabaseDiProva({
      ...PROD,
      E2E_SUPABASE_URL: "https://PRODUZIONE.supabase.co/",
      E2E_SUPABASE_ANON_KEY: "a",
      E2E_SUPABASE_SERVICE_ROLE_KEY: "s",
    });
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errore).toContain("STESSO progetto");
  });

  it("l'opt-out esplicito funziona, e si dichiara per quello che e'", () => {
    const esito = risolviDatabaseDiProva({ ...PROD, E2E_CONSENTI_PRODUZIONE: "1" });
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.database.url).toBe("https://produzione.supabase.co");
    expect(esito.database.eProduzione).toBe(true);
  });

  it("l'opt-out non basta se mancano le variabili di produzione", () => {
    const esito = risolviDatabaseDiProva({ E2E_CONSENTI_PRODUZIONE: "1" });
    expect(esito.ok).toBe(false);
  });

  it("un valore diverso da 1 non e' un opt-out", () => {
    expect(risolviDatabaseDiProva({ ...PROD, E2E_CONSENTI_PRODUZIONE: "si" }).ok).toBe(false);
    expect(risolviDatabaseDiProva({ ...PROD, E2E_CONSENTI_PRODUZIONE: "true" }).ok).toBe(false);
    expect(risolviDatabaseDiProva({ ...PROD, E2E_CONSENTI_PRODUZIONE: "0" }).ok).toBe(false);
  });
});

/**
 * La guardia che manca al resto: separare il database serve a poco se poi un
 * singolo file di test si costruisce il client da solo leggendo
 * `process.env.NEXT_PUBLIC_SUPABASE_URL`, cioe' da `.env.local`, cioe' da
 * produzione.
 *
 * E' successo davvero (18/09/2026): gli scenari 23 e 26 creavano il tenant
 * nel database di test e poi provavano a fare login in PRODUZIONE. Falliva
 * con "Invalid login credentials" -- un messaggio che fa pensare alla
 * password e non all'indirizzo, quindi il tipo di errore che si insegue per
 * un'ora.
 *
 * Questo test non guarda un comportamento, guarda il TESTO dei file: e'
 * l'unico modo di accorgersene prima, perche' il difetto sta in cosa un test
 * decide di leggere, non in cosa fa.
 */
describe("nessuno scenario si costruisce il client da solo", () => {
  it("nessun .spec.ts legge le variabili Supabase da process.env", () => {
    // Non `__dirname`: sotto vitest questi file girano come ESM, dove non
    // esiste sempre.
    const cartella = join(dirname(fileURLToPath(import.meta.url)), "..");
    const colpevoli = readdirSync(cartella)
      .filter((nome) => nome.endsWith(".spec.ts"))
      .filter((nome) =>
        /process\.env\.(NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE_KEY)/.test(
          readFileSync(join(cartella, nome), "utf8")
        )
      );

    expect(
      colpevoli,
      "questi scenari puntano al database di .env.local invece che a quello dei test: usa creaClientAdminTest / creaClientAnonimoTest da helpers/supabase-admin.ts"
    ).toEqual([]);
  });
});
