import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pianoEPagante, giorniDiProva, pianoPerPriceId, priceIdPerPiano } from "./piani";

describe("pianoEPagante", () => {
  it("riconosce solo i 3 piani con checkout self-service", () => {
    expect(pianoEPagante("starter")).toBe(true);
    expect(pianoEPagante("growth")).toBe(true);
    expect(pianoEPagante("pro")).toBe(true);
  });

  it("free ed enterprise non passano dal checkout Stripe (free è nel DB, enterprise è a preventivo)", () => {
    expect(pianoEPagante("free")).toBe(false);
    expect(pianoEPagante("enterprise")).toBe(false);
  });

  it("un valore mancante o non riconosciuto non è mai un piano pagante (fail-safe)", () => {
    expect(pianoEPagante(null)).toBe(false);
    expect(pianoEPagante(undefined)).toBe(false);
    expect(pianoEPagante("qualcosa-di-strano")).toBe(false);
  });
});

describe("giorniDiProva", () => {
  it("solo Growth ha un trial -- non Starter (che l'AI non ce l'ha) e non più Pro (ristretto il 12/09/2026)", () => {
    expect(giorniDiProva("starter")).toBeUndefined();
    expect(giorniDiProva("growth")).toBe(10);
    expect(giorniDiProva("pro")).toBeUndefined();
  });
});

describe("priceIdPerPiano / pianoPerPriceId", () => {
  const ENV_ORIGINALE = { ...process.env };

  beforeEach(() => {
    process.env.STRIPE_PRICE_STARTER = "price_starter_test";
    process.env.STRIPE_PRICE_GROWTH = "price_growth_test";
    process.env.STRIPE_PRICE_PRO = "price_pro_test";
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
  });

  it("legge il Price ID giusto per ogni piano dalle env", () => {
    expect(priceIdPerPiano("starter")).toBe("price_starter_test");
    expect(priceIdPerPiano("growth")).toBe("price_growth_test");
    expect(priceIdPerPiano("pro")).toBe("price_pro_test");
  });

  it("senza la env corrispondente valorizzata, alza un errore esplicito invece di mandare un Price ID vuoto a Stripe", () => {
    delete process.env.STRIPE_PRICE_GROWTH;
    expect(() => priceIdPerPiano("growth")).toThrow(/STRIPE_PRICE_GROWTH/);
  });

  it("ricostruisce il piano interno a partire da un Price ID Stripe reale (usato dal webhook)", () => {
    expect(pianoPerPriceId("price_growth_test")).toBe("growth");
    expect(pianoPerPriceId("price_pro_test")).toBe("pro");
  });

  it("un Price ID sconosciuto (prodotto rimosso/ricreato) non esplode, torna null", () => {
    expect(pianoPerPriceId("price_non_esiste")).toBeNull();
  });
});
