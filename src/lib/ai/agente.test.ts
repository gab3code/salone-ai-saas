import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rispondiConversazione, type ClienteAnthropic } from "./agente";
import type { ContestoStrumento } from "./tools";

/**
 * Il client Anthropic vero non è chiamato qui (niente rete, niente costo,
 * niente flakiness nella suite) -- questi test verificano il CICLO del
 * loop (esecuzione reale degli strumenti, propagazione dei risultati,
 * limite di sicurezza) con un client finto che restituisce risposte
 * pre-costruite, esattamente nella forma che l'SDK reale restituirebbe.
 */
function testoFinale(testo: string) {
  return { content: [{ type: "text", text: testo }] } as any;
}
function usoStrumento(nome: string, input: Record<string, unknown>, id = "toolu_1") {
  return { content: [{ type: "tool_use", id, name: nome, input }] } as any;
}

const ctx: ContestoStrumento & { nomeAttivita: string } = {
  supabase: {} as SupabaseClient, // non toccato: lo strumento usato nei test qui sotto non fa query
  tenantId: "tenant-1",
  nomeAttivita: "Salone di prova",
};

describe("rispondiConversazione", () => {
  it("risponde subito con testo se il modello non chiede nessuno strumento", async () => {
    const create = vi.fn().mockResolvedValue(testoFinale("Ciao! Come posso aiutarti?"));
    const risultato = await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);

    expect(risultato).toEqual({ rispostaTesto: "Ciao! Come posso aiutarti?", trasferitoAUmano: false });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("esegue davvero lo strumento richiesto e lo ripassa al modello prima della risposta finale", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(usoStrumento("trasferisci_a_operatore", { motivo: "test" }))
      .mockResolvedValueOnce(testoFinale("Ti metto in contatto con un operatore."));

    const risultato = await rispondiConversazione(
      [],
      "Voglio parlare con una persona",
      ctx,
      { messages: { create } } as ClienteAnthropic
    );

    expect(risultato.trasferitoAUmano).toBe(true);
    expect(risultato.rispostaTesto).toBe("Ti metto in contatto con un operatore.");
    expect(create).toHaveBeenCalledTimes(2);

    // Il secondo giro deve contenere il risultato REALE dello strumento
    // (non un placeholder), pronto per essere letto dal modello.
    const secondaChiamata = create.mock.calls[1][0];
    const messaggioConRisultato = secondaChiamata.messages.at(-1);
    expect(messaggioConRisultato.role).toBe("user");
    const contenutoTool = JSON.parse(messaggioConRisultato.content[0].content);
    expect(contenutoTool).toEqual({ trasferito: true, motivo: "test" });
  });

  it("passa a un operatore invece di girare all'infinito se il modello continua a chiedere strumenti", async () => {
    const create = vi.fn().mockResolvedValue(usoStrumento("trasferisci_a_operatore", { motivo: "loop" }));

    const risultato = await rispondiConversazione([], "...", ctx, { messages: { create } } as ClienteAnthropic);

    expect(risultato.trasferitoAUmano).toBe(true);
    expect(risultato.rispostaTesto).toMatch(/operatore/i);
    // Si ferma al limite di sicurezza, non chiama il modello all'infinito.
    expect(create.mock.calls.length).toBeLessThanOrEqual(8);
  });

  it("include lo storico della conversazione nella richiesta, non solo l'ultimo messaggio", async () => {
    const create = vi.fn().mockResolvedValue(testoFinale("Certo, il taglio dura 30 minuti."));

    await rispondiConversazione(
      [
        { ruolo: "cliente", contenuto: "Vorrei un taglio" },
        { ruolo: "assistente", contenuto: "Con piacere, per quando?" },
      ],
      "Quanto dura?",
      ctx,
      { messages: { create } } as ClienteAnthropic
    );

    const primaChiamata = create.mock.calls[0][0];
    expect(primaChiamata.messages).toEqual([
      { role: "user", content: "Vorrei un taglio" },
      { role: "assistant", content: "Con piacere, per quando?" },
      { role: "user", content: "Quanto dura?" },
    ]);
  });

  it("include la data odierna reale nel system prompt, così il modello non deve chiederla al cliente", async () => {
    const create = vi.fn().mockResolvedValue(testoFinale("Certo, domani alle 15:00 è libero."));

    await rispondiConversazione(
      [],
      "Vorrei prenotare domani pomeriggio",
      ctx,
      { messages: { create } } as ClienteAnthropic,
      new Date("2026-09-03T10:00:00Z")
    );

    const primaChiamata = create.mock.calls[0][0];
    expect(primaChiamata.system).toContain("2026-09-03");
    expect(primaChiamata.system).toContain("giovedì");
  });
});
