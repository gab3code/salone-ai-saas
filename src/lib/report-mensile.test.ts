import { describe, expect, it } from "vitest";
import {
  commentoAccettabile,
  eGiornoDelReport,
  meseDaRaccontare,
  promptReport,
  MAX_CARATTERI_COMMENTO,
} from "./report-mensile";

const DATI = {
  nomeSalone: "Salone Rosa",
  mese: "settembre 2026",
  appuntamenti: 120,
  appuntamentiMesePrecedente: 98,
  noShow: 4,
  cancellati: 7,
  clientiNuovi: 15,
  clientiCheNonTornano: 23,
  serviziPiuRichiesti: [
    { nome: "Taglio", quante: 60 },
    { nome: "Colore", quante: 30 },
  ],
};

describe("quale mese si racconta", () => {
  it("il primo di ottobre si racconta settembre", () => {
    const mese = meseDaRaccontare(new Date("2026-10-01T08:00:00Z"));
    expect(mese.nome).toBe("settembre 2026");
    expect(mese.chiave).toBe("2026-09");
    expect(mese.inizio.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(mese.fine.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("il primo di gennaio si racconta dicembre dell'anno prima", () => {
    const mese = meseDaRaccontare(new Date("2027-01-01T08:00:00Z"));
    expect(mese.nome).toBe("dicembre 2026");
    expect(mese.chiave).toBe("2026-12");
  });

  it("si spedisce solo il primo del mese", () => {
    expect(eGiornoDelReport(new Date("2026-10-01T08:00:00Z"))).toBe(true);
    expect(eGiornoDelReport(new Date("2026-10-02T08:00:00Z"))).toBe(false);
    expect(eGiornoDelReport(new Date("2026-10-31T08:00:00Z"))).toBe(false);
  });
});

describe("cosa si chiede al modello", () => {
  it("gli si danno i numeri contati da noi, tutti", () => {
    const prompt = promptReport(DATI);
    expect(prompt).toContain("120");
    expect(prompt).toContain("98");
    expect(prompt).toContain("Taglio (60)");
  });

  it("senza servizi non inventa una riga vuota", () => {
    expect(promptReport({ ...DATI, serviziPiuRichiesti: [] })).not.toContain("Servizi piu' richiesti");
  });
});

describe("il commento del modello", () => {
  const buono =
    "Il mese è andato meglio del precedente, soprattutto sui tagli. Restano diversi clienti che non si vedono da parecchio: varrebbe la pena richiamarli prima delle feste.";

  it("un commento senza cifre passa", () => {
    expect(commentoAccettabile(buono)).toBe(buono);
  });

  it("UN COMMENTO CON UN NUMERO NON PARTE", () => {
    // E' la regola che rende impossibile l'errore peggiore: un titolare che
    // prende una decisione su un numero che il modello si e' ricordato male.
    // Le cifre le mostra la tabella, contate da noi.
    expect(commentoAccettabile("Hai avuto 120 appuntamenti, bene così.")).toBeNull();
    expect(commentoAccettabile("Sei cresciuto del 22% sul mese scorso.")).toBeNull();
  });

  it("niente link", () => {
    expect(commentoAccettabile("Vai su www.esempio.it per approfondire il tuo andamento mensile.")).toBeNull();
  });

  it("troppo corto o troppo lungo non parte", () => {
    expect(commentoAccettabile("Bene.")).toBeNull();
    expect(commentoAccettabile("a".repeat(MAX_CARATTERI_COMMENTO + 1))).toBeNull();
  });

  it("qualunque cosa che non sia testo non parte", () => {
    expect(commentoAccettabile(null)).toBeNull();
    expect(commentoAccettabile({ commento: "ciao" })).toBeNull();
  });
});
