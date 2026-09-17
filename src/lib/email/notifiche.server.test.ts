import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creaSupabaseFinto } from "@/test/supabase-finto";

vi.mock("@/lib/supabase/admin", () => ({ creaClientAdmin: vi.fn() }));
vi.mock("./mailjet.server", () => ({ inviaEmail: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/sms/invio.server", () => ({ inviaSmsSeInclusoNelPiano: vi.fn().mockResolvedValue(true) }));

import { creaClientAdmin } from "@/lib/supabase/admin";
import { inviaEmail } from "./mailjet.server";
import { inviaSmsSeInclusoNelPiano } from "@/lib/sms/invio.server";
import {
  inviaNotificheNuovoAppuntamento,
  inviaNotificaPassaggioAOperatore,
} from "./notifiche.server";

const creaClientAdminFinto = vi.mocked(creaClientAdmin);
const inviaEmailFinto = vi.mocked(inviaEmail);
const inviaSmsFinto = vi.mocked(inviaSmsSeInclusoNelPiano);

const TENANT_ID = "tenant-1";
const APPUNTAMENTO_ID = "app-1";
const RIGA_APPUNTAMENTO_BASE = {
  inizio: "2026-07-15T14:00:00.000Z", // 16:00 civile Roma (CEST, UTC+2)
  note: null,
  clienti: { nome: "Giulia Bianchi", email: null as string | null, telefono: "+393331234567" as string | null },
  servizi: { nome: "Taglio" },
  operatori: { nome: "Marco" },
  tenants: { nome: "Salone Test", piano: "pro" },
};

/**
 * Costruisce un client admin finto con le tre interrogazioni che
 * `inviaNotificheNuovoAppuntamento` fa sempre: i dettagli dell'appuntamento
 * (con i join), il fuso orario del tenant (`caricaFusoOrarioTenant`, non
 * mockata: è già testata a parte in fuso-orario.test.ts, qui basta darle una
 * riga vera da leggere) e il profilo del titolare -- più `auth.admin.
 * getUserById`, che richiede un mock a parte perché non passa da `.from()`.
 */
function creaAdminFinto(opts: {
  appuntamento?: typeof RIGA_APPUNTAMENTO_BASE | null;
  profiloOwner?: { id: string } | null;
  getUserById?: ReturnType<typeof vi.fn>;
}) {
  const datiAppuntamento = opts.appuntamento === undefined ? RIGA_APPUNTAMENTO_BASE : opts.appuntamento;
  const profiloOwner = opts.profiloOwner === undefined ? { id: "titolare-1" } : opts.profiloOwner;
  const base = creaSupabaseFinto({
    appuntamenti: { select: [{ data: datiAppuntamento, error: null }] },
    tenants: { select: [{ data: { fuso_orario: "Europe/Rome" }, error: null }] },
    profiles: { select: [{ data: profiloOwner, error: null }] },
  });
  return {
    ...base,
    auth: {
      admin: {
        getUserById:
          opts.getUserById ??
          vi.fn().mockResolvedValue({ data: { user: { email: "titolare@esempio.it" } }, error: null }),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("inviaNotificheNuovoAppuntamento", () => {
  const ENV_ORIGINALE = { ...process.env };

  beforeEach(() => {
    process.env.MJ_APIKEY_PUBLIC = "chiave-pubblica-test";
    process.env.MJ_APIKEY_PRIVATE = "chiave-privata-test";
    delete process.env.SKEBBY_EMAIL;
    delete process.env.SKEBBY_PASSWORD;
    inviaEmailFinto.mockClear();
    inviaEmailFinto.mockResolvedValue(true);
    inviaSmsFinto.mockClear();
    inviaSmsFinto.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
    vi.clearAllMocks();
  });

  it("senza le chiavi Mailjet NÉ Skebby non interroga nemmeno il database: nessuna latenza aggiunta a una prenotazione se Gabriel non ha ancora configurato nessuno dei due canali", async () => {
    delete process.env.MJ_APIKEY_PUBLIC;
    delete process.env.MJ_APIKEY_PRIVATE;
    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);
    expect(creaClientAdminFinto).not.toHaveBeenCalled();
    expect(inviaEmailFinto).not.toHaveBeenCalled();
    expect(inviaSmsFinto).not.toHaveBeenCalled();
  });

  it("senza le chiavi Mailjet ma CON Skebby configurato, interroga comunque il database (il cliente potrebbe non avere email)", async () => {
    delete process.env.MJ_APIKEY_PUBLIC;
    delete process.env.MJ_APIKEY_PRIVATE;
    process.env.SKEBBY_EMAIL = "gabriel@esempio.it";
    process.env.SKEBBY_PASSWORD = "segreta";
    creaClientAdminFinto.mockReturnValue(creaAdminFinto({}));

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(creaClientAdminFinto).toHaveBeenCalled();
  });

  it("invia sempre l'email al titolare, anche se il cliente non ha lasciato un'email", async () => {
    creaClientAdminFinto.mockReturnValue(creaAdminFinto({}));

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(inviaEmailFinto).toHaveBeenCalledTimes(1);
    expect(inviaEmailFinto).toHaveBeenCalledWith(
      expect.objectContaining({ a: "titolare@esempio.it", oggetto: expect.stringContaining("Giulia Bianchi") })
    );
  });

  it("manda un SMS al cliente (piano Pro) quando non ha lasciato un'email ma ha un telefono -- MAI email e SMS insieme", async () => {
    creaClientAdminFinto.mockReturnValue(creaAdminFinto({}));

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(inviaEmailFinto).toHaveBeenCalledTimes(1); // solo il titolare, mai il cliente
    expect(inviaSmsFinto).toHaveBeenCalledTimes(1);
    expect(inviaSmsFinto).toHaveBeenCalledWith(
      expect.anything(),
      TENANT_ID,
      "pro",
      "+393331234567",
      expect.stringContaining("Taglio")
    );
  });

  it("non manda l'SMS se il cliente non ha né email né telefono", async () => {
    creaClientAdminFinto.mockReturnValue(
      creaAdminFinto({ appuntamento: { ...RIGA_APPUNTAMENTO_BASE, clienti: { nome: "Giulia Bianchi", email: null, telefono: null } } })
    );

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(inviaSmsFinto).not.toHaveBeenCalled();
  });

  it("invia anche l'email di conferma al cliente quando ha lasciato un indirizzo", async () => {
    creaClientAdminFinto.mockReturnValue(
      creaAdminFinto({ appuntamento: { ...RIGA_APPUNTAMENTO_BASE, clienti: { nome: "Giulia Bianchi", email: "giulia@esempio.it", telefono: null } } })
    );

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(inviaEmailFinto).toHaveBeenCalledTimes(2);
    expect(inviaEmailFinto).toHaveBeenCalledWith(expect.objectContaining({ a: "titolare@esempio.it" }));
    expect(inviaEmailFinto).toHaveBeenCalledWith(expect.objectContaining({ a: "giulia@esempio.it" }));
  });

  it("fail-open: se non esiste nessun profilo owner per il tenant, salta solo l'email del titolare (il cliente la riceve comunque)", async () => {
    creaClientAdminFinto.mockReturnValue(
      creaAdminFinto({
        appuntamento: { ...RIGA_APPUNTAMENTO_BASE, clienti: { nome: "Giulia Bianchi", email: "giulia@esempio.it", telefono: null } },
        profiloOwner: null,
      })
    );

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(inviaEmailFinto).toHaveBeenCalledTimes(1);
    expect(inviaEmailFinto).toHaveBeenCalledWith(expect.objectContaining({ a: "giulia@esempio.it" }));
  });

  it("fail-open: se l'appuntamento non viene trovato non lancia e non invia nessuna email", async () => {
    creaClientAdminFinto.mockReturnValue(creaAdminFinto({ appuntamento: null }));

    await expect(inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID)).resolves.toBeUndefined();
    expect(inviaEmailFinto).not.toHaveBeenCalled();
  });

  it("include il link 'gestisci la tua prenotazione' nell'email al cliente quando NEXT_PUBLIC_SITE_URL è definita", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://saloneai.esempio.it";
    creaClientAdminFinto.mockReturnValue(
      creaAdminFinto({ appuntamento: { ...RIGA_APPUNTAMENTO_BASE, clienti: { nome: "Giulia Bianchi", email: "giulia@esempio.it", telefono: null } } })
    );

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(inviaEmailFinto).toHaveBeenCalledWith(
      expect.objectContaining({
        a: "giulia@esempio.it",
        html: expect.stringContaining(`https://saloneai.esempio.it/gestisci/${APPUNTAMENTO_ID}`),
      })
    );
  });

  it("omette il link 'gestisci' senza rompere l'invio se l'URL base non è determinabile (fuori da NEXT_PUBLIC_SITE_URL e da un contesto richiesta)", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    creaClientAdminFinto.mockReturnValue(
      creaAdminFinto({ appuntamento: { ...RIGA_APPUNTAMENTO_BASE, clienti: { nome: "Giulia Bianchi", email: "giulia@esempio.it", telefono: null } } })
    );

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(inviaEmailFinto).toHaveBeenCalledWith(
      expect.objectContaining({ a: "giulia@esempio.it", html: expect.not.stringContaining("/gestisci/") })
    );
  });

  it("fail-open: un'eccezione inattesa (es. auth.admin.getUserById che lancia) non si propaga mai fuori dalla funzione", async () => {
    creaClientAdminFinto.mockReturnValue(
      creaAdminFinto({ getUserById: vi.fn().mockRejectedValue(new Error("servizio auth non raggiungibile")) })
    );

    await expect(inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID)).resolves.toBeUndefined();
  });
});

/**
 * 17/09/2026 -- l'email che rende vera la promessa "passa la mano a te con
 * tutto il contesto della conversazione", fatta in quattro punti del sito e
 * fino a ieri non mantenuta da nessuna riga di codice.
 *
 * Le due cose che devono valere: ci deve essere DAVVERO tutta la
 * conversazione dentro (se il titolare deve riaprire il prodotto per capire
 * di cosa si parla, il passaggio di consegne non è avvenuto), e un problema
 * qui non deve mai propagarsi a chi sta chattando -- la risposta al cliente
 * è già stata salvata.
 */
describe("inviaNotificaPassaggioAOperatore", () => {
  const ENV_ORIGINALE = { ...process.env };
  const CONVERSAZIONE_ID = "conv-1";

  function adminConConversazione(opts: {
    conversazione?: unknown;
    messaggi?: unknown[];
    profiloOwner?: { id: string } | null;
  }) {
    const base = creaSupabaseFinto({
      conversazioni: {
        select: [
          {
            data:
              opts.conversazione === undefined
                ? {
                    canale: "web",
                    clienti: { nome: "Giulia", telefono: "+393331234567", email: null },
                    tenants: { nome: "Salone Test" },
                  }
                : opts.conversazione,
            error: null,
          },
        ],
      },
      messaggi: {
        select: [
          {
            data:
              opts.messaggi ?? [
                { ruolo: "cliente", contenuto: "Volevo lamentarmi del taglio di ieri", created_at: "2026-09-17T10:00:00Z" },
                { ruolo: "assistente", contenuto: "Mi dispiace, avviso subito il salone.", created_at: "2026-09-17T10:00:05Z" },
              ],
            error: null,
          },
        ],
      },
      profiles: {
        select: [{ data: opts.profiloOwner === undefined ? { id: "titolare-1" } : opts.profiloOwner, error: null }],
      },
    });
    return {
      ...base,
      auth: {
        admin: {
          getUserById: vi
            .fn()
            .mockResolvedValue({ data: { user: { email: "titolare@esempio.it" } }, error: null }),
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  beforeEach(() => {
    process.env.MJ_APIKEY_PUBLIC = "chiave-pubblica-test";
    process.env.MJ_APIKEY_PRIVATE = "chiave-privata-test";
    inviaEmailFinto.mockClear();
    inviaEmailFinto.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
    vi.clearAllMocks();
  });

  it("manda al titolare la trascrizione completa, non solo un avviso", async () => {
    creaClientAdminFinto.mockReturnValue(adminConConversazione({}));

    await inviaNotificaPassaggioAOperatore(TENANT_ID, CONVERSAZIONE_ID);

    expect(inviaEmailFinto).toHaveBeenCalledTimes(1);
    const email = inviaEmailFinto.mock.calls[0][0];
    expect(email.a).toBe("titolare@esempio.it");
    expect(email.oggetto).toContain("Salone Test");
    expect(email.html).toContain("Volevo lamentarmi del taglio di ieri");
    expect(email.html).toContain("Mi dispiace, avviso subito il salone.");
    expect(email.html).toContain("+393331234567");
  });

  it("dice esplicitamente quando non c'è nessun recapito, invece di lasciare una riga vuota", async () => {
    creaClientAdminFinto.mockReturnValue(
      adminConConversazione({
        conversazione: { canale: "web", clienti: null, tenants: { nome: "Salone Test" } },
      })
    );

    await inviaNotificaPassaggioAOperatore(TENANT_ID, CONVERSAZIONE_ID);

    const email = inviaEmailFinto.mock.calls[0][0];
    expect(email.html).toContain("non ha lasciato un recapito");
  });

  it("senza le chiavi Mailjet non tocca nemmeno il database", async () => {
    delete process.env.MJ_APIKEY_PUBLIC;
    delete process.env.MJ_APIKEY_PRIVATE;
    creaClientAdminFinto.mockClear();

    await inviaNotificaPassaggioAOperatore(TENANT_ID, CONVERSAZIONE_ID);

    expect(creaClientAdminFinto).not.toHaveBeenCalled();
    expect(inviaEmailFinto).not.toHaveBeenCalled();
  });

  it("fail-open: se il database esplode non rilancia (la risposta al cliente è già salvata)", async () => {
    creaClientAdminFinto.mockImplementation(() => {
      throw new Error("database irraggiungibile");
    });

    await expect(
      inviaNotificaPassaggioAOperatore(TENANT_ID, CONVERSAZIONE_ID)
    ).resolves.toBeUndefined();
    expect(inviaEmailFinto).not.toHaveBeenCalled();
  });
});
