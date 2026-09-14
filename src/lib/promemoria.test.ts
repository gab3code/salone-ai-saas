import { describe, expect, it } from "vitest";
import {
  appuntamentiDaAvvisare,
  clientiDaAvvisarePerInattivita,
  type AppuntamentoPerPromemoria,
  type ClientePerPromemoriaInattivita,
} from "./promemoria";

const ADESSO = new Date(Date.UTC(2026, 8, 14, 8, 0, 0)); // 2026-09-14 08:00 UTC
const ORA = 60 * 60 * 1000;
const GIORNO = 24 * ORA;

function appuntamento(overrides: Partial<AppuntamentoPerPromemoria>): AppuntamentoPerPromemoria {
  return {
    id: "app-1",
    inizio: new Date(ADESSO.getTime() + 30 * ORA), // dentro la finestra 24-48h di default
    stato: "confermato",
    promemoriaInviatoAt: null,
    clienteEmail: "cliente@example.com",
    tenantPiano: "growth",
    ...overrides,
  };
}

describe("appuntamentiDaAvvisare", () => {
  it("include un appuntamento confermato, su piano Growth+, nella finestra 24-48h, con email e mai avvisato", () => {
    const risultato = appuntamentiDaAvvisare([appuntamento({})], ADESSO);
    expect(risultato.map((r) => r.id)).toEqual(["app-1"]);
  });

  it("esclude un appuntamento troppo vicino (meno di 24h) -- lo prenderà eventualmente un giro successivo se resta in finestra, altrimenti niente reminder per quello specifico orario", () => {
    const risultato = appuntamentiDaAvvisare([appuntamento({ inizio: new Date(ADESSO.getTime() + 10 * ORA) })], ADESSO);
    expect(risultato).toEqual([]);
  });

  it("esclude un appuntamento troppo lontano (oltre 48h)", () => {
    const risultato = appuntamentiDaAvvisare([appuntamento({ inizio: new Date(ADESSO.getTime() + 60 * ORA) })], ADESSO);
    expect(risultato).toEqual([]);
  });

  it("esclude un appuntamento cancellato, anche se altrimenti nella finestra giusta", () => {
    const risultato = appuntamentiDaAvvisare([appuntamento({ stato: "cancellato" })], ADESSO);
    expect(risultato).toEqual([]);
  });

  it("esclude un appuntamento già avvisato -- mai due promemoria per lo stesso appuntamento", () => {
    const risultato = appuntamentiDaAvvisare(
      [appuntamento({ promemoriaInviatoAt: new Date(ADESSO.getTime() - ORA) })],
      ADESSO
    );
    expect(risultato).toEqual([]);
  });

  it("esclude un cliente senza email -- non c'è dove mandare il promemoria", () => {
    const risultato = appuntamentiDaAvvisare([appuntamento({ clienteEmail: null })], ADESSO);
    expect(risultato).toEqual([]);
  });

  it("esclude un tenant sul piano Free/Starter -- Promemoria automatici è una funzione Growth+", () => {
    const risultato = appuntamentiDaAvvisare([appuntamento({ tenantPiano: "starter" })], ADESSO);
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
