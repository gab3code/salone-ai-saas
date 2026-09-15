import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import { formattaTestoConLink } from "./ChatWidgetPubblico";

/**
 * `formattaTestoConLink` ritorna un array di ReactNode (stringhe + elementi
 * `<a>`) -- niente rendering DOM richiesto (il progetto non ha
 * @testing-library/react), basta ispezionare la struttura ritornata: ogni
 * elemento React è un oggetto semplice con `.type` e `.props`.
 */
function link(nodo: unknown): { href: string; testo: string } {
  if (!isValidElement<{ href: string; children: string }>(nodo) || nodo.type !== "a") {
    throw new Error("atteso un elemento <a>");
  }
  return { href: nodo.props.href, testo: nodo.props.children };
}

describe("formattaTestoConLink -- numeri di telefono (richiesta di Gabriel 15/09/2026)", () => {
  it("rende cliccabile un numero fisso con spazio (formato usato nei dati di test, '02 99999999')", () => {
    const risultato = formattaTestoConLink("Chiamaci al 02 99999999 per informazioni.");
    expect(risultato[0]).toBe("Chiamaci al ");
    expect(link(risultato[1])).toEqual({ href: "tel:0299999999", testo: "02 99999999" });
    expect(risultato[2]).toBe(" per informazioni.");
  });

  it("rende cliccabile un cellulare con prefisso internazionale ('+39 347 1234567')", () => {
    const risultato = formattaTestoConLink("Scrivimi su WhatsApp al +39 347 1234567 quando puoi.");
    expect(link(risultato[1])).toEqual({ href: "tel:+393471234567", testo: "+39 347 1234567" });
  });

  it("rende cliccabile un numero con separatori a punto o trattino ('02.9999.9999', '347-123-4567')", () => {
    const r1 = formattaTestoConLink("Fisso: 02.99999999");
    expect(link(r1[1]).testo).toBe("02.99999999");

    const r2 = formattaTestoConLink("Cell: 347-1234567");
    expect(link(r2[1]).testo).toBe("347-1234567");
  });

  it("NON scambia una data (15/09/2026) per un numero di telefono", () => {
    const risultato = formattaTestoConLink("L'appuntamento è per il 15/09/2026 alle 10:00.");
    expect(risultato.every((nodo) => typeof nodo === "string")).toBe(true);
    expect(risultato.join("")).toContain("15/09/2026");
  });

  it("NON scambia un intervallo di prezzi ('150.00 - 200.00') per un numero di telefono", () => {
    const risultato = formattaTestoConLink("Il trattamento costa tra 150.00 - 200.00 euro.");
    expect(risultato.every((nodo) => typeof nodo === "string")).toBe(true);
  });

  it("un link http e un numero di telefono nello stesso messaggio vengono riconosciuti entrambi", () => {
    const risultato = formattaTestoConLink(
      "Paga qui: https://esempio.it/pagamento oppure chiama il 02 99999999."
    );
    const href = (nodo: unknown) => (isValidElement<{ href: string }>(nodo) ? nodo.props.href : undefined);
    const link1 = risultato.find((n) => href(n)?.startsWith("https://"));
    const link2 = risultato.find((n) => href(n)?.startsWith("tel:"));
    expect(link1).toBeDefined();
    expect(link2).toBeDefined();
    expect(link(link2)).toEqual({ href: "tel:0299999999", testo: "02 99999999" });
  });

  it("testo senza numeri né link resta invariato", () => {
    const risultato = formattaTestoConLink("Siamo aperti dal lunedì al sabato.");
    expect(risultato).toEqual(["Siamo aperti dal lunedì al sabato."]);
  });
});
