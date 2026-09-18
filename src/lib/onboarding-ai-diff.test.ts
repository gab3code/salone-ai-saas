import { describe, expect, it } from "vitest";
import {
  calcolaDiff,
  diffOrari,
  diffVuoto,
  type OrarioAttuale,
  type StatoSalone,
  type StatoDesiderato,
} from "./onboarding-ai-diff";

/** Un giorno aperto, con la possibilita' di cambiarne un pezzo. */
function giorno(giornoSettimana: number, extra: Partial<OrarioAttuale> = {}): OrarioAttuale {
  return {
    giornoSettimana,
    chiuso: false,
    apertura: "08:00",
    chiusura: "18:00",
    pausaInizio: null,
    pausaFine: null,
    ...extra,
  };
}

/** Domenica chiusa, il resto 08:00-18:00: la settimana di un salone vero. */
const SETTIMANA: OrarioAttuale[] = [
  giorno(0, { chiuso: true, apertura: null, chiusura: null }),
  giorno(1),
  giorno(2),
  giorno(3),
  giorno(4),
  giorno(5),
  giorno(6),
];

const ANNA = { id: "op-anna", nome: "Anna", descrizione: "Colorista", attivo: true };
const BRUNO = { id: "op-bruno", nome: "Bruno", descrizione: null, attivo: true };
const TAGLIO = { id: "sv-taglio", nome: "Taglio", durataMinuti: 30, prezzoEuro: 25, attivo: true };
const COLORE = { id: "sv-colore", nome: "Colore", durataMinuti: 90, prezzoEuro: 60, attivo: true };

const SALONE: StatoSalone = {
  operatori: [ANNA, BRUNO],
  servizi: [TAGLIO, COLORE],
  associazioni: [
    { operatoreId: ANNA.id, servizioId: TAGLIO.id },
    { operatoreId: ANNA.id, servizioId: COLORE.id },
    { operatoreId: BRUNO.id, servizioId: TAGLIO.id },
  ],
  orari: SETTIMANA,
};

/** Lo stato desiderato "non cambia niente": utile come base dei test. */
function statoIdentico(): StatoDesiderato {
  return {
    operatori: [
      { id: ANNA.id, nome: ANNA.nome, descrizione: ANNA.descrizione },
      { id: BRUNO.id, nome: BRUNO.nome, descrizione: BRUNO.descrizione },
    ],
    servizi: [
      { id: TAGLIO.id, nome: TAGLIO.nome, durataMinuti: TAGLIO.durataMinuti, prezzoEuro: TAGLIO.prezzoEuro },
      { id: COLORE.id, nome: COLORE.nome, durataMinuti: COLORE.durataMinuti, prezzoEuro: COLORE.prezzoEuro },
    ],
    associazioni: null,
    orari: [],
  };
}

describe("il caso che ha fatto nascere questo file", () => {
  it('"siamo in due" su un salone con due operatori non ne crea altri due', () => {
    // Prima del 18/09/2026 questa frase produceva due operatori in piu':
    // la bozza non sapeva niente di quelli gia' presenti.
    const diff = calcolaDiff(SALONE, statoIdentico());
    expect(diff.operatori).toEqual([]);
    expect(diffVuoto(diff)).toBe(true);
  });
});

