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

  it("la quota mensile cresce con il piano, e nessun piano è senza tetto", () => {
    expect(limiteMensileMessaggi("growth")).toBeGreaterThan(0);
    expect(limiteMensileMessaggi("pro")).toBeGreaterThan(limiteMensileMessaggi("growth"));
    expect(limiteMensileMessaggi("enterprise")).toBeGreaterThan(limiteMensileMessaggi("pro"));
  });

  it("NESSUN piano ha quota infinita", () => {
    // Corretto il 17/09/2026 dopo un audit: enterprise era `Infinity`.
    // `/api/chat/[slug]` è pubblico e non autenticato, quindi un piano senza
    // tetto voleva dire che chiunque conoscesse lo slug poteva far crescere
    // la bolletta Anthropic senza nessun limite superiore. Un tetto
    // commerciale generoso e un muro contro l'abuso sono due cose diverse.
    for (const piano of ["free", "starter", "growth", "pro", "enterprise"]) {
      expect(Number.isFinite(limiteMensileMessaggi(piano)), piano).toBe(true);
      expect(Number.isFinite(limiteMensileMessaggi(piano, 50)), `${piano} con 50 operatori`).toBe(true);
    }
  });

  it("la quota di Pro scala per operatore (stesso pattern della quota SMS)", () => {
    const base = limiteMensileMessaggi("pro");
    expect(limiteMensileMessaggi("pro", 1)).toBe(base);
    expect(limiteMensileMessaggi("pro", 0)).toBe(base); // mai sotto la quota di un solo operatore
    expect(limiteMensileMessaggi("pro", 3)).toBe(base * 3);
  });

  it("anche la quota di Growth scala per operatore, ma molto piu' piano di Pro", () => {
    // Corretto il 18/09/2026: il commento diceva che Growth non scala
    // "perche' il prezzo non scala per operatore", ma sono 15 euro al mese
    // per ognuno. Un salone Growth con quattro poltrone pagava 84,90 e aveva
    // lo stesso tetto di chi lavora da solo: passava a Pro solo quando
    // l'assistente smetteva di rispondere, cioe' un upgrade venduto da un
    // guasto.
    const growthSolo = limiteMensileMessaggi("growth", 1);
    expect(limiteMensileMessaggi("growth", 4)).toBeGreaterThan(growthSolo);
    // Pro resta nettamente sopra a parita' di operatori: e' quello che
    // rende il passaggio una scelta e non un ripiego.
    expect(limiteMensileMessaggi("pro", 4)).toBeGreaterThan(limiteMensileMessaggi("growth", 4) * 2);
  });

  it("enterprise non scala: 50.000 e' un muro contro l'abuso, non un tetto commerciale", () => {
    expect(limiteMensileMessaggi("enterprise", 5)).toBe(limiteMensileMessaggi("enterprise", 1));
  });

  it("free e starter restano a zero per quanti operatori abbiano", () => {
    expect(limiteMensileMessaggi("free", 10)).toBe(0);
    expect(limiteMensileMessaggi("starter", 10)).toBe(0);
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
