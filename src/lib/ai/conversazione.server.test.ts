import { describe, expect, it } from "vitest";
import { creaSupabaseFinto } from "@/test/supabase-finto";
import { ottieniOCreaConversazione, aggiornaTurniSenzaStrumenti,
  aggiornaMessaggiDaAzione,
} from "./conversazione.server";

describe("ottieniOCreaConversazione", () => {
  it("espone turniSenzaToolConsecutivi di una conversazione esistente (0019)", async () => {
    const supabase = creaSupabaseFinto({
      conversazioni: {
        select: [{ data: { id: "conv-1", stato: "aperta", turni_senza_tool_consecutivi: 2 }, error: null }],
      },
      // Nessun messaggio ancora per questa conversazione (creata ma non
      // ancora usata in questo test) -- conversazioneTroppoVecchia la tratta
      // come non vecchia (vedi conversazione.server.ts), quindi viene riusata.
      messaggi: { select: [{ data: null, error: null }] },
    });

    const conversazione = await ottieniOCreaConversazione(supabase, "tenant-1", "sessione-1");

    expect(conversazione).toEqual({ id: "conv-1", stato: "aperta", turniSenzaToolConsecutivi: 2, messaggiClienteDaAzione: 0 });
  });

  it("tratta come nuova una conversazione 'aperta' ma inattiva da troppo tempo (15/09/2026)", async () => {
    const unMessaggioVecchio = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(); // 4 ore fa
    const supabase = creaSupabaseFinto({
      conversazioni: {
        select: [{ data: { id: "conv-vecchia", stato: "aperta", turni_senza_tool_consecutivi: 3 }, error: null }],
        insert: [{ data: { id: "conv-nuova", stato: "aperta", turni_senza_tool_consecutivi: 0 }, error: null }],
      },
      messaggi: { select: [{ data: { created_at: unMessaggioVecchio }, error: null }] },
    });

    const conversazione = await ottieniOCreaConversazione(supabase, "tenant-1", "sessione-vecchia");

    // Non riusa conv-vecchia (col contatore anti-abuso già a 3): ne crea una pulita.
    expect(conversazione).toEqual({ id: "conv-nuova", stato: "aperta", turniSenzaToolConsecutivi: 0, messaggiClienteDaAzione: 0 });
  });

  it("una conversazione appena creata parte da turniSenzaToolConsecutivi 0", async () => {
    const supabase = creaSupabaseFinto({
      conversazioni: {
        select: [{ data: null, error: null }], // nessuna conversazione aperta esistente
        insert: [{ data: { id: "conv-nuova", stato: "aperta", turni_senza_tool_consecutivi: 0 }, error: null }],
      },
    });

    const conversazione = await ottieniOCreaConversazione(supabase, "tenant-1", "sessione-2");

    expect(conversazione).toEqual({ id: "conv-nuova", stato: "aperta", turniSenzaToolConsecutivi: 0, messaggiClienteDaAzione: 0 });
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

describe("aggiornaMessaggiDaAzione (19/09/2026)", () => {
  function supabaseCheRegistra() {
    const scritture: Record<string, unknown>[] = [];
    const supabase = {
      from: () => ({
        update: (valori: Record<string, unknown>) => {
          scritture.push(valori);
          return { eq: async () => ({ error: null }) };
        },
      }),
    } as unknown as Parameters<typeof aggiornaMessaggiDaAzione>[0];
    return { supabase, scritture };
  }

  it("azzera il contatore quando un'azione e' riuscita davvero", async () => {
    const { supabase, scritture } = supabaseCheRegistra();
    await aggiornaMessaggiDaAzione(supabase, "conv-1", true, 16);
    expect(scritture[0]).toEqual({ messaggi_cliente_da_azione: 0 });
  });

  it("altrimenti tiene il conto del messaggio appena arrivato", async () => {
    const { supabase, scritture } = supabaseCheRegistra();
    await aggiornaMessaggiDaAzione(supabase, "conv-1", false, 7);
    expect(scritture[0]).toEqual({ messaggi_cliente_da_azione: 7 });
  });
});
