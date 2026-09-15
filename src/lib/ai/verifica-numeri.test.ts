import { describe, expect, it } from "vitest";
import {
  trovaIncongruenzaPrezzoDurata,
  trovaIncongruenzaCaparra,
  correggiImportoCaparraNelTesto,
  type ServizioReale,
} from "./verifica-numeri";

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

describe("trovaIncongruenzaCaparra (trovato dal vivo 15/09/2026: AI ha detto 25 euro invece di 5)", () => {
  it("nessuna incongruenza se l'importo dichiarato combacia con quello reale", () => {
    expect(
      trovaIncongruenzaCaparra("Questa attività richiede una caparra di 5 euro per confermare.", 5)
    ).toBeNull();
  });

  it("riproduce esattamente il caso trovato dal vivo: 25 euro dichiarati, 5 reali", () => {
    const risultato = trovaIncongruenzaCaparra(
      "Questa attività richiede una caparra di 25 euro per confermare. Basta completare il pagamento di 25 euro da questo link.",
      5
    );
    expect(risultato).not.toBeNull();
    expect(risultato).toMatch(/25€/);
    expect(risultato).toMatch(/5€/);
  });

  it("non confonde l'importo della caparra con il prezzo pieno del servizio menzionato altrove nello stesso messaggio", () => {
    // Il prezzo pieno (25€) compare lontano dalla parola "caparra": non deve
    // essere scambiato per l'importo dichiarato della caparra stessa.
    const testo =
      "La manicure che hai scelto costa 25 euro in totale. Per confermare la prenotazione è richiesta una caparra di 5 euro, che puoi pagare qui.";
    expect(trovaIncongruenzaCaparra(testo, 5)).toBeNull();
  });

  it("fail-open se il messaggio non nomina affatto la caparra", () => {
    expect(trovaIncongruenzaCaparra("Ci vediamo sabato alle 10:00, a presto!", 5)).toBeNull();
  });

  it("accetta il formato con la virgola e il simbolo € oltre alla parola per esteso", () => {
    expect(trovaIncongruenzaCaparra("Caparra richiesta: 5,00 €.", 5)).toBeNull();
    expect(trovaIncongruenzaCaparra("Caparra richiesta: 7,50 €.", 5)).not.toBeNull();
  });

  it("riconosce l'importo anche quando precede la parola caparra", () => {
    expect(trovaIncongruenzaCaparra("25€ di caparra per confermare.", 5)).not.toBeNull();
    expect(trovaIncongruenzaCaparra("5€ di caparra per confermare.", 5)).toBeNull();
  });

  it("un importo in una FRASE DIVERSA (separata da un punto) non conta come 'vicino' anche se più corto in caratteri di quello nella stessa frase", () => {
    // "25 euro" è a soli 5 caratteri da "caparra" ma in un'altra frase (c'è
    // un punto in mezzo); "30 euro" è più lontano in caratteri ma nella
    // STESSA frase della caparra -- deve vincere quest'ultimo.
    const testo = "La manicure costa 25 euro. La caparra richiesta è di 30 euro.";
    expect(trovaIncongruenzaCaparra(testo, 30)).toBeNull();
    expect(trovaIncongruenzaCaparra(testo, 5)).not.toBeNull();
  });
});

describe("correggiImportoCaparraNelTesto", () => {
  it("sostituisce solo la cifra vicino a 'caparra', mantenendo intatto il resto del messaggio (link incluso)", () => {
    const testo =
      "Questa attività richiede una caparra di 25 euro per confermare. Ecco il link: https://checkout.stripe.com/pay/cs_test_abc123";
    const corretto = correggiImportoCaparraNelTesto(testo, 5);
    expect(corretto).toContain("caparra di 5 euro");
    expect(corretto).toContain("https://checkout.stripe.com/pay/cs_test_abc123");
  });

  it("non tocca un importo già corretto nel resto del testo (es. il prezzo pieno del servizio) quando corregge la caparra", () => {
    const testo = "La manicure costa 25 euro. La caparra richiesta è di 30 euro.";
    const corretto = correggiImportoCaparraNelTesto(testo, 5);
    expect(corretto).toContain("manicure costa 25 euro");
    expect(corretto).toContain("caparra richiesta è di 5 euro");
  });

  it("gestisce anche il formato con l'importo prima della parola caparra", () => {
    expect(correggiImportoCaparraNelTesto("Serve un acconto, la caparra è 25€, grazie", 5)).toContain("5€");
  });

  it("non modifica il testo se non nomina affatto la caparra (fail-open)", () => {
    const testo = "Ci vediamo sabato alle 10:00!";
    expect(correggiImportoCaparraNelTesto(testo, 5)).toBe(testo);
  });
});
