import { describe, expect, it } from "vitest";
import {
  limiteMensilePrenotazioni,
  limiteMensileSms,
  limiteOperatori,
  pianoHaAnalytics,
  pianoHaListaAttesaAutomatica,
  pianoHaSms,
} from "./piani";

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

describe("pianoHaListaAttesaAutomatica", () => {
  it("growth, pro ed enterprise hanno accesso al contatto automatico della lista d'attesa", () => {
    for (const piano of ["growth", "pro", "enterprise"]) {
      expect(pianoHaListaAttesaAutomatica(piano)).toBe(true);
    }
  });

  it("free e starter non hanno accesso", () => {
    for (const piano of ["free", "starter"]) {
      expect(pianoHaListaAttesaAutomatica(piano)).toBe(false);
    }
  });

  it("un piano sconosciuto/malformato non ha accesso -- fail-closed, stesso principio di pianoHaAnalytics", () => {
    expect(pianoHaListaAttesaAutomatica("qualcosa-di-strano")).toBe(false);
  });
});

describe("pianoHaSms", () => {
  it("pro ed enterprise hanno accesso, come pubblicizzato in Prezzi.tsx", () => {
    for (const piano of ["pro", "enterprise"]) {
      expect(pianoHaSms(piano)).toBe(true);
    }
  });

  it("free, starter e growth non hanno accesso -- l'SMS costa soldi veri, non è incluso nemmeno nei piani con Promemoria/AI", () => {
    for (const piano of ["free", "starter", "growth"]) {
      expect(pianoHaSms(piano)).toBe(false);
    }
  });

  it("un piano sconosciuto/malformato non ha accesso -- fail-closed, stesso principio di pianoHaAnalytics", () => {
    expect(pianoHaSms("qualcosa-di-strano")).toBe(false);
  });
});

describe("limiteMensileSms", () => {
  it("un piano senza SMS ha sempre tetto zero, a prescindere dal numero di operatori", () => {
    expect(limiteMensileSms("growth", 5)).toBe(0);
  });

  it("pro con 1 operatore (o zero, es. onboarding non ancora completato) ha 100 SMS/mese", () => {
    expect(limiteMensileSms("pro", 1)).toBe(100);
    expect(limiteMensileSms("pro", 0)).toBe(100);
  });

  it("pro con più operatori scala linearmente: 100 SMS/operatore/mese", () => {
    expect(limiteMensileSms("pro", 3)).toBe(300);
  });
});
