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

/**
 * PREVENIRE, NON CURARE.
 *
 * Tutti i difetti di onesta' di questo progetto sono nati allo stesso modo:
 * qualcosa di nuovo e' entrato nel prodotto e nessuno si e' chiesto se la
 * rete lo copriva. Il prompt vietava gia' di inventare prenotazioni quando il
 * modello ne ha inventata una; il controllo vietava di promettere una "mail"
 * quando il modello ha promesso un "SMS".
 *
 * Questi test non verificano un comportamento: verificano che **non si possa
 * aggiungere una cosa nuova dimenticando la rete**. Sono l'unico tipo di
 * controllo che funziona quando nessuno si ricorda della regola.
 */
describe("copertura -- la rete non puo' restare indietro", () => {
  it("ogni strumento che SCRIVE e' dichiarato in STRUMENTI_CHE_CAMBIANO_QUALCOSA", async () => {
    const { STRUMENTI_AI } = await import("./tools");
    const { STRUMENTI_CHE_CAMBIANO_QUALCOSA } = await import("./verifica-azioni");

    // Gli strumenti di sola lettura, dichiarati uno per uno: elencare quelli
    // innocui costringe a guardare in faccia ogni strumento nuovo invece di
    // lasciarlo passare per omissione.
    const SOLA_LETTURA = new Set([
      "elenca_servizi",
      "elenca_operatori",
      "info_orari",
      "verifica_disponibilita",
      "cerca_prenotazioni_cliente",
      "info_attivita",
      "trasferisci_a_operatore",
    ]);

    const dichiarati = new Set(Object.keys(STRUMENTI_CHE_CAMBIANO_QUALCOSA));
    const senzaRete = STRUMENTI_AI.map((s) => s.name).filter(
      (nome) => !SOLA_LETTURA.has(nome) && !dichiarati.has(nome)
    );

    expect(
      senzaRete,
      `Strumenti che cambiano qualcosa e non sono dichiarati in STRUMENTI_CHE_CAMBIANO_QUALCOSA: ${senzaRete.join(", ")}. ` +
        "Aggiungili li' (o a SOLA_LETTURA se davvero non scrivono niente), altrimenti l'assistente puo' dire di averli usati senza che nessuno lo verifichi."
    ).toEqual([]);
  });

  it("ogni canale di avviso che il prodotto conosce e' riconosciuto dal controllo", async () => {
    const { canaleDellaPromessa } = await import("./verifica-azioni");
    // Se domani nasce un canale nuovo (Telegram, notifiche push...) va
    // aggiunto qui E riconosciuto dal controllo: e' esattamente il buco da
    // cui e' passato l'SMS il 19/09/2026.
    const CANALI_CONOSCIUTI = ["email", "sms", "whatsapp"] as const;
    const frasi: Record<(typeof CANALI_CONOSCIUTI)[number], string> = {
      email: "Riceverai una mail di conferma.",
      sms: "Riceverai una conferma via SMS.",
      whatsapp: "Ti mandiamo un messaggio WhatsApp di conferma.",
    };
    for (const canale of CANALI_CONOSCIUTI) {
      expect(canaleDellaPromessa(frasi[canale]), canale).toBe(canale);
    }
  });

  it("un canale NON ancora attivo non si puo' promettere, anche se e' nei piani", async () => {
    const { avvisoPromettibile } = await import("./verifica-azioni");
    const conEmail = { avvenute: new Set<never>(), emailDisponibile: true, inAttesaDiCaparra: false };

    // Skebby e' nel piano ma non manda ancora niente: finche' non e' in
    // CANALI_AVVISO_ATTIVI, prometterlo resta una bugia.
    expect(avvisoPromettibile("Riceverai una conferma via SMS.", conEmail)).toBe(false);
    // L'email invece parte davvero, ma solo se l'indirizzo c'e'.
    expect(avvisoPromettibile("Riceverai una mail di conferma.", conEmail)).toBe(true);
    expect(
      avvisoPromettibile("Riceverai una mail di conferma.", { ...conEmail, emailDisponibile: false })
    ).toBe(false);
  });
});
