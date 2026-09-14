import { describe, it, expect } from "vitest";
import { calcolaAndamentoSettimanale } from "./analytics";

describe("calcolaAndamentoSettimanale", () => {
  // Mercoledì 2026-09-16 -- la sua settimana (lun-dom) va dal 14/09 al 20/09.
  const adesso = new Date("2026-09-16T12:00:00Z");

  it("ritorna il numero di settimane richiesto, dal più vecchio al più recente", () => {
    const punti = calcolaAndamentoSettimanale([], [], adesso, 4);
    expect(punti).toHaveLength(4);
    expect(punti[0].inizioSettimana < punti[3].inizioSettimana).toBe(true);
    // L'ultimo punto è la settimana corrente (lunedì 14/09).
    expect(punti[3].inizioSettimana.toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("conta solo gli appuntamenti confermati nella settimana giusta", () => {
    const punti = calcolaAndamentoSettimanale(
      [
        { inizio: new Date("2026-09-15T10:00:00Z"), stato: "confermato" }, // settimana corrente
        { inizio: new Date("2026-09-15T10:00:00Z"), stato: "cancellato" }, // stessa settimana, ma cancellato -- non conta
        { inizio: new Date("2026-09-08T10:00:00Z"), stato: "confermato" }, // settimana precedente
      ],
      [],
      adesso,
      2
    );
    expect(punti[0].prenotazioniConfermate).toBe(1); // settimana del 08/09
    expect(punti[1].prenotazioniConfermate).toBe(1); // settimana del 14/09
  });

  it("conta i nuovi clienti nella settimana in cui sono stati creati", () => {
    const punti = calcolaAndamentoSettimanale(
      [],
      [{ createdAt: new Date("2026-09-15T08:00:00Z") }, { createdAt: new Date("2026-09-01T08:00:00Z") }],
      adesso,
      3
    );
    expect(punti[2].nuoviClienti).toBe(1); // settimana corrente
    expect(punti[0].nuoviClienti + punti[1].nuoviClienti).toBe(1); // l'altro, più vecchio, in una settimana precedente
  });

  it("un appuntamento esattamente a mezzanotte di lunedì appartiene a quella settimana, non alla precedente", () => {
    const punti = calcolaAndamentoSettimanale(
      [{ inizio: new Date("2026-09-14T00:00:00.000Z"), stato: "confermato" }],
      [],
      adesso,
      1
    );
    expect(punti[0].prenotazioniConfermate).toBe(1);
  });

  it("con zero dati, tutti i punti sono a zero (nessuna divisione o errore)", () => {
    const punti = calcolaAndamentoSettimanale([], [], adesso, 6);
    expect(punti.every((p) => p.prenotazioniConfermate === 0 && p.nuoviClienti === 0)).toBe(true);
  });
});
