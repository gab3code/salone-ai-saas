import { describe, expect, it } from "vitest";
import {
  appuntamentiDaAvvisarePerRegola,
  clientiDaAvvisarePerInattivita,
  comporreMessaggioFollowUp,
  finestraRipetizioneGiorni,
  giorniInattivitaValidi,
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
    clienteTelefono: null,
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

  it("esclude un cliente senza email e senza telefono -- non c'è dove mandare il promemoria", () => {
    const risultato = appuntamentiDaAvvisarePerRegola([appuntamento({ clienteEmail: null })], REGOLA_24H, ADESSO);
    expect(risultato).toEqual([]);
  });

  it("esclude un tenant sul piano Free/Starter -- Promemoria automatici è una funzione Growth+", () => {
    const risultato = appuntamentiDaAvvisarePerRegola([appuntamento({ tenantPiano: "starter" })], REGOLA_24H, ADESSO);
    expect(risultato).toEqual([]);
  });

  it("include un cliente senza email ma con telefono su un piano con SMS (Pro)", () => {
    const risultato = appuntamentiDaAvvisarePerRegola(
      [appuntamento({ clienteEmail: null, clienteTelefono: "+393331234567", tenantPiano: "pro" })],
      REGOLA_24H,
      ADESSO
    );
    expect(risultato.map((r) => r.id)).toEqual(["app-1"]);
  });

  it("esclude un cliente senza email ma con telefono su un piano SENZA SMS (Growth) -- l'SMS costa, non è incluso ovunque abbia i Promemoria", () => {
    const risultato = appuntamentiDaAvvisarePerRegola(
      [appuntamento({ clienteEmail: null, clienteTelefono: "+393331234567", tenantPiano: "growth" })],
      REGOLA_24H,
      ADESSO
    );
    expect(risultato).toEqual([]);
  });
});

function cliente(overrides: Partial<ClientePerPromemoriaInattivita>): ClientePerPromemoriaInattivita {
  return {
    id: "cliente-1",
    email: "cliente@example.com",
    telefono: null,
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

  it("esclude un cliente senza email e senza telefono", () => {
    const risultato = clientiDaAvvisarePerInattivita([cliente({ email: null })], new Set(["cliente-1"]), ADESSO);
    expect(risultato).toEqual([]);
  });

  it("include un cliente senza email ma con telefono su un piano con SMS (Pro)", () => {
    const risultato = clientiDaAvvisarePerInattivita(
      [cliente({ email: null, telefono: "+393331234567", tenantPiano: "pro" })],
      new Set(["cliente-1"]),
      ADESSO
    );
    expect(risultato.map((r) => r.id)).toEqual(["cliente-1"]);
  });

  it("esclude un cliente senza email ma con telefono su un piano SENZA SMS (Growth)", () => {
    const risultato = clientiDaAvvisarePerInattivita(
      [cliente({ email: null, telefono: "+393331234567", tenantPiano: "growth" })],
      new Set(["cliente-1"]),
      ADESSO
    );
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

/**
 * Follow-up configurabile (17/09/2026, migrazione 0040). Le tre cose che
 * possono andare storte in modo invisibile: una soglia sporca che fa saltare
 * il job notturno, una finestra di ripetizione che scende sotto i due mesi e
 * trasforma la fidelizzazione in spam, e un messaggio con `{nome}` su un
 * cliente che il nome non ce l'ha.
 */
describe("soglia di inattività configurabile", () => {
  it("un valore fuori dai paletti o sporco ricade sul predefinito invece di rompere il cron", () => {
    expect(giorniInattivitaValidi(90)).toBe(90);
    expect(giorniInattivitaValidi(14)).toBe(14);
    expect(giorniInattivitaValidi(365)).toBe(365);
    expect(giorniInattivitaValidi(13)).toBe(60);
    expect(giorniInattivitaValidi(366)).toBe(60);
    expect(giorniInattivitaValidi(60.5)).toBe(60);
    expect(giorniInattivitaValidi(null)).toBe(60);
    expect(giorniInattivitaValidi(undefined)).toBe(60);
  });

  it("la finestra di ripetizione non scende MAI sotto i 60 giorni", () => {
    // Il titolare decide quando un cliente è "sparito", non quanto spesso
    // gli si può riscrivere: senza questo pavimento, una soglia di 14 giorni
    // significherebbe ventisei messaggi l'anno alla stessa persona.
    expect(finestraRipetizioneGiorni(14)).toBe(60);
    expect(finestraRipetizioneGiorni(59)).toBe(60);
    expect(finestraRipetizioneGiorni(60)).toBe(60);
    // Sopra i 60, invece, segue la soglia: chi considera "sparito" un
    // cliente dopo 180 giorni non vuole riscrivergli dopo due mesi.
    expect(finestraRipetizioneGiorni(180)).toBe(180);
  });

  it("usa la finestra giusta per decidere chi è già stato avvisato di recente", () => {
    const adesso = new Date("2026-09-17T08:00:00Z");
    const avvisato40GiorniFa = new Date("2026-08-08T08:00:00Z");
    const cliente = {
      id: "c1",
      email: "c@esempio.it",
      telefono: null,
      tenantPiano: "growth",
      promemoriaInattivitaInviatoAt: avvisato40GiorniFa,
    };
    const inattivi = new Set(["c1"]);

    // Soglia bassa (20 giorni): la finestra resta 60, quindi 40 giorni fa
    // è ancora troppo recente per riscrivere.
    expect(clientiDaAvvisarePerInattivita([cliente], inattivi, adesso, 20)).toHaveLength(0);
    // Mai avvisato: parte comunque.
    expect(
      clientiDaAvvisarePerInattivita(
        [{ ...cliente, promemoriaInattivitaInviatoAt: null }],
        inattivi,
        adesso,
        20
      )
    ).toHaveLength(1);
  });
});

describe("comporreMessaggioFollowUp", () => {
  it("sostituisce {nome} e usa il testo predefinito quando non ce n'è uno", () => {
    expect(comporreMessaggioFollowUp(null, "Giulia")).toContain("Ciao Giulia");
    expect(comporreMessaggioFollowUp("  ", "Giulia")).toContain("Ciao Giulia");
    expect(comporreMessaggioFollowUp("Ehi {nome}, torna a trovarci!", "Marco")).toBe(
      "Ehi Marco, torna a trovarci!"
    );
  });

  it("su un cliente senza nome non lascia 'Ciao ,' con lo spazio prima della virgola", () => {
    expect(comporreMessaggioFollowUp(null, null)).toBe(
      "Ciao, è passato un po' dal tuo ultimo appuntamento — ti aspettiamo!"
    );
    expect(comporreMessaggioFollowUp("Ciao {nome}!", "   ")).toBe("Ciao!");
  });
});
