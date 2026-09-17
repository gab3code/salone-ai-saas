import { describe, it, expect } from "vitest";
import {
  PERIODI,
  calcolaAndamento,
  confrontaConPeriodoPrecedente,
  trovaPeriodo,
  type Periodo,
} from "./analytics";

/**
 * REGOLA DI QUESTO FILE: le date si costruiscono con `Date.UTC` o con una
 * stringa ISO che finisce per Z, mai con `new Date(anno, mese, giorno)` --
 * quella e' la mezzanotte LOCALE e a Roma cade il giorno prima in UTC.
 * Imparata il 17/09/2026 con un test che passava nel sandbox e falliva sul
 * Mac di Gabriel.
 */
// Mercoledì 2026-09-16 -- la sua settimana (lun-dom) va dal 14/09 al 20/09.
const adesso = new Date("2026-09-16T12:00:00Z");

const settimanale = trovaPeriodo("3m");
const giornaliero = trovaPeriodo("28g");
const mensile = trovaPeriodo("12m");

function conPunti(base: Periodo, punti: number): Periodo {
  return { ...base, punti };
}

describe("trovaPeriodo", () => {
  it("riconosce le chiavi offerte", () => {
    for (const p of PERIODI) expect(trovaPeriodo(p.chiave).chiave).toBe(p.chiave);
  });

  it("una chiave inventata nella barra degli indirizzi ricade sul predefinito", () => {
    for (const sporca of ["", "999m", "../../etc", undefined, null]) {
      expect(trovaPeriodo(sporca).chiave).toBe("3m");
    }
  });
});

