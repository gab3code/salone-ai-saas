import { describe, expect, it } from "vitest";
import { trovaIncongruenzaPrezzoDurata, type ServizioReale } from "./verifica-numeri";

const SERVIZI: ServizioReale[] = [
  { nome: "pedicure", durataMinuti: 30, prezzoEuro: 40 },
  { nome: "manicure", durataMinuti: 30, prezzoEuro: 25 },
];

describe("trovaIncongruenzaPrezzoDurata", () => {
  it("nessuna incongruenza se prezzo e durata dichiarati combaciano con la realtà", () => {
    expect(trovaIncongruenzaPrezzoDurata("La manicure costa 25 euro e dura 30 minuti.", SERVIZI)).toBeNull();
  });

  it("rileva un prezzo sbagliato per un servizio univocamente menzionato", () => {
    const risultato = trovaIncongruenzaPrezzoDurata("La manicure costa 35 euro e dura 30 minuti.", SERVIZI);
    expect(risultato).not.toBeNull();
    expect(risultato).toMatch(/manicure/i);
    expect(risultato).toMatch(/35€/);
    expect(risultato).toMatch(/25€/);
  });

  it("rileva una durata sbagliata per un servizio univocamente menzionato", () => {
    const risultato = trovaIncongruenzaPrezzoDurata("La manicure costa 25 euro e dura 25 minuti.", SERVIZI);
    expect(risultato).not.toBeNull();
    expect(risultato).toMatch(/25 minuti.*30 minuti|30 minuti.*25 minuti/);
  });

  it("rileva entrambi gli errori insieme", () => {
    const risultato = trovaIncongruenzaPrezzoDurata("La manicure costa 35 euro e dura 25 minuti.", SERVIZI);
    expect(risultato).not.toBeNull();
    expect(risultato).toMatch(/35€/);
    expect(risultato).toMatch(/25 minuti/);
  });

  it("non valida nulla se il testo menziona più di un servizio (evita falsi positivi su risposte ambigue)", () => {
    expect(
      trovaIncongruenzaPrezzoDurata("Sia la pedicure che la manicure sono disponibili, quale preferisci?", SERVIZI)
    ).toBeNull();
  });

  it("non valida nulla se nessun servizio reale è menzionato nel testo", () => {
    expect(trovaIncongruenzaPrezzoDurata("Avete parcheggio gratuito qui vicino.", SERVIZI)).toBeNull();
  });

  it("fail-open con lista servizi vuota (nessun dato da controllare)", () => {
    expect(trovaIncongruenzaPrezzoDurata("La manicure costa 999 euro.", [])).toBeNull();
  });

  it("accetta il formato con la virgola per i decimali", () => {
    const conServizioDecimale: ServizioReale[] = [{ nome: "colore", durataMinuti: 60, prezzoEuro: 45.5 }];
    expect(trovaIncongruenzaPrezzoDurata("Il colore costa 45,50 euro e dura 60 minuti.", conServizioDecimale)).toBeNull();
    expect(trovaIncongruenzaPrezzoDurata("Il colore costa 50,00 euro e dura 60 minuti.", conServizioDecimale)).not.toBeNull();
  });

  it("riconosce il simbolo € oltre alla parola per esteso", () => {
    expect(trovaIncongruenzaPrezzoDurata("La manicure costa 35€ e dura 30 minuti.", SERVIZI)).not.toBeNull();
  });
});
