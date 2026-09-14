import { describe, expect, it } from "vitest";
import { creaSupabaseFinto } from "@/test/supabase-finto";
import { ottieniOCreaConversazione, aggiornaTurniSenzaStrumenti } from "./conversazione.server";

describe("ottieniOCreaConversazione", () => {
  it("espone turniSenzaToolConsecutivi di una conversazione esistente (0019)", async () => {
    const supabase = creaSupabaseFinto({
      conversazioni: {
        select: [{ data: { id: "conv-1", stato: "aperta", turni_senza_tool_consecutivi: 2 }, error: null }],
      },
    });

    const conversazione = await ottieniOCreaConversazione(supabase, "tenant-1", "sessione-1");

    expect(conversazione).toEqual({ id: "conv-1", stato: "aperta", turniSenzaToolConsecutivi: 2 });
  });

  it("una conversazione appena creata parte da turniSenzaToolConsecutivi 0", async () => {
    const supabase = creaSupabaseFinto({
      conversazioni: {
        select: [{ data: null, error: null }], // nessuna conversazione aperta esistente
        insert: [{ data: { id: "conv-nuova", stato: "aperta", turni_senza_tool_consecutivi: 0 }, error: null }],
      },
    });

    const conversazione = await ottieniOCreaConversazione(supabase, "tenant-1", "sessione-2");

    expect(conversazione).toEqual({ id: "conv-nuova", stato: "aperta", turniSenzaToolConsecutivi: 0 });
  });
});

describe("aggiornaTurniSenzaStrumenti", () => {
  it("azzera il contatore se il turno ha usato almeno uno strumento", async () => {
    const supabase = creaSupabaseFinto({ conversazioni: { update: [{ data: null, error: null }] } });

    await aggiornaTurniSenzaStrumenti(supabase, "conv-1", true, 2);

    expect(supabase.registro.update).toEqual([
      { tabella: "conversazioni", payload: { turni_senza_tool_consecutivi: 0 } },
    ]);
  });

  it("incrementa di uno il contatore se il turno NON ha usato strumenti", async () => {
    const supabase = creaSupabaseFinto({ conversazioni: { update: [{ data: null, error: null }] } });

    await aggiornaTurniSenzaStrumenti(supabase, "conv-1", false, 2);

    expect(supabase.registro.update).toEqual([
      { tabella: "conversazioni", payload: { turni_senza_tool_consecutivi: 3 } },
    ]);
  });

  it("fail-open: un errore Supabase non lancia (difesa anti-abuso, non funzionalità core)", async () => {
    const supabase = creaSupabaseFinto({
      conversazioni: { update: [{ data: null, error: { message: "boom" } }] },
    });

    await expect(aggiornaTurniSenzaStrumenti(supabase, "conv-1", false, 0)).resolves.toBeUndefined();
  });
});
