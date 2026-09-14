import { describe, expect, it } from "vitest";
import {
  pianoHaAccessoAIChatWeb,
  pianoHaAccessoAIWhatsapp,
  pianoHaTonoPersonalizzato,
  limiteMensileMessaggi,
  INTERVALLO_MINIMO_MS_TRA_MESSAGGI,
  LIMITE_MESSAGGI_CLIENTE_PER_CONVERSAZIONE,
  LIMITE_TURNI_SENZA_STRUMENTI_CONSECUTIVI,
} from "./limiti";

describe("limiti di piano per la chat AI", () => {
  it("free e starter non hanno accesso all'AI (né chat web né WhatsApp)", () => {
    expect(pianoHaAccessoAIChatWeb("free")).toBe(false);
    expect(pianoHaAccessoAIChatWeb("starter")).toBe(false);
    expect(pianoHaAccessoAIWhatsapp("free")).toBe(false);
    expect(pianoHaAccessoAIWhatsapp("starter")).toBe(false);
  });

  it("growth ha la chat web ma non WhatsApp", () => {
    expect(pianoHaAccessoAIChatWeb("growth")).toBe(true);
    expect(pianoHaAccessoAIWhatsapp("growth")).toBe(false);
  });

  it("pro ed enterprise hanno sia chat web che WhatsApp", () => {
    for (const piano of ["pro", "enterprise"]) {
      expect(pianoHaAccessoAIChatWeb(piano)).toBe(true);
      expect(pianoHaAccessoAIWhatsapp(piano)).toBe(true);
    }
  });

  it("un piano sconosciuto/malformato non ha mai accesso (fail-safe, non fail-open)", () => {
    expect(pianoHaAccessoAIChatWeb("qualcosa-di-strano")).toBe(false);
    expect(limiteMensileMessaggi("qualcosa-di-strano")).toBe(0);
  });

  it("il tono AI personalizzabile è riservato a Pro/Enterprise, come WhatsApp (Prezzi.tsx)", () => {
    expect(pianoHaTonoPersonalizzato("free")).toBe(false);
    expect(pianoHaTonoPersonalizzato("starter")).toBe(false);
    expect(pianoHaTonoPersonalizzato("growth")).toBe(false);
    expect(pianoHaTonoPersonalizzato("pro")).toBe(true);
    expect(pianoHaTonoPersonalizzato("enterprise")).toBe(true);
  });

  it("la quota mensile cresce con il piano, enterprise è illimitato", () => {
    expect(limiteMensileMessaggi("growth")).toBeGreaterThan(0);
    expect(limiteMensileMessaggi("pro")).toBeGreaterThan(limiteMensileMessaggi("growth"));
    expect(limiteMensileMessaggi("enterprise")).toBe(Infinity);
  });

  it("la quota di Pro scala per operatore (stesso pattern della quota SMS)", () => {
    const base = limiteMensileMessaggi("pro");
    expect(limiteMensileMessaggi("pro", 1)).toBe(base);
    expect(limiteMensileMessaggi("pro", 0)).toBe(base); // mai sotto la quota di un solo operatore
    expect(limiteMensileMessaggi("pro", 3)).toBe(base * 3);
  });

  it("growth ed enterprise NON scalano per operatore (prezzo piatto/illimitato)", () => {
    expect(limiteMensileMessaggi("growth", 5)).toBe(limiteMensileMessaggi("growth", 1));
    expect(limiteMensileMessaggi("enterprise", 5)).toBe(Infinity);
  });

  it("l'intervallo anti-burst è positivo e ragionevole (non zero, non minuti)", () => {
    expect(INTERVALLO_MINIMO_MS_TRA_MESSAGGI).toBeGreaterThan(0);
    expect(INTERVALLO_MINIMO_MS_TRA_MESSAGGI).toBeLessThan(10_000);
  });

  it("anti-abuso lato cliente: soglie positive e ragionevoli (14/09/2026)", () => {
    expect(LIMITE_MESSAGGI_CLIENTE_PER_CONVERSAZIONE).toBeGreaterThan(0);
    expect(LIMITE_TURNI_SENZA_STRUMENTI_CONSECUTIVI).toBeGreaterThan(0);
    // La soglia per singola conversazione deve restare ben sotto la quota
    // mensile per tenant, altrimenti non protegge da nulla in pratica.
    expect(LIMITE_MESSAGGI_CLIENTE_PER_CONVERSAZIONE).toBeLessThan(limiteMensileMessaggi("growth"));
  });
});
