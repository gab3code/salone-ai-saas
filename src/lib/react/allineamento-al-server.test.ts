import { describe, expect, it } from "vitest";
import { stessiValori } from "./allineamento-al-server";

/**
 * Il confronto e' il cuore dell'hook: se dice "cambiato" quando non lo e', il
 * form si riallinea a ogni render e cancella quello che l'utente sta
 * scrivendo; se dice "uguale" quando e' cambiato, torna il difetto della
 * caparra (salvi e il valore vecchio resta a schermo).
 */
describe("stessiValori", () => {
  it("dice uguale per due oggetti letterali diversi con gli stessi valori", () => {
    expect(stessiValori({ attiva: false, valore: 20 }, { attiva: false, valore: 20 })).toBe(true);
  });

  it("dice diverso quando cambia un booleano (il caso della caparra)", () => {
    expect(stessiValori({ attiva: true }, { attiva: false })).toBe(false);
  });

  it("dice diverso quando cambia una stringa (il caso del tono dell'AI)", () => {
    expect(stessiValori({ stile: "professionale" }, { stile: "amichevole" })).toBe(false);
  });

  it("non confonde 0 con false ne' null con undefined", () => {
    expect(stessiValori({ v: 0 }, { v: false as unknown as number })).toBe(false);
    expect(stessiValori({ v: null }, { v: undefined })).toBe(false);
  });

  it("non considera diversi due NaN (altrimenti sarebbe un ciclo di render)", () => {
    expect(stessiValori({ v: Number.NaN }, { v: Number.NaN })).toBe(true);
  });

  it("dice diverso se una chiave compare o sparisce", () => {
    expect(stessiValori({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(stessiValori({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });
});
