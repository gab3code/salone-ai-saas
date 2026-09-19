import { describe, expect, it } from "vitest";
import {
  orariNelTesto,
  orariChiestiDalCliente,
  orariConsentiti,
  trovaOrarioInventato,
  trovaOrarioConfermatoSbagliato,
  oraDiInizioPrenotata,
  confermaConOrarioVero,
  FRASE_ORARI_NON_VERIFICATI,
} from "./verifica-orari";

describe("orariNelTesto", () => {
  it("prende gli orari con i due punti e li normalizza", () => {
    expect(orariNelTesto("8:00, 9:00 e 14:30")).toEqual(["08:00", "09:00", "14:30"]);
  });

  it("NON scambia prezzi e durate per orari", () => {
    expect(orariNelTesto("La manicure dura 30 minuti e costa 25 euro.")).toEqual([]);
    expect(orariNelTesto("Sono 45 minuti, 40 euro.")).toEqual([]);
  });

  it("lascia stare 'alle 8' senza minuti, che e' ambiguo", () => {
    expect(orariNelTesto("Ti aspetto alle 8")).toEqual([]);
  });
});

describe("orariConsentiti", () => {
  it("estrae gli orari dagli ISO di un risultato di verifica_disponibilita", () => {
    const risultato = JSON.stringify({
      slot: [
        { inizio: "2026-09-22T08:00:00.000Z", fine: "2026-09-22T08:30:00.000Z" },
        { inizio: "2026-09-22T09:30:00.000Z", fine: "2026-09-22T10:00:00.000Z" },
      ],
    });
    const consentiti = orariConsentiti([risultato]);
    expect(consentiti.has("08:00")).toBe(true);
    expect(consentiti.has("09:30")).toBe(true);
    expect(consentiti.has("12:00")).toBe(false);
  });

  it("estrae anche gli orari di apertura in formato HH:MM:SS", () => {
    const risultato = JSON.stringify({ apertura: "08:00:00", chiusura: "18:00:00" });
    const consentiti = orariConsentiti([risultato]);
    expect(consentiti.has("08:00")).toBe(true);
    expect(consentiti.has("18:00")).toBe(true);
  });
});

describe("trovaOrarioInventato", () => {
  /** La lista vera scritta al cliente il 19/09, pausa pranzo compresa. */
  it("prende la lista inventata del 19/09/2026", () => {
    const soloVeri = orariConsentiti([
      JSON.stringify({
        slot: [
          { inizio: "2026-09-22T08:00:00.000Z" },
          { inizio: "2026-09-22T09:00:00.000Z" },
        ],
      }),
    ]);
    const problema = trovaOrarioInventato(
      "Gli orari disponibili sono: 8:00, 9:00, 10:00, 11:00, 12:00, 13:00, 14:00",
      soloVeri
    );
    expect(problema).toMatch(/non risultano da nessuno strumento/i);
    expect(problema).toContain("12:00");
    expect(problema).toContain("13:00");
    expect(problema).not.toContain("08:00");
  });

  it("scatta anche quando NESSUNO strumento e' stato chiamato", () => {
    expect(trovaOrarioInventato("Ho libero alle 8:00 e alle 9:00.", new Set())).not.toBeNull();
  });

  /** La meta' che evita che la rete venga spenta dopo due giorni. */
  it("NON scatta su un orario che il cliente ha appena scritto", () => {
    const consentiti = orariConsentiti(["vorrei prenotare alle 8:00"]);
    expect(trovaOrarioInventato("Perfetto, martedì alle 8:00 per la manicure.", consentiti)).toBeNull();
  });

  it("NON scatta quando gli orari vengono davvero dallo strumento", () => {
    const consentiti = orariConsentiti([
      JSON.stringify({ slot: [{ inizio: "2026-09-22T08:00:00.000Z" }, { inizio: "2026-09-22T15:30:00.000Z" }] }),
    ]);
    expect(trovaOrarioInventato("Ho libero alle 8:00 e alle 15:30.", consentiti)).toBeNull();
  });

  it("NON scatta su un messaggio senza nessun orario", () => {
    expect(trovaOrarioInventato("La manicure dura 30 minuti e costa 25 euro.", new Set())).toBeNull();
  });

  it("la frase di ripiego non contiene nessun orario", () => {
    expect(orariNelTesto(FRASE_ORARI_NON_VERIFICATI)).toEqual([]);
  });
});

