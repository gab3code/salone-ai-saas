import { describe, expect, it } from "vitest";
import {
  coortiPerMese,
  imbutoAttivazione,
  inizioSettimana,
  medianaGiorniAllaPrimaPrenotazione,
  serieSettimanale,
  usoPiattaforma,
  type AppuntamentoAggregabile,
} from "./admin-metriche";
import type { RigaAdmin } from "./admin";

/**
 * Metriche aggregate del pannello di piattaforma. Come per `admin.test.ts`:
 * un errore qui non rompe niente a schermo, racconta una cosa falsa con
 * l'aria di essere un dato -- e su questi numeri Gabriel decide dove
 * mettere le prossime settimane di lavoro.
 */

function riga(sovrascritture: Partial<RigaAdmin> = {}): RigaAdmin {
  return {
    tenantId: "t1",
    nome: "Salone",
    slug: "salone",
    piano: "growth",
    statoAbbonamento: "attivo",
    pianoManuale: false,
    sospesa: false,
    sospesaMotivo: null,
    creatoIl: "2026-06-01T00:00:00Z",
    haStripe: true,
    haAbbonamentoStripe: true,
    datiFatturaCompleti: true,
    verificaPartitaIva: "verified",
    emailTitolari: ["t@esempio.it"],
    membri: 1,
    operatori: 1,
    servizi: 2,
    orariConfigurati: true,
    clienti: 10,
    appuntamenti: 20,
    appuntamenti30Giorni: 5,
    prenotazioniMeseCorrente: 5,
    appuntamentiAi: 8,
    noShow: 1,
    primaAttivita: "2026-06-05T00:00:00Z",
    ultimaAttivita: "2026-06-20T00:00:00Z",
    ...sovrascritture,
  };
}

function appuntamento(
  sovrascritture: Partial<AppuntamentoAggregabile> = {}
): AppuntamentoAggregabile {
  return {
    creatoIl: "2026-09-15T10:00:00Z",
    stato: "confermato",
    creatoDa: "manuale",
    ...sovrascritture,
  };
}

/**
 * Tutte le date di questo file sono costruite in UTC (`Date.UTC`), mai con
 * `new Date(2026, 8, 14)`.
 *
 * Non è pignoleria: `new Date(2026, 8, 14)` è la MEZZANOTTE LOCALE del
 * computer che esegue il test. Su un server in UTC è il 14 alle 00:00Z; su
 * un Mac in Europa/Roma è il 13 alle 22:00Z, cioè un altro giorno e, per il
 * 14 settembre 2026 (un lunedì), un'altra settimana. Il 17/09/2026 questa
 * riga ha fatto fallire il test sul Mac di Gabriel e passare nel sandbox --
 * il test diceva una cosa diversa a seconda di dove girava, che è
 * esattamente il difetto che `inizioSettimana` è stata riscritta per
 * togliere dal prodotto.
 *
 * Regola per chi tocca questo file: se una data serve a verificare un
 * confine di giorno, mese o settimana, si scrive con `Date.UTC`.
 */
const SETTEMBRE = 8; // i mesi di JavaScript partono da 0
const utc = (giorno: number, ora = 0) => new Date(Date.UTC(2026, SETTEMBRE, giorno, ora));

