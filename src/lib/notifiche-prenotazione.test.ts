import { describe, expect, it } from "vitest";
import {
  canaleConfermaValido,
  canaleConsentitoDalPiano,
  canaliDisponibiliPerPiano,
  inviiConferma,
} from "./notifiche-prenotazione";

const CON_EMAIL = { haEmail: true, haTelefono: true };
const SENZA_EMAIL = { haEmail: false, haTelefono: true };
const SENZA_NIENTE = { haEmail: false, haTelefono: false };

describe("inviiConferma -- email_o_sms (il comportamento storico)", () => {
  it("manda l'email a chi l'ha lasciata, e NON anche l'SMS", () => {
    // "o", non "e": due conferme alla stessa persona sono spam, e l'SMS
    // costa soldi veri.
    expect(inviiConferma("email_o_sms", "pro", CON_EMAIL)).toEqual({ email: true, sms: false });
  });

  it("ripiega sull'SMS solo quando l'email manca", () => {
    expect(inviiConferma("email_o_sms", "pro", SENZA_EMAIL)).toEqual({ email: false, sms: true });
  });

  it("su un piano senza SMS, chi non ha lasciato l'email non riceve niente", () => {
    expect(inviiConferma("email_o_sms", "growth", SENZA_EMAIL)).toEqual({ email: false, sms: false });
  });

  it("senza email e senza telefono non si manda nulla, su qualunque piano", () => {
    expect(inviiConferma("email_o_sms", "pro", SENZA_NIENTE)).toEqual({ email: false, sms: false });
  });
});

describe("inviiConferma -- le altre tre scelte", () => {
  it("solo_email non ripiega mai sull'SMS, nemmeno su Pro", () => {
    expect(inviiConferma("solo_email", "pro", SENZA_EMAIL)).toEqual({ email: false, sms: false });
    expect(inviiConferma("solo_email", "pro", CON_EMAIL)).toEqual({ email: true, sms: false });
  });

  it("solo_sms manda l'SMS anche a chi HA lasciato l'email: è il solo caso, ed è una scelta esplicita", () => {
    expect(inviiConferma("solo_sms", "pro", CON_EMAIL)).toEqual({ email: false, sms: true });
  });

  it("solo_sms su un piano senza SMS non manda niente (ed è per questo che la UI non lo offre)", () => {
    expect(inviiConferma("solo_sms", "growth", CON_EMAIL)).toEqual({ email: false, sms: false });
  });

  it("nessuna non manda niente a nessuno", () => {
    expect(inviiConferma("nessuna", "pro", CON_EMAIL)).toEqual({ email: false, sms: false });
  });
});

describe("gate di piano", () => {
  it("sotto Pro le opzioni SMS non esistono", () => {
    expect(canaliDisponibiliPerPiano("growth")).toEqual(["email_o_sms", "solo_email", "nessuna"]);
    expect(canaleConsentitoDalPiano("solo_sms", "growth")).toBe(false);
    expect(canaleConsentitoDalPiano("solo_email", "growth")).toBe(true);
  });

  it("da Pro in su ci sono tutte e quattro", () => {
    expect(canaliDisponibiliPerPiano("pro")).toHaveLength(4);
    expect(canaleConsentitoDalPiano("solo_sms", "pro")).toBe(true);
    expect(canaleConsentitoDalPiano("solo_sms", "enterprise")).toBe(true);
  });

  it("un piano sconosciuto è trattato come senza SMS: in caso di dato sporco si concede meno", () => {
    expect(canaleConsentitoDalPiano("solo_sms", "")).toBe(false);
  });
});

describe("canaleConfermaValido", () => {
  it("rifiuta un valore inventato arrivato da una server action", () => {
    expect(canaleConfermaValido("solo_piccione")).toBe(false);
    expect(canaleConfermaValido("solo_email")).toBe(true);
  });
});
