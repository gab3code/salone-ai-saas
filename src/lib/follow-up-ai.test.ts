import { describe, expect, it } from "vitest";
import {
  messaggioFollowUpAccettabile,
  promptFollowUp,
  MAX_CARATTERI_FOLLOW_UP,
} from "./follow-up-ai";

describe("cosa si chiede al modello", () => {
  it("dice da quanto manca e cosa aveva fatto", () => {
    const prompt = promptFollowUp({
      nomeCliente: "Giulia",
      nomeSalone: "Salone Rosa",
      giorniDaUltimaVisita: 75,
      ultimoServizio: "Colore",
    });
    expect(prompt).toContain("Giulia");
    expect(prompt).toContain("75");
    expect(prompt).toContain("Colore");
  });

  it("senza nome, dice esplicitamente di non usarlo", () => {
    // Senza questa riga il modello scrive "Ciao null" oppure si inventa un
    // nome, che e' peggio.
    const prompt = promptFollowUp({
      nomeCliente: null,
      nomeSalone: "Salone Rosa",
      giorniDaUltimaVisita: 60,
      ultimoServizio: null,
    });
    expect(prompt).toContain("non usarlo");
    expect(prompt).not.toContain("Ultima volta");
  });
});

describe("cosa si rifiuta di spedire", () => {
  const buono = "Ciao Giulia, è passato un po' dall'ultimo colore: se ti va di risistemarlo, siamo qui.";

  it("un messaggio normale passa", () => {
    expect(messaggioFollowUpAccettabile(buono)).toBe(buono);
  });

  it("toglie le virgolette che il modello a volte mette intorno", () => {
    expect(messaggioFollowUpAccettabile(`"${buono}"`)).toBe(buono);
  });

  it("UNO SCONTO INVENTATO NON PARTE", () => {
    // E' il motivo per cui questo controllo esiste: il messaggio va a un
    // cliente vero, a nome del salone, senza che nessuno lo rilegga. Una
    // promozione inventata diventa un impegno che il titolare scopre alla
    // cassa.
    expect(messaggioFollowUpAccettabile("Ciao Giulia, torna da noi: hai il 20% di sconto!")).toBeNull();
    expect(messaggioFollowUpAccettabile("Ciao, ti offriamo una piega in omaggio.")).toBeNull();
    expect(messaggioFollowUpAccettabile("Ciao, questa settimana promozione sul colore.")).toBeNull();
  });

  it("nessun prezzo", () => {
    expect(messaggioFollowUpAccettabile("Ciao Giulia, il colore ora è 35 euro, ti aspettiamo.")).toBeNull();
    expect(messaggioFollowUpAccettabile("Ciao, taglio a 20€ come sempre.")).toBeNull();
  });

  it("nessun link: quello per prenotare lo mettiamo noi e deve restare l'unico", () => {
    expect(messaggioFollowUpAccettabile("Ciao, prenota su www.salone.it")).toBeNull();
    expect(messaggioFollowUpAccettabile("Ciao, scrivici su https://esempio.org")).toBeNull();
  });

  it("troppo lungo o troppo corto: non parte", () => {
    expect(messaggioFollowUpAccettabile("Ciao")).toBeNull();
    expect(messaggioFollowUpAccettabile("a".repeat(MAX_CARATTERI_FOLLOW_UP + 1))).toBeNull();
  });

  it("qualunque cosa che non sia testo non parte", () => {
    expect(messaggioFollowUpAccettabile(null)).toBeNull();
    expect(messaggioFollowUpAccettabile(42)).toBeNull();
    expect(messaggioFollowUpAccettabile({ testo: "ciao" })).toBeNull();
  });

  it("una parola che CONTIENE una vietata non fa scartare il messaggio", () => {
    // "buongiorno" contiene "buono" solo se si cerca male: il controllo va
    // sulle parole intere, altrimenti scarterebbe messaggi innocui.
    expect(messaggioFollowUpAccettabile("Buongiorno Giulia, ci manchi: passa a trovarci.")).not.toBeNull();
  });
});
