import { describe, expect, it } from "vitest";
import {
  tabellaGiorniSettimana,
  trovaIncongruenzaGiornoSettimana,
  correggiGiornoSettimanaNelTesto,
  nomeGiornoSettimana,
} from "./giorni-settimana";

const MARTEDI_15_SETTEMBRE_2026 = new Date("2026-09-15T10:00:00Z");

describe("nomeGiornoSettimana", () => {
  it("riproduce dal vivo il 15/09/2026 (Gruppo B #5, DECISIONS.md): 20 settembre 2026 è domenica, non sabato", () => {
    // Trovato live: l'AI ha chiamato verifica_disponibilita per "domenica 20
    // settembre" ma ha risposto "chiusi" -- segno che internamente ha
    // interrogato una data diversa (19, sabato, davvero chiuso) pur scrivendo
    // il nome/data corretti nel testo finale. Questa funzione dà al tool un
    // dato pronto da restituire all'AI così non deve più calcolarlo da sola.
    expect(nomeGiornoSettimana(new Date("2026-09-20T00:00:00Z"))).toBe("domenica");
    expect(nomeGiornoSettimana(new Date("2026-09-19T00:00:00Z"))).toBe("sabato");
  });

  it("copre tutti e 7 i giorni della settimana", () => {
    const attesi = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
    for (let i = 0; i < 7; i++) {
      expect(nomeGiornoSettimana(new Date(Date.UTC(2026, 8, 13 + i)))).toBe(attesi[i]); // 13/09/2026 è domenica
    }
  });
});

describe("tabellaGiorniSettimana", () => {
  it("una riga per ciascuno dei 7 giorni della settimana, in ordine lunedì..domenica", () => {
    const tabella = tabellaGiorniSettimana(new Date("2026-09-15T10:00:00Z"), 1);
    const righe = tabella.split("\n");
    expect(righe).toHaveLength(7);
    expect(righe.map((r) => r.split(":")[0])).toEqual([
      "lunedì",
      "martedì",
      "mercoledì",
      "giovedì",
      "venerdì",
      "sabato",
      "domenica",
    ]);
  });

  it("include oggi stesso nella riga del suo giorno della settimana (15/09/2026 è martedì)", () => {
    const tabella = tabellaGiorniSettimana(new Date("2026-09-15T10:00:00Z"), 1);
    const rigaMartedi = tabella.split("\n").find((r) => r.startsWith("martedì:"));
    expect(rigaMartedi).toContain("2026-09-15");
  });

  it("riproduce esattamente il caso trovato dal vivo il 15/09/2026: il 19 settembre 2026 è sabato, non il 20", () => {
    const tabella = tabellaGiorniSettimana(new Date("2026-09-15T10:00:00Z"), 2);
    const rigaSabato = tabella.split("\n").find((r) => r.startsWith("sabato:"));
    const rigaDomenica = tabella.split("\n").find((r) => r.startsWith("domenica:"));
    expect(rigaSabato).toContain("2026-09-19");
    expect(rigaSabato).not.toContain("2026-09-20");
    expect(rigaDomenica).toContain("2026-09-20");
  });

  it("copre settimane*7 giorni consecutivi a partire da oggi, nessun buco e nessuna data ripetuta due volte nello stesso giorno della settimana", () => {
    const settimane = 8;
    const tabella = tabellaGiorniSettimana(new Date("2026-01-01T00:00:00Z"), settimane);
    const tutteLeDate = tabella
      .split("\n")
      .flatMap((riga) => riga.split(": ")[1].split(", "));
    expect(tutteLeDate).toHaveLength(settimane * 7);
    expect(new Set(tutteLeDate).size).toBe(settimane * 7); // nessun duplicato
  });

  it("tratta 'adesso' come UTC indipendentemente dall'ora del giorno passata", () => {
    const tabellaMattina = tabellaGiorniSettimana(new Date("2026-09-15T00:00:01Z"), 1);
    const tabellaSera = tabellaGiorniSettimana(new Date("2026-09-15T23:59:59Z"), 1);
    expect(tabellaMattina).toBe(tabellaSera);
  });
});