describe("inizioSettimana", () => {
  it("torna sempre al lunedì, anche di domenica", () => {
    // 16 settembre 2026 è un mercoledì: il lunedì è il 14.
    expect(inizioSettimana(utc(16)).getUTCDate()).toBe(14);
    // La domenica appartiene alla settimana che è appena finita, non a
    // quella che comincia il giorno dopo: è la convenzione italiana, ed è
    // l'errore classico di `getDay()`, dove domenica è 0.
    expect(inizioSettimana(utc(20)).getUTCDate()).toBe(14);
    // Il lunedì stesso resta sé stesso.
    expect(inizioSettimana(utc(14)).getUTCDate()).toBe(14);
  });

  it("dà lo stesso lunedì indipendentemente dal fuso del computer che esegue il codice", () => {
    // È la garanzia introdotta il 17/09/2026: prima esistevano DUE
    // `inizioSettimana`, una in UTC (analytics della dashboard) e una in ora
    // locale (pannello di piattaforma). Su Vercel coincidono, su un computer
    // italiano no -- e due grafici raccontavano settimane diverse per gli
    // stessi appuntamenti. Un istante è un istante: la settimana in cui cade
    // non può dipendere da dove lo si guarda.
    const istante = new Date("2026-09-20T23:30:00Z"); // domenica sera, tardi
    expect(inizioSettimana(istante).toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });
});

describe("serieSettimanale", () => {
  const adesso = utc(16); // mercoledì 16 settembre 2026, 00:00 UTC

  it("divide le prenotazioni fra assistente e lavoro manuale, settimana per settimana", () => {
    const serie = serieSettimanale(
      [
        appuntamento({ creatoIl: utc(15, 10).toISOString(), creatoDa: "ai" }),
        appuntamento({ creatoIl: utc(16, 10).toISOString(), creatoDa: "ai" }),
        appuntamento({ creatoIl: utc(16, 14).toISOString(), creatoDa: "manuale" }),
        appuntamento({ creatoIl: utc(8, 10).toISOString(), creatoDa: "manuale" }),
      ],
      4,
      adesso
    );

    expect(serie).toHaveLength(4);
    const ultima = serie[serie.length - 1];
    expect(ultima.ai).toBe(2);
    expect(ultima.manuali).toBe(1);
    expect(ultima.totale).toBe(3);

    const precedente = serie[serie.length - 2];
    expect(precedente.totale).toBe(1);
  });

  it("tiene le settimane vuote a zero invece di saltarle", () => {
    const serie = serieSettimanale([], 12, adesso);
    expect(serie).toHaveLength(12);
    expect(serie.every((p) => p.totale === 0)).toBe(true);
  });

  it("ignora quello che sta fuori dalla finestra, senza contarlo altrove", () => {
    const serie = serieSettimanale(
      [appuntamento({ creatoIl: new Date(Date.UTC(2025, 0, 1)).toISOString() })],
      4,
      adesso
    );
    expect(serie.reduce((somma, p) => somma + p.totale, 0)).toBe(0);
  });

  it("non si fa rompere da una data illeggibile", () => {
    const serie = serieSettimanale([appuntamento({ creatoIl: "non-una-data" })], 4, adesso);
    expect(serie.reduce((somma, p) => somma + p.totale, 0)).toBe(0);
  });
});

describe("usoPiattaforma", () => {
  it("conta AI, no-show, cancellazioni, passaggi a operatore e media recensioni", () => {
    const uso = usoPiattaforma(
      [
        appuntamento({ creatoDa: "ai" }),
        appuntamento({ creatoDa: "ai", stato: "no_show" }),
        appuntamento({ stato: "cancellato" }),
        appuntamento({ stato: "completato" }),
      ],
      [{ stato: "chiusa" }, { stato: "passata_a_operatore" }, { stato: "aperta" }],
      [{ valutazione: 5 }, { valutazione: 4 }]
    );

    expect(uso.appuntamenti).toBe(4);
    expect(uso.presiDallAi).toBe(2);
    expect(uso.noShow).toBe(1);
    expect(uso.cancellati).toBe(1);
    expect(uso.conversazioni).toBe(3);
    expect(uso.passateAOperatore).toBe(1);
    expect(uso.mediaValutazioni).toBe(4.5);
  });

  it("senza recensioni la media è null e non zero: zero stelle sarebbe un giudizio, non un'assenza", () => {
    expect(usoPiattaforma([], [], []).mediaValutazioni).toBeNull();
  });
});

describe("imbutoAttivazione", () => {
  it("ogni gradino è un sottoinsieme del precedente", () => {
    const gradini = imbutoAttivazione([
      riga({ tenantId: "a" }),
      // configurata ma senza prenotazioni
      riga({ tenantId: "b", appuntamenti: 0, statoAbbonamento: "trialing" }),
      // non configurata: niente servizi
      riga({ tenantId: "c", servizi: 0, statoAbbonamento: "trialing" }),
      // paga ma non ha ancora configurato: conta fra i paganti e non fra le configurate
      riga({ tenantId: "d", orariConfigurati: false }),
    ]);

    expect(gradini.map((g) => g.quante)).toEqual([4, 2, 1, 2]);
  });

  it("un'attività attiva senza abbonamento Stripe non è pagante", () => {
    const gradini = imbutoAttivazione([riga({ haAbbonamentoStripe: false })]);
    expect(gradini[3].quante).toBe(0);
  });
});

describe("medianaGiorniAllaPrimaPrenotazione", () => {
  it("usa la mediana, così un caso estremo non sposta il numero di tutti", () => {
    const righe = [
      riga({ creatoIl: "2026-06-01T00:00:00Z", primaAttivita: "2026-06-02T00:00:00Z" }), // 1
      riga({ creatoIl: "2026-06-01T00:00:00Z", primaAttivita: "2026-06-04T00:00:00Z" }), // 3
      riga({ creatoIl: "2026-06-01T00:00:00Z", primaAttivita: "2026-09-01T00:00:00Z" }), // 92
    ];
    // La media direbbe 32 giorni e non descriverebbe nessuno dei tre.
    expect(medianaGiorniAllaPrimaPrenotazione(righe)).toBe(3);
  });

  it("chi non ha ancora prenotazioni non entra nel calcolo", () => {
    expect(medianaGiorniAllaPrimaPrenotazione([riga({ primaAttivita: null })])).toBeNull();
  });
});

describe("coortiPerMese", () => {
  const adesso = new Date("2026-09-16T12:00:00Z");

  it("raggruppa per mese di iscrizione e conta chi è ancora vivo", () => {
    const coorti = coortiPerMese(
      [
        riga({ tenantId: "a", creatoIl: "2026-08-03T00:00:00Z", ultimaAttivita: "2026-09-10T00:00:00Z" }),
        // iscritta lo stesso mese ma ferma da luglio: non è viva
        riga({ tenantId: "b", creatoIl: "2026-08-20T00:00:00Z", ultimaAttivita: "2026-07-01T00:00:00Z" }),
        riga({ tenantId: "c", creatoIl: "2026-09-01T00:00:00Z", ultimaAttivita: "2026-09-15T00:00:00Z" }),
      ],
      adesso
    );

    expect(coorti.map((c) => c.mese)).toEqual(["2026-09", "2026-08"]);
    expect(coorti[0].iscritte).toBe(1);
    expect(coorti[1].iscritte).toBe(2);
    expect(coorti[1].vive).toBe(1);
  });

  it("i mesi tornano dal più recente al più vecchio, tagliati al limite chiesto", () => {
    const righe = ["2026-05", "2026-06", "2026-07", "2026-08"].map((mese, i) =>
      riga({ tenantId: `t${i}`, creatoIl: `${mese}-10T00:00:00Z` })
    );
    const coorti = coortiPerMese(righe, adesso, 2);
    expect(coorti.map((c) => c.mese)).toEqual(["2026-08", "2026-07"]);
  });
});
