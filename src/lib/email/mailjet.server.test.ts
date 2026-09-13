import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `mailjet.server.ts` mette in cache un'istanza del client a livello di
 * modulo (stesso pattern di `creaClientStripe`): per testare sia il caso
 * "chiavi assenti" sia quello "presenti" senza che la cache dell'uno
 * inquini l'altro, ogni test reimporta il modulo da zero con
 * `vi.resetModules()` + `import()` dinamico, con un mock fresco di
 * "node-mailjet" dichiarato subito prima tramite `vi.doMock` (non hoistato
 * come `vi.mock`, quindi può cambiare da un test all'altro).
 */

const ENV_ORIGINALE = { ...process.env };

function mockaMailjet(requestFinto: ReturnType<typeof vi.fn>) {
  const postFinto = vi.fn().mockReturnValue({ request: requestFinto });
  vi.doMock("node-mailjet", () => ({
    default: {
      apiConnect: vi.fn().mockReturnValue({ post: postFinto }),
    },
    SendEmailV3_1: { ResponseStatus: { Success: "success", Error: "error" } },
  }));
  return postFinto;
}

function rispostaSuccesso() {
  return { body: { Messages: [{ Status: "success", Errors: [] }] } };
}

function rispostaErrore(errori: unknown[] = [{ ErrorMessage: "mittente non validato" }]) {
  return { body: { Messages: [{ Status: "error", Errors: errori }] } };
}

describe("inviaEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ENV_ORIGINALE };
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
  });

  it("fail-open: senza le chiavi Mailjet non lancia, ritorna false e non prova nemmeno a chiamare l'API", async () => {
    delete process.env.MJ_APIKEY_PUBLIC;
    delete process.env.MJ_APIKEY_PRIVATE;
    process.env.MAILJET_FROM_EMAIL = "titolare@esempio.it";
    const requestFinto = vi.fn();
    mockaMailjet(requestFinto);
    const { inviaEmail } = await import("./mailjet.server");

    const risultato = await inviaEmail({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" });

    expect(risultato).toBe(false);
    expect(requestFinto).not.toHaveBeenCalled();
  });

  it("fail-open: senza MAILJET_FROM_EMAIL non lancia, ritorna false e non prova a chiamare l'API", async () => {
    process.env.MJ_APIKEY_PUBLIC = "chiave-pubblica";
    process.env.MJ_APIKEY_PRIVATE = "chiave-privata";
    delete process.env.MAILJET_FROM_EMAIL;
    const requestFinto = vi.fn();
    mockaMailjet(requestFinto);
    const { inviaEmail } = await import("./mailjet.server");

    const risultato = await inviaEmail({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" });

    expect(risultato).toBe(false);
    expect(requestFinto).not.toHaveBeenCalled();
  });

  it("invia con successo e ritorna true quando Mailjet risponde Status \"success\"", async () => {
    process.env.MJ_APIKEY_PUBLIC = "chiave-pubblica";
    process.env.MJ_APIKEY_PRIVATE = "chiave-privata";
    process.env.MAILJET_FROM_EMAIL = "titolare@esempio.it";
    const requestFinto = vi.fn().mockResolvedValue(rispostaSuccesso());
    const postFinto = mockaMailjet(requestFinto);
    const { inviaEmail } = await import("./mailjet.server");

    const risultato = await inviaEmail({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" });

    expect(risultato).toBe(true);
    expect(postFinto).toHaveBeenCalledWith("send", { version: "v3.1" });
    expect(requestFinto).toHaveBeenCalledWith(
      expect.objectContaining({
        Messages: [
          expect.objectContaining({
            From: { Email: "titolare@esempio.it", Name: "Salone AI" },
            To: [{ Email: "cliente@esempio.it" }],
            Subject: "Ciao",
            HTMLPart: "<p>Ciao</p>",
          }),
        ],
      })
    );
  });

  it("usa `nomeMittente` come nome del mittente quando fornito, invece del nome della piattaforma", async () => {
    process.env.MJ_APIKEY_PUBLIC = "chiave-pubblica";
    process.env.MJ_APIKEY_PRIVATE = "chiave-privata";
    process.env.MAILJET_FROM_EMAIL = "titolare@esempio.it";
    const requestFinto = vi.fn().mockResolvedValue(rispostaSuccesso());
    mockaMailjet(requestFinto);
    const { inviaEmail } = await import("./mailjet.server");

    await inviaEmail({
      a: "cliente@esempio.it",
      oggetto: "Ciao",
      html: "<p>Ciao</p>",
      nomeMittente: "Estetica Bianchi",
    });

    expect(requestFinto).toHaveBeenCalledWith(
      expect.objectContaining({
        Messages: [
          expect.objectContaining({
            From: { Email: "titolare@esempio.it", Name: "Estetica Bianchi" },
          }),
        ],
      })
    );
  });

  it("fail-open: Status \"error\" nella risposta (es. mittente non validato) non lancia, ritorna false", async () => {
    process.env.MJ_APIKEY_PUBLIC = "chiave-pubblica";
    process.env.MJ_APIKEY_PRIVATE = "chiave-privata";
    process.env.MAILJET_FROM_EMAIL = "titolare@esempio.it";
    const requestFinto = vi.fn().mockResolvedValue(rispostaErrore());
    mockaMailjet(requestFinto);
    const { inviaEmail } = await import("./mailjet.server");

    await expect(inviaEmail({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" })).resolves.toBe(false);
  });

  it("fail-open: un'eccezione inattesa (es. rete non raggiungibile) non lancia, ritorna false", async () => {
    process.env.MJ_APIKEY_PUBLIC = "chiave-pubblica";
    process.env.MJ_APIKEY_PRIVATE = "chiave-privata";
    process.env.MAILJET_FROM_EMAIL = "titolare@esempio.it";
    const requestFinto = vi.fn().mockRejectedValue(new Error("rete non raggiungibile"));
    mockaMailjet(requestFinto);
    const { inviaEmail } = await import("./mailjet.server");

    await expect(inviaEmail({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" })).resolves.toBe(false);
  });
});
