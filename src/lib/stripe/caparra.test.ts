import { describe, expect, it } from "vitest";
import { caparraDovuta, calcolaImportoCaparraCentesimi, type ConfigCaparra } from "./caparra";

describe("calcolaImportoCaparraCentesimi", () => {
  it("torna 0 se la caparra non è attiva, qualunque sia tipo/valore", () => {
    const config: ConfigCaparra = { attiva: false, tipo: "percentuale", valore: 50 };
    expect(calcolaImportoCaparraCentesimi(config, 5000)).toBe(0);
  });

  it("percentuale: calcola la percentuale del prezzo del servizio, arrotondata", () => {
    const config: ConfigCaparra = { attiva: true, tipo: "percentuale", valore: 20 };
    expect(calcolaImportoCaparraCentesimi(config, 5000)).toBe(1000); // 20% di 50,00€
  });

  it("percentuale: arrotonda all'intero più vicino (i centesimi non sono divisibili)", () => {
    const config: ConfigCaparra = { attiva: true, tipo: "percentuale", valore: 33 };
    expect(calcolaImportoCaparraCentesimi(config, 999)).toBe(330); // 329.67 -> 330
  });

  it("fisso: ignora il prezzo del servizio, usa sempre il valore configurato", () => {
    const config: ConfigCaparra = { attiva: true, tipo: "fisso", valore: 1500 };
    expect(calcolaImportoCaparraCentesimi(config, 9999)).toBe(1500);
    expect(calcolaImportoCaparraCentesimi(config, 100)).toBe(1500);
  });

  it("servizio a prezzo zero con caparra percentuale torna 0, mai un importo negativo o NaN", () => {
    const config: ConfigCaparra = { attiva: true, tipo: "percentuale", valore: 20 };
    expect(calcolaImportoCaparraCentesimi(config, 0)).toBe(0);
  });

  it("non torna mai un importo negativo anche con valori di configurazione anomali", () => {
    const config: ConfigCaparra = { attiva: true, tipo: "fisso", valore: -500 };
    expect(calcolaImportoCaparraCentesimi(config, 5000)).toBe(0);
  });
});

describe("caparra selettiva (migrazione 0071): a chi si chiede", () => {
  const base = { attiva: true, tipo: "fisso" as const, valore: 1000 };

  it("regola 'tutti' (o assente, per le configurazioni vecchie): sempre", () => {
    expect(caparraDovuta(base)).toBe(true);
    expect(caparraDovuta({ ...base, regola: "tutti" }, 0)).toBe(true);
    expect(calcolaImportoCaparraCentesimi(base, 5000)).toBe(1000);
  });

  it("regola 'dopo_no_show': un cliente nuovo o senza assenze non paga, chi ha raggiunto la soglia si'", () => {
    const cfg = { ...base, regola: "dopo_no_show" as const, sogliaNoShow: 2 };
    expect(caparraDovuta(cfg)).toBe(false);
    expect(caparraDovuta(cfg, null)).toBe(false);
    expect(caparraDovuta(cfg, 1)).toBe(false);
    expect(caparraDovuta(cfg, 2)).toBe(true);
    expect(calcolaImportoCaparraCentesimi(cfg, 5000, 1)).toBe(0);
    expect(calcolaImportoCaparraCentesimi(cfg, 5000, 3)).toBe(1000);
  });

  it("soglia assente vale 1; caparra spenta non chiede a nessuno", () => {
    expect(caparraDovuta({ ...base, regola: "dopo_no_show" }, 1)).toBe(true);
    expect(caparraDovuta({ ...base, attiva: false, regola: "dopo_no_show" }, 5)).toBe(false);
  });
});
