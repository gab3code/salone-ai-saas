import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { generaBozzaOnboarding, type ClienteAnthropic } from "./onboarding-ai.server";

/**
 * Stesso principio di src/lib/ai/agente.test.ts: client Anthropic finto,
 * niente rete/costo/flakiness -- questi test verificano che il modulo
 * gestisca correttamente la risposta del tool-calling forzato, non che il
 * modello reale estragga bene (per quello vedi la verifica dal vivo fatta
 * a mano, non nella suite automatica).
 */
function usoStrumentoBozza(input: Record<string, unknown>) {
  return {
    content: [{ type: "tool_use", id: "toolu_1", name: "restituisci_bozza", input }],
  } as unknown as Anthropic.Message;
}
function soloTesto(testo: string) {
  return { content: [{ type: "text", text: testo }] } as unknown as Anthropic.Message;
}

describe("generaBozzaOnboarding", () => {
  it("restituisce una bozza valida a partire da una risposta ben formata del modello", async () => {
    const create = vi.fn().mockResolvedValue(
      usoStrumentoBozza({
        servizi: [{ nome: "Manicure", durata_minuti: 30, prezzo_euro: 20 }],
        operatori: [{ nome: "Maria" }],
      })
    );

    const risultato = await generaBozzaOnboarding("Faccio manicure, sono Maria e lavoro da sola.", false, {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.ok).toBe(true);
    if (risultato.ok) {
      expect(risultato.bozza.servizi).toEqual([{ nome: "Manicure", durataMinuti: 30, prezzoEuro: 20 }]);
      expect(risultato.bozza.operatori).toEqual([{ nome: "Maria", descrizione: null }]);
    }
  });

  it("forza il tool_choice su restituisci_bozza e passa il piano corretto nello schema", async () => {
    const create = vi.fn().mockResolvedValue(usoStrumentoBozza({ operatori: [{ nome: "Maria" }] }));

    await generaBozzaOnboarding("Test", false, { messages: { create } } as ClienteAnthropic);

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0];
    expect(params.tool_choice).toEqual({ type: "tool", name: "restituisci_bozza" });
    expect(params.tools).toHaveLength(1);
    expect(params.tools[0].name).toBe("restituisci_bozza");
    // Piano senza knowledge base AI: lo schema non deve nemmeno proporre quei campi al modello.
    expect(params.tools[0].input_schema.properties.informazioni_attivita).toBeUndefined();
  });

  it("include i campi di knowledge base nello schema solo se il piano li supporta", async () => {
    const create = vi.fn().mockResolvedValue(usoStrumentoBozza({ operatori: [{ nome: "Maria" }] }));

    await generaBozzaOnboarding("Test", true, { messages: { create } } as ClienteAnthropic);

    const params = create.mock.calls[0][0];
    expect(params.tools[0].input_schema.properties.informazioni_attivita).toBeDefined();
    expect(params.tools[0].input_schema.properties.faq).toBeDefined();
  });

  it("restituisce un errore gestito se la chiamata ad Anthropic lancia un'eccezione", async () => {
    const create = vi.fn().mockRejectedValue(new Error("rete non disponibile"));

    const risultato = await generaBozzaOnboarding("Test", false, { messages: { create } } as ClienteAnthropic);

    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/problema tecnico/i);
  });

  it("restituisce un errore gestito se il modello non restituisce un blocco tool_use", async () => {
    const create = vi.fn().mockResolvedValue(soloTesto("Non ho capito, puoi ripetere?"));

    const risultato = await generaBozzaOnboarding("Test", false, { messages: { create } } as ClienteAnthropic);

    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/non ha restituito una bozza valida/i);
  });

  it("restituisce un errore gestito se la bozza estratta è completamente vuota", async () => {
    const create = vi.fn().mockResolvedValue(usoStrumentoBozza({}));

    const risultato = await generaBozzaOnboarding("Frase a caso senza informazioni utili.", false, {
      messages: { create },
    } as ClienteAnthropic);

    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/non sono riuscito a estrarre/i);
  });

  it("rifiuta una descrizione vuota senza nemmeno chiamare il modello", async () => {
    const create = vi.fn();

    const risultato = await generaBozzaOnboarding("   ", false, { messages: { create } } as ClienteAnthropic);

    expect(risultato.ok).toBe(false);
    if (!risultato.ok) expect(risultato.errore).toMatch(/scrivi prima una descrizione/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("tronca una descrizione troppo lunga invece di inviarla per intero", async () => {
    const create = vi.fn().mockResolvedValue(usoStrumentoBozza({ operatori: [{ nome: "Maria" }] }));
    const descrizioneLunghissima = "a".repeat(10000);

    await generaBozzaOnboarding(descrizioneLunghissima, false, { messages: { create } } as ClienteAnthropic);

    const params = create.mock.calls[0][0];
    const testoInviato = params.messages[0].content;
    expect(testoInviato.length).toBeLessThanOrEqual(4000);
  });
});
