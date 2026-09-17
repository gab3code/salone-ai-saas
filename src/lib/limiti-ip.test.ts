import { describe, expect, it } from "vitest";
import {
  MESSAGGI_DEMO_PER_CONNESSIONE_AL_MESE,
  TETTI_CHAT_SALONE,
  chiaveDemoPerConnessione,
  chiaveLimiteIp,
  ipDaIntestazioni,
} from "./limiti-ip";

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
  it("il tetto giornaliero della chat è più alto di quello orario", () => {
    expect(TETTI_CHAT_SALONE.perGiorno).toBeGreaterThan(TETTI_CHAT_SALONE.perOra);
  });

  it("la chat di un salone vero non chiude in faccia a un cliente", () => {
    // Dall'altra parte c'è un cliente che sta prenotando da un salone che
    // paga: bloccarlo costa più di qualche messaggio in più. Una
    // conversazione tipica sono dieci messaggi.
    expect(TETTI_CHAT_SALONE.perOra).toBeGreaterThanOrEqual(30);
    expect(TETTI_CHAT_SALONE.perGiorno).toBeGreaterThanOrEqual(100);
  });

  it("la demo ha un tetto MENSILE, stretto ma sufficiente a provarla", () => {
    // Una prenotazione completa sono cinque o sei messaggi: venti sono circa
    // tre prove intere. Sotto le due prove non basterebbe a farsi un'idea.
    expect(MESSAGGI_DEMO_PER_CONNESSIONE_AL_MESE / 6).toBeGreaterThanOrEqual(3);
    expect(MESSAGGI_DEMO_PER_CONNESSIONE_AL_MESE).toBeLessThan(TETTI_CHAT_SALONE.perGiorno);
  });

  it("la chiave del contatore mensile della demo è separata dalle altre", () => {
    expect(chiaveDemoPerConnessione("abc")).not.toBe(chiaveLimiteIp("demo", "abc"));
    expect(chiaveDemoPerConnessione("abc")).not.toBe(chiaveDemoPerConnessione("def"));
  });
});
