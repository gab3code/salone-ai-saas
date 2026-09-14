import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creaSupabaseFinto } from "@/test/supabase-finto";

vi.mock("./skebby.server", () => ({ inviaSms: vi.fn() }));
vi.mock("./limiti.server", () => ({ contaSmsTenantQuestoMese: vi.fn() }));

import { inviaSms } from "./skebby.server";
import { contaSmsTenantQuestoMese } from "./limiti.server";
import { inviaSmsSeInclusoNelPiano } from "./invio.server";

const inviaSmsFinto = vi.mocked(inviaSms);
const contaSmsFinto = vi.mocked(contaSmsTenantQuestoMese);

describe("inviaSmsSeInclusoNelPiano", () => {
  beforeEach(() => {
    inviaSmsFinto.mockReset();
    contaSmsFinto.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("un piano senza SMS non chiama nemmeno Skebby (né la quota)", async () => {
    const supabase = creaSupabaseFinto({});

    const risultato = await inviaSmsSeInclusoNelPiano(supabase, "tenant-1", "growth", "+393331234567", "Ciao");

    expect(risultato).toBe(false);
    expect(inviaSmsFinto).not.toHaveBeenCalled();
    expect(contaSmsFinto).not.toHaveBeenCalled();
  });

  it("sotto quota invia via Skebby e traccia l'invio riuscito nella tabella sms_inviati", async () => {
    const supabase = creaSupabaseFinto({
      operatori: { select: [{ data: null, error: null, count: 2 }] },
      sms_inviati: { insert: [{ data: null, error: null }] },
    });
    contaSmsFinto.mockResolvedValue(5); // ben sotto il limite di 200 (2 operatori x 100)
    inviaSmsFinto.mockResolvedValue(true);

    const risultato = await inviaSmsSeInclusoNelPiano(supabase, "tenant-1", "pro", "+393331234567", "Ciao");

    expect(risultato).toBe(true);
    expect(inviaSmsFinto).toHaveBeenCalledWith("+393331234567", "Ciao");
    expect(supabase.registro.insert).toEqual([
      { tabella: "sms_inviati", payload: { tenant_id: "tenant-1", telefono: "+393331234567" } },
    ]);
  });

  it("al tetto mensile (100 SMS/operatore) non chiama nemmeno Skebby", async () => {
    const supabase = creaSupabaseFinto({
      operatori: { select: [{ data: null, error: null, count: 1 }] },
    });
    contaSmsFinto.mockResolvedValue(100); // limite pro con 1 operatore = 100, già raggiunto

    const risultato = await inviaSmsSeInclusoNelPiano(supabase, "tenant-1", "pro", "+393331234567", "Ciao");

    expect(risultato).toBe(false);
    expect(inviaSmsFinto).not.toHaveBeenCalled();
  });

  it("un invio fallito lato Skebby non viene tracciato nella tabella sms_inviati", async () => {
    const supabase = creaSupabaseFinto({
      operatori: { select: [{ data: null, error: null, count: 1 }] },
    });
    contaSmsFinto.mockResolvedValue(0);
    inviaSmsFinto.mockResolvedValue(false);

    const risultato = await inviaSmsSeInclusoNelPiano(supabase, "tenant-1", "pro", "+393331234567", "Ciao");

    expect(risultato).toBe(false);
    expect(supabase.registro.insert).toEqual([]);
  });

  it("fail-open: un'eccezione inattesa (es. errore leggendo il conteggio operatori) non lancia, ritorna false", async () => {
    const supabase = creaSupabaseFinto({}); // "operatori" non configurata -- la query lancia
    contaSmsFinto.mockResolvedValue(0);

    await expect(
      inviaSmsSeInclusoNelPiano(supabase, "tenant-1", "pro", "+393331234567", "Ciao")
    ).resolves.toBe(false);
  });
});
