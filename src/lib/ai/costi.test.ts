import { describe, expect, it } from "vitest";
import {
  LISTINO_HAIKU_4_5,
  costoMicroDollari,
  leggiUso,
  microDollariADollari,
} from "./costi";

/**
 * Questi test proteggono un numero che servira' a decidere un listino.
 * Un errore qui non rompe niente di visibile: produce una cifra sbagliata
 * con l'aria di essere misurata, che e' peggio di non averla.
 */
describe("costoMicroDollari", () => {
  it("calcola le quattro voci con i prezzi verificati il 19/09/2026", () => {
    // Un milione di token di ciascun tipo = esattamente il prezzo di listino.
    const micro = costoMicroDollari({
      input: 1_000_000,
      output: 0,
      scritturaCache: 0,
      letturaCache: 0,
    });
    expect(microDollariADollari(micro)).toBeCloseTo(1.0, 6);

    expect(
      microDollariADollari(costoMicroDollari({ input: 0, output: 1_000_000, scritturaCache: 0, letturaCache: 0 }))
    ).toBeCloseTo(5.0, 6);
    expect(
      microDollariADollari(costoMicroDollari({ input: 0, output: 0, scritturaCache: 1_000_000, letturaCache: 0 }))
    ).toBeCloseTo(1.25, 6);
    expect(
      microDollariADollari(costoMicroDollari({ input: 0, output: 0, scritturaCache: 0, letturaCache: 1_000_000 }))
    ).toBeCloseTo(0.1, 6);
  });

  it("una chiamata tipica costa qualche millesimo di dollaro", () => {
    // Numeri realistici: prefisso letto dalla cache, un po' di storico
    // nuovo, una risposta breve.
    const micro = costoMicroDollari({
      input: 1_500,
      output: 200,
      scritturaCache: 0,
      letturaCache: 6_000,
    });
    const dollari = microDollariADollari(micro);
    expect(dollari).toBeGreaterThan(0.002);
    expect(dollari).toBeLessThan(0.005);
  });

  it("arrotonda per eccesso: mai sottostimare un costo", () => {
    // Un solo token di input costa 0,000001$: un milionesimo esatto.
    expect(costoMicroDollari({ input: 1, output: 0, scritturaCache: 0, letturaCache: 0 })).toBe(1);
    // Un solo token letto dalla cache costa un decimo di milionesimo, che
    // arrotondato per eccesso fa 1, non 0.
    expect(costoMicroDollari({ input: 0, output: 0, scritturaCache: 0, letturaCache: 1 })).toBe(1);
  });

  it("zero token, zero costo", () => {
    expect(costoMicroDollari({ input: 0, output: 0, scritturaCache: 0, letturaCache: 0 })).toBe(0);
  });

  it("il listino porta un nome, cosi' una riga vecchia resta interpretabile", () => {
    expect(LISTINO_HAIKU_4_5.nome).toMatch(/^haiku-4\.5@\d{4}-\d{2}-\d{2}$/);
  });

  it("sommare molte chiamate non perde precisione (e' il motivo degli interi)", () => {
    const una = costoMicroDollari({ input: 1_500, output: 200, scritturaCache: 0, letturaCache: 6_000 });
    let totale = 0;
    for (let i = 0; i < 100_000; i++) totale += una;
    expect(totale).toBe(una * 100_000);
    expect(Number.isInteger(totale)).toBe(true);
  });
});

describe("leggiUso", () => {
  it("legge i quattro campi dell'SDK", () => {
    expect(
      leggiUso({
        input_tokens: 120,
        output_tokens: 45,
        cache_creation_input_tokens: 6000,
        cache_read_input_tokens: 0,
      })
    ).toEqual({ input: 120, output: 45, scritturaCache: 6000, letturaCache: 0 });
  });

  it("i campi della cache mancanti o null valgono zero, non NaN", () => {
    expect(leggiUso({ input_tokens: 10, output_tokens: 5 })).toEqual({
      input: 10,
      output: 5,
      scritturaCache: 0,
      letturaCache: 0,
    });
    expect(leggiUso({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null })).toEqual({
      input: 10,
      output: 5,
      scritturaCache: 0,
      letturaCache: 0,
    });
  });

  it("non esplode su `usage` assente o di forma inattesa", () => {
    const vuoto = { input: 0, output: 0, scritturaCache: 0, letturaCache: 0 };
    expect(leggiUso(undefined)).toEqual(vuoto);
    expect(leggiUso(null)).toEqual(vuoto);
    expect(leggiUso("non un oggetto")).toEqual(vuoto);
    expect(leggiUso({ input_tokens: "molti" })).toEqual(vuoto);
    expect(leggiUso({ input_tokens: -5 })).toEqual(vuoto);
  });

  it("un `usage` illeggibile non puo' produrre un costo NaN", () => {
    const costo = costoMicroDollari(leggiUso({ input_tokens: "boh", output_tokens: undefined }));
    expect(costo).toBe(0);
    expect(Number.isNaN(costo)).toBe(false);
  });
});