describe("orariChiestiDalCliente -- le ore secche nei messaggi del cliente", () => {
  /**
   * IL CASO VERO, 19/09/2026 (seconda chat segnalata da Gabriel). Il cliente
   * scrive "alle 16", l'assistente risponde con "16:00" e il controllo lo
   * scambia per un orario inventato: al cliente arriva "Scusa, non riesco a
   * dirti gli orari liberi" mentre stava dicendo l'ora che voleva.
   */
  it("riconosce 'alle 16'", () => {
    expect(orariChiestiDalCliente("va bene alle 16")).toContain("16:00");
  });

  it("riconosce 'verso le 9 e mezza' e 'alle 10 e un quarto'", () => {
    expect(orariChiestiDalCliente("verso le 9 e mezza")).toContain("09:30");
    expect(orariChiestiDalCliente("alle 10 e un quarto")).toContain("10:15");
  });

  it("legge anche il pomeriggio quando il cliente lo dice", () => {
    const orari = orariChiestiDalCliente("alle 4 del pomeriggio");
    expect(orari).toContain("16:00");
    expect(orari).toContain("04:00");
  });

  it("NON scambia un numero qualunque per un orario", () => {
    expect(orariChiestiDalCliente("ho 16 anni")).toEqual([]);
    expect(orariChiestiDalCliente("siamo in 4")).toEqual([]);
    expect(orariChiestiDalCliente("costa 25 euro")).toEqual([]);
  });

  it("l'ora secca del cliente rende lecito l'orario scritto per esteso", () => {
    const consentiti = orariConsentiti([], ["mi va bene alle 16"]);
    expect(trovaOrarioInventato("Perfetto, allora alle 16:00.", consentiti)).toBeNull();
  });

  it("un'ora secca scritta dall'ASSISTENTE non rende lecito niente", () => {
    // i messaggi dell'assistente non passano mai da qui: e' la cosa di cui
    // stiamo dubitando (vedi l'intestazione del modulo).
    const consentiti = orariConsentiti([], []);
    expect(trovaOrarioInventato("Ti aspetto alle 16:00.", consentiti)).not.toBeNull();
  });
});

describe("trovaOrarioConfermatoSbagliato -- l'ora scritta deve essere l'ora prenotata", () => {
  /**
   * IL CASO VERO, 19/09/2026: nel database le 09:00, nel messaggio "09:30".
   * Tutto vero tranne l'unica cosa che il cliente si segna.
   */
  it("scatta quando la conferma nomina un'ora diversa da quella prenotata", () => {
    const problema = trovaOrarioConfermatoSbagliato("È tutto confermato per le 09:30.", "09:00");
    expect(problema).toContain("09:30");
    expect(problema).toContain("09:00");
  });

  it("NON scatta quando l'ora coincide", () => {
    expect(trovaOrarioConfermatoSbagliato("È tutto confermato per le 9:00.", "09:00")).toBeNull();
  });

  it("NON scatta quando in questo turno non e' stato prenotato niente", () => {
    expect(trovaOrarioConfermatoSbagliato("Ho libero alle 09:30 e alle 10:00.", null)).toBeNull();
  });

  it("legge l'ora dall'inizio passato allo strumento", () => {
    expect(oraDiInizioPrenotata("2026-09-22T09:00")).toBe("09:00");
    expect(oraDiInizioPrenotata(null)).toBeNull();
    expect(oraDiInizioPrenotata("non una data")).toBeNull();
  });

  it("la conferma scritta da noi porta la data e l'ora vere, e passa il suo stesso controllo", () => {
    const frase = confermaConOrarioVero("2026-09-22T09:00");
    expect(frase).toContain("09:00");
    expect(frase).toContain("22 settembre 2026");
    expect(trovaOrarioConfermatoSbagliato(frase, "09:00")).toBeNull();
  });
});
