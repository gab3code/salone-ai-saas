import { describe, expect, it } from "vitest";
import {
  daAvvisare,
  daDeclassare,
  fineProvaDallaRegistrazione,
  giorniRimanentiProva,
  provaAttiva,
  GIORNI_PROVA_GROWTH,
  type TenantConProva,
} from "./prova-gratuita";

const ADESSO = new Date("2026-09-18T10:00:00Z");
const fra = (giorni: number) => new Date(ADESSO.getTime() + giorni * 86400000).toISOString();

describe("quando la prova e' attiva", () => {
  it("una data futura e' attiva, una passata no", () => {
    expect(provaAttiva(fra(3), ADESSO)).toBe(true);
    expect(provaAttiva(fra(-1), ADESSO)).toBe(false);
  });

  it("niente data, niente prova", () => {
    expect(provaAttiva(null, ADESSO)).toBe(false);
  });

  it("una data illeggibile non regala Growth per sbaglio", () => {
    // Fail-closed: un valore sporco in quella colonna non deve diventare una
    // prova infinita.
    expect(provaAttiva("non una data", ADESSO)).toBe(false);
  });

  it("la registrazione fissa la fine a due settimane", () => {
    const fine = fineProvaDallaRegistrazione(ADESSO);
    expect(giorniRimanentiProva(fine, ADESSO)).toBe(GIORNI_PROVA_GROWTH);
  });
});

describe("giorni rimanenti", () => {
  it("si arrotonda per eccesso: a poche ore dalla fine resta 1 giorno, non 0", () => {
    // "0 giorni" mentre la prova e' ancora attiva e' una bugia precisa, e
    // toglie a chi legge il tempo di fare qualcosa.
    const fraTreOre = new Date(ADESSO.getTime() + 3 * 3600000);
    expect(giorniRimanentiProva(fraTreOre, ADESSO)).toBe(1);
  });

  it("scaduta: zero", () => {
    expect(giorniRimanentiProva(fra(-1), ADESSO)).toBe(0);
  });
});

function tenant(patch: Partial<TenantConProva> = {}): TenantConProva {
  return {
    id: "t1",
    piano: "growth",
    provaGrowthFinoAl: fra(-1),
    stripeSubscriptionId: null,
    ...patch,
  };
}

describe("chi torna su Free", () => {
  it("prova scaduta e nessun abbonamento: si declassa", () => {
    expect(daDeclassare([tenant()], ADESSO)).toEqual(["t1"]);
  });

  it("prova ancora attiva: non si tocca", () => {
    expect(daDeclassare([tenant({ provaGrowthFinoAl: fra(2) })], ADESSO)).toEqual([]);
  });

  it("CHI PAGA NON SI TOCCA MAI, anche se la data e' passata", () => {
    // E' il difetto peggiore che questo job possa avere: molto peggio
    // lasciare Growth qualche giorno di troppo a chi non paga che togliere
    // l'assistente a un cliente pagante.
    expect(daDeclassare([tenant({ stripeSubscriptionId: "sub_123" })], ADESSO)).toEqual([]);
  });

  it("chi e' stato messo su un altro piano a mano non torna indietro", () => {
    // Un admin che ha alzato un tenant a Pro ha preso una decisione: una
    // data di prova dimenticata in una colonna non deve ribaltarla.
    expect(daDeclassare([tenant({ piano: "pro" })], ADESSO)).toEqual([]);
    expect(daDeclassare([tenant({ piano: "free" })], ADESSO)).toEqual([]);
  });

  it("chi non ha mai avuto una prova non compare", () => {
    expect(daDeclassare([tenant({ provaGrowthFinoAl: null })], ADESSO)).toEqual([]);
  });
});

describe("chi viene avvisato", () => {
  function conAvviso(patch: Partial<TenantConProva & { avvisoProvaInviato: boolean }> = {}) {
    return { ...tenant({ provaGrowthFinoAl: fra(2) }), avvisoProvaInviato: false, ...patch };
  }

  it("a due giorni dalla fine si avvisa", () => {
    expect(daAvvisare([conAvviso()], ADESSO)).toEqual(["t1"]);
  });

  it("a una settimana dalla fine no: sarebbe solo rumore", () => {
    expect(daAvvisare([conAvviso({ provaGrowthFinoAl: fra(7) })], ADESSO)).toEqual([]);
  });

  it("gia' avvisato: una volta basta", () => {
    expect(daAvvisare([conAvviso({ avvisoProvaInviato: true })], ADESSO)).toEqual([]);
  });

  it("chi ha gia' sottoscritto non riceve un avviso che non lo riguarda", () => {
    expect(daAvvisare([conAvviso({ stripeSubscriptionId: "sub_1" })], ADESSO)).toEqual([]);
  });

  it("prova gia' scaduta: l'avviso non serve piu', serviva prima", () => {
    expect(daAvvisare([conAvviso({ provaGrowthFinoAl: fra(-1) })], ADESSO)).toEqual([]);
  });
});
