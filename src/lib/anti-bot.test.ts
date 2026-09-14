import { describe, it, expect } from "vitest";
import { campoTrappolaCompilato, formPubblicoCompilatoTroppoVeloce, SOGLIA_MINIMA_MS_COMPILAZIONE_FORM_PUBBLICO } from "./anti-bot";

describe("campoTrappolaCompilato", () => {
  it("false quando assente", () => {
    expect(campoTrappolaCompilato(undefined)).toBe(false);
  });
  it("false quando vuoto o solo spazi", () => {
    expect(campoTrappolaCompilato("")).toBe(false);
    expect(campoTrappolaCompilato("   ")).toBe(false);
  });
  it("true quando un bot lo ha compilato", () => {
    expect(campoTrappolaCompilato("http://spam.example")).toBe(true);
  });
});

describe("formPubblicoCompilatoTroppoVeloce", () => {
  const adesso = 1_000_000;

  it("false quando il valore è assente (fail-open, mai blocca un client vecchio/senza JS)", () => {
    expect(formPubblicoCompilatoTroppoVeloce(undefined, adesso)).toBe(false);
  });

  it("true se la richiesta arriva prima della soglia", () => {
    const iniziato = adesso - (SOGLIA_MINIMA_MS_COMPILAZIONE_FORM_PUBBLICO - 1);
    expect(formPubblicoCompilatoTroppoVeloce(iniziato, adesso)).toBe(true);
  });

  it("false esattamente alla soglia e oltre", () => {
    const iniziato = adesso - SOGLIA_MINIMA_MS_COMPILAZIONE_FORM_PUBBLICO;
    expect(formPubblicoCompilatoTroppoVeloce(iniziato, adesso)).toBe(false);
  });

  it("false per un umano che ha navigato più passaggi prima di confermare", () => {
    const iniziato = adesso - 45_000;
    expect(formPubblicoCompilatoTroppoVeloce(iniziato, adesso)).toBe(false);
  });
});
