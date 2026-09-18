import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  pianoEPagante,
  pianoPerPriceId,
  priceIdPerPiano,
  priceIdOperatoreExtra,
  tuttiPriceIdOperatoreExtra,
} from "./piani";

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

describe("priceIdOperatoreExtra (16/09/2026: esteso da Pro a tutti i piani paganti)", () => {
  const ENV_ORIGINALE = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
  });

  it("ogni piano pagante legge la PROPRIA variabile, mai quella di un altro", () => {
    // Il bug che questo test esclude: un salone Growth a cui viene addebitata
    // la quota di Pro (o viceversa) perché il codice legge la variabile
    // sbagliata. Sono cifre diverse -- 10/15/20€ -- quindi uno scambio è
    // denaro vero addebitato male.
    process.env.STRIPE_PRICE_STARTER_OPERATORE_EXTRA = "price_starter_extra";
    process.env.STRIPE_PRICE_GROWTH_OPERATORE_EXTRA = "price_growth_extra";
    process.env.STRIPE_PRICE_PRO_OPERATORE_EXTRA = "price_pro_extra";

    expect(priceIdOperatoreExtra("starter")).toBe("price_starter_extra");
    expect(priceIdOperatoreExtra("growth")).toBe("price_growth_extra");
    expect(priceIdOperatoreExtra("pro")).toBe("price_pro_extra");
  });

  it("una variabile mancante restituisce null invece di lanciare", () => {
    // Starter e Growth richiedono due Price che Gabriel deve creare a mano su
    // Stripe: finché non esistono, quei piani non applicano la quota e tutto
    // il resto continua a funzionare. Un errore qui bloccherebbe la creazione
    // di un operatore, che è un danno molto peggiore.
    delete process.env.STRIPE_PRICE_STARTER_OPERATORE_EXTRA;
    process.env.STRIPE_PRICE_PRO_OPERATORE_EXTRA = "price_pro_extra";

    expect(priceIdOperatoreExtra("starter")).toBeNull();
    expect(priceIdOperatoreExtra("pro")).toBe("price_pro_extra");
  });

  it("una variabile vuota conta come mancante, non come price id valido", () => {
    // Una riga `STRIPE_PRICE_STARTER_OPERATORE_EXTRA=` lasciata a metà in un
    // .env è più probabile della variabile assente del tutto, e manderebbe a
    // Stripe una stringa vuota come price.
    process.env.STRIPE_PRICE_STARTER_OPERATORE_EXTRA = "";
    expect(priceIdOperatoreExtra("starter")).toBeNull();
  });
});

describe("tuttiPriceIdOperatoreExtra", () => {
  const ENV_ORIGINALE = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
  });

  it("elenca solo i price id davvero configurati", () => {
    process.env.STRIPE_PRICE_STARTER_OPERATORE_EXTRA = "price_starter_extra";
    delete process.env.STRIPE_PRICE_GROWTH_OPERATORE_EXTRA;
    process.env.STRIPE_PRICE_PRO_OPERATORE_EXTRA = "price_pro_extra";

    expect(tuttiPriceIdOperatoreExtra().sort()).toEqual(
      ["price_pro_extra", "price_starter_extra"].sort()
    );
  });

  it("serve a riconoscere l'add-on di un piano VECCHIO dopo un cambio piano", () => {
    // È il motivo per cui questa funzione esiste: chi passa da Starter a
    // Growth si porta dietro la riga "operatore extra Starter" a 10€, e la
    // sincronizzazione deve riconoscerla per sostituirla con quella da 15€,
    // non affiancarla.
    process.env.STRIPE_PRICE_STARTER_OPERATORE_EXTRA = "price_starter_extra";
    process.env.STRIPE_PRICE_GROWTH_OPERATORE_EXTRA = "price_growth_extra";
    process.env.STRIPE_PRICE_PRO_OPERATORE_EXTRA = "price_pro_extra";

    const noti = new Set(tuttiPriceIdOperatoreExtra());
    expect(noti.has("price_starter_extra")).toBe(true);
    expect(noti.has(priceIdOperatoreExtra("growth")!)).toBe(true);
  });
});
