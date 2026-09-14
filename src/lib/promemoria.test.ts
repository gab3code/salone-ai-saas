import { describe, expect, it } from "vitest";
import {
  appuntamentiDaAvvisarePerRegola,
  clientiDaAvvisarePerInattivita,
  type AppuntamentoPerPromemoria,
  type ClientePerPromemoriaInattivita,
  type RegolaPromemoria,
} from "./promemoria";

const ADESSO = new Date(Date.UTC(2026, 8, 14, 8, 0, 0)); // 2026-09-14 08:00 UTC
const ORA = 60 * 60 * 1000;
const GIORNO = 24 * ORA;

const REGOLA_24H: RegolaPromemoria = { id: "regola-24h", orePreavviso: 24 };
const REGOLA_72H: RegolaPromemoria = { id: "regola-72h", orePreavviso: 72 };

function appuntamento(overrides: Partial<AppuntamentoPerPromemoria>): AppuntamentoPerPromemoria {
  return {
    id: "app-1",
    inizio: new Date(ADESSO.getTime() + 30 * ORA), // dentro la finestra 24-48h della regola di default
    stato: "confermato",
    clienteEmail: "cliente@example.com",
    tenantPiano: "growth",
    regoleGiaInviate: new Set(),
    ...overrides,
  };
}

describe("appuntamentiDaAvvisarePerRegola", () => {
  it("include un appuntamento confermato, su piano Growth+, nella finestra 24-48h della regola, con email e mai avvisato per QUESTA regola", () => {
    const risultato = appuntamentiDaAvvisarePerRegola([appuntamento({})], REGOLA_24H, ADESSO);
    expect(risultato.map((r) => r.id)).toEqual(["app-1"]);
  });

  it("una regola con preavviso più lungo (72h) usa la sua stessa finestra di 24h, non quella di un'altra regola", () => {
    const risultato = appuntamentiDaAvvisarePerRegola(
      [appuntamento({ inizio: new Date(ADESSO.getTime() + 80 * ORA) })],
      REGOLA_72H,
      ADESSO
    );
    expect(risultato.map((r) => r.id)).toEqual(["app-1"]);
  });

  it("esclude un appuntamento troppo vicino per la regola scelta (meno di 24h con la regola a 24h)", () => {
    const risultato = appuntamentiDaAvvisarePerRegola(
      [appuntamento({ inizio: new Date(ADESSO.getTime() + 10 * ORA) })],
      REGOLA_24H,
      ADESSO
    );
    expect(risultato).toEqual([]);
  });

  it("esclude un appuntamento troppo lontano per la regola scelta (oltre 48h con la regola a 24h)", () => {
    const risultato = appuntamentiDaAvvisarePerRegola(
      [appuntamento({ inizio: new Date(ADESSO.getTime() + 60 * ORA) })],
      REGOLA_24H,
      ADESSO
    );
    expect(risultato).toEqual([]);
  });

  it("esclude un appuntamento cancellato, anche se altrimenti nella finestra giusta", () => {
    const risultato = appuntamentiDaAvvisarePerRegola([appuntamento({ stato: "cancellato" })], REGOLA_24H, ADESSO);
    expect(risultato).toEqual([]);
  });

  it("esclude un appuntamento già avvisato PER QUESTA regola -- mai due volte lo stesso promemoria", () => {
    const risultato = appuntamentiDaAvvisarePerRegola(
      [appuntamento({ regoleGiaInviate: new Set(["regola-24h"]) })],
      REGOLA_24H,
      ADESSO
    );
    expect(risultato).toEqual([]);
  });

  it("un appuntamento già avvisato per una regola può comunque ricevere il promemoria di UN'ALTRA regola -- è il punto di avere più regole", () => {
    const risultato = appuntamentiDaAvvisarePerRegola(
      [
        appuntamento({
          inizio: new Date(ADESSO.getTime() + 30 * ORA),
          regoleGiaInviate: new Set(["regola-72h"]), // già avvisato per la 72h, non per la 24h
        }),
      ],
      REGOLA_24H,
      ADESSO
    );
    expect(risultato.map((r) => r.id)).toEqual(["app-1"]);
  });

  it("esclude un cliente senza email -- non c'è dove mandare il promemoria", () => {
    const risultato = appuntamentiDaAvvisarePerRegola([appuntamento({ clienteEmail: null })], REGOLA_24H, ADESSO);
    expect(risultato).toEqual([]);
  });

  it("esclude un tenant sul piano Free/Starter -- Promemoria automatici è una funzione Growth+", () => {
    const risultato = appuntamentiDaAvvisarePerRegola([appuntamento({ tenantPiano: "starter" })], REGOLA_24H, ADESSO);
    expect(risultato).toEqual([]);
  });
});

function cliente(overrides: Partial<ClientePerPromemoriaInattivita>): ClientePerPromemoriaInattivita {
  return {
    id: "cliente-1",
    email: "cliente@example.com",
    tenantPiano: "growth",
    promemoriaInattivitaInviatoAt: null,
    ...overrides,
  };
}

describe("clientiDaAvvisarePerInattivita", () => {
  it("include un cliente inattivo, su piano Growth+, con email, mai avvisato prima", () => {
    const risultato = clientiDaAvvisarePerInattivita([cliente({})], new Set(["cliente-1"]), ADESSO);
    expect(risultato.map((r) => r.id)).toEqual(["cliente-1"]);
  });

  it("esclude un cliente che non è nell'elenco degli inattivi (stessa regola di elencaClientiInattivi, non ricalcolata qui)", () => {
    const risultato = clientiDaAvvisarePerInattivita([cliente({})], new Set(), ADESSO);
    expect(risultato).toEqual([]);
  });

  it("esclude un cliente senza email", () => {
    const risultato = clientiDaAvvisarePerInattivita([cliente({ email: null })], new Set(["cliente-1"]), ADESSO);
    expect(risultato).toEqual([]);
  });

  it("esclude un tenant sotto Growth", () => {
    const risultato = clientiDaAvvisarePerInattivita(
      [cliente({ tenantPiano: "free" })],
      new Set(["cliente-1"]),
      ADESSO
    );
    expect(risultato).toEqual([]);
  });

  it("esclude un cliente già avvisato negli ultimi 60 giorni -- niente spam ripetuto ogni giorno", () => {
    const risultato = clientiDaAvvisarePerInattivita(
      [cliente({ promemoriaInattivitaInviatoAt: new Date(ADESSO.getTime() - 30 * GIORNO) })],
      new Set(["cliente-1"]),
      ADESSO
    );
    expect(risultato).toEqual([]);
  });

  it("include di nuovo un cliente avvisato più di 60 giorni fa e ancora inattivo -- un secondo tentativo è legittimo", () => {
    const risultato = clientiDaAvvisarePerInattivita(
      [cliente({ promemoriaInattivitaInviatoAt: new Date(ADESSO.getTime() - 61 * GIORNO) })],
      new Set(["cliente-1"]),
      ADESSO
    );
    expect(risultato.map((r) => r.id)).toEqual(["cliente-1"]);
  });
});
