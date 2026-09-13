import { describe, expect, it } from "vitest";
import { origineDalPrimoAppuntamento, originePerCliente } from "./origine-cliente";

describe("origineDalPrimoAppuntamento", () => {
  it("ritorna null se non ci sono appuntamenti (nessuna origine da dedurre)", () => {
    expect(origineDalPrimoAppuntamento([])).toBeNull();
  });

  it("usa il canale dell'appuntamento con created_at più vecchio, non il primo dell'array", () => {
    const etichetta = origineDalPrimoAppuntamento([
      { creatoDa: "manuale", createdAt: new Date("2026-09-05") },
      { creatoDa: "pubblico", createdAt: new Date("2026-09-01") }, // il più vecchio -> vince
      { creatoDa: "ai", createdAt: new Date("2026-09-10") },
    ]);
    expect(etichetta).toBe("Pagina pubblica");
  });

  it("traduce 'ai' in 'AI' e 'manuale' in 'Manuale'", () => {
    expect(origineDalPrimoAppuntamento([{ creatoDa: "ai", createdAt: new Date() }])).toBe("AI");
    expect(origineDalPrimoAppuntamento([{ creatoDa: "manuale", createdAt: new Date() }])).toBe("Manuale");
  });

  it("un valore di creato_da sconosciuto ricade su 'Manuale', mai un'etichetta rotta a schermo", () => {
    expect(origineDalPrimoAppuntamento([{ creatoDa: "boh", createdAt: new Date() }])).toBe("Manuale");
  });
});

describe("originePerCliente", () => {
  it("aggrega per cliente, ognuno con l'origine del proprio primo appuntamento", () => {
    const mappa = originePerCliente([
      { clienteId: "cliente-1", creatoDa: "manuale", createdAt: new Date("2026-09-05") },
      { clienteId: "cliente-1", creatoDa: "pubblico", createdAt: new Date("2026-09-01") }, // primo di cliente-1
      { clienteId: "cliente-2", creatoDa: "ai", createdAt: new Date("2026-09-03") },
    ]);
    expect(mappa.get("cliente-1")).toBe("Pagina pubblica");
    expect(mappa.get("cliente-2")).toBe("AI");
  });

  it("ignora le righe senza cliente_id (appuntamento senza cliente associato)", () => {
    const mappa = originePerCliente([{ clienteId: null, creatoDa: "manuale", createdAt: new Date() }]);
    expect(mappa.size).toBe(0);
  });

  it("un cliente senza nessun appuntamento non compare nella mappa (nessuna voce, non 'Manuale' di default)", () => {
    const mappa = originePerCliente([]);
    expect(mappa.has("cliente-mai-prenotato")).toBe(false);
  });
});