describe("trovaIncongruenzaGiornoSettimana (trovato dal vivo 15/09/2026: 'sabato sarebbe il 20 settembre' -- falso, è il 19)", () => {
  it("nessuna incongruenza quando giorno della settimana e data combaciano (data prima)", () => {
    expect(
      trovaIncongruenzaGiornoSettimana("Ho creato la prenotazione per il 19 settembre, che è sabato.", MARTEDI_15_SETTEMBRE_2026)
    ).toBeNull();
  });

  it("nessuna incongruenza quando giorno della settimana e data combaciano (giorno prima)", () => {
    expect(
      trovaIncongruenzaGiornoSettimana("Ci vediamo sabato 19 settembre alle 16:00!", MARTEDI_15_SETTEMBRE_2026)
    ).toBeNull();
  });

  it("riproduce esattamente il caso trovato dal vivo: '20 settembre' dichiarato sabato, in realtà è domenica", () => {
    const risultato = trovaIncongruenzaGiornoSettimana(
      "Quindi sabato sarebbe il 20 settembre, non il 19.",
      MARTEDI_15_SETTEMBRE_2026
    );
    expect(risultato).not.toBeNull();
    expect(risultato).toMatch(/20 settembre/);
    expect(risultato).toMatch(/domenica/);
  });

  it("rileva l'incongruenza anche nell'ordine 'data poi giorno'", () => {
    const risultato = trovaIncongruenzaGiornoSettimana("Il 19 settembre cade di domenica.", MARTEDI_15_SETTEMBRE_2026);
    expect(risultato).not.toBeNull();
    expect(risultato).toMatch(/sabato/);
  });

  it("non attraversa una frase diversa (punto in mezzo) per abbinare giorno e data", () => {
    // "sabato" qui si riferisce a un'altra frase, non al 20 settembre.
    expect(
      trovaIncongruenzaGiornoSettimana("Siamo aperti anche sabato. Il 20 settembre saremo chiusi per ferie.", MARTEDI_15_SETTEMBRE_2026)
    ).toBeNull();
  });

  it("rispetta un anno esplicito diverso da quello di 'adesso'", () => {
    // Il 19 settembre 2027 è una domenica, non un sabato -- se il cliente
    // specifica l'anno, va rispettato invece di presumere quello corrente.
    expect(
      trovaIncongruenzaGiornoSettimana("Il 19 settembre 2027 è sabato.", MARTEDI_15_SETTEMBRE_2026)
    ).not.toBeNull();
    expect(
      trovaIncongruenzaGiornoSettimana("Il 19 settembre 2027 è domenica.", MARTEDI_15_SETTEMBRE_2026)
    ).toBeNull();
  });

  it("fail-open su una data non valida (es. giorno fuori range per il mese)", () => {
    expect(trovaIncongruenzaGiornoSettimana("Il 31 settembre è sabato.", MARTEDI_15_SETTEMBRE_2026)).toBeNull();
  });

  it("fail-open se il testo non menziona affatto una combinazione giorno+data", () => {
    expect(trovaIncongruenzaGiornoSettimana("Ci vediamo domani!", MARTEDI_15_SETTEMBRE_2026)).toBeNull();
  });
});

describe("correggiGiornoSettimanaNelTesto", () => {
  it("sostituisce solo il nome del giorno sbagliato, mantenendo intatto il resto del messaggio", () => {
    const testo = "Quindi sabato sarebbe il 20 settembre, non il 19. Vuoi procedere comunque?";
    const corretto = correggiGiornoSettimanaNelTesto(testo, MARTEDI_15_SETTEMBRE_2026);
    expect(corretto).toBe("Quindi domenica sarebbe il 20 settembre, non il 19. Vuoi procedere comunque?");
    expect(corretto).toContain("Vuoi procedere comunque?");
  });

  it("preserva la maiuscola iniziale se il giorno dichiarato era capitalizzato", () => {
    const corretto = correggiGiornoSettimanaNelTesto("Sabato 20 settembre siamo aperti.", MARTEDI_15_SETTEMBRE_2026);
    expect(corretto).toContain("Domenica 20 settembre");
  });

  it("non modifica il testo se non c'è nessuna incongruenza", () => {
    const testo = "Ci vediamo sabato 19 settembre!";
    expect(correggiGiornoSettimanaNelTesto(testo, MARTEDI_15_SETTEMBRE_2026)).toBe(testo);
  });
});
