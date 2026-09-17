import { describe, expect, it } from "vitest";
import { partitaIvaValida } from "./fiscale";

/**
 * I casi validi usati qui sono identificativi di prova costruiti apposta
 * perché il carattere di controllo torni, non di persone o aziende reali.
 * Il punto di questi test non è "riconoscere Tizio": è che una cifra
 * cambiata venga rifiutata, perché è quella la differenza fra una fattura
 * emessa e una scartata dallo SdI.
 */

describe("partitaIvaValida", () => {
  it("accetta una partita IVA con carattere di controllo corretto", () => {
    // 00000000000 è formalmente valida (somma 0, controllo 0): serve come
    // caso limite dell'algoritmo, non come dato reale.
    expect(partitaIvaValida("00000000000")).toBe(true);
    expect(partitaIvaValida("00743110157")).toBe(true);
  });

  it("rifiuta una cifra sbagliata, che è il refuso tipico", () => {
    expect(partitaIvaValida("00743110158")).toBe(false);
    expect(partitaIvaValida("00743110147")).toBe(false);
  });

  it("rifiuta lunghezze e caratteri non ammessi", () => {
    expect(partitaIvaValida("123")).toBe(false);
    expect(partitaIvaValida("0074311015X")).toBe(false);
    expect(partitaIvaValida("IT00743110157")).toBe(false); // il prefisso va tolto prima
    expect(partitaIvaValida("")).toBe(false);
  });

  it("tollera gli spazi, che chi copia e incolla si porta dietro", () => {
    expect(partitaIvaValida(" 00743110157 ")).toBe(true);
  });
});
