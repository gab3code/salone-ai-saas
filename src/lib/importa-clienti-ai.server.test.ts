import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { numeroPresoDallaRiga, recuperaRigheConModello } from "./importa-clienti-ai.server";

vi.mock("@/lib/ai/costi.server", () => ({ registraUsoApi: vi.fn() }));

function modelloChe(clienti: unknown[]) {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "tool_use", id: "t1", name: "restituisci_clienti", input: { clienti } }],
    usage: { input_tokens: 100, output_tokens: 50 },
  } as unknown as Anthropic.Message);
  return { messages: { create } };
}

describe("numeroPresoDallaRiga -- il modello puo' ripulire, non inventare", () => {
  it("accetta un numero ripulito da spazi e punti", () => {
    expect(numeroPresoDallaRiga("3331234567", "Maria la bionda 333.123.4567 martedi'")).toBe(true);
  });
  it("accetta un +39 aggiunto dal modello", () => {
    expect(numeroPresoDallaRiga("+393331234567", "Maria 333 123 4567")).toBe(true);
  });
  it("RIFIUTA un numero che nella riga non c'e'", () => {
    expect(numeroPresoDallaRiga("3339999999", "Maria 333 123 4567")).toBe(false);
  });
  it("rifiuta un numero 'completato' con cifre in piu'", () => {
    expect(numeroPresoDallaRiga("33312345678", "Maria 333 123 4567")).toBe(false);
  });
});

describe("recuperaRigheConModello", () => {
  it("trasforma una riga sporca in un cliente proponibile, con le note a parte", async () => {
    const modello = modelloChe([
      { riga: 1, nome: "Maria", telefono: "333 123 4567", email: null, note: "la bionda del martedi'" },
    ]);
    const esito = await recuperaRigheConModello(["Maria la bionda del martedi' 333 123 4567"], { tenantId: "t1" }, modello);
    expect(esito).toEqual({
      ok: true,
      esito: {
        proposte: [
          {
            rigaOriginale: "Maria la bionda del martedi' 333 123 4567",
            nome: "Maria",
            telefono: "3331234567",
            email: null,
            note: "la bionda del martedi'",
          },
        ],
        nonRecuperate: [],
      },
    });
  });

  it("SCARTA una proposta con un numero che nella riga non c'era, e la riga resta fra le non recuperate", async () => {
    const modello = modelloChe([{ riga: 1, nome: "Maria", telefono: "3339999999", email: null, note: null }]);
    const esito = await recuperaRigheConModello(["Maria, mi ha chiamato ieri"], { tenantId: "t1" }, modello);
    expect(esito).toEqual({ ok: true, esito: { proposte: [], nonRecuperate: ["Maria, mi ha chiamato ieri"] } });
  });

  it("scarta un numero non utilizzabile anche se preso dalla riga", async () => {
    const modello = modelloChe([{ riga: 1, nome: "Maria", telefono: "12", email: null, note: null }]);
    const esito = await recuperaRigheConModello(["Maria 12"], { tenantId: "t1" }, modello);
    expect(esito.ok && esito.esito.proposte).toEqual([]);
  });

  it("una riga con due persone produce due proposte", async () => {
    const modello = modelloChe([
      { riga: 1, nome: "Anna", telefono: "3331111111", email: null, note: null },
      { riga: 1, nome: "Bruno", telefono: "3332222222", email: null, note: null },
    ]);
    const esito = await recuperaRigheConModello(["Anna 3331111111 e Bruno 3332222222"], { tenantId: "t1" }, modello);
    expect(esito.ok && esito.esito.proposte.map((p) => p.nome)).toEqual(["Anna", "Bruno"]);
  });

  it("ignora un indice di riga inventato dal modello", async () => {
    const modello = modelloChe([{ riga: 7, nome: "Fantasma", telefono: "3331234567", email: null, note: null }]);
    const esito = await recuperaRigheConModello(["Maria 3331234567"], { tenantId: "t1" }, modello);
    expect(esito.ok && esito.esito.proposte).toEqual([]);
  });

  it("se il modello fallisce torna un errore leggibile, senza lanciare", async () => {
    const modello = { messages: { create: vi.fn().mockRejectedValue(new Error("rete")) } };
    const esito = await recuperaRigheConModello(["Maria 3331234567"], { tenantId: "t1" }, modello);
    expect(esito.ok).toBe(false);
  });

  it("senza righe non chiama il modello", async () => {
    const modello = modelloChe([]);
    await recuperaRigheConModello(["  ", ""], { tenantId: "t1" }, modello);
    expect(modello.messages.create).not.toHaveBeenCalled();
  });
});
