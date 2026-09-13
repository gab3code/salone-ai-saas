import { describe, expect, it } from "vitest";
import { clientiACsv, type ClienteEsportabile } from "./csv";

function cliente(overrides: Partial<ClienteEsportabile> = {}): ClienteEsportabile {
  return {
    nome: "Maria Rossi",
    telefono: "3331234567",
    email: "maria@esempio.it",
    tag: [],
    origine: "Manuale",
    createdAt: new Date(Date.UTC(2026, 8, 1)),
    ...overrides,
  };
}

describe("clientiACsv", () => {
  it("inizia con il BOM UTF-8 (Excel su Windows legge male gli accenti senza)", () => {
    const csv = clientiACsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("scrive sempre l'intestazione, anche con zero clienti", () => {
    const csv = clientiACsv([]);
    expect(csv).toBe("﻿Nome,Telefono,Email,Tag,Origine,Cliente da\r\n");
  });

  it("scrive una riga per cliente con i campi nell'ordine giusto", () => {
    const csv = clientiACsv([cliente()]);
    expect(csv).toBe(
      "﻿Nome,Telefono,Email,Tag,Origine,Cliente da\r\n" +
        "Maria Rossi,3331234567,maria@esempio.it,,Manuale,2026-09-01\r\n"
    );
  });

  it("unisce i tag con '; ', non una virgola (romperebbe le colonne CSV)", () => {
    const csv = clientiACsv([cliente({ tag: ["vip", "colore"] })]);
    expect(csv).toContain("vip; colore");
  });

  it("campi mancanti (nome/telefono/email null) diventano stringa vuota, mai 'null' scritto nel file", () => {
    const csv = clientiACsv([cliente({ nome: null, telefono: null, email: null })]);
    expect(csv).toContain(",,,,Manuale,");
    expect(csv).not.toMatch(/null/i);
  });

  it("racchiude tra virgolette un campo che contiene una virgola, raddoppiando eventuali virgolette interne", () => {
    const csv = clientiACsv([cliente({ nome: 'Cliente "VIP", con virgola' })]);
    expect(csv).toContain('"Cliente ""VIP"", con virgola"');
  });

  it("racchiude tra virgolette un campo con un ritorno a capo", () => {
    const csv = clientiACsv([cliente({ nome: "Riga1\nRiga2" })]);
    expect(csv).toContain('"Riga1\nRiga2"');
  });

  it("non racchiude tra virgolette un campo normale, per restare leggibile come testo semplice", () => {
    const csv = clientiACsv([cliente({ nome: "Maria Rossi" })]);
    expect(csv).toContain("Maria Rossi,");
    expect(csv).not.toContain('"Maria Rossi"');
  });
});
