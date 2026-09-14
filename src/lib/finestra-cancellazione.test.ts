import { describe, it, expect } from "vitest";
import { cancellazioneOnlineConsentita, messaggioCancellazioneBloccata } from "./finestra-cancellazione";

describe("cancellazioneOnlineConsentita", () => {
  const adesso = new Date("2026-09-14T10:00:00Z");

  it("permette la cancellazione se mancano più ore della soglia", () => {
    const inizio = new Date("2026-09-16T10:00:00Z"); // fra 48h
    expect(cancellazioneOnlineConsentita(inizio, 24, adesso)).toBe(true);
  });

  it("blocca la cancellazione se mancano meno ore della soglia", () => {
    const inizio = new Date("2026-09-14T20:00:00Z"); // fra 10h
    expect(cancellazioneOnlineConsentita(inizio, 24, adesso)).toBe(false);
  });

  it("permette esattamente al limite (>=)", () => {
    const inizio = new Date("2026-09-15T10:00:00Z"); // fra esattamente 24h
    expect(cancellazioneOnlineConsentita(inizio, 24, adesso)).toBe(true);
  });

  it("con oreMinime a 0 permette sempre, anche un minuto prima", () => {
    const inizio = new Date("2026-09-14T10:01:00Z");
    expect(cancellazioneOnlineConsentita(inizio, 0, adesso)).toBe(true);
  });

  it("blocca anche un appuntamento già iniziato/passato se sotto soglia", () => {
    const inizio = new Date("2026-09-14T09:00:00Z"); // un'ora fa
    expect(cancellazioneOnlineConsentita(inizio, 24, adesso)).toBe(false);
  });
});

describe("messaggioCancellazioneBloccata", () => {
  it("include il numero di telefono quando presente", () => {
    const msg = messaggioCancellazioneBloccata(24, "Salone Test", "02 1234567");
    expect(msg).toContain("Salone Test");
    expect(msg).toContain("02 1234567");
    expect(msg).toContain("24 ore");
  });

  it("usa il singolare per 1 ora", () => {
    const msg = messaggioCancellazioneBloccata(1, "Salone Test", "02 1234567");
    expect(msg).toContain("1 ora");
    expect(msg).not.toContain("1 ore");
  });

  it("senza telefono invita a contattare direttamente, senza inventare un numero", () => {
    const msg = messaggioCancellazioneBloccata(24, "Salone Test", null);
    expect(msg).toContain("contatta direttamente Salone Test");
  });
});
