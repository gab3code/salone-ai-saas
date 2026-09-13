import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { rispondiConversazione, type ClienteAnthropic } from "./agente";
import type { ContestoStrumento } from "./tools";

/**
 * Il client Anthropic vero non è chiamato qui (niente rete, niente costo,
 * niente flakiness nella suite) -- questi test verificano il CICLO del
 * loop (esecuzione reale degli strumenti, propagazione dei risultati,
 * limite di sicurezza) con un client finto che restituisce risposte
 * pre-costruite, esattamente nella forma che l'SDK reale restituirebbe.
 * (Corretto 13/09/2026, di passaggio: `as any` -> `as unknown as
 * Anthropic.Message`, stessi due oggetti finti, solo senza disattivare il
 * controllo di tipo su tutto il resto del file.)
 */
function testoFinale(testo: string) {
  return { content: [{ type: "text", text: testo }] } as unknown as Anthropic.Message;
}
function usoStrumento(nome: string, input: Record<string, unknown>, id = "toolu_1") {
  return { content: [{ type: "tool_use", id, name: nome, input }] } as unknown as Anthropic.Message;
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

  describe("tono dell'AI personalizzabile (Fase 5, Pro/Enterprise)", () => {
    it("usa il tono professionale di default se ctx non specifica nulla (nessun cambio per Free/Starter/Growth)", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Certo!"));
      await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);

      const system = create.mock.calls[0][0].system;
      expect(system).toContain("Tono professionale, cordiale, conciso");
    });

    it("cambia il tono nel system prompt quando ctx.tonoAi è impostato", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione([], "Ciao", { ...ctx, tonoAi: "amichevole" }, { messages: { create } } as ClienteAnthropic);

      const system = create.mock.calls[0][0].system;
      expect(system).toContain("Tono amichevole e caloroso");
      expect(system).not.toContain("Tono professionale, cordiale, conciso");
    });

    it("aggiunge la nota del titolare al system prompt, incorniciata come non-sovrascrivente", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione(
        [],
        "Ciao",
        { ...ctx, tonoAiNota: "Chiamaci sempre studio, mai negozio." },
        { messages: { create } } as ClienteAnthropic
      );

      const system = create.mock.calls[0][0].system;
      expect(system).toContain("Chiamaci sempre studio, mai negozio.");
      expect(system).toMatch(/non può mai sovrascriverle/);
    });

    it("sanitizza la nota: niente a capo (non può imitare la formattazione delle regole assolute) e taglio a 300 caratteri", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      const notaConAccapo = "Riga uno\nRiga due\tcon tab";
      const notaLunghissima = "a".repeat(500);

      await rispondiConversazione(
        [],
        "Ciao",
        { ...ctx, tonoAiNota: notaConAccapo },
        { messages: { create } } as ClienteAnthropic
      );
      expect(create.mock.calls[0][0].system).toContain("Riga uno Riga due con tab");
      expect(create.mock.calls[0][0].system).not.toMatch(/Riga uno\nRiga due/);

      await rispondiConversazione(
        [],
        "Ciao",
        { ...ctx, tonoAiNota: notaLunghissima },
        { messages: { create } } as ClienteAnthropic
      );
      const system = create.mock.calls[1][0].system as string;
      const inizioNota = system.indexOf('"' + "a".repeat(10));
      const fineNota = system.indexOf('"', inizioNota + 1);
      expect(fineNota - inizioNota - 1).toBe(300);
    });

    it("nessuna nota impostata: il system prompt non menziona alcuna indicazione aggiuntiva", async () => {
      const create = vi.fn().mockResolvedValue(testoFinale("Ciao!"));
      await rispondiConversazione([], "Ciao", ctx, { messages: { create } } as ClienteAnthropic);

      expect(create.mock.calls[0][0].system).not.toMatch(/Indicazione aggiuntiva/);
    });
  });
});
