import { describe, expect, it } from "vitest";
import {
  oraDaIso,
  selezionaOrariDaProporre,
  preparaOrariPerIlModello,
  MAX_ORARI_DA_PROPORRE,
} from "./proposta-orari";

describe("oraDaIso", () => {
  it("prende l'ora dall'ISO in pseudo-UTC", () => {
    expect(oraDaIso("2026-09-22T08:00:00.000Z")).toBe("08:00");
    expect(oraDaIso("2026-09-22T15:45:00.000Z")).toBe("15:45");
  });
  it("torna null su qualcosa che non e' un ISO", () => {
    expect(oraDaIso("domani")).toBeNull();
  });
});

describe("selezionaOrariDaProporre", () => {
  /**
   * Il caso vero: passo 15 minuti, giornata intera. I primi sei sarebbero
   * un'ora e un quarto di mattina presto, cioe' nessuna scelta.
   */
  it("distribuisce sulla giornata invece di dare i primi sei", () => {
    const giornata: string[] = [];
    for (let h = 8; h < 18; h++) for (const m of ["00", "15", "30", "45"]) giornata.push(`${String(h).padStart(2, "0")}:${m}`);
    expect(giornata.length).toBe(40);

    const scelti = selezionaOrariDaProporre(giornata);
    expect(scelti.length).toBe(MAX_ORARI_DA_PROPORRE);
    expect(scelti[0]).toBe("08:00");
    expect(scelti[scelti.length - 1]).toBe("17:45");
    // Nessuno dei sei è dentro la prima ora: sarebbe il difetto che stiamo
    // evitando.
    expect(scelti.filter((o) => o < "09:00").length).toBe(1);
  });

  it("il primo e l'ultimo ci sono sempre: servono a chi ha fretta e a chi lavora tardi", () => {
    const orari = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    const scelti = selezionaOrariDaProporre(orari);
    expect(scelti[0]).toBe("09:00");
    expect(scelti[scelti.length - 1]).toBe("18:00");
  });

  it("se sono pochi li da tutti, senza inventarsi una selezione", () => {
    expect(selezionaOrariDaProporre(["09:00", "10:00"])).toEqual(["09:00", "10:00"]);
    expect(selezionaOrariDaProporre([])).toEqual([]);
  });

  it("toglie i doppioni e ordina", () => {
    expect(selezionaOrariDaProporre(["10:00", "09:00", "10:00"])).toEqual(["09:00", "10:00"]);
  });
});

describe("preparaOrariPerIlModello", () => {
  it("consegna stringhe gia' pronte da scrivere, non timestamp da riformattare", () => {
    const risultato = preparaOrariPerIlModello([
      { inizio: "2026-09-22T08:00:00.000Z", operatoreId: "a" },
      { inizio: "2026-09-22T08:15:00.000Z", operatoreId: "a" },
      { inizio: "2026-09-22T08:00:00.000Z", operatoreId: "b" },
    ]);
    // Lo stesso orario con due operatori diversi e' UN orario per il cliente.
    expect(risultato.tutti_gli_orari_liberi).toEqual(["08:00", "08:15"]);
    expect(risultato.quanti_in_tutto).toBe(2);
    expect(risultato.orari_da_mostrare).toEqual(["08:00", "08:15"]);
  });

  it("giornata vuota: tutto a zero, niente di inventato", () => {
    expect(preparaOrariPerIlModello([])).toEqual({
      tutti_gli_orari_liberi: [],
      orari_da_mostrare: [],
      quanti_in_tutto: 0,
    });
  });
});