describe("operatori", () => {
  it("un nome nuovo diventa una creazione", () => {
    const desiderato = statoIdentico();
    desiderato.operatori.push({ id: null, nome: "Carla", descrizione: null });
    const diff = calcolaDiff(SALONE, desiderato);
    expect(diff.operatori).toHaveLength(1);
    expect(diff.operatori[0].tipo).toBe("crea");
    expect(diff.operatori[0].dopo?.nome).toBe("Carla");
  });

  it("un nome corretto su una riga esistente diventa un aggiornamento, non una coppia crea+rimuovi", () => {
    const desiderato = statoIdentico();
    desiderato.operatori[0] = { id: ANNA.id, nome: "Anna Rossi", descrizione: "Colorista" };
    const diff = calcolaDiff(SALONE, desiderato);
    expect(diff.operatori).toHaveLength(1);
    expect(diff.operatori[0].tipo).toBe("aggiorna");
    expect(diff.operatori[0].id).toBe(ANNA.id);
    expect(diff.operatori[0].prima?.nome).toBe("Anna");
    expect(diff.operatori[0].dopo?.nome).toBe("Anna Rossi");
  });

  it("uno spazio in piu' non e' una modifica", () => {
    const desiderato = statoIdentico();
    desiderato.operatori[0] = { id: ANNA.id, nome: "  Anna  ", descrizione: "Colorista" };
    expect(calcolaDiff(SALONE, desiderato).operatori).toEqual([]);
  });

  it("un operatore esistente non nominato diventa una PROPOSTA di rimozione", () => {
    const desiderato = statoIdentico();
    desiderato.operatori = desiderato.operatori.filter((o) => o.id !== BRUNO.id);
    const diff = calcolaDiff(SALONE, desiderato);
    const rimozioni = diff.operatori.filter((m) => m.tipo === "rimuovi");
    expect(rimozioni).toHaveLength(1);
    expect(rimozioni[0].prima?.nome).toBe("Bruno");
    // Il diff la propone e basta: chi applica non tocca niente senza spunta.
    expect(rimozioni[0].dopo).toBeNull();
  });

  it("un id inventato dal modello non diventa un aggiornamento a vuoto", () => {
    // Se si fidasse dell'id, l'aggiornamento finirebbe su nessuna riga e il
    // titolare vedrebbe "fatto" senza che sia cambiato niente.
    const desiderato = statoIdentico();
    desiderato.operatori.push({ id: "op-che-non-esiste", nome: "Dario", descrizione: null });
    const diff = calcolaDiff(SALONE, desiderato);
    expect(diff.idSconosciuti).toEqual(["op-che-non-esiste"]);
    expect(diff.operatori.find((m) => m.dopo?.nome === "Dario")?.tipo).toBe("crea");
  });
});

describe("servizi", () => {
  it("durata e prezzo non ripetuti a voce non si perdono", () => {
    // Il modello lascia null cio' che il testo non dice. Se null diventasse
    // "azzera", dire "il taglio ora si chiama taglio donna" cancellerebbe
    // prezzo e durata di un servizio gia' configurato.
    const desiderato = statoIdentico();
    desiderato.servizi[0] = { id: TAGLIO.id, nome: "Taglio donna", durataMinuti: null, prezzoEuro: null };
    const diff = calcolaDiff(SALONE, desiderato);
    expect(diff.servizi).toHaveLength(1);
    expect(diff.servizi[0].tipo).toBe("aggiorna");
    expect(diff.servizi[0].dopo?.durataMinuti).toBe(30);
    expect(diff.servizi[0].dopo?.prezzoEuro).toBe(25);
  });

  it("un prezzo nuovo e' un aggiornamento", () => {
    const desiderato = statoIdentico();
    desiderato.servizi[0] = { id: TAGLIO.id, nome: "Taglio", durataMinuti: 30, prezzoEuro: 28 };
    const diff = calcolaDiff(SALONE, desiderato);
    expect(diff.servizi[0].tipo).toBe("aggiorna");
    expect(diff.servizi[0].dopo?.prezzoEuro).toBe(28);
  });

  it("prezzo zero e' un prezzo, non un'assenza", () => {
    const desiderato = statoIdentico();
    desiderato.servizi[0] = { id: TAGLIO.id, nome: "Taglio", durataMinuti: 30, prezzoEuro: 0 };
    expect(calcolaDiff(SALONE, desiderato).servizi[0].dopo?.prezzoEuro).toBe(0);
  });
});

