import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `resend.server.ts` mette in cache un'istanza di `Resend` a livello di
 * modulo (stesso pattern di `creaClientStripe`): per testare sia il caso
 * "RESEND_API_KEY assente" sia quello "presente" senza che la cache
 * dell'uno inquini l'altro, ogni test reimporta il modulo da zero con
 * `vi.resetModules()` + `import()` dinamico, con un mock fresco di "resend"
 * dichiarato subito prima tramite `vi.doMock` (non hoistato come `vi.mock`,
 * quindi può cambiare da un test all'altro).
 */

const ENV_ORIGINALE = { ...process.env };

function mockaResend(sendFinto: ReturnType<typeof vi.fn>) {
  // Implementazione con `function`, MAI una arrow function: il client viene
  // istanziato con `new Resend(...)` in resend.server.ts, e una arrow
  // function non è mai costruibile con `new` (vitest la invoca davvero come
  // costruttore internamente, non solo come chiamata normale).
  vi.doMock("resend", () => ({
    Resend: vi.fn().mockImplementation(function () {
      return { emails: { send: sendFinto } };
    }),
  }));
}

describe("inviaEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ENV_ORIGINALE };
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
  });

  it("fail-open: senza RESEND_API_KEY non lancia, ritorna false e non prova nemmeno a chiamare Resend", async () => {
    delete process.env.RESEND_API_KEY;
    const sendFinto = vi.fn();
    mockaResend(sendFinto);
    const { inviaEmail } = await import("./resend.server");

    const risultato = await inviaEmail({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" });

    expect(risultato).toBe(false);
    expect(sendFinto).not.toHaveBeenCalled();
  });

  it("invia con successo e ritorna true quando Resend risponde senza errore", async () => {
    process.env.RESEND_API_KEY = "chiave-test";
    const sendFinto = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });
    mockaResend(sendFinto);
    const { inviaEmail } = await import("./resend.server");

    const risultato = await inviaEmail({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" });

    expect(risultato).toBe(true);
    expect(sendFinto).toHaveBeenCalledWith(
      expect.objectContaining({ to: "cliente@esempio.it", subject: "Ciao", html: "<p>Ciao</p>" })
    );
  });

  it("fail-open: un errore restituito da Resend (es. dominio non verificato) non lancia, ritorna false", async () => {
    process.env.RESEND_API_KEY = "chiave-test";
    const sendFinto = vi.fn().mockResolvedValue({ data: null, error: { message: "dominio non verificato" } });
    mockaResend(sendFinto);
    const { inviaEmail } = await import("./resend.server");

    await expect(inviaEmail({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" })).resolves.toBe(false);
  });

  it("fail-open: un'eccezione inattesa (es. rete non raggiungibile) non lancia, ritorna false", async () => {
    process.env.RESEND_API_KEY = "chiave-test";
    const sendFinto = vi.fn().mockRejectedValue(new Error("rete non raggiungibile"));
    mockaResend(sendFinto);
    const { inviaEmail } = await import("./resend.server");

    await expect(inviaEmail({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" })).resolves.toBe(false);
  });

  it("usa RESEND_FROM_EMAIL quando impostata, altrimenti il mittente di default", async () => {
    process.env.RESEND_API_KEY = "chiave-test";
    const sendFinto = vi.fn().mockResolvedValue({ data: { id: "email-1" }, error: null });
    mockaResend(sendFinto);

    const { inviaEmail: inviaSenzaFrom } = await import("./resend.server");
    await inviaSenzaFrom({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" });
    expect(sendFinto).toHaveBeenCalledWith(expect.objectContaining({ from: "Salone AI <onboarding@resend.dev>" }));

    vi.resetModules();
    process.env.RESEND_FROM_EMAIL = "Il Mio Salone <no-reply@ilmiosalone.it>";
    const sendFinto2 = vi.fn().mockResolvedValue({ data: { id: "email-2" }, error: null });
    mockaResend(sendFinto2);
    const { inviaEmail: inviaConFrom } = await import("./resend.server");
    await inviaConFrom({ a: "cliente@esempio.it", oggetto: "Ciao", html: "<p>Ciao</p>" });
    expect(sendFinto2).toHaveBeenCalledWith(expect.objectContaining({ from: "Il Mio Salone <no-reply@ilmiosalone.it>" }));
  });
});
