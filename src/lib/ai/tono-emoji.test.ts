import { describe, expect, it } from "vitest";
import { contieneEmoji, rimuoviEmoji } from "./tono-emoji";

describe("le emoji negli stili che non le vogliono", () => {
  it("riconosce un'emoji", () => {
    expect(contieneEmoji("Tutto fatto 🎉 Ci vediamo martedì!")).toBe(true);
    expect(contieneEmoji("Ehi! Dimmi tutto 😊")).toBe(true);
    expect(contieneEmoji("Buongiorno! Come posso aiutarla?")).toBe(false);
  });

  it("NON scambia accenti, simboli di valuta o punteggiatura per emoji", () => {
    expect(contieneEmoji("Martedì alle 09:00, sono 25 euro (25€).")).toBe(false);
    expect(contieneEmoji("Manicure -- 30 minuti; prezzo: 25,00 €")).toBe(false);
  });

  it("toglie l'emoji senza lasciare spazi doppi", () => {
    expect(rimuoviEmoji("Ecco cosa facciamo 💅 manicure e pedicure.")).toBe(
      "Ecco cosa facciamo manicure e pedicure."
    );
  });

  it("non lascia uno spazio appeso prima della punteggiatura", () => {
    expect(rimuoviEmoji("Che giorno ti va bene? 📅")).toBe("Che giorno ti va bene?");
    expect(rimuoviEmoji("Ci siamo 🎉!")).toBe("Ci siamo!");
  });

  it("lascia intatto un testo che non ne ha", () => {
    const testo = "È prenotato: mercoledì 23 alle 09:00. La aspettiamo.";
    expect(rimuoviEmoji(testo)).toBe(testo);
  });

  it("toglie anche le emoji composte (bandiere, tonalita' della pelle)", () => {
    expect(rimuoviEmoji("Ok 👍🏽 a martedì")).toBe("Ok a martedì");
  });
});
