import { describe, expect, it } from "vitest";
import { pseudoUtcAReale, realeAPseudoUtc } from "./fuso-orario";

describe("realeAPseudoUtc", () => {
  it("converte un istante reale nell'ora civile di Roma (CET, UTC+1, inverno)", () => {
    // 2026-01-15T09:00:00Z reale -> 10:00 a Roma in gennaio (CET, +1).
    const reale = new Date("2026-01-15T09:00:00Z");
    const pseudo = realeAPseudoUtc(reale, "Europe/Rome");
    expect(pseudo.toISOString()).toBe("2026-01-15T10:00:00.000Z");
  });

  it("converte un istante reale nell'ora civile di Roma (CEST, UTC+2, estate)", () => {
    // 2026-07-15T09:00:00Z reale -> 11:00 a Roma in luglio (CEST, +2).
    const reale = new Date("2026-07-15T09:00:00Z");
    const pseudo = realeAPseudoUtc(reale, "Europe/Rome");
    expect(pseudo.toISOString()).toBe("2026-07-15T11:00:00.000Z");
  });

  it("un fuso che coincide con UTC non cambia nulla (caso degenere, utile come rete di sicurezza)", () => {
    const reale = new Date("2026-03-01T12:34:56Z");
    expect(realeAPseudoUtc(reale, "UTC").toISOString()).toBe(reale.toISOString());
  });
});

describe("pseudoUtcAReale", () => {
  it("è l'inversa esatta di realeAPseudoUtc in inverno", () => {
    const pseudo = new Date("2026-01-15T10:00:00Z"); // 10:00 civili a Roma
    expect(pseudoUtcAReale(pseudo, "Europe/Rome").toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("è l'inversa esatta di realeAPseudoUtc in estate", () => {
    const pseudo = new Date("2026-07-15T11:00:00Z"); // 11:00 civili a Roma
    expect(pseudoUtcAReale(pseudo, "Europe/Rome").toISOString()).toBe("2026-07-15T09:00:00.000Z");
  });

  it("round-trip reale -> pseudo -> reale torna al punto di partenza per tanti istanti diversi", () => {
    // Nota: il fine settimana del cambio ora solare (fine ottobre) produce
    // deliberatamente un'ora civile "ripetuta" (es. 02:30 esiste sia come
    // CEST che come CET) -- non invertibile in modo univoco per costruzione,
    // quindi non incluso qui; i campioni restano fuori da quella finestra.
    const campioni = [
      "2026-01-01T00:00:00Z",
      "2026-03-29T00:30:00Z", // vicino al cambio ora legale in Europa
      "2026-06-21T18:45:00Z",
      "2026-10-25T04:00:00Z", // dopo il cambio ora solare in Europa
      "2026-12-31T23:59:59Z",
    ];
    for (const iso of campioni) {
      const reale = new Date(iso);
      const pseudo = realeAPseudoUtc(reale, "Europe/Rome");
      const tornato = pseudoUtcAReale(pseudo, "Europe/Rome");
      expect(tornato.getTime()).toBe(reale.getTime());
    }
  });

  it("round-trip pseudo -> reale -> pseudo torna al punto di partenza", () => {
    const pseudo = new Date("2026-05-20T09:30:00Z");
    const reale = pseudoUtcAReale(pseudo, "Europe/Rome");
    const tornato = realeAPseudoUtc(reale, "Europe/Rome");
    expect(tornato.getTime()).toBe(pseudo.getTime());
  });
});
