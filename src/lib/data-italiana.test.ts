import { describe, expect, it } from "vitest";
import { formattaDataItaliana, formattaGiornoEsteso, giornoSettimanaDaYMD } from "./data-italiana";

describe("date in italiano", () => {
  it("scrive la data come la legge un titolare", () => {
    expect(formattaDataItaliana("2026-09-21")).toBe("21/09/2026");
    expect(formattaDataItaliana("2026-01-05")).toBe("05/01/2026");
  });

  it("scrive il giorno per esteso, con il giorno della settimana", () => {
    expect(formattaGiornoEsteso("2026-09-21")).toBe("lunedi' 21 settembre 2026");
    expect(formattaGiornoEsteso("2026-09-20")).toBe("domenica 20 settembre 2026");
  });

  it("il giorno della settimana combacia con quello del motore (0 = domenica)", () => {
    // Lo stesso indice che usa giornoChiuso() con getUTCDay(): se questi due
    // divergessero, la pagina direbbe "aperto" su un giorno chiuso.
    expect(giornoSettimanaDaYMD("2026-09-20")).toBe(0);
    expect(giornoSettimanaDaYMD("2026-09-21")).toBe(1);
    expect(giornoSettimanaDaYMD("2026-09-19")).toBe(6);
  });

  it("non sposta il giorno a cavallo di mezzanotte", () => {
    // Il difetto classico: interpretare "2026-01-01" come un istante UTC e
    // poi formattarlo in un fuso a ovest, ottenendo il 31 dicembre. Qui la
    // stringa non diventa mai un istante.
    expect(formattaDataItaliana("2026-01-01")).toBe("01/01/2026");
    expect(formattaGiornoEsteso("2026-12-31")).toBe("giovedi' 31 dicembre 2026");
  });

  it("una data impossibile resta com'e' invece di diventare un altro giorno", () => {
    // `new Date(Date.UTC(2026, 10, 31))` sarebbe il 1 dicembre: un 31 novembre
    // mostrato come 01/12 sarebbe peggio di un testo grezzo.
    expect(formattaDataItaliana("2026-11-31")).toBe("2026-11-31");
    expect(giornoSettimanaDaYMD("2026-11-31")).toBeNull();
    expect(formattaDataItaliana("ieri")).toBe("ieri");
  });
});
