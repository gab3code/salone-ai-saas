import { describe, expect, it } from "vitest";
import {
  APPUNTAMENTI_MASSIMI_DEMO,
  LUNGHEZZA_MASSIMA_MESSAGGIO_DEMO,
  MESSAGGI_DEMO_AL_MESE,
  MESSAGGI_PER_CONVERSAZIONE_DEMO,
  validaRichiestaDemo,
} from "./limiti-demo";

const base = { messaggio: "Avete posto giovedì?", numeroMessaggiStorico: 2, numeroAppuntamenti: 0 };

describe("validaRichiestaDemo", () => {
  it("lascia passare una richiesta normale", () => {
    expect(validaRichiestaDemo(base).ok).toBe(true);
  });

  it("rifiuta il vuoto, gli spazi e quello che non è testo", () => {
    for (const m of ["", "   ", null, 42, {}, []]) {
      expect(validaRichiestaDemo({ ...base, messaggio: m }).ok, JSON.stringify(m)).toBe(false);
    }
  });

  it("rifiuta un messaggio oltre il tetto di caratteri", () => {
    expect(validaRichiestaDemo({ ...base, messaggio: "a".repeat(LUNGHEZZA_MASSIMA_MESSAGGIO_DEMO) }).ok).toBe(true);
    expect(validaRichiestaDemo({ ...base, messaggio: "a".repeat(LUNGHEZZA_MASSIMA_MESSAGGIO_DEMO + 1) }).ok).toBe(false);
  });

  it("chiude una conversazione troppo lunga", () => {
    // Lo storico arriva dal browser: gonfiarlo è il modo più semplice di
    // farci pagare token, e questo è il controllo che lo ferma.
    const dentro = { ...base, numeroMessaggiStorico: MESSAGGI_PER_CONVERSAZIONE_DEMO * 2 };
    const fuori = { ...base, numeroMessaggiStorico: MESSAGGI_PER_CONVERSAZIONE_DEMO * 2 + 1 };
    expect(validaRichiestaDemo(dentro).ok).toBe(true);
    expect(validaRichiestaDemo(fuori).ok).toBe(false);
  });

  it("ferma chi vuole riempire l'agenda finta", () => {
    expect(validaRichiestaDemo({ ...base, numeroAppuntamenti: APPUNTAMENTI_MASSIMI_DEMO }).ok).toBe(true);
    expect(validaRichiestaDemo({ ...base, numeroAppuntamenti: APPUNTAMENTI_MASSIMI_DEMO + 1 }).ok).toBe(false);
  });
});

describe("i numeri dei tetti", () => {
  it("il tetto mensile basta per un centinaio di prove complete", () => {
    expect(MESSAGGI_DEMO_AL_MESE / 6).toBeGreaterThan(80);
  });

  it("il tetto per conversazione è molto più basso di quello mensile", () => {
    // Altrimenti una conversazione sola potrebbe consumare il mese.
    expect(MESSAGGI_PER_CONVERSAZIONE_DEMO * 10).toBeLessThan(MESSAGGI_DEMO_AL_MESE);
  });
});
