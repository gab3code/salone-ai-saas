import { describe, expect, it } from "vitest";
import { SOGLIA_AVVISO_QUOTA_AI } from "./avviso-quota.server";
import { limiteMensileMessaggi } from "./limiti";

describe("la soglia dell'avviso di quota", () => {
  it("scatta prima che la quota finisca, non quando è già finita", () => {
    // Un avviso che arriva a quota esaurita non serve a niente: il danno
    // (l'assistente che smette di rispondere ai clienti) è già fatto.
    expect(SOGLIA_AVVISO_QUOTA_AI).toBeGreaterThan(0.5);
    expect(SOGLIA_AVVISO_QUOTA_AI).toBeLessThan(1);
  });

  it("lascia un margine utile per reagire su ogni piano con AI", () => {
    // Fra la soglia e il tetto devono restare abbastanza messaggi da avere il
    // tempo di passare al piano superiore: almeno una trentina, cioè qualche
    // giorno di lavoro normale.
    for (const piano of ["growth", "pro"]) {
      const limite = limiteMensileMessaggi(piano);
      expect(limite - limite * SOGLIA_AVVISO_QUOTA_AI, piano).toBeGreaterThan(30);
    }
  });
});

describe("i tetti dopo la revisione del 17/09/2026", () => {
  it("Growth regge un salone che va bene", () => {
    // Una prenotazione via chat sono 6-10 messaggi. Sotto le 250
    // conversazioni al mese (8 al giorno) il tetto tornerebbe a essere un
    // problema per un salone attivo, non una difesa contro l'abuso.
    expect(limiteMensileMessaggi("growth") / 10).toBeGreaterThanOrEqual(250);
  });

  it("Pro resta nettamente sopra Growth, e scala con gli operatori", () => {
    expect(limiteMensileMessaggi("pro")).toBeGreaterThan(limiteMensileMessaggi("growth"));
    expect(limiteMensileMessaggi("pro", 3)).toBe(limiteMensileMessaggi("pro", 1) * 3);
  });
});
