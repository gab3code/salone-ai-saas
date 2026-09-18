import { describe, expect, it } from "vitest";
import {
  dataValida,
  giorniDelPeriodo,
  leggiFascia,
  raggruppaInPeriodi,
  MAX_GIORNI_PERIODO,
  type RigaChiusura,
} from "./periodi-chiusura";

describe("date", () => {
  it("accetta una data scritta bene", () => {
    expect(dataValida("2026-08-10")).toBe(true);
  });

  it("rifiuta un giorno che non esiste, non solo un formato sbagliato", () => {
    // Il 31 febbraio passa qualunque controllo fatto con una sola regex:
    // Date lo normalizza in silenzio al 2 o 3 marzo.
    expect(dataValida("2026-02-31")).toBe(false);
    expect(dataValida("2026-13-01")).toBe(false);
    expect(dataValida("10/08/2026")).toBe(false);
    expect(dataValida("")).toBe(false);
  });

  it("l'anno bisestile e' un anno bisestile", () => {
    expect(dataValida("2028-02-29")).toBe(true);
    expect(dataValida("2027-02-29")).toBe(false);
  });
});

describe("un periodo diventa giorni", () => {
  it("dal 10 al 13 agosto sono quattro giorni, estremi inclusi", () => {
    const esito = giorniDelPeriodo("2026-08-10", "2026-08-13");
    expect(esito.ok && esito.giorni).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
  });

  it("senza data di fine e' un giorno solo", () => {
    // "il 15 siamo chiusi" non deve costringere a scrivere due volte la data.
    expect(giorniDelPeriodo("2026-08-15").ok && giorniDelPeriodo("2026-08-15")).toMatchObject({
      giorni: ["2026-08-15"],
    });
    expect(giorniDelPeriodo("2026-08-15", "").ok).toBe(true);
    expect(giorniDelPeriodo("2026-08-15", null).ok).toBe(true);
  });

  it("attraversa il cambio di mese e di anno senza saltare niente", () => {
    const esito = giorniDelPeriodo("2026-12-30", "2027-01-02");
    expect(esito.ok && esito.giorni).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("attraversa il cambio dell'ora legale senza perdere un giorno", () => {
    // L'ultima domenica di marzo: costruendo le date come istanti locali si
    // perderebbe o si duplicherebbe un giorno. Qui si lavora in UTC apposta.
    const esito = giorniDelPeriodo("2027-03-27", "2027-03-30");
    expect(esito.ok && esito.giorni).toEqual([
      "2027-03-27",
      "2027-03-28",
      "2027-03-29",
      "2027-03-30",
    ]);
  });

  it("una fine prima dell'inizio e' un errore leggibile, non un elenco vuoto", () => {
    const esito = giorniDelPeriodo("2026-08-20", "2026-08-10");
    expect(esito.ok).toBe(false);
    expect(!esito.ok && esito.errore).toContain("prima");
  });

  it("un periodo assurdamente lungo viene fermato", () => {
    const esito = giorniDelPeriodo("2026-01-01", "2030-01-01");
    expect(esito.ok).toBe(false);
    expect(!esito.ok && esito.errore).toContain(String(MAX_GIORNI_PERIODO));
  });
});

describe("chiusura di mezza giornata", () => {
  it("giorno intero: niente orari", () => {
    expect(leggiFascia(true, "", "")).toEqual({
      ok: true,
      fascia: { giornoIntero: true, oraInizio: null, oraFine: null },
    });
  });

  it("mezza fascia non e' un dato", () => {
    expect(leggiFascia(false, "14:00", "").ok).toBe(false);
    expect(leggiFascia(false, "", "18:00").ok).toBe(false);
  });

  it("la fine deve venire dopo l'inizio", () => {
    expect(leggiFascia(false, "18:00", "14:00").ok).toBe(false);
    expect(leggiFascia(false, "14:00", "18:00").ok).toBe(true);
  });
});

describe("rimettere insieme i giorni in periodi", () => {
  function riga(id: string, data: string, extra: Partial<RigaChiusura> = {}): RigaChiusura {
    return {
      id,
      operatoreId: null,
      data,
      giornoIntero: true,
      oraInizio: null,
      oraFine: null,
      motivo: "Ferie",
      ...extra,
    };
  }

  it("giorni consecutivi uguali tornano un periodo solo", () => {
    const periodi = raggruppaInPeriodi([
      riga("1", "2026-08-10"),
      riga("2", "2026-08-11"),
      riga("3", "2026-08-12"),
    ]);
    expect(periodi).toHaveLength(1);
    expect(periodi[0]).toMatchObject({ inizio: "2026-08-10", fine: "2026-08-12" });
    expect(periodi[0].ids).toEqual(["1", "2", "3"]);
  });

  it("un buco in mezzo spezza il periodo", () => {
    const periodi = raggruppaInPeriodi([
      riga("1", "2026-08-10"),
      riga("2", "2026-08-12"),
    ]);
    expect(periodi).toHaveLength(2);
  });

  it("stessi giorni ma operatori diversi restano periodi diversi", () => {
    // Le ferie di Anna non sono le ferie del salone.
    const periodi = raggruppaInPeriodi([
      riga("1", "2026-08-10", { operatoreId: "anna" }),
      riga("2", "2026-08-11", { operatoreId: null }),
    ]);
    expect(periodi).toHaveLength(2);
  });

  it("motivi diversi restano periodi diversi", () => {
    const periodi = raggruppaInPeriodi([
      riga("1", "2026-08-10", { motivo: "Ferie" }),
      riga("2", "2026-08-11", { motivo: "Corso" }),
    ]);
    expect(periodi).toHaveLength(2);
  });

  it("l'ordine di arrivo non conta", () => {
    const periodi = raggruppaInPeriodi([
      riga("3", "2026-08-12"),
      riga("1", "2026-08-10"),
      riga("2", "2026-08-11"),
    ]);
    expect(periodi).toHaveLength(1);
    expect(periodi[0]).toMatchObject({ inizio: "2026-08-10", fine: "2026-08-12" });
  });

  it("nessuna riga, nessun periodo", () => {
    expect(raggruppaInPeriodi([])).toEqual([]);
  });
});
