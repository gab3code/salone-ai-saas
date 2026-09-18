import { describe, expect, it } from "vitest";
import { validaBozzaGrezza, bozzaVuota } from "./onboarding-ai";

describe("validaBozzaGrezza", () => {
  it("normalizza una bozza completa e ben formata", () => {
    const bozza = validaBozzaGrezza(
      {
        orari: [
          { giorno_settimana: 1, chiuso: false, apertura: "09:00", chiusura: "19:00", pausa_inizio: "13:00", pausa_fine: "14:00" },
          { giorno_settimana: 0, chiuso: true },
        ],
        operatori: [{ nome: "Maria", descrizione: "Colorista" }],
        servizi: [{ nome: "Piega", durata_minuti: 30, prezzo_euro: 20 }],
        associazioni: [{ operatore: "Maria", servizio: "Piega" }],
        informazioni_attivita: { descrizione: "Salone in centro", indirizzo: "Via Roma 1" },
        faq: [{ domanda: "Avete parcheggio?", risposta: "Sì, gratuito." }],
        ore_minime_cancellazione: 24,
      },
      true
    );

    // Due giorni nell'input, due nella bozza: gli altri cinque non sono
    // stati nominati e non devono comparire da nessuna parte.
    expect(bozza.orari).toHaveLength(2);
    expect(bozza.orari.find((o) => o.giornoSettimana === 1)).toEqual({
      giornoSettimana: 1,
      chiuso: false,
      apertura: "09:00",
      chiusura: "19:00",
      pausaInizio: "13:00",
      pausaFine: "14:00",
    });
    expect(bozza.operatori).toEqual([{ id: null, nome: "Maria", descrizione: "Colorista" }]);
    expect(bozza.servizi).toEqual([{ id: null, nome: "Piega", durataMinuti: 30, prezzoEuro: 20 }]);
    expect(bozza.associazioni).toEqual([{ operatore: "Maria", servizio: "Piega" }]);
    expect(bozza.informazioniAttivita).toEqual({
      descrizione: "Salone in centro",
      indirizzo: "Via Roma 1",
      parcheggio: null,
      metodiPagamento: null,
    });
    expect(bozza.faq).toEqual([{ domanda: "Avete parcheggio?", risposta: "Sì, gratuito." }]);
    expect(bozza.oreMinimeCancellazione).toBe(24);
  });

  it("UN GIORNO OMESSO RESTA OMESSO: non diventa 'chiuso'", () => {
    // Fino al 18/09/2026 qui si riempivano i buchi con "chiuso", e sembrava
    // la scelta prudente. Era invece quella che ha rotto il salone di
    // Gabriel: "il sabato siamo aperti" arrivava a chi scrive come una
    // settimana intera, con sei giorni che nessuno aveva nominato.
    //
    // Il giorno omesso deve restare INVISIBILE: cosi' diffOrari non lo
    // guarda e chi applica lo lascia com'e'.
    const bozza = validaBozzaGrezza(
      { orari: [{ giorno_settimana: 2, chiuso: false, apertura: "09:00", chiusura: "18:00" }] },
      false
    );
    expect(bozza.orari).toHaveLength(1);
    expect(bozza.orari[0].giornoSettimana).toBe(2);
    expect(bozza.orari.find((o) => o.giornoSettimana === 1)).toBeUndefined();
  });

  it("i giorni escono in ordine, anche se il modello li elenca a caso", () => {
    const bozza = validaBozzaGrezza(
      {
        orari: [
          { giorno_settimana: 5, chiuso: true },
          { giorno_settimana: 1, chiuso: true },
          { giorno_settimana: 3, chiuso: true },
        ],
      },
      false
    );
    expect(bozza.orari.map((o) => o.giornoSettimana)).toEqual([1, 3, 5]);
  });

  it("un giorno detto CHIUSO resta nella bozza: quello si', e' un ordine", () => {
    // La differenza che tutta questa storia serve a preservare: "chiuso" e'
    // una cosa che il titolare ha detto, "assente" e' una cosa di cui non ha
    // parlato. La prima si applica, la seconda no.
    const bozza = validaBozzaGrezza({ orari: [{ giorno_settimana: 0, chiuso: true }] }, false);
    expect(bozza.orari).toHaveLength(1);
    expect(bozza.orari[0]).toMatchObject({ giornoSettimana: 0, chiuso: true, apertura: null });
  });

  it("l'id di una riga esistente viene conservato, un id non valido diventa null", () => {
    const bozza = validaBozzaGrezza(
      { operatori: [{ id: "op-1", nome: "Anna" }, { id: 42, nome: "Bruno" }, { nome: "Carla" }] },
      false
    );
    expect(bozza.operatori.map((o) => o.id)).toEqual(["op-1", null, null]);
  });

  it("SILENZIO SULLE ASSOCIAZIONI != ELENCO VUOTO", () => {
    // Le due cose vogliono dire l'opposto: "non ne ho parlato, lascia stare"
    // contro "nessuno esegue piu' niente". E' l'unico campo della bozza dove
    // la distinzione esiste, e perderla cancellerebbe collegamenti veri.
    expect(validaBozzaGrezza({ operatori: [{ nome: "Anna" }] }, false).associazioni).toBeNull();
    expect(validaBozzaGrezza({ associazioni: [] }, false).associazioni).toEqual([]);
  });

  it("durata e prezzo mancanti restano null, mai stimati/inventati", () => {
    const bozza = validaBozzaGrezza({ servizi: [{ nome: "Manicure" }] }, false);
    expect(bozza.servizi).toEqual([{ id: null, nome: "Manicure", durataMinuti: null, prezzoEuro: null }]);
  });

  it("un prezzo di 0€ è legittimo e distinto da 'non specificato'", () => {
    const bozza = validaBozzaGrezza({ servizi: [{ nome: "Consulenza", prezzo_euro: 0 }] }, false);
    expect(bozza.servizi[0].prezzoEuro).toBe(0);
  });

  it("scarta un servizio senza nome invece di inventarne uno", () => {
    const bozza = validaBozzaGrezza({ servizi: [{ durata_minuti: 30 }, { nome: "Valido", durata_minuti: 30 }] }, false);
    expect(bozza.servizi).toHaveLength(1);
    expect(bozza.servizi[0].nome).toBe("Valido");
  });

  it("scarta un orario in formato non valido invece di salvarlo comunque", () => {
    const bozza = validaBozzaGrezza({ orari: [{ giorno_settimana: 3, chiuso: false, apertura: "9am", chiusura: "18:00" }] }, false);
    const mercoledi = bozza.orari.find((o) => o.giornoSettimana === 3);
    expect(mercoledi?.apertura).toBeNull();
    expect(mercoledi?.chiusura).toBe("18:00");
  });

  it("i campi di knowledge base (informazioni_attivita/faq) sono sempre vuoti se il tenant non ha il piano che li include", () => {
    const bozza = validaBozzaGrezza(
      { informazioni_attivita: { descrizione: "Test" }, faq: [{ domanda: "D?", risposta: "R." }] },
      false
    );
    expect(bozza.informazioniAttivita).toBeNull();
    expect(bozza.faq).toEqual([]);
  });

  it("informazioni_attivita tutta vuota diventa null invece di un oggetto con solo campi null", () => {
    const bozza = validaBozzaGrezza({ informazioni_attivita: { descrizione: null, indirizzo: null } }, true);
    expect(bozza.informazioniAttivita).toBeNull();
  });

  it("ore_minime_cancellazione fuori range viene scartato", () => {
    expect(validaBozzaGrezza({ ore_minime_cancellazione: 1000 }, false).oreMinimeCancellazione).toBeNull();
    expect(validaBozzaGrezza({ ore_minime_cancellazione: -1 }, false).oreMinimeCancellazione).toBeNull();
    expect(validaBozzaGrezza({ ore_minime_cancellazione: 48 }, false).oreMinimeCancellazione).toBe(48);
  });

  it("fail-open completo su input totalmente malformato (mai un'eccezione)", () => {
    expect(() => validaBozzaGrezza(null, true)).not.toThrow();
    expect(() => validaBozzaGrezza("testo a caso", true)).not.toThrow();
    expect(() => validaBozzaGrezza(42, true)).not.toThrow();
    const bozza = validaBozzaGrezza(undefined, true);
    // Nessun giorno, non sette giorni chiusi: da un input illeggibile non
    // deve uscire una settimana da applicare a qualcuno.
    expect(bozza.orari).toEqual([]);
    expect(bozza.operatori).toEqual([]);
  });

  it("tronca i testi troppo lunghi agli stessi limiti delle azioni esistenti", () => {
    const bozza = validaBozzaGrezza(
      {
        operatori: [{ nome: "Maria", descrizione: "x".repeat(1000) }],
        faq: [{ domanda: "d".repeat(1000), risposta: "r".repeat(2000) }],
      },
      true
    );
    expect(bozza.operatori[0].descrizione).toHaveLength(500);
    expect(bozza.faq[0].domanda).toHaveLength(300);
    expect(bozza.faq[0].risposta).toHaveLength(1000);
  });

  it("limita il numero di operatori/servizi/faq proposti", () => {
    const bozza = validaBozzaGrezza(
      {
        operatori: Array.from({ length: 50 }, (_, i) => ({ nome: `Op${i}` })),
        servizi: Array.from({ length: 100 }, (_, i) => ({ nome: `Serv${i}` })),
        faq: Array.from({ length: 50 }, (_, i) => ({ domanda: `D${i}`, risposta: `R${i}` })),
      },
      true
    );
    expect(bozza.operatori.length).toBeLessThanOrEqual(20);
    expect(bozza.servizi.length).toBeLessThanOrEqual(40);
    expect(bozza.faq.length).toBeLessThanOrEqual(15);
  });
});

describe("bozzaVuota", () => {
  it("true su una bozza completamente vuota", () => {
    const bozza = validaBozzaGrezza({}, true);
    expect(bozzaVuota(bozza)).toBe(true);
  });

  it("false se anche un solo campo ha qualcosa (es. un operatore)", () => {
    const bozza = validaBozzaGrezza({ operatori: [{ nome: "Maria" }] }, true);
    expect(bozzaVuota(bozza)).toBe(false);
  });

  it("false se solo gli orari hanno un giorno aperto", () => {
    const bozza = validaBozzaGrezza({ orari: [{ giorno_settimana: 1, chiuso: false, apertura: "09:00", chiusura: "18:00" }] }, true);
    expect(bozzaVuota(bozza)).toBe(false);
  });
});
