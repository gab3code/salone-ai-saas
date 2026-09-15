import { describe, expect, it } from "vitest";
import { pulisciMarkdown } from "./pulisci-markdown";

describe("pulisciMarkdown", () => {
  it("non tocca il testo semplice", () => {
    expect(pulisciMarkdown("La pedicure costa 40 euro e dura 30 minuti.")).toBe(
      "La pedicure costa 40 euro e dura 30 minuti."
    );
  });

  it("toglie il grassetto (** e __) mantenendo il testo", () => {
    expect(pulisciMarkdown("**Manicure** disponibile oggi")).toBe("Manicure disponibile oggi");
    expect(pulisciMarkdown("__Manicure__ disponibile oggi")).toBe("Manicure disponibile oggi");
  });

  it("toglie il corsivo (singolo * o _) mantenendo il testo", () => {
    expect(pulisciMarkdown("*Nota*: chiuso la domenica")).toBe("Nota: chiuso la domenica");
    expect(pulisciMarkdown("_Nota_: chiuso la domenica")).toBe("Nota: chiuso la domenica");
  });

  it("toglie i titoli markdown a inizio riga", () => {
    expect(pulisciMarkdown("# Orari\nSiamo aperti dal lunedì al sabato")).toBe(
      "Orari\nSiamo aperti dal lunedì al sabato"
    );
    expect(pulisciMarkdown("## Orari")).toBe("Orari");
  });

  it("toglie i trattini/asterischi degli elenchi puntati a inizio riga, mantenendo gli a capo", () => {
    const risultato = pulisciMarkdown(
      "Offriamo due servizi:\n\n- Manicure: 30 minuti a 25 euro\n- Pedicure: 30 minuti a 40 euro\n\nVuoi prenotarne uno?"
    );
    expect(risultato).toBe(
      "Offriamo due servizi:\n\nManicure: 30 minuti a 25 euro\nPedicure: 30 minuti a 40 euro\n\nVuoi prenotarne uno?"
    );
  });

  it("toglie anche gli elenchi con punto elenco unicode (•)", () => {
    expect(pulisciMarkdown("• Manicure\n• Pedicure")).toBe("Manicure\nPedicure");
  });

  it("non tocca un trattino usato come normale punteggiatura a metà frase", () => {
    expect(pulisciMarkdown("Il salone è aperto 9-19 tutti i giorni.")).toBe(
      "Il salone è aperto 9-19 tutti i giorni."
    );
  });

  it("comprime tre o più righe vuote consecutive a una sola riga vuota", () => {
    expect(pulisciMarkdown("Prima parte\n\n\n\nSeconda parte")).toBe("Prima parte\n\nSeconda parte");
  });

  it("elimina spazi bianchi superflui a inizio e fine", () => {
    expect(pulisciMarkdown("  Ciao!  \n")).toBe("Ciao!");
  });
});
