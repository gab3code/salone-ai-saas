import { describe, expect, it } from "vitest";
import { limiteMensilePrenotazioni, limiteOperatori } from "./piani";

describe("limiteMensilePrenotazioni", () => {
  it("il piano free ha un tetto di 60 prenotazioni al mese", () => {
    expect(limiteMensilePrenotazioni("free")).toBe(60);
  });

  it("tutti gli altri piani restano illimitati su questo fronte (leva di prodotto, non di costo)", () => {
    for (const piano of ["starter", "growth", "pro", "enterprise"]) {
      expect(limiteMensilePrenotazioni(piano)).toBe(Infinity);
    }
  });

  it("un piano sconosciuto/malformato non ha un tetto -- fail-open qui, mai bloccare una prenotazione reale per un valore di piano imprevisto", () => {
    expect(limiteMensilePrenotazioni("qualcosa-di-strano")).toBe(Infinity);
  });
});

describe("limiteOperatori", () => {
  it("il piano free è limitato a 1 operatore, come pubblicizzato in Prezzi.tsx", () => {
    expect(limiteOperatori("free")).toBe(1);
  });

  it("tutti gli altri piani restano illimitati", () => {
    for (const piano of ["starter", "growth", "pro", "enterprise"]) {
      expect(limiteOperatori(piano)).toBe(Infinity);
    }
  });

  it("un piano sconosciuto/malformato non ha un tetto -- fail-open, mai bloccare la creazione di un operatore per un valore imprevisto", () => {
    expect(limiteOperatori("qualcosa-di-strano")).toBe(Infinity);
  });
});
