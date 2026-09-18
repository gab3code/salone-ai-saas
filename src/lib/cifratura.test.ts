import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  ChiaveMancante,
  chiaveCifratura,
  cifra,
  decifra,
  eCifrato,
  NOME_VARIABILE_CHIAVE,
  segretiUguali,
} from "./cifratura";

const CHIAVE = { [NOME_VARIABILE_CHIAVE]: randomBytes(32).toString("base64") };
const ALTRA_CHIAVE = { [NOME_VARIABILE_CHIAVE]: randomBytes(32).toString("base64") };

describe("la chiave", () => {
  it("senza chiave si rifiuta di cifrare, invece di salvare in chiaro", () => {
    // Fail-closed: meglio un collegamento che non si salva e lo dice, che un
    // segreto di qualcun altro scritto in chiaro senza che nessuno lo sappia.
    expect(() => cifra("password-icloud", {})).toThrow(ChiaveMancante);
  });

  it("rifiuta una chiave della lunghezza sbagliata", () => {
    const corta = { [NOME_VARIABILE_CHIAVE]: Buffer.from("troppo corta").toString("base64") };
    expect(() => chiaveCifratura(corta)).toThrow(/32 byte/);
  });
});

describe("cifra e decifra", () => {
  it("quello che entra e' quello che esce", () => {
    const segreto = "abcd-efgh-ijkl-mnop";
    expect(decifra(cifra(segreto, CHIAVE), CHIAVE)).toBe(segreto);
  });

  it("regge accenti ed emoji", () => {
    const segreto = "passwòrd cön àccenti 🙂";
    expect(decifra(cifra(segreto, CHIAVE), CHIAVE)).toBe(segreto);
  });

  it("lo stesso segreto cifrato due volte da' due risultati diversi", () => {
    // IV casuale: senza, due operatrici con la stessa password avrebbero la
    // stessa riga nel database, e si vedrebbe a occhio.
    const a = cifra("stessa-password", CHIAVE);
    const b = cifra("stessa-password", CHIAVE);
    expect(a).not.toBe(b);
    expect(decifra(a, CHIAVE)).toBe(decifra(b, CHIAVE));
  });

  it("il segreto non compare da nessuna parte nel valore cifrato", () => {
    const cifrato = cifra("segreto-riconoscibile", CHIAVE) ?? "";
    expect(cifrato).not.toContain("segreto-riconoscibile");
  });

  it("non cifra due volte", () => {
    const unaVolta = cifra("x", CHIAVE);
    expect(cifra(unaVolta, CHIAVE)).toBe(unaVolta);
  });

  it("null, undefined e stringa vuota restano niente", () => {
    for (const vuoto of [null, undefined, ""]) {
      expect(cifra(vuoto, CHIAVE)).toBeNull();
      expect(decifra(vuoto, CHIAVE)).toBeNull();
    }
  });
});

describe("quando qualcosa non torna, si accorge", () => {
  it("una riga manomessa non si decifra in silenzio", () => {
    // E' il motivo per cui si usa GCM e non solo CBC: cifra E autentica.
    const cifrato = cifra("password-vera", CHIAVE) ?? "";
    const parti = cifrato.split(".");
    const manomesso = [parti[0], parti[1], parti[2], Buffer.from("altro").toString("base64")].join(".");
    expect(() => decifra(manomesso, CHIAVE)).toThrow();
  });

  it("con la chiave sbagliata fallisce invece di restituire spazzatura", () => {
    const cifrato = cifra("password-vera", CHIAVE);
    expect(() => decifra(cifrato, ALTRA_CHIAVE)).toThrow();
  });
});

describe("le righe scritte prima della cifratura", () => {
  it("il testo in chiaro passa attraverso senza rompersi", () => {
    // LA SCELTA che rende sicuro il passaggio: nel momento del deploy i
    // calendari gia' collegati non devono smettere di sincronizzare tutti
    // insieme. Se questo test sparisce, sparisce quella garanzia.
    expect(decifra("password-vecchia-in-chiaro", CHIAVE)).toBe("password-vecchia-in-chiaro");
  });

  it("e si riconosce che non e' cifrato", () => {
    expect(eCifrato("password-vecchia-in-chiaro")).toBe(false);
    expect(eCifrato(cifra("nuova", CHIAVE))).toBe(true);
    // Qualcosa che comincia per v1 ma non ha le quattro parti non e' nostro.
    expect(eCifrato("v1.soltanto.tre")).toBe(false);
  });

  it("senza chiave, una riga vecchia continua a funzionare", () => {
    // Prima che la chiave sia configurata il prodotto non deve rompersi:
    // deve solo rifiutarsi di scrivere segreti nuovi.
    expect(decifra("vecchia-in-chiaro", {})).toBe("vecchia-in-chiaro");
  });

  it("senza chiave, una riga gia' cifrata lancia invece di fingere", () => {
    const cifrato = cifra("x", CHIAVE);
    expect(() => decifra(cifrato, {})).toThrow(ChiaveMancante);
  });
});

describe("segretiUguali", () => {
  it("dice vero solo se sono identici", () => {
    expect(segretiUguali("token", "token")).toBe(true);
    expect(segretiUguali("token", "tokes")).toBe(false);
    expect(segretiUguali("token", "token-piu-lungo")).toBe(false);
  });

  it("un valore mancante non e' mai uguale a niente", () => {
    expect(segretiUguali(null, null)).toBe(false);
    expect(segretiUguali("", "")).toBe(false);
  });
});
