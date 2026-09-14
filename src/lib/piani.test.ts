import { describe, expect, it } from "vitest";
import { limiteMensilePrenotazioni, limiteOperatori, pianoHaAnalytics } from "./piani";

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

describe("pianoHaAnalytics", () => {
  it("growth, pro ed enterprise hanno accesso, come pubblicizzato in Prezzi.tsx/Funzionalita.tsx", () => {
    for (const piano of ["growth", "pro", "enterprise"]) {
      expect(pianoHaAnalytics(piano)).toBe(true);
    }
  });

  it("free e starter non hanno accesso", () => {
    for (const piano of ["free", "starter"]) {
      expect(pianoHaAnalytics(piano)).toBe(false);
    }
  });

  it("un piano sconosciuto/malformato non ha accesso -- fail-closed qui: diverso dai limiti sopra, dare accesso a una funzione a pagamento per un valore imprevisto sarebbe il difetto pericoloso, non il contrario", () => {
    expect(pianoHaAnalytics("qualcosa-di-strano")).toBe(false);
  });
});
