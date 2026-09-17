import { describe, expect, it } from "vitest";
import { LUNGHEZZA_MASSIMA_TERMINE_RICERCA, filtroRicercaClienti, terminoRicercaSicuro } from "./ricerca";

describe("terminoRicercaSicuro", () => {
  it("lascia passare una ricerca normale", () => {
    expect(terminoRicercaSicuro("Giulia")).toBe("Giulia");
    expect(terminoRicercaSicuro("  333 111 2223  ")).toBe("333 111 2223");
  });

  it("toglie i caratteri che rompono la grammatica del filtro", () => {
    // La virgola separa due condizioni in PostgREST: lasciarla passare
    // significa lasciare che la ricerca aggiunga filtri alla query.
    for (const carattere of [",", "(", ")", ".", '"', "\\"]) {
      expect(terminoRicercaSicuro(`Giulia${carattere}Rossi`), carattere).not.toContain(carattere);
    }
  });

  it("toglie i jolly di like, che scaricherebbero l'intera rubrica", () => {
    expect(terminoRicercaSicuro("%")).toBeNull();
    expect(terminoRicercaSicuro("_")).toBeNull();
    expect(terminoRicercaSicuro("a%b")).toBe("a b");
  });

  it("un tentativo di iniettare un secondo filtro non sopravvive", () => {
    const cattivo = 'x,tenant_id.neq.00000000-0000-0000-0000-000000000000';
    const pulito = terminoRicercaSicuro(cattivo)!;
    expect(pulito).not.toContain(",");
    expect(pulito).not.toContain(".");
    expect(filtroRicercaClienti(pulito).split(",")).toHaveLength(2);
  });

  it("vuoto, spazi e non-stringhe diventano null", () => {
    for (const v of ["", "   ", null, undefined]) expect(terminoRicercaSicuro(v as string | null)).toBeNull();
  });

  it("tronca un termine assurdamente lungo", () => {
    expect(terminoRicercaSicuro("a".repeat(500))!.length).toBe(LUNGHEZZA_MASSIMA_TERMINE_RICERCA);
  });
});

describe("filtroRicercaClienti", () => {
  it("cerca su nome e telefono, e su nient'altro", () => {
    const filtro = filtroRicercaClienti("Anna");
    expect(filtro).toBe("nome.ilike.%Anna%,telefono.ilike.%Anna%");
    expect(filtro.split(",")).toHaveLength(2);
  });
});