describe("chi fa cosa", () => {
  it("silenzio sulle associazioni = non si tocca niente", () => {
    const diff = calcolaDiff(SALONE, statoIdentico());
    expect(diff.associazioni).toEqual([]);
  });

  it("una coppia nuova fra righe esistenti diventa una creazione", () => {
    const desiderato = statoIdentico();
    desiderato.associazioni = [
      { operatore: desiderato.operatori[0], servizio: desiderato.servizi[0] }, // Anna-Taglio, gia' c'e'
      { operatore: desiderato.operatori[1], servizio: desiderato.servizi[1] }, // Bruno-Colore, nuova
    ];
    const diff = calcolaDiff(SALONE, desiderato);
    const creazioni = diff.associazioni.filter((a) => a.tipo === "crea");
    expect(creazioni).toHaveLength(1);
    expect(creazioni[0].nomeOperatore).toBe("Bruno");
    expect(creazioni[0].nomeServizio).toBe("Colore");
  });

  it("una coppia esistente non piu' desiderata diventa una rimozione", () => {
    const desiderato = statoIdentico();
    // Anna fa solo il colore: sparisce Anna-Taglio.
    desiderato.associazioni = [
      { operatore: desiderato.operatori[0], servizio: desiderato.servizi[1] },
      { operatore: desiderato.operatori[1], servizio: desiderato.servizi[0] },
    ];
    const diff = calcolaDiff(SALONE, desiderato);
    const rimozioni = diff.associazioni.filter((a) => a.tipo === "rimuovi");
    expect(rimozioni).toHaveLength(1);
    expect(rimozioni[0].nomeOperatore).toBe("Anna");
    expect(rimozioni[0].nomeServizio).toBe("Taglio");
  });

  it("non rimuove le coppie di righe che il modello non ha nemmeno nominato", () => {
    // Il titolare parla solo del colore di Anna: le coppie di Bruno non
    // erano sul tavolo e non devono sparire per omissione.
    const desiderato: StatoDesiderato = {
      operatori: [{ id: ANNA.id, nome: "Anna", descrizione: "Colorista" }],
      servizi: [{ id: COLORE.id, nome: "Colore", durataMinuti: 90, prezzoEuro: 60 }],
      associazioni: [
        {
          operatore: { id: ANNA.id, nome: "Anna", descrizione: "Colorista" },
          servizio: { id: COLORE.id, nome: "Colore", durataMinuti: 90, prezzoEuro: 60 },
        },
      ],
      orari: [],
    };
    const diff = calcolaDiff(SALONE, desiderato);
    expect(diff.associazioni.filter((a) => a.tipo === "rimuovi")).toEqual([]);
  });

  it("una coppia che coinvolge una riga nuova resta senza id, da risolvere dopo la creazione", () => {
    const desiderato = statoIdentico();
    const carla = { id: null, nome: "Carla", descrizione: null };
    desiderato.operatori.push(carla);
    desiderato.associazioni = [{ operatore: carla, servizio: desiderato.servizi[0] }];
    const diff = calcolaDiff(SALONE, desiderato);
    const coppia = diff.associazioni.find((a) => a.nomeOperatore === "Carla");
    expect(coppia?.tipo).toBe("crea");
    expect(coppia?.operatoreId).toBeNull();
    expect(coppia?.servizioId).toBe(TAGLIO.id);
  });

  it("un elenco VUOTO non e' silenzio: vuol dire che nessuno fa piu' niente", () => {
    const desiderato = statoIdentico();
    desiderato.associazioni = [];
    const diff = calcolaDiff(SALONE, desiderato);
    expect(diff.associazioni.filter((a) => a.tipo === "rimuovi")).toHaveLength(3);
  });
});

describe("un salone vuoto", () => {
  it("tutto e' una creazione, niente e' una rimozione", () => {
    const vuoto: StatoSalone = { operatori: [], servizi: [], associazioni: [], orari: SETTIMANA };
    const desiderato: StatoDesiderato = {
      operatori: [{ id: null, nome: "Anna", descrizione: null }],
      servizi: [{ id: null, nome: "Taglio", durataMinuti: 30, prezzoEuro: 25 }],
      associazioni: null,
      orari: [],
    };
    const diff = calcolaDiff(vuoto, desiderato);
    expect(diff.operatori.every((m) => m.tipo === "crea")).toBe(true);
    expect(diff.servizi.every((m) => m.tipo === "crea")).toBe(true);
    expect(diff.operatori).toHaveLength(1);
    expect(diff.servizi).toHaveLength(1);
  });
});

