import { describe, it, expect } from "vitest";
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
