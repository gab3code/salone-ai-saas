import { describe, expect, it, vi } from "vitest";
import { creaSupabaseFinto } from "@/test/supabase-finto";
import { elaboraRichiestaRecensione } from "./recensioni.server";

vi.mock("@/lib/supabase/admin", () => ({ creaClientAdmin: () => ({}) }));
vi.mock("@/lib/email/mailjet.server", () => ({ inviaEmail: vi.fn().mockResolvedValue({ ok: true }) }));

function appuntamentoCon(consenso: boolean | null) {
  return {
    id: "a1",
    tenant_id: "t1",
    stato: "confermato",
    recensione_richiesta_inviata_at: null,
    clienti: { nome: "Anna", email: "anna@esempio.it", consenso_marketing: consenso },
    servizi: { nome: "Piega" },
    tenants: { nome: "Salone", slug: "salone", raccolta_recensioni_attiva: true },
  };
}

describe("la richiesta di recensione e il consenso marketing (migrazione 0070)", () => {
  it("a chi ha detto NO non si manda niente, prima ancora di reclamare l'invio", async () => {
    const admin = creaSupabaseFinto({
      appuntamenti: { select: [{ data: appuntamentoCon(false) }] },
    });
    const esito = await elaboraRichiestaRecensione(admin, "t1", "a1");
    expect(esito).toBe("consenso_negato");
    expect(admin.registro.update).toEqual([]);
  });

  it("a chi non ha mai risposto (null) si prosegue: e' il caso soft-spam dopo un servizio reso", async () => {
    const admin = creaSupabaseFinto({
      appuntamenti: { select: [{ data: appuntamentoCon(null) }], update: [{ data: { id: "a1" } }] },
    });
    const esito = await elaboraRichiestaRecensione(admin, "t1", "a1");
    expect(esito).not.toBe("consenso_negato");
  });
});
