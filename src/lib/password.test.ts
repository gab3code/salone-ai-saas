import { describe, it, expect } from "vitest";
import {
  problemaPassword,
  problemaPasswordRipetuta,
  LUNGHEZZA_MINIMA_PASSWORD,
} from "./password";

describe("problemaPassword", () => {
  it("accetta una password lunga abbastanza", () => {
    expect(problemaPassword("cavallo-batteria-graffetta")).toBeNull();
  });

  it("accetta esattamente il minimo", () => {
    expect(problemaPassword("a".repeat(LUNGHEZZA_MINIMA_PASSWORD))).toBeNull();
  });

  it("rifiuta un carattere in meno del minimo", () => {
    expect(problemaPassword("a".repeat(LUNGHEZZA_MINIMA_PASSWORD - 1))).toContain(
      String(LUNGHEZZA_MINIMA_PASSWORD)
    );
  });

  it("rifiuta il vuoto e i soli spazi", () => {
    expect(problemaPassword("")).toBe("Scrivi una password.");
    expect(problemaPassword("        ")).toBe("Scrivi una password.");
  });

  it("non esplode su input non testuale", () => {
    expect(problemaPassword(null as unknown as string)).toBe("Scrivi una password.");
    expect(problemaPassword(undefined as unknown as string)).toBe("Scrivi una password.");
  });

  it("non impone maiuscole, numeri o simboli", () => {
    expect(problemaPassword("tuttominuscolo")).toBeNull();
  });

  it("non taglia gli spazi interni: una passphrase resta valida", () => {
    expect(problemaPassword("il mio salone")).toBeNull();
  });
});

describe("problemaPasswordRipetuta", () => {
  it("accetta due password uguali e valide", () => {
    expect(problemaPasswordRipetuta("cavallo-batteria", "cavallo-batteria")).toBeNull();
  });

  it("segnala prima il problema della password, poi quello della ripetizione", () => {
    expect(problemaPasswordRipetuta("corta", "diversa")).toContain(
      String(LUNGHEZZA_MINIMA_PASSWORD)
    );
  });

  it("segnala due password diverse", () => {
    expect(problemaPasswordRipetuta("cavallo-batteria", "cavallo-batteri")).toBe(
      "Le due password non coincidono."
    );
  });

  it("distingue due password che differiscono solo per uno spazio finale", () => {
    expect(problemaPasswordRipetuta("cavallo-batteria", "cavallo-batteria ")).toBe(
      "Le due password non coincidono."
    );
  });
});
