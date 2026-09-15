import { describe, it, expect } from "vitest";
import { motivoBloccoSpostamento, messaggioSpostamentoBloccato } from "./finestra-spostamento";

describe("motivoBloccoSpostamento", () => {
  const adesso = new Date("2026-09-14T10:00:00Z");

  it("consente lo spostamento se non è mai stato spostato e mancano più ore della soglia", () => {
    const inizio = new Date("2026-09-16T10:00:00Z"); // fra 48h
    expect(motivoBloccoSpostamento(inizio, 24, 0, adesso)).toBeNull();
  });

  it("blocca per finestra se mancano meno ore della soglia (primo spostamento)", () => {
    const inizio = new Date("2026-09-14T20:00:00Z"); // fra 10h
    expect(motivoBloccoSpostamento(inizio, 24, 0, adesso)).toBe("finestra");
  });

  it("blocca per 'già spostato' anche se la finestra sarebbe ancora aperta", () => {
    const inizio = new Date("2026-09-20T10:00:00Z"); // fra giorni, finestra ok
    expect(motivoBloccoSpostamento(inizio, 24, 1, adesso)).toBe("gia_spostato");
  });

  it("'già spostato' vince su 'finestra' quando entrambi si applicherebbero", () => {
    const inizio = new Date("2026-09-14T20:00:00Z"); // fra 10h, sotto soglia
    expect(motivoBloccoSpostamento(inizio, 24, 1, adesso)).toBe("gia_spostato");
  });

  it("con oreMinime a 0 e nessuno spostamento già fatto, consente sempre", () => {
    const inizio = new Date("2026-09-14T10:01:00Z");
    expect(motivoBloccoSpostamento(inizio, 0, 0, adesso)).toBeNull();
  });

  it("un contatore più alto di 1 resta comunque bloccato (mai un secondo spostamento)", () => {
    const inizio = new Date("2026-09-20T10:00:00Z");
    expect(motivoBloccoSpostamento(inizio, 24, 2, adesso)).toBe("gia_spostato");
  });
});

describe("messaggioSpostamentoBloccato", () => {
  it("motivo 'finestra': include ore e contatto, come la cancellazione", () => {
    const msg = messaggioSpostamentoBloccato("finestra", 24, "Salone Test", "02 1234567");
    expect(msg).toContain("24 ore");
    expect(msg).toContain("02 1234567");
  });

  it("motivo 'finestra' con 1 ora usa il singolare", () => {
    const msg = messaggioSpostamentoBloccato("finestra", 1, "Salone Test", "02 1234567");
    expect(msg).toContain("1 ora");
    expect(msg).not.toContain("1 ore");
  });

  it("motivo 'gia_spostato': non menziona le ore, spiega il tetto di 1 spostamento", () => {
    const msg = messaggioSpostamentoBloccato("gia_spostato", 24, "Salone Test", "02 1234567");
    expect(msg).toContain("già stato spostato una volta");
    expect(msg).toContain("02 1234567");
    expect(msg).not.toContain("24 ore");
  });

  it("senza telefono invita a contattare direttamente, senza inventare un numero", () => {
    const msg = messaggioSpostamentoBloccato("gia_spostato", 24, "Salone Test", null);
    expect(msg).toContain("contatta direttamente Salone Test");
  });
});
