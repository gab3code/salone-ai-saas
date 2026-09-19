import { describe, expect, it } from "vitest";
import { oraDaIso, raggruppaPerFascia, preparaOrariPerIlModello } from "./proposta-orari";

describe("oraDaIso", () => {
  it("prende l'ora dall'ISO in pseudo-UTC", () => {
    expect(oraDaIso("2026-09-22T08:00:00.000Z")).toBe("08:00");
    expect(oraDaIso("2026-09-22T15:45:00.000Z")).toBe("15:45");
  });
  it("torna null su qualcosa che non e' un ISO", () => {
    expect(oraDaIso("domani")).toBeNull();
  });
});

describe("raggruppaPerFascia", () => {
  it("divide come parla un cliente, non come divide un orologio", () => {
    const g = raggruppaPerFascia(["08:00", "12:30", "13:00", "17:45", "18:00", "19:30"]);
    // 12:30 e' mattina: nessuno lo chiama pomeriggio.
    expect(g.mattina).toEqual(["08:00", "12:30"]);
    expect(g.pomeriggio).toEqual(["13:00", "17:45"]);
    // 18:00 e' l'ora del "passo dopo il lavoro".
    expect(g.sera).toEqual(["18:00", "19:30"]);
  });

  it("una fascia senza orari resta vuota, cosi' non viene mostrata", () => {
    const g = raggruppaPerFascia(["09:00", "10:00"]);
    expect(g.pomeriggio).toEqual([]);
    expect(g.sera).toEqual([]);
  });

  it("ordina e toglie i doppioni", () => {
    expect(raggruppaPerFascia(["10:00", "09:00", "10:00"]).mattina).toEqual(["09:00", "10:00"]);
  });

  it("giornata vuota: tre fasce vuote, niente di inventato", () => {
    expect(raggruppaPerFascia([])).toEqual({ mattina: [], pomeriggio: [], sera: [] });
  });
});

describe("preparaOrariPerIlModello", () => {
  /**
   * Il caso vero: passo 15, giornata 08:00-18:00 con pausa 12:00-14:00.
   * Gabriel li vuole TUTTI, non una selezione -- "voglio che dica tutti gli
   * orari liberi, no riassunti", 19/09/2026.
   */
  it("consegna TUTTI gli orari, non una selezione", () => {
    const slot: { inizio: string; operatoreId: string }[] = [];
    for (const h of [8, 9, 10, 11]) {
      for (const m of ["00", "15", "30", "45"]) {
        slot.push({ inizio: `2026-09-22T${String(h).padStart(2, "0")}:${m}:00.000Z`, operatoreId: "a" });
      }
    }
    for (const h of [14, 15, 16, 17]) {
      for (const m of ["00", "15", "30", "45"]) {
        slot.push({ inizio: `2026-09-22T${h}:${m}:00.000Z`, operatoreId: "a" });
      }
    }

    const r = preparaOrariPerIlModello(slot);
    expect(r.tutti_gli_orari_liberi.length).toBe(32);
    expect(r.quanti_in_tutto).toBe(32);
    expect(r.primo_libero).toBe("08:00");
    // Nessuna pausa pranzo fra gli orari: 12 e 13 non ci sono.
    expect(r.tutti_gli_orari_liberi.filter((o) => o.startsWith("12:") || o.startsWith("13:"))).toEqual([]);
    // Divisi per poterli scrivere leggibili.
    expect(r.orari_per_fascia.mattina.length).toBe(16);
    expect(r.orari_per_fascia.pomeriggio.length).toBe(16);
    expect(r.orari_per_fascia.sera).toEqual([]);
  });

  it("lo stesso orario con due operatori diversi e' UN orario per il cliente", () => {
    const r = preparaOrariPerIlModello([
      { inizio: "2026-09-22T08:00:00.000Z", operatoreId: "a" },
      { inizio: "2026-09-22T08:00:00.000Z", operatoreId: "b" },
      { inizio: "2026-09-22T08:15:00.000Z", operatoreId: "a" },
    ]);
    expect(r.tutti_gli_orari_liberi).toEqual(["08:00", "08:15"]);
    expect(r.quanti_in_tutto).toBe(2);
  });

  it("giornata vuota: tutto a zero e primo_libero null, niente di inventato", () => {
    expect(preparaOrariPerIlModello([])).toEqual({
      tutti_gli_orari_liberi: [],
      orari_per_fascia: { mattina: [], pomeriggio: [], sera: [] },
      quanti_in_tutto: 0,
      primo_libero: null,
    });
  });
});