describe("orari: il bug del sabato (18/09/2026)", () => {
  it('"il sabato siamo aperti" NON tocca gli altri sei giorni', () => {
    // E' il caso esatto segnalato da Gabriel. Prima di diffOrari, questa
    // richiesta riportava lunedi'-venerdi' agli orari di default.
    const modifiche = diffOrari(SETTIMANA, [giorno(6, { apertura: "09:00", chiusura: "13:00" })]);
    expect(modifiche).toHaveLength(1);
    expect(modifiche[0].giornoSettimana).toBe(6);
    expect(modifiche[0].prima.chiusura).toBe("18:00");
    expect(modifiche[0].dopo.chiusura).toBe("13:00");
  });

  it("un giorno che il modello non nomina non compare nel diff, qualunque cosa sia", () => {
    expect(diffOrari(SETTIMANA, [])).toEqual([]);
  });

  it("un giorno ripetuto identico non e' una modifica", () => {
    // Il modello quasi sempre ripete tutta la settimana. I giorni uguali
    // devono sparire, se no la revisione chiede di confermare sette righe di
    // cui sei non cambiano niente e la settima si perde in mezzo.
    expect(diffOrari(SETTIMANA, SETTIMANA)).toEqual([]);
  });

  it("aprire un giorno chiuso e chiudere un giorno aperto sono entrambe modifiche", () => {
    const modifiche = diffOrari(SETTIMANA, [
      giorno(0, { apertura: "10:00", chiusura: "13:00" }),
      giorno(3, { chiuso: true, apertura: null, chiusura: null }),
    ]);
    expect(modifiche.map((m) => m.giornoSettimana)).toEqual([0, 3]);
    expect(modifiche[0].prima.chiuso).toBe(true);
    expect(modifiche[0].dopo.chiuso).toBe(false);
    expect(modifiche[1].dopo.chiuso).toBe(true);
  });

  it("su un giorno chiuso gli orari non si confrontano", () => {
    // Un modello che scrive "chiuso" e lascia dentro 09:00-19:00 non sta
    // proponendo un cambio di orario: nel database un giorno chiuso ha gli
    // orari a null per definizione.
    const chiusaDavvero = SETTIMANA[0];
    const chiusaConOrariInutili = giorno(0, { chiuso: true, apertura: "09:00", chiusura: "19:00" });
    expect(diffOrari([chiusaDavvero], [chiusaConOrariInutili])).toEqual([]);
  });

  it("la pausa pranzo conta come modifica", () => {
    const modifiche = diffOrari(SETTIMANA, [giorno(2, { pausaInizio: "13:00", pausaFine: "14:00" })]);
    expect(modifiche).toHaveLength(1);
    expect(modifiche[0].dopo.pausaInizio).toBe("13:00");
  });

  it("un giorno che nel database non esiste viene ignorato invece di far esplodere tutto", () => {
    expect(diffOrari([], [giorno(6)])).toEqual([]);
  });

  it("le modifiche escono in ordine di giorno, non nell'ordine del modello", () => {
    const modifiche = diffOrari(SETTIMANA, [
      giorno(5, { chiusura: "20:00" }),
      giorno(1, { chiusura: "20:00" }),
      giorno(3, { chiusura: "20:00" }),
    ]);
    expect(modifiche.map((m) => m.giornoSettimana)).toEqual([1, 3, 5]);
  });

  it("un diff con soli orari non e' un diff vuoto", () => {
    const desiderato = statoIdentico();
    desiderato.orari = [giorno(6, { chiusura: "13:00" })];
    expect(diffVuoto(calcolaDiff(SALONE, desiderato))).toBe(false);
  });
});
