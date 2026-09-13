import { describe, expect, it } from "vitest";
import { calcolaImportoCaparraCentesimi, type ConfigCaparra } from "./caparra";

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
