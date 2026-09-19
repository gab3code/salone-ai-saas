import { describe, expect, it } from "vitest";
import { orariNelTesto, orariConsentiti, trovaOrarioInventato, FRASE_ORARI_NON_VERIFICATI } from "./verifica-orari";

describe("orariNelTesto", () => {
  it("prende gli orari con i due punti e li normalizza", () => {
    expect(orariNelTesto("8:00, 9:00 e 14:30")).toEqual(["08:00", "09:00", "14:30"]);
  });

  it("NON scambia prezzi e durate per orari", () => {
    expect(orariNelTesto("La manicure dura 30 minuti e costa 25 euro.")).toEqual([]);
    expect(orariNelTesto("Sono 45 minuti, 40 euro.")).toEqual([]);
  });

  it("lascia stare 'alle 8' senza minuti, che e' ambiguo", () => {
    expect(orariNelTesto("Ti aspetto alle 8")).toEqual([]);
  });
});

describe("orariConsentiti", () => {
  it("estrae gli orari dagli ISO di un risultato di verifica_disponibilita", () => {
    const risultato = JSON.stringify({
      slot: [
        { inizio: "2026-09-22T08:00:00.000Z", fine: "2026-09-22T08:30:00.000Z" },
        { inizio: "2026-09-22T09:30:00.000Z", fine: "2026-09-22T10:00:00.000Z" },
      ],
    });
    const consentiti = orariConsentiti([risultato]);
    expect(consentiti.has("08:00")).toBe(true);
    expect(consentiti.has("09:30")).toBe(true);
    expect(consentiti.has("12:00")).toBe(false);
  });

  it("estrae anche gli orari di apertura in formato HH:MM:SS", () => {
    const risultato = JSON.stringify({ apertura: "08:00:00", chiusura: "18:00:00" });
    const consentiti = orariConsentiti([risultato]);
    expect(consentiti.has("08:00")).toBe(true);
    expect(consentiti.has("18:00")).toBe(true);
  });
});

describe("trovaOrarioInventato", () => {
  /** La lista vera scritta al cliente il 19/09, pausa pranzo compresa. */
  it("prende la lista inventata del 19/09/2026", () => {
    const soloVeri = orariConsentiti([
      JSON.stringify({
        slot: [
          { inizio: "2026-09-22T08:00:00.000Z" },
          { inizio: "2026-09-22T09:00:00.000Z" },
        ],
      }),
    ]);
    const problema = trovaOrarioInventato(
      "Gli orari disponibili sono: 8:00, 9:00, 10:00, 11:00, 12:00, 13:00, 14:00",
      soloVeri
    );
    expect(problema).toMatch(/non risultano da nessuno strumento/i);
    expect(problema).toContain("12:00");
    expect(problema).toContain("13:00");
    expect(problema).not.toContain("08:00");
  });

  it("scatta anche quando NESSUNO strumento e' stato chiamato", () => {
    expect(trovaOrarioInventato("Ho libero alle 8:00 e alle 9:00.", new Set())).not.toBeNull();
  });

  /** La meta' che evita che la rete venga spenta dopo due giorni. */
  it("NON scatta su un orario che il cliente ha appena scritto", () => {
    const consentiti = orariConsentiti(["vorrei prenotare alle 8:00"]);
    expect(trovaOrarioInventato("Perfetto, martedì alle 8:00 per la manicure.", consentiti)).toBeNull();
  });

  it("NON scatta quando gli orari vengono davvero dallo strumento", () => {
    const consentiti = orariConsentiti([
      JSON.stringify({ slot: [{ inizio: "2026-09-22T08:00:00.000Z" }, { inizio: "2026-09-22T15:30:00.000Z" }] }),
    ]);
    expect(trovaOrarioInventato("Ho libero alle 8:00 e alle 15:30.", consentiti)).toBeNull();
  });

  it("NON scatta su un messaggio senza nessun orario", () => {
    expect(trovaOrarioInventato("La manicure dura 30 minuti e costa 25 euro.", new Set())).toBeNull();
  });

  it("la frase di ripiego non contiene nessun orario", () => {
    expect(orariNelTesto(FRASE_ORARI_NON_VERIFICATI)).toEqual([]);
  });
});
