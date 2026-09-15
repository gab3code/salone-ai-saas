import { describe, expect, it } from "vitest";
import {
  clientiDaAvvisarePerCompleanno,
  comporreMessaggioCompleanno,
  compleannoCadeOggi,
  scomponiDataIso,
  MESSAGGIO_COMPLEANNO_PREDEFINITO,
  type ClientePerCompleanno,
  type TenantPerCompleanno,
} from "./compleanno";

const OGGI = { anno: 2026, mese: 9, giorno: 15 };
const TENANT_ATTIVO: TenantPerCompleanno = { piano: "pro", compleannoAttivo: true };

function cliente(overrides: Partial<ClientePerCompleanno>): ClientePerCompleanno {
  return {
    id: "cli-1",
    nome: "Maria",
    email: "maria@example.com",
    telefono: null,
    dataNascita: "1990-09-15", // compleanno oggi
    tenantPiano: "pro",
    ultimoAnnoAvvisato: null,
    ...overrides,
  };
}

describe("scomponiDataIso", () => {
  it("legge anno/mese/giorno da una data YYYY-MM-DD senza passare da Date/fusi orari", () => {
    expect(scomponiDataIso("1990-09-15")).toEqual({ anno: 1990, mese: 9, giorno: 15 });
  });
});

describe("compleannoCadeOggi", () => {
  it("vero quando mese e giorno coincidono (anno di nascita diverso, non conta)", () => {
    expect(compleannoCadeOggi({ anno: 1990, mese: 9, giorno: 15 }, OGGI)).toBe(true);
  });

  it("falso quando il giorno è diverso", () => {
    expect(compleannoCadeOggi({ anno: 1990, mese: 9, giorno: 16 }, OGGI)).toBe(false);
  });

  it("falso quando il mese è diverso (stesso giorno del mese)", () => {
    expect(compleannoCadeOggi({ anno: 1990, mese: 8, giorno: 15 }, OGGI)).toBe(false);
  });

  it("29 febbraio: in un anno bisestile scatta esattamente il 29", () => {
    const oggiBisestile = { anno: 2028, mese: 2, giorno: 29 };
    expect(compleannoCadeOggi({ anno: 2000, mese: 2, giorno: 29 }, oggiBisestile)).toBe(true);
  });

  it("29 febbraio: in un anno NON bisestile scatta il 28 (default scelto, non saltato né spostato a marzo)", () => {
    const oggiNonBisestile28 = { anno: 2026, mese: 2, giorno: 28 };
    const oggiNonBisestile1marzo = { anno: 2026, mese: 3, giorno: 1 };
    expect(compleannoCadeOggi({ anno: 2000, mese: 2, giorno: 29 }, oggiNonBisestile28)).toBe(true);
    expect(compleannoCadeOggi({ anno: 2000, mese: 2, giorno: 29 }, oggiNonBisestile1marzo)).toBe(false);
  });
});

describe("clientiDaAvvisarePerCompleanno", () => {
  it("include un cliente sul piano giusto, con l'interruttore acceso, compleanno oggi, con email, non ancora avvisato quest'anno", () => {
    const risultato = clientiDaAvvisarePerCompleanno([cliente({})], TENANT_ATTIVO, OGGI);
    expect(risultato.map((c) => c.id)).toEqual(["cli-1"]);
  });

  it("esclude se il piano non include il promemoria di compleanno (es. Growth)", () => {
    const risultato = clientiDaAvvisarePerCompleanno(
      [cliente({ tenantPiano: "growth" })],
      { piano: "growth", compleannoAttivo: true },
      OGGI
    );
    expect(risultato).toEqual([]);
  });

  it("esclude se il tenant ha il piano giusto ma l'interruttore è spento (default)", () => {
    const risultato = clientiDaAvvisarePerCompleanno([cliente({})], { piano: "pro", compleannoAttivo: false }, OGGI);
    expect(risultato).toEqual([]);
  });

  it("esclude un cliente senza data di nascita compilata", () => {
    const risultato = clientiDaAvvisarePerCompleanno([cliente({ dataNascita: null })], TENANT_ATTIVO, OGGI);
    expect(risultato).toEqual([]);
  });

  it("esclude un cliente il cui compleanno non cade oggi", () => {
    const risultato = clientiDaAvvisarePerCompleanno(
      [cliente({ dataNascita: "1990-01-01" })],
      TENANT_ATTIVO,
      OGGI
    );
    expect(risultato).toEqual([]);
  });

  it("esclude un cliente già avvisato quest'anno (claim-before-send annuale)", () => {
    const risultato = clientiDaAvvisarePerCompleanno(
      [cliente({ ultimoAnnoAvvisato: 2026 })],
      TENANT_ATTIVO,
      OGGI
    );
    expect(risultato).toEqual([]);
  });

  it("include un cliente avvisato l'anno scorso (idoneo di nuovo quest'anno)", () => {
    const risultato = clientiDaAvvisarePerCompleanno(
      [cliente({ ultimoAnnoAvvisato: 2025 })],
      TENANT_ATTIVO,
      OGGI
    );
    expect(risultato.map((c) => c.id)).toEqual(["cli-1"]);
  });

  it("un cliente senza email ma con telefono è incluso solo se il piano include l'SMS", () => {
    const senzaEmail = cliente({ email: null, telefono: "+391234567890" });
    expect(clientiDaAvvisarePerCompleanno([senzaEmail], TENANT_ATTIVO, OGGI).map((c) => c.id)).toEqual(["cli-1"]);

    // Enterprise include l'SMS quanto Pro (PIANI_CON_SMS) -- qui si forza un
    // piano ammesso da PIANI_CON_PROMEMORIA_COMPLEANNO ma privo di SMS non
    // esiste oggi (Pro/Enterprise hanno entrambi SMS): il caso "niente
    // email, niente SMS incluso" si verifica invece senza alcun recapito.
    const senzaRecapiti = cliente({ email: null, telefono: null });
    expect(clientiDaAvvisarePerCompleanno([senzaRecapiti], TENANT_ATTIVO, OGGI)).toEqual([]);
  });
});

describe("comporreMessaggioCompleanno", () => {
  it("usa il messaggio predefinito se il tenant non ne ha scritto uno", () => {
    expect(comporreMessaggioCompleanno(null, "Maria")).toBe(
      MESSAGGIO_COMPLEANNO_PREDEFINITO.replace("{nome}", "Maria")
    );
  });

  it("usa il template del tenant, sostituendo {nome}", () => {
    expect(comporreMessaggioCompleanno("Ciao {nome}, oggi sconto del 20% per te!", "Luca")).toBe(
      "Ciao Luca, oggi sconto del 20% per te!"
    );
  });

  it("il segnaposto è case-insensitive ({Nome}, {NOME})", () => {
    expect(comporreMessaggioCompleanno("Auguri {NOME}!", "Anna")).toBe("Auguri Anna!");
  });

  it("un template vuoto/solo spazi ricade sul predefinito", () => {
    expect(comporreMessaggioCompleanno("   ", "Anna")).toBe(
      MESSAGGIO_COMPLEANNO_PREDEFINITO.replace("{nome}", "Anna")
    );
  });
});
