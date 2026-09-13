import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creaSupabaseFinto } from "@/test/supabase-finto";

vi.mock("@/lib/supabase/admin", () => ({ creaClientAdmin: vi.fn() }));
vi.mock("./resend.server", () => ({ inviaEmail: vi.fn().mockResolvedValue(true) }));

import { creaClientAdmin } from "@/lib/supabase/admin";
import { inviaEmail } from "./resend.server";
import { inviaNotificheNuovoAppuntamento } from "./notifiche.server";

const creaClientAdminFinto = vi.mocked(creaClientAdmin);
const inviaEmailFinto = vi.mocked(inviaEmail);

const TENANT_ID = "tenant-1";
const APPUNTAMENTO_ID = "app-1";
const RIGA_APPUNTAMENTO_BASE = {
  inizio: "2026-07-15T14:00:00.000Z", // 16:00 civile Roma (CEST, UTC+2)
  note: null,
  clienti: { nome: "Giulia Bianchi", email: null as string | null },
  servizi: { nome: "Taglio" },
  operatori: { nome: "Marco" },
  tenants: { nome: "Salone Test" },
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
    process.env.RESEND_API_KEY = "chiave-test";
    inviaEmailFinto.mockClear();
    inviaEmailFinto.mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
    vi.clearAllMocks();
  });

  it("senza RESEND_API_KEY non interroga nemmeno il database: nessuna latenza aggiunta a una prenotazione se Gabriel non ha ancora configurato Resend", async () => {
    delete process.env.RESEND_API_KEY;
    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);
    expect(creaClientAdminFinto).not.toHaveBeenCalled();
    expect(inviaEmailFinto).not.toHaveBeenCalled();
  });

  it("invia sempre l'email al titolare, anche se il cliente non ha lasciato un'email", async () => {
    creaClientAdminFinto.mockReturnValue(creaAdminFinto({}));

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(inviaEmailFinto).toHaveBeenCalledTimes(1);
    expect(inviaEmailFinto).toHaveBeenCalledWith(
      expect.objectContaining({ a: "titolare@esempio.it", oggetto: expect.stringContaining("Giulia Bianchi") })
    );
  });

  it("invia anche l'email di conferma al cliente quando ha lasciato un indirizzo", async () => {
    creaClientAdminFinto.mockReturnValue(
      creaAdminFinto({ appuntamento: { ...RIGA_APPUNTAMENTO_BASE, clienti: { nome: "Giulia Bianchi", email: "giulia@esempio.it" } } })
    );

    await inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID);

    expect(inviaEmailFinto).toHaveBeenCalledTimes(2);
    expect(inviaEmailFinto).toHaveBeenCalledWith(expect.objectContaining({ a: "titolare@esempio.it" }));
    expect(inviaEmailFinto).toHaveBeenCalledWith(expect.objectContaining({ a: "giulia@esempio.it" }));
  });

  it("fail-open: se non esiste nessun profilo owner per il tenant, salta solo l'email del titolare (il cliente la riceve comunque)", async () => {
    creaClientAdminFinto.mockReturnValue(
      creaAdminFinto({
        appuntamento: { ...RIGA_APPUNTAMENTO_BASE, clienti: { nome: "Giulia Bianchi", email: "giulia@esempio.it" } },
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

  it("fail-open: un'eccezione inattesa (es. auth.admin.getUserById che lancia) non si propaga mai fuori dalla funzione", async () => {
    creaClientAdminFinto.mockReturnValue(
      creaAdminFinto({ getUserById: vi.fn().mockRejectedValue(new Error("servizio auth non raggiungibile")) })
    );

    await expect(inviaNotificheNuovoAppuntamento(TENANT_ID, APPUNTAMENTO_ID)).resolves.toBeUndefined();
  });
});
