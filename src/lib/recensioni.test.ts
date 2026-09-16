import { describe, expect, it } from "vitest";
import { calcolaMediaRecensioni, nomePubblicoRecensione, valutazioneValida } from "./recensioni";

describe("valutazioneValida", () => {
  it("accetta interi da 1 a 5", () => {
    expect(valutazioneValida(1)).toBe(true);
    expect(valutazioneValida(3)).toBe(true);
    expect(valutazioneValida(5)).toBe(true);
  });

  it("rifiuta 0, numeri sopra 5 e non interi", () => {
    expect(valutazioneValida(0)).toBe(false);
    expect(valutazioneValida(6)).toBe(false);
    expect(valutazioneValida(3.5)).toBe(false);
    expect(valutazioneValida(-1)).toBe(false);
  });
});

describe("nomePubblicoRecensione", () => {
  it("mostra nome + iniziale del cognome per un nome completo", () => {
    expect(nomePubblicoRecensione("Giulia Rossi")).toBe("Giulia R.");
  });

  it("mostra il nome invariato se è una sola parola", () => {
    expect(nomePubblicoRecensione("Giulia")).toBe("Giulia");
  });

  it("usa solo la prima e l'ultima parola per un nome con più parti", () => {
    expect(nomePubblicoRecensione("Maria Luisa Bianchi")).toBe("Maria B.");
  });

  it("torna 'Cliente' se il nome è assente o vuoto", () => {
    expect(nomePubblicoRecensione(null)).toBe("Cliente");
    expect(nomePubblicoRecensione("   ")).toBe("Cliente");
  });
});

describe("calcolaMediaRecensioni", () => {
  it("torna media null e totale 0 senza recensioni", () => {
    expect(calcolaMediaRecensioni([])).toEqual({ media: null, totale: 0 });
  });

  it("calcola la media arrotondata a 1 decimale", () => {
    expect(calcolaMediaRecensioni([5, 4, 5])).toEqual({ media: 4.7, totale: 3 });
  });

  it("una sola recensione: la media è quel valore", () => {
    expect(calcolaMediaRecensioni([3])).toEqual({ media: 3, totale: 1 });
  });
});
