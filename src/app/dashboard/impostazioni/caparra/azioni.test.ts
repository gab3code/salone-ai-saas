import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Nasce da una segnalazione di Gabriel del 19/09/2026, ed e' il tipo di
 * difetto che non si vede finche' non capita: tolta la spunta e svuotato il
 * campo della percentuale, il salvataggio rispondeva "Inserisci un valore
 * maggiore di zero" e non scriveva niente. Risultato: il titolare credeva di
 * aver spento la caparra e il prodotto continuava a chiedere soldi ai suoi
 * clienti.
 */

const update = vi.fn();
const eq = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ creaClientServer: vi.fn() }));
vi.mock("@/lib/permessi.server", () => ({
  richiediPermesso: vi.fn(),
  accessoNegato: (a: unknown) => typeof a === "object" && a !== null && "errore" in a,
}));

import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso } from "@/lib/permessi.server";
import { aggiornaCaparra } from "./azioni";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  update.mockReset();
  eq.mockReset();
  eq.mockResolvedValue({ error: null });
  update.mockReturnValue({ eq });
  vi.mocked(creaClientServer).mockResolvedValue({ from: () => ({ update }) } as never);
  vi.mocked(richiediPermesso).mockResolvedValue({ tenantId: TENANT_ID } as never);
});

function form(campi: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campi)) fd.set(k, v);
  return fd;
}

describe("aggiornaCaparra", () => {
  it("spegnere la caparra riesce anche con il campo del valore VUOTO", async () => {
    const esito = await aggiornaCaparra(form({ tipo: "percentuale", valore: "" }));
    expect(esito).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ caparra_attiva: false });
  });

  it("spegnendola NON si perde l'impostazione di prima", async () => {
    await aggiornaCaparra(form({ tipo: "percentuale", valore: "" }));
    // Solo l'interruttore: tipo e valore restano quelli, cosi' riaccendendola
    // si ritrova la percentuale scelta invece di un default.
    const scritto = update.mock.calls[0][0];
    expect(Object.keys(scritto)).toEqual(["caparra_attiva"]);
  });

  it("spegnerla riesce anche con un valore assurdo rimasto nel campo", async () => {
    expect(await aggiornaCaparra(form({ tipo: "percentuale", valore: "-5" }))).toEqual({ ok: true });
    expect(await aggiornaCaparra(form({ tipo: "percentuale", valore: "abc" }))).toEqual({ ok: true });
  });

  it("ACCENDERLA invece pretende ancora un valore sensato", async () => {
    expect(await aggiornaCaparra(form({ attiva: "on", tipo: "percentuale", valore: "" }))).toEqual({
      errore: "Inserisci un valore maggiore di zero.",
    });
    expect(await aggiornaCaparra(form({ attiva: "on", tipo: "percentuale", valore: "0" }))).toEqual({
      errore: "Inserisci un valore maggiore di zero.",
    });
    expect(await aggiornaCaparra(form({ attiva: "on", tipo: "percentuale", valore: "150" }))).toEqual({
      errore: "Una percentuale non può superare 100.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("accesa con una percentuale valida, salva tutto", async () => {
    expect(await aggiornaCaparra(form({ attiva: "on", tipo: "percentuale", valore: "20" }))).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({
      caparra_attiva: true,
      caparra_tipo: "percentuale",
      caparra_valore: 20,
      caparra_regola: "tutti",
      caparra_no_show_soglia: 1,
    });
  });

  it("caparra selettiva (0071): 'solo dopo N no-show' salva regola e soglia, e una soglia non valida ferma tutto", async () => {
    expect(
      await aggiornaCaparra(form({ attiva: "on", tipo: "percentuale", valore: "20", regola: "dopo_no_show", soglia: "2" }))
    ).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ caparra_regola: "dopo_no_show", caparra_no_show_soglia: 2 }));
    update.mockClear();
    expect(
      await aggiornaCaparra(form({ attiva: "on", tipo: "percentuale", valore: "20", regola: "dopo_no_show", soglia: "0" }))
    ).toEqual({ errore: "La soglia dei no-show deve essere un numero intero, almeno 1." });
    expect(update).not.toHaveBeenCalled();
  });

  it("accesa con importo fisso, gli euro diventano centesimi in un punto solo", async () => {
    await aggiornaCaparra(form({ attiva: "on", tipo: "fisso", valore: "12,50" }));
    expect(update).toHaveBeenCalledWith({
      caparra_attiva: true,
      caparra_tipo: "fisso",
      caparra_valore: 1250,
      caparra_regola: "tutti",
      caparra_no_show_soglia: 1,
    });
  });

  it("un tipo inventato viene rifiutato prima di qualunque scrittura", async () => {
    expect(await aggiornaCaparra(form({ attiva: "on", tipo: "gratis", valore: "10" }))).toEqual({
      errore: "Tipo di caparra non valido.",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
