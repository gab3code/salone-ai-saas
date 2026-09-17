import { describe, expect, it } from "vitest";
import { TETTI_CHAT_SALONE, TETTI_DEMO, chiaveLimiteIp, ipDaIntestazioni } from "./limiti-ip";

function intestazioni(valori: Record<string, string>) {
  return { get: (nome: string) => valori[nome.toLowerCase()] ?? null };
}

describe("ipDaIntestazioni", () => {
  it("prende il PRIMO valore di x-forwarded-for, che è il client", () => {
    // I successivi sono i proxy attraversati: usare l'ultimo vorrebbe dire
    // mettere tutto il traffico di un proxy in un secchiello solo.
    expect(ipDaIntestazioni(intestazioni({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" }))).toBe(
      "203.0.113.7"
    );
  });

  it("tollera gli spazi e un valore singolo", () => {
    expect(ipDaIntestazioni(intestazioni({ "x-forwarded-for": "  203.0.113.7  " }))).toBe("203.0.113.7");
  });

  it("ripiega su x-real-ip", () => {
    expect(ipDaIntestazioni(intestazioni({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("senza intestazioni ritorna null, e NON un valore inventato", () => {
    // Un finto "sconosciuto" diverso a ogni richiesta non limiterebbe niente;
    // uno uguale per tutti metterebbe il mondo intero nello stesso secchiello.
    expect(ipDaIntestazioni(intestazioni({}))).toBeNull();
    expect(ipDaIntestazioni(intestazioni({ "x-forwarded-for": "   " }))).toBeNull();
    expect(ipDaIntestazioni(intestazioni({ "x-forwarded-for": "" }))).toBeNull();
  });
});

describe("chiaveLimiteIp", () => {
  it("tiene separati demo e chat dei saloni", () => {
    // Chi ha provato la demo non deve ritrovarsi con meno messaggi quando poi
    // prenota davvero da un salone.
    expect(chiaveLimiteIp("demo", "abc")).not.toBe(chiaveLimiteIp("chat", "abc"));
  });

  it("due chiamanti diversi hanno chiavi diverse", () => {
    expect(chiaveLimiteIp("demo", "abc")).not.toBe(chiaveLimiteIp("demo", "def"));
  });
});

describe("i numeri dei tetti", () => {
  it("il tetto giornaliero è più alto di quello orario", () => {
    for (const [nome, t] of Object.entries({ demo: TETTI_DEMO, chat: TETTI_CHAT_SALONE })) {
      expect(t.perGiorno, nome).toBeGreaterThan(t.perOra);
    }
  });

  it("la chat di un salone vero è più permissiva della demo", () => {
    // Dall'altra parte c'è un cliente che sta prenotando: bloccarlo costa al
    // salone molto più di quanto costi a noi qualche messaggio in più.
    expect(TETTI_CHAT_SALONE.perOra).toBeGreaterThan(TETTI_DEMO.perOra);
    expect(TETTI_CHAT_SALONE.perGiorno).toBeGreaterThan(TETTI_DEMO.perGiorno);
  });

  it("nessun tetto è così basso da rompere una conversazione normale", () => {
    // Una prenotazione completa sta in cinque o sei messaggi, una complicata
    // in una decina.
    for (const [nome, t] of Object.entries({ demo: TETTI_DEMO, chat: TETTI_CHAT_SALONE })) {
      expect(t.perOra, nome).toBeGreaterThanOrEqual(20);
    }
  });
});
