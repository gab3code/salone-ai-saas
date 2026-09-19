import { describe, expect, it } from "vitest";
import {
  azioniDichiarate,
  prometteEmail,
  trovaAzioneNonAvvenuta,
  frasePrudente,
  type ContestoAzioni,
} from "./verifica-azioni";

const NIENTE: ContestoAzioni = { avvenute: new Set(), emailDisponibile: false, inAttesaDiCaparra: false };
const CREATA: ContestoAzioni = { avvenute: new Set(["creata"]), emailDisponibile: false, inAttesaDiCaparra: false };

describe("azioniDichiarate", () => {
  it("riconosce la frase esatta detta al cliente vero il 19/09/2026", () => {
    const testo =
      "Grazie! Ti ho prenotato la pedicure per lunedì 21 settembre alle 08:00.\n\nLa prenotazione è confermata.";
    expect([...azioniDichiarate(testo)]).toEqual(["creata"]);
  });

  it("riconosce anche la seconda bugia, quella detta dopo 'hai prenotato davvero?'", () => {
    expect(azioniDichiarate("Sì, la prenotazione è confermata!").has("creata")).toBe(true);
  });

  it("riconosce modifica e cancellazione", () => {
    expect(azioniDichiarate("Ho spostato il tuo appuntamento a mercoledì.").has("modificata")).toBe(true);
    expect(azioniDichiarate("Ho cancellato la tua prenotazione.").has("cancellata")).toBe(true);
    expect(azioniDichiarate("La prenotazione è stata annullata.").has("cancellata")).toBe(true);
  });

  /**
   * La meta' che conta di piu': una rete che scatta sulle risposte oneste
   * e' peggio di nessuna rete, perche' la si disattiva dopo due giorni.
   */
  it("NON scatta su un'offerta, che non dichiara niente", () => {
    for (const testo of [
      "Posso prenotarti la pedicure per lunedì alle 8, va bene?",
      "Vuoi che ti prenoti questo orario?",
      "Per prenotare mi servono nome e telefono.",
      "Ti confermo il prezzo: la pedicure costa 40 euro.",
      "Procedo con la prenotazione appena mi dai il tuo numero.",
    ]) {
      expect(azioniDichiarate(testo).size, testo).toBe(0);
    }
  });

  it("NON scatta su una frase che NEGA l'azione", () => {
    for (const testo of [
      "Non ho ancora prenotato niente: mi serve prima il tuo numero.",
      "Non ho cancellato nulla, l'appuntamento è ancora lì.",
    ]) {
      expect(azioniDichiarate(testo).size, testo).toBe(0);
    }
  });
});

describe("trovaAzioneNonAvvenuta", () => {
  it("contesta la dichiarazione quando lo strumento non e' stato chiamato", () => {
    const problema = trovaAzioneNonAvvenuta("Ti ho prenotato la pedicure. La prenotazione è confermata.", NIENTE);
    expect(problema).toMatch(/non hai chiamato nessuno strumento/i);
  });

  it("lascia passare la stessa frase quando la prenotazione e' davvero avvenuta", () => {
    expect(trovaAzioneNonAvvenuta("Ti ho prenotato la pedicure. La prenotazione è confermata.", CREATA)).toBeNull();
  });

  it("'confermata' e' vietata finche' la caparra non e' pagata", () => {
    const inAttesa: ContestoAzioni = {
      avvenute: new Set(["creata"]),
      emailDisponibile: false,
      inAttesaDiCaparra: true,
    };
    expect(trovaAzioneNonAvvenuta("La prenotazione è confermata!", inAttesa)).toMatch(/caparra/i);
  });

  it("contesta la mail promessa a chi non ha lasciato un indirizzo", () => {
    expect(trovaAzioneNonAvvenuta("Riceverai una mail di conferma a breve.", NIENTE)).toMatch(/mail/i);
  });

  it("la stessa frase passa se l'email c'e' davvero", () => {
    const conEmail: ContestoAzioni = { avvenute: new Set(), emailDisponibile: true, inAttesaDiCaparra: false };
    expect(trovaAzioneNonAvvenuta("Riceverai una mail di conferma a breve.", conEmail)).toBeNull();
  });

  it("un messaggio onesto non viene toccato", () => {
    expect(trovaAzioneNonAvvenuta("Lunedì ho libero alle 8:00 e alle 9:00. Quale preferisci?", NIENTE)).toBeNull();
  });
});

describe("prometteEmail", () => {
  it("riconosce le forme comuni", () => {
    expect(prometteEmail("troverai il link nella mail di conferma che riceverai tra poco")).toBe(true);
    expect(prometteEmail("Ti arriva una email con il riepilogo")).toBe(true);
  });
  it("non confonde un indirizzo chiesto con una mail promessa", () => {
    expect(prometteEmail("Mi lasci la tua email?")).toBe(false);
  });
});

describe("frasePrudente", () => {
  it("non promette niente e dice l'unica cosa certa", () => {
    const f = frasePrudente("chiamare il 02 99999999");
    expect(f).toMatch(/non risulta nessun appuntamento/i);
    expect(f).toContain("02 99999999");
    expect(f).not.toMatch(/confermat/i);
  });

  it("regge anche senza recapito configurato", () => {
    expect(frasePrudente(null)).toMatch(/contattare l'attività direttamente/i);
  });
});
