import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { leggiRubricaDaFoto, numeroPresoDallaRiga, recuperaRigheConModello } from "./importa-clienti-ai.server";

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

function modelloCheVedeNellaFoto(voci: unknown[], nonEUnaRubrica = false) {
  const create = vi.fn().mockResolvedValue({
    content: [{ type: "tool_use", id: "t1", name: "restituisci_voci_foto", input: { non_e_una_rubrica: nonEUnaRubrica, voci } }],
    usage: { input_tokens: 2000, output_tokens: 300 },
  } as unknown as Anthropic.Message);
  return { messages: { create } };
}

const FOTO = { base64: "AAAA", tipo: "image/jpeg" as const };

describe("leggiRubricaDaFoto -- il modello e' l'unico lettore, quindi le reti stringono di piu'", () => {
  it("manda la foto come immagine e propone la voce con la trascrizione accanto", async () => {
    const modello = modelloCheVedeNellaFoto([
      { trascrizione: "Maria R. 333 123 4567 colore", nome: "Maria R.", telefono: "333 123 4567", email: null, note: "colore", cifre_incerte: false },
    ]);
    const esito = await leggiRubricaDaFoto(FOTO, { tenantId: "t1" }, modello);
    expect(esito).toEqual({
      ok: true,
      esito: {
        proposte: [{ rigaOriginale: "Maria R. 333 123 4567 colore", nome: "Maria R.", telefono: "3331234567", email: null, note: "colore" }],
        nonLette: [],
        nonEUnaRubrica: false,
      },
    });
    const params = modello.messages.create.mock.calls[0][0];
    const contenuto = params.messages[0].content as { type: string; source?: { media_type: string; data: string } }[];
    expect(contenuto[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg", data: "AAAA" } });
  });

  it("UNA CIFRA INCERTA E LA VOCE NON SI PROPONE: torna fra le non lette, con la trascrizione", async () => {
    const modello = modelloCheVedeNellaFoto([
      // Il modello e' incoerente: dice di non essere sicuro ma propone un numero completo.
      { trascrizione: "Luca 333 12?4 567", nome: "Luca", telefono: "3331234567", email: null, note: null, cifre_incerte: false },
      // Qui e' sincero: cifre_incerte true, telefono null.
      { trascrizione: "Anna 33? 987 6543", nome: "Anna", telefono: null, email: null, note: null, cifre_incerte: true },
    ]);
    const esito = await leggiRubricaDaFoto(FOTO, { tenantId: "t1" }, modello);
    expect(esito.ok && esito.esito.proposte).toEqual([]);
    expect(esito.ok && esito.esito.nonLette).toEqual([
      { trascrizione: "Luca 333 12?4 567", motivo: "cifre_incerte" },
      { trascrizione: "Anna 33? 987 6543", motivo: "cifre_incerte" },
    ]);
  });

  it("un numero che nella trascrizione non c'e' non passa: quello che il titolare vede e quello che si scrive devono coincidere", async () => {
    const modello = modelloCheVedeNellaFoto([
      { trascrizione: "Maria 333 123 4567", nome: "Maria", telefono: "3339999999", email: null, note: null, cifre_incerte: false },
    ]);
    const esito = await leggiRubricaDaFoto(FOTO, { tenantId: "t1" }, modello);
    expect(esito.ok && esito.esito.nonLette).toEqual([{ trascrizione: "Maria 333 123 4567", motivo: "numero_non_riconoscibile" }]);
  });

  it("una voce senza numero si vede, non sparisce", async () => {
    const modello = modelloCheVedeNellaFoto([
      { trascrizione: "Giulia, richiamare", nome: "Giulia", telefono: null, email: null, note: "richiamare", cifre_incerte: false },
    ]);
    const esito = await leggiRubricaDaFoto(FOTO, { tenantId: "t1" }, modello);
    expect(esito.ok && esito.esito.nonLette).toEqual([{ trascrizione: "Giulia, richiamare", motivo: "senza_numero" }]);
  });

  it("se non e' una rubrica lo dice, e non propone niente", async () => {
    const esito = await leggiRubricaDaFoto(FOTO, { tenantId: "t1" }, modelloCheVedeNellaFoto([], true));
    expect(esito).toEqual({ ok: true, esito: { proposte: [], nonLette: [], nonEUnaRubrica: true } });
  });

  it("una chiamata fallita torna come errore parlante, senza lanciare", async () => {
    const modello = { messages: { create: vi.fn().mockRejectedValue(new Error("rete")) } };
    const esito = await leggiRubricaDaFoto(FOTO, { tenantId: "t1" }, modello);
    expect(esito).toEqual({ ok: false, errore: "Non sono riuscito a leggere la foto adesso. Riprova fra poco." });
  });
});
