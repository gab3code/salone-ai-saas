import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `skebby.server.ts` mette in cache il token in una variabile di modulo
 * (vedi il docblock di `tokenCache`) -- stesso motivo di
 * `mailjet.server.test.ts` per reimportare il modulo da zero
 * (`vi.resetModules()` + `import()` dinamico) a ogni test, così la cache di
 * un test non inquina quello successivo. `fetch` è globale (nessun SDK
 * Skebby, solo REST): mockato con `vi.stubGlobal`.
 */

const ENV_ORIGINALE = { ...process.env };

function rispostaToken(corpo = "USER_KEY_TEST;ACCESS_TOKEN_TEST", ok = true, status = 200) {
  return { ok, status, text: () => Promise.resolve(corpo) };
}

function rispostaSms(status = 201) {
  return { ok: status === 201, status, text: () => Promise.resolve(JSON.stringify({ result: status === 201 ? "OK" : "KO" })) };
}

describe("inviaSms", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ENV_ORIGINALE, SKEBBY_EMAIL: "gabriel@esempio.it", SKEBBY_PASSWORD: "segreta" };
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
    vi.unstubAllGlobals();
  });

  it("fail-open: senza SKEBBY_EMAIL/SKEBBY_PASSWORD non lancia, ritorna false e non chiama nemmeno fetch", async () => {
    delete process.env.SKEBBY_EMAIL;
    delete process.env.SKEBBY_PASSWORD;
    const fetchFinto = vi.fn();
    vi.stubGlobal("fetch", fetchFinto);
    const { inviaSms } = await import("./skebby.server");

    const risultato = await inviaSms("+393331234567", "Ciao");

    expect(risultato).toBe(false);
    expect(fetchFinto).not.toHaveBeenCalled();
  });

  it("autentica e invia con successo, normalizzando un numero italiano senza prefisso internazionale", async () => {
    const fetchFinto = vi
      .fn()
      .mockResolvedValueOnce(rispostaToken())
      .mockResolvedValueOnce(rispostaSms(201));
    vi.stubGlobal("fetch", fetchFinto);
    const { inviaSms } = await import("./skebby.server");

    const risultato = await inviaSms("333 123 4567", "Ciao Giulia");

    expect(risultato).toBe(true);
    expect(fetchFinto).toHaveBeenCalledTimes(2);
    const [, opzioniInvio] = fetchFinto.mock.calls[1] as [string, RequestInit];
    expect(opzioniInvio.headers).toMatchObject({ user_key: "USER_KEY_TEST", Access_token: "ACCESS_TOKEN_TEST" });
    expect(JSON.parse(opzioniInvio.body as string)).toMatchObject({
      message: "Ciao Giulia",
      recipient: ["+393331234567"],
    });
  });

  it("lascia invariato un numero che ha già il prefisso internazionale", async () => {
    const fetchFinto = vi.fn().mockResolvedValueOnce(rispostaToken()).mockResolvedValueOnce(rispostaSms(201));
    vi.stubGlobal("fetch", fetchFinto);
    const { inviaSms } = await import("./skebby.server");

    await inviaSms("+44 7911 123456", "Ciao");

    const [, opzioniInvio] = fetchFinto.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(opzioniInvio.body as string).recipient).toEqual(["+447911123456"]);
  });

  it("riusa il token in cache tra due invii consecutivi -- un solo GET /token per due POST /sms", async () => {
    const fetchFinto = vi
      .fn()
      .mockResolvedValueOnce(rispostaToken())
      .mockResolvedValueOnce(rispostaSms(201))
      .mockResolvedValueOnce(rispostaSms(201));
    vi.stubGlobal("fetch", fetchFinto);
    const { inviaSms } = await import("./skebby.server");

    await inviaSms("+393331234567", "Uno");
    await inviaSms("+393331234567", "Due");

    expect(fetchFinto).toHaveBeenCalledTimes(3); // 1 token + 2 invii
  });

  it("un 401 sull'invio forza un solo retry con un token fresco, poi ritorna il risultato del secondo tentativo", async () => {
    const fetchFinto = vi
      .fn()
      .mockResolvedValueOnce(rispostaToken("VECCHIO_KEY;VECCHIO_TOKEN"))
      .mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("token scaduto") })
      .mockResolvedValueOnce(rispostaToken("NUOVO_KEY;NUOVO_TOKEN"))
      .mockResolvedValueOnce(rispostaSms(201));
    vi.stubGlobal("fetch", fetchFinto);
    const { inviaSms } = await import("./skebby.server");

    const risultato = await inviaSms("+393331234567", "Ciao");

    expect(risultato).toBe(true);
    expect(fetchFinto).toHaveBeenCalledTimes(4); // token, invio(401), token, invio(201)
  });

  it("fail-open: un invio rifiutato in modo definitivo (non 401) ritorna false senza lanciare", async () => {
    const fetchFinto = vi.fn().mockResolvedValueOnce(rispostaToken()).mockResolvedValueOnce(rispostaSms(400));
    vi.stubGlobal("fetch", fetchFinto);
    const { inviaSms } = await import("./skebby.server");

    await expect(inviaSms("+393331234567", "Ciao")).resolves.toBe(false);
  });

  it("fail-open: un'eccezione di rete non lancia, ritorna false", async () => {
    const fetchFinto = vi.fn().mockRejectedValue(new Error("rete non raggiungibile"));
    vi.stubGlobal("fetch", fetchFinto);
    const { inviaSms } = await import("./skebby.server");

    await expect(inviaSms("+393331234567", "Ciao")).resolves.toBe(false);
  });
});
