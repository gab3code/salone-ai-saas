import { describe, expect, it } from "vitest";
import {
  FINESTRE_RITORNO,
  GIORNI_MATURAZIONE_SENZA_LIMITE,
  MINIMO_CLIENTI_PER_PERCENTUALE,
  calcolaRetention,
  finestraPiuVicinaA,
  type VisitaRetention,
} from "./retention";

/**
 * REGOLA DI QUESTO FILE (stessa di admin-metriche.test.ts, imparata a spese
 * nostre il 17/09/2026): ogni data si costruisce con `Date.UTC`, mai con
 * `new Date(anno, mese, giorno)`. La seconda forma e' la mezzanotte LOCALE,
 * che a Roma cade il giorno prima in UTC: un test scritto cosi' passa nel
 * sandbox e fallisce sul Mac di Gabriel.
 */
const ADESSO = new Date(Date.UTC(2026, 8, 17, 12, 0));
const MS_GIORNO = 24 * 60 * 60 * 1000;

/** Una data a N giorni di distanza da oggi, alle 10 del mattino. */
function giorniFa(n: number, ora = 10): Date {
  return new Date(Date.UTC(2026, 8, 17) - n * MS_GIORNO + ora * 60 * 60 * 1000);
}

function visita(clienteId: string, giorni: number, stato = "confermato", ora = 10): VisitaRetention {
  return { clienteId, inizio: giorniFa(giorni, ora), stato };
}

function riga(visite: VisitaRetention[], chiave: string, quale: "nuoviClienti" | "abituali" = "nuoviClienti") {
  const r = calcolaRetention(visite, ADESSO)[quale].find((x) => x.chiave === chiave);
  if (!r) throw new Error(`finestra ${chiave} non trovata`);
  return r;
}

/** Sei clienti identici: sopra la soglia minima, cosi' la percentuale esce. */
function coorte(costruisci: (id: string, i: number) => VisitaRetention[], quanti = 6): VisitaRetention[] {
  return Array.from({ length: quanti }, (_, i) => costruisci(`c${i}`, i)).flat();
}

describe("calcolaRetention -- chi non ha avuto il tempo di tornare resta fuori", () => {
  it("un cliente arrivato tre giorni fa non e' un mancato ritorno a 30 giorni", () => {
    const visite = coorte((id) => [visita(id, 3)]);
    const r = riga(visite, "30");
    expect(r.clientiValutabili, "nessuno ha ancora avuto 30 giorni di tempo").toBe(0);
    expect(r.percentualeRiprenotati).toBeNull();
  });

  it("lo stesso cliente entra nel denominatore appena la finestra e' passata", () => {
    const visite = coorte((id) => [visita(id, 40)]);
    expect(riga(visite, "30").clientiValutabili).toBe(6);
    expect(riga(visite, "90").clientiValutabili, "a 90 giorni non e' ancora maturo").toBe(0);
  });

  it("senza l'esclusione la percentuale peggiorerebbe crescendo: qui non succede", () => {
    // Sei clienti maturi, tutti tornati. Poi arrivano sei clienti nuovissimi.
    const maturi = coorte((id) => [visita(id, 200), visita(id, 190)]);
    const appenaArrivati = coorte((id) => [visita(`nuovo-${id}`, 2)]);
    const prima = riga(maturi, "30").percentualePresentati;
    const dopo = riga([...maturi, ...appenaArrivati], "30").percentualePresentati;
    expect(prima).toBe(100);
    expect(dopo, "i nuovi arrivati non diluiscono il numero").toBe(100);
  });
});

describe("calcolaRetention -- la finestra", () => {
  it("un ritorno dopo dieci giorni conta entro il mese ma non entro la settimana", () => {
    const visite = coorte((id) => [visita(id, 60), visita(id, 50)]);
    expect(riga(visite, "7").percentualePresentati).toBe(0);
    expect(riga(visite, "30").percentualePresentati).toBe(100);
  });

  it("il giorno esatto della scadenza e' ancora dentro", () => {
    const visite = coorte((id) => [visita(id, 100), visita(id, 93)]);
    expect(riga(visite, "7").percentualePresentati, "sette giorni netti").toBe(100);
  });

  it("'prima o poi' prende anche chi torna dopo piu' di un anno", () => {
    const visite = coorte((id) => [visita(id, 800), visita(id, 300)]);
    expect(riga(visite, "365").percentualePresentati).toBe(0);
    expect(riga(visite, "sempre").percentualePresentati).toBe(100);
  });

  it("'prima o poi' usa comunque un anno di maturazione", () => {
    const visite = coorte((id) => [visita(id, GIORNI_MATURAZIONE_SENZA_LIMITE - 10)]);
    expect(riga(visite, "sempre").clientiValutabili).toBe(0);
  });
});

