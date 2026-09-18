import { describe, expect, it } from "vitest";
import {
  costruisciEventoGoogle,
  eNostroEvento,
  titoloEvento,
  PROPRIETA_APPUNTAMENTO,
} from "./evento-google";

const BASE = {
  appuntamentoId: "app-1",
  nomeServizio: "Taglio",
  nomeCliente: "Giulia",
  inizio: new Date("2026-09-21T08:00:00Z"),
  fine: new Date("2026-09-21T08:30:00Z"),
  fusoOrario: "Europe/Rome",
};

describe("il titolo che si legge sul telefono", () => {
  it("prima il servizio, poi chi", () => {
    expect(titoloEvento("Taglio", "Giulia")).toBe("Taglio - Giulia");
  });

  it("senza nome resta il solo servizio, mai 'Taglio - null'", () => {
    expect(titoloEvento("Taglio", null)).toBe("Taglio");
    expect(titoloEvento("Taglio", "   ")).toBe("Taglio");
  });

  it("senza nemmeno il servizio non resta un titolo vuoto", () => {
    expect(titoloEvento("   ", null)).toBe("Appuntamento");
  });
});

describe("l'evento da mandare a Google", () => {
  it("porta gli istanti e il fuso del salone", () => {
    const evento = costruisciEventoGoogle(BASE);
    expect(evento.start).toEqual({ dateTime: "2026-09-21T08:00:00.000Z", timeZone: "Europe/Rome" });
    expect(evento.end).toEqual({ dateTime: "2026-09-21T08:30:00.000Z", timeZone: "Europe/Rome" });
  });

  it("E' MARCATO COME NOSTRO: e' la riga che rompe l'anello", () => {
    // Senza questa marcatura l'appuntamento che scriviamo su Google torna
    // indietro alla lettura successiva come impegno esterno, e quello slot
    // risulta occupato due volte -- per sempre, perche' l'evento su Google
    // resterebbe anche cancellando l'appuntamento.
    const evento = costruisciEventoGoogle(BASE);
    expect(evento.extendedProperties.private[PROPRIETA_APPUNTAMENTO]).toBe("app-1");
  });

  it("nella descrizione non finiscono telefono ne' email del cliente", () => {
    // Quel calendario puo' essere condiviso con chiunque, fuori dal nostro
    // controllo e fuori da quello che il cliente ha accettato.
    const evento = costruisciEventoGoogle({ ...BASE, urlGestione: "https://esempio.it/gestisci/1" });
    expect(evento.description).toContain("https://esempio.it/gestisci/1");
    expect(evento.description).not.toMatch(/\d{6,}/);
    expect(evento.description).not.toContain("@");
  });

  it("senza link di gestione la descrizione resta valida", () => {
    const evento = costruisciEventoGoogle({ ...BASE, urlGestione: null });
    expect(evento.description).toBe("Appuntamento gestito da Salone AI.");
  });
});

describe("riconoscere gli eventi nostri in lettura", () => {
  it("riconosce quello che abbiamo appena costruito", () => {
    expect(eNostroEvento(costruisciEventoGoogle(BASE))).toBe(true);
  });

  it("un impegno personale dell'operatrice NON e' nostro", () => {
    expect(eNostroEvento({ id: "abc", summary: "Dentista" })).toBe(false);
    expect(eNostroEvento({ extendedProperties: { private: { altro: "x" } } })).toBe(false);
  });

  it("una marcatura vuota non conta come nostra", () => {
    expect(eNostroEvento({ extendedProperties: { private: { [PROPRIETA_APPUNTAMENTO]: "  " } } })).toBe(false);
  });

  it("NON LANCIA MAI, qualunque cosa arrivi", () => {
    // Sta dentro il calcolo della disponibilita': il caso peggiore deve
    // essere uno slot in meno, non un'eccezione.
    for (const strano of [null, undefined, 42, "testo", [], { extendedProperties: 7 }, { extendedProperties: { private: 3 } }]) {
      expect(() => eNostroEvento(strano)).not.toThrow();
      expect(eNostroEvento(strano)).toBe(false);
    }
  });
});
