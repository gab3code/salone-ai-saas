import { describe, expect, it } from "vitest";
import {
  DATI_FATTURAZIONE_VUOTI,
  datiFatturazioneCompleti,
  normalizzaDatiFatturazione,
  validaDatiFatturazione,
  type DatiFatturazione,
} from "./fatturazione";

function dati(sovrascritture: Partial<DatiFatturazione> = {}): DatiFatturazione {
  return {
    denominazione: "Rossi Mario Acconciature",
    partitaIva: "00743110157",
    via: "Via Gambarelli 31",
    cap: "24064",
    comune: "Grumello del Monte",
    provincia: "BG",
    codiceDestinatario: "ABCDEFG",
    pec: "",
    ...sovrascritture,
  };
}

describe("normalizzaDatiFatturazione", () => {
  it("toglie il prefisso IT dalla partita IVA invece di rifiutarla", () => {
    expect(normalizzaDatiFatturazione(dati({ partitaIva: "IT00743110157" })).partitaIva).toBe(
      "00743110157"
    );
    expect(normalizzaDatiFatturazione(dati({ partitaIva: "it 007 4311 0157" })).partitaIva).toBe(
      "00743110157"
    );
  });

  it("porta provincia e codice destinatario in maiuscolo, la PEC in minuscolo", () => {
    const normalizzati = normalizzaDatiFatturazione(
      dati({ provincia: "bg", codiceDestinatario: "abcdefg", pec: "Studio@PEC.IT" })
    );
    expect(normalizzati.provincia).toBe("BG");
    expect(normalizzati.codiceDestinatario).toBe("ABCDEFG");
    expect(normalizzati.pec).toBe("studio@pec.it");
  });
});

describe("validaDatiFatturazione", () => {
  it("accetta dati completi e corretti", () => {
    expect(validaDatiFatturazione(dati())).toEqual({});
    expect(datiFatturazioneCompleti(dati())).toBe(true);
  });

  it("accetta la PEC al posto del codice destinatario, e viceversa", () => {
    expect(validaDatiFatturazione(dati({ codiceDestinatario: "", pec: "studio@pec.it" }))).toEqual({});
    expect(validaDatiFatturazione(dati({ codiceDestinatario: "0000000", pec: "" }))).toEqual({});
  });

  it("chiede almeno uno dei due quando mancano entrambi", () => {
    const errori = validaDatiFatturazione(dati({ codiceDestinatario: "", pec: "" }));
    expect(errori.codiceDestinatario).toContain("0000000");
  });

  it("rifiuta una partita IVA con una cifra sbagliata", () => {
    const errori = validaDatiFatturazione(dati({ partitaIva: "00743110158" }));
    expect(errori.partitaIva).toBeDefined();
  });

  it("vuole la provincia come sigla di due lettere, non il nome esteso", () => {
    expect(validaDatiFatturazione(dati({ provincia: "Bergamo" })).provincia).toBeDefined();
    expect(validaDatiFatturazione(dati({ provincia: "BG" })).provincia).toBeUndefined();
  });

  it("vuole un CAP di cinque cifre", () => {
    expect(validaDatiFatturazione(dati({ cap: "2406" })).cap).toBeDefined();
    expect(validaDatiFatturazione(dati({ cap: "24O64" })).cap).toBeDefined();
  });

  it("segnala TUTTI i campi sbagliati insieme, non il primo che trova", () => {
    // Un modulo che segnala un problema alla volta si compila tre volte.
    const errori = validaDatiFatturazione(
      dati({ denominazione: "", partitaIva: "", cap: "", provincia: "", comune: "", via: "" })
    );
    expect(Object.keys(errori).sort()).toEqual(
      ["cap", "comune", "denominazione", "partitaIva", "provincia", "via"].sort()
    );
  });

  it("i dati vuoti non sono completi", () => {
    expect(datiFatturazioneCompleti(DATI_FATTURAZIONE_VUOTI)).toBe(false);
  });
});
