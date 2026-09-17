import { describe, it, expect } from "vitest";
import {
  analizzaMessaggioOffensivo,
  eMessaggioOffensivo,
  normalizzaPerConfronto,
  applicaSostituzioni,
  RISPOSTA_MESSAGGIO_OFFENSIVO,
} from "./messaggio-offensivo";

describe("normalizzaPerConfronto", () => {
  it("toglie accenti e maiuscole", () => {
    expect(normalizzaPerConfronto("PERCHÉ")).toBe("perche");
  });

  it("NON tocca i numeri: la sostituzione e' un passo separato", () => {
    expect(normalizzaPerConfronto("c4zz0")).toBe("c4zz0");
    expect(applicaSostituzioni("c4zz0")).toBe("cazzo");
  });

  it("la punteggiatura finale resta punteggiatura", () => {
    expect(normalizzaPerConfronto("MERDA!!!")).toBe("merda!!!");
  });

  it("riduce gli spazi multipli", () => {
    expect(normalizzaPerConfronto("  ciao    a   tutti ")).toBe("ciao a tutti");
  });
});

describe("il caso che ha fatto nascere questo modulo", () => {
  it("riconosce l'insulto secco che ha ricevuto 'puoi ripetere?'", () => {
    expect(eMessaggioOffensivo("frocio")).toBe(true);
  });

  it("la risposta non chiede mai di ripetere", () => {
    expect(RISPOSTA_MESSAGGIO_OFFENSIVO.toLowerCase()).not.toContain("ripeter");
    expect(RISPOSTA_MESSAGGIO_OFFENSIVO.toLowerCase()).not.toContain("non ho capito");
  });

  it("la risposta dice comunque cosa si puo' fare", () => {
    expect(RISPOSTA_MESSAGGIO_OFFENSIVO.toLowerCase()).toContain("appuntamento");
  });
});

describe("livello odio: scatta anche dentro una frase", () => {
  const casi = [
    "frocio",
    "sei un frocio",
    "ma vaffanculo, il tuo salone fa schifo e non ci vengo piu",
    "ricchione",
    "senti mongoloide, mi prenoti questo taglio o no?",
    "terrone",
  ];
  for (const caso of casi) {
    it(`scatta su "${caso}"`, () => {
      expect(analizzaMessaggioOffensivo(caso)).toEqual({ offensivo: true, motivo: "odio" });
    });
  }
});

describe("livello odio: resiste ai trucchi per aggirarlo", () => {
  const casi = ["FROCIO", "Fr0ci0", "frooocio", "f.r.o.c.i.o", "f r o c i o", "froci0!!!"];
  for (const caso of casi) {
    it(`scatta su "${caso}"`, () => {
      expect(eMessaggioOffensivo(caso)).toBe(true);
    });
  }
});

describe("livello volgare: scatta solo sull'insulto secco", () => {
  const secchi = [
    "stronzo",
    "che cazzo",
    "sei un coglione",
    "negro",
    "troia",
    "MERDA!!!",
    "c4zz0",
    "cazzzzo",
    "fuck",
  ];
  for (const caso of secchi) {
    it(`scatta su "${caso}"`, () => {
      expect(analizzaMessaggioOffensivo(caso)).toEqual({ offensivo: true, motivo: "volgare" });
    });
  }
});

describe("livello volgare: NON scatta dentro una richiesta vera", () => {
  const veri = [
    "scusa, ho fatto una cazzata, posso spostare l'appuntamento di domani?",
    "che merda di giornata, comunque volevo prenotare un taglio per sabato",
    "sono il signor Negro, ho un appuntamento alle 15 di giovedi",
    "buongiorno, sono di Troia in provincia di Foggia, fate anche la manicure?",
    "mi sono sentito uno scemo a dimenticare l'appuntamento, posso rifissarlo per venerdi?",
  ];
  for (const caso of veri) {
    it(`lascia passare "${caso.slice(0, 40)}..."`, () => {
      expect(eMessaggioOffensivo(caso)).toBe(false);
    });
  }
});

describe("i messaggi normali non vengono mai toccati", () => {
  const normali = [
    "Vorrei taglio e piega insieme, con chi posso?",
    "buongiorno, avete posto sabato mattina?",
    "quanto costa la manicure?",
    "vorrei disdire l'appuntamento di domani, grazie",
    "fate anche la barba? con chi?",
    "ci sono ancora posti per il colore giovedi pomeriggio?",
    "il mio numero e' 333 1234567",
    "penne e pennelli",
    "ho preso un appuntamento per mia mamma",
    "avete il parcheggio?",
    "mi consigliate spaghetti alla puttanesca dopo il taglio?",
    "cerco un finocchio per la ricetta, scherzo: volevo prenotare",
  ];
  for (const caso of normali) {
    it(`lascia passare "${caso.slice(0, 40)}"`, () => {
      expect(eMessaggioOffensivo(caso)).toBe(false);
    });
  }
});

describe("robustezza", () => {
  it("non scatta sul vuoto", () => {
    expect(eMessaggioOffensivo("")).toBe(false);
    expect(eMessaggioOffensivo("   ")).toBe(false);
  });

  it("non esplode su input non testuale", () => {
    expect(eMessaggioOffensivo(null as unknown as string)).toBe(false);
    expect(eMessaggioOffensivo(undefined as unknown as string)).toBe(false);
    expect(eMessaggioOffensivo(42 as unknown as string)).toBe(false);
  });

  it("non esplode su un messaggio lunghissimo", () => {
    expect(eMessaggioOffensivo("ciao ".repeat(5000))).toBe(false);
  });
});