describe("calcolaAndamento -- settimane", () => {
  it("ritorna il numero di punti richiesto, dal più vecchio al più recente", () => {
    const punti = calcolaAndamento([], [], adesso, conPunti(settimanale, 4));
    expect(punti).toHaveLength(4);
    expect(punti[0].inizio < punti[3].inizio).toBe(true);
    // L'ultimo punto è la settimana corrente (lunedì 14/09).
    expect(punti[3].inizio.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("conta solo gli appuntamenti confermati nella settimana giusta", () => {
    const punti = calcolaAndamento(
      [
        { inizio: new Date("2026-09-15T10:00:00Z"), stato: "confermato" }, // settimana corrente
        { inizio: new Date("2026-09-15T10:00:00Z"), stato: "cancellato" }, // stessa settimana, non conta
        { inizio: new Date("2026-09-15T10:00:00Z"), stato: "no_show" }, // idem: non si è presentato
        { inizio: new Date("2026-09-08T10:00:00Z"), stato: "confermato" }, // settimana precedente
      ],
      [],
      adesso,
      conPunti(settimanale, 2)
    );
    expect(punti[0].prenotazioniConfermate).toBe(1); // settimana del 08/09
    expect(punti[1].prenotazioniConfermate).toBe(1); // settimana del 14/09
  });

  it("conta i nuovi clienti nella settimana in cui sono stati creati", () => {
    const punti = calcolaAndamento(
      [],
      [{ createdAt: new Date("2026-09-15T08:00:00Z") }, { createdAt: new Date("2026-09-01T08:00:00Z") }],
      adesso,
      conPunti(settimanale, 3)
    );
    expect(punti[2].nuoviClienti).toBe(1);
    expect(punti[0].nuoviClienti + punti[1].nuoviClienti).toBe(1);
  });

  it("un appuntamento esattamente a mezzanotte di lunedì appartiene a quella settimana", () => {
    const punti = calcolaAndamento(
      [{ inizio: new Date("2026-09-14T00:00:00.000Z"), stato: "confermato" }],
      [],
      adesso,
      conPunti(settimanale, 1)
    );
    expect(punti[0].prenotazioniConfermate).toBe(1);
  });
});

describe("calcolaAndamento -- giorni", () => {
  it("l'ultimo punto è oggi e i bucket sono giorni civili", () => {
    const punti = calcolaAndamento([], [], adesso, conPunti(giornaliero, 3));
    expect(punti.map((p) => p.inizio.toISOString())).toEqual([
      "2026-09-14T00:00:00.000Z",
      "2026-09-15T00:00:00.000Z",
      "2026-09-16T00:00:00.000Z",
    ]);
  });

  it("due appuntamenti nello stesso giorno finiscono nello stesso bucket", () => {
    const punti = calcolaAndamento(
      [
        { inizio: new Date("2026-09-16T09:00:00Z"), stato: "confermato" },
        { inizio: new Date("2026-09-16T18:30:00Z"), stato: "confermato" },
        { inizio: new Date("2026-09-15T23:59:00Z"), stato: "confermato" },
      ],
      [],
      adesso,
      conPunti(giornaliero, 2)
    );
    expect(punti[0].prenotazioniConfermate).toBe(1);
    expect(punti[1].prenotazioniConfermate).toBe(2);
  });
});

describe("calcolaAndamento -- mesi", () => {
  it("i bucket cominciano il primo del mese e l'ultimo è il mese corrente", () => {
    const punti = calcolaAndamento([], [], adesso, conPunti(mensile, 3));
    expect(punti.map((p) => p.inizio.toISOString())).toEqual([
      "2026-07-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
      "2026-09-01T00:00:00.000Z",
    ]);
  });

  it("i mesi di lunghezza diversa non si sovrappongono né lasciano buchi", () => {
    // Febbraio 2026 ha 28 giorni: il 28/02 e il 01/03 sono in mesi diversi.
    const fine = new Date("2026-03-15T12:00:00Z");
    const punti = calcolaAndamento(
      [
        { inizio: new Date("2026-02-28T23:00:00Z"), stato: "confermato" },
        { inizio: new Date("2026-03-01T00:00:00Z"), stato: "confermato" },
      ],
      [],
      fine,
      conPunti(mensile, 2)
    );
    expect(punti[0].prenotazioniConfermate).toBe(1);
    expect(punti[1].prenotazioniConfermate).toBe(1);
  });

  it("attraversa il capodanno senza saltare né duplicare un mese", () => {
    const gennaio = new Date("2027-01-10T12:00:00Z");
    const punti = calcolaAndamento([], [], gennaio, conPunti(mensile, 3));
    expect(punti.map((p) => p.inizio.toISOString())).toEqual([
      "2026-11-01T00:00:00.000Z",
      "2026-12-01T00:00:00.000Z",
      "2027-01-01T00:00:00.000Z",
    ]);
  });
});

describe("calcolaAndamento -- forma della serie", () => {
  it("ogni punto ha un'etichetta già formattata", () => {
    for (const periodo of PERIODI) {
      const punti = calcolaAndamento([], [], adesso, periodo);
      expect(punti).toHaveLength(periodo.punti);
      expect(punti.every((p) => p.etichetta.length > 0), periodo.chiave).toBe(true);
    }
  });

  it("i bucket vuoti restano nella serie a zero, non spariscono", () => {
    const punti = calcolaAndamento([], [], adesso, conPunti(settimanale, 6));
    expect(punti).toHaveLength(6);
    expect(punti.every((p) => p.prenotazioniConfermate === 0 && p.nuoviClienti === 0)).toBe(true);
  });
});

describe("confrontaConPeriodoPrecedente", () => {
  const settimane = (n: number) => ({ ...settimanale, punti: n });

  it("divide la finestra doppia a metà e somma le due parti", () => {
    const c = confrontaConPeriodoPrecedente(
      [
        { inizio: new Date("2026-09-15T10:00:00Z"), stato: "confermato" }, // settimana corrente
        { inizio: new Date("2026-09-08T10:00:00Z"), stato: "confermato" }, // settimana scorsa
        { inizio: new Date("2026-09-01T10:00:00Z"), stato: "confermato" }, // due settimane fa
        { inizio: new Date("2026-08-25T10:00:00Z"), stato: "confermato" }, // tre settimane fa
      ],
      [],
      adesso,
      settimane(2)
    );
    expect(c.attuale.prenotazioniConfermate, "ultime due settimane").toBe(2);
    expect(c.precedente.prenotazioniConfermate, "le due prima").toBe(2);
    expect(c.variazionePrenotazioni).toBe(0);
  });

  it("calcola la variazione percentuale nei due versi", () => {
    const appuntamenti = [
      { inizio: new Date("2026-09-15T10:00:00Z"), stato: "confermato" },
      { inizio: new Date("2026-09-15T11:00:00Z"), stato: "confermato" },
      { inizio: new Date("2026-09-15T12:00:00Z"), stato: "confermato" },
      { inizio: new Date("2026-09-08T10:00:00Z"), stato: "confermato" },
    ];
    expect(confrontaConPeriodoPrecedente(appuntamenti, [], adesso, settimane(1)).variazionePrenotazioni).toBe(200);
    const calo = [
      { inizio: new Date("2026-09-15T10:00:00Z"), stato: "confermato" },
      { inizio: new Date("2026-09-08T10:00:00Z"), stato: "confermato" },
      { inizio: new Date("2026-09-08T11:00:00Z"), stato: "confermato" },
    ];
    expect(confrontaConPeriodoPrecedente(calo, [], adesso, settimane(1)).variazionePrenotazioni).toBe(-50);
  });

  it("partendo da zero non inventa una percentuale", () => {
    const c = confrontaConPeriodoPrecedente(
      [{ inizio: new Date("2026-09-15T10:00:00Z"), stato: "confermato" }],
      [],
      adesso,
      settimane(1)
    );
    expect(c.precedente.prenotazioniConfermate).toBe(0);
    expect(c.variazionePrenotazioni, "+100% o +infinito sarebbero entrambi inventati").toBeNull();
  });

  it("senza dati entrambe le finestre sono a zero e non c'è variazione", () => {
    const c = confrontaConPeriodoPrecedente([], [], adesso, settimane(4));
    expect(c.attuale).toEqual({ prenotazioniConfermate: 0, nuoviClienti: 0 });
    expect(c.variazioneNuoviClienti).toBeNull();
  });
});