describe("calcolaRetention -- cosa conta come ritorno", () => {
  it("chi riprenota e non si presenta conta fra i riprenotati, non fra i presentati", () => {
    const visite = coorte((id) => [visita(id, 120), visita(id, 100, "no_show")]);
    const r = riga(visite, "30");
    expect(r.riprenotati).toBe(6);
    expect(r.presentati).toBe(0);
    expect(r.percentualeRiprenotati).toBe(100);
    expect(r.percentualePresentati).toBe(0);
  });

  it("una disdetta non e' un ritorno, in nessuna delle due serie", () => {
    const visite = coorte((id) => [visita(id, 120), visita(id, 100, "cancellato")]);
    const r = riga(visite, "30");
    expect(r.riprenotati).toBe(0);
    expect(r.presentati).toBe(0);
  });

  it("i presentati non superano mai i riprenotati, su ogni finestra", () => {
    const visite = [
      ...coorte((id) => [visita(id, 300), visita(id, 280)]),
      ...coorte((id) => [visita(`b-${id}`, 300), visita(`b-${id}`, 250, "no_show")]),
      ...coorte((id) => [visita(`c-${id}`, 300)]),
    ];
    const r = calcolaRetention(visite, ADESSO);
    for (const lista of [r.nuoviClienti, r.abituali]) {
      for (const x of lista) expect(x.presentati, x.etichetta).toBeLessThanOrEqual(x.riprenotati);
    }
  });

  it("un cliente che al primo appuntamento non si e' presentato non entra nella coorte", () => {
    // Nel salone non ci e' mai entrato: misurare "quanti tornano" su di lui
    // non vuol dire niente.
    const visite = coorte((id) => [visita(id, 120, "no_show")]);
    expect(riga(visite, "30").clientiValutabili).toBe(0);
  });
});

describe("calcolaRetention -- due appuntamenti lo stesso giorno sono una visita sola", () => {
  it("taglio e colore lo stesso pomeriggio non sono un ritorno", () => {
    const visite = coorte((id) => [visita(id, 120, "confermato", 10), visita(id, 120, "confermato", 15)]);
    const r = riga(visite, "30");
    expect(r.presentati, "stesso giorno = stessa visita").toBe(0);
    expect(riga(visite, "30", "abituali").clientiValutabili, "non ha una seconda visita").toBe(0);
  });
});

describe("calcolaRetention -- la soglia sotto cui non si mostra una percentuale", () => {
  it("con pochi clienti i conteggi ci sono ma la percentuale no", () => {
    const quanti = MINIMO_CLIENTI_PER_PERCENTUALE - 1;
    const visite = coorte((id) => [visita(id, 120), visita(id, 110)], quanti);
    const r = riga(visite, "30");
    expect(r.clientiValutabili).toBe(quanti);
    expect(r.presentati).toBe(quanti);
    expect(r.percentualePresentati, "un terzo o due terzi non significano niente").toBeNull();
  });

  it("appena si raggiunge la soglia la percentuale compare", () => {
    const visite = coorte((id) => [visita(id, 120), visita(id, 110)], MINIMO_CLIENTI_PER_PERCENTUALE);
    expect(riga(visite, "30").percentualePresentati).toBe(100);
  });
});

describe("calcolaRetention -- clienti abituali", () => {
  it("l'ancora e' la seconda visita, non la prima", () => {
    // Prima visita 300 giorni fa, seconda 200, terza 190: dalla seconda alla
    // terza passano 10 giorni.
    const visite = coorte((id) => [visita(id, 300), visita(id, 200), visita(id, 190)]);
    expect(riga(visite, "30", "abituali").percentualePresentati).toBe(100);
    expect(riga(visite, "7", "abituali").percentualePresentati).toBe(0);
  });

  it("chi ha una sola visita non e' un abituale", () => {
    const visite = coorte((id) => [visita(id, 300)]);
    expect(riga(visite, "30", "abituali").clientiValutabili).toBe(0);
    expect(riga(visite, "30").clientiValutabili, "ma e' un cliente nuovo valutabile").toBe(6);
  });
});

describe("calcolaRetention -- il futuro non conta", () => {
  it("un appuntamento gia' in agenda per domani non e' ancora un ritorno", () => {
    const visite = coorte((id) => [visita(id, 400), visita(id, -5)]);
    const r = riga(visite, "sempre");
    expect(r.clientiValutabili, "la coorte e' matura").toBe(6);
    expect(r.presentati, "deve ancora succedere").toBe(0);
  });

  it("un appuntamento di stamattina gia' finito conta come visita", () => {
    const visite = coorte((id) => [visita(id, 400), visita(id, 0, "confermato", 9)]);
    expect(riga(visite, "sempre").presentati).toBe(6);
  });
});

describe("calcolaRetention -- casi vuoti", () => {
  it("senza nessuna visita tutte le righe sono a zero e senza percentuale", () => {
    const r = calcolaRetention([], ADESSO);
    expect(r.nuoviClienti).toHaveLength(FINESTRE_RITORNO.length);
    for (const x of [...r.nuoviClienti, ...r.abituali]) {
      expect(x.clientiValutabili).toBe(0);
      expect(x.percentualeRiprenotati).toBeNull();
    }
  });

  it("gli appuntamenti senza cliente collegato vengono ignorati", () => {
    const visite: VisitaRetention[] = [{ clienteId: "", inizio: giorniFa(120), stato: "confermato" }];
    expect(riga(visite, "30").clientiValutabili).toBe(0);
  });
});

describe("finestraPiuVicinaA", () => {
  it("aggancia la soglia di follow-up alla finestra piu' vicina", () => {
    // 60 giorni e' esattamente in mezzo fra 30 e 90: a parita' vince la piu' ampia.
    expect(finestraPiuVicinaA(60).chiave).toBe("90");
    expect(finestraPiuVicinaA(55).chiave).toBe("30");
    expect(finestraPiuVicinaA(14).chiave).toBe("7");
    expect(finestraPiuVicinaA(30).chiave).toBe("30");
    expect(finestraPiuVicinaA(365).chiave).toBe("365");
  });

  it("non restituisce mai 'prima o poi', che non e' un numero di giorni", () => {
    for (const g of [1, 45, 200, 999]) expect(finestraPiuVicinaA(g).giorni).not.toBeNull();
  });
});
