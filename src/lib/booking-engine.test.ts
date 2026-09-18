import { describe, expect, it } from "vitest";
import {
  calcolaSlotDisponibili,
  calcolaSlotServiziConsecutivi,
  giornoChiuso,
  verificaConflitto,
  type AppuntamentoEsistente,
  type Chiusura,
  type OrarioGiorno,
  type Operatore,
  diagnosticaOperatori,
} from "./booking-engine";

// Lunedì 2026-09-07 (giornoSettimana = 1), per non dipendere dalla data odierna.
const LUNEDI = new Date(Date.UTC(2026, 8, 7));
const MARTEDI = new Date(Date.UTC(2026, 8, 8));

const orariStandard: OrarioGiorno[] = [
  { giornoSettimana: 0, chiuso: true },
  {
    giornoSettimana: 1,
    chiuso: false,
    apertura: "09:00",
    chiusura: "18:00",
    pausaInizio: "13:00",
    pausaFine: "14:00",
  },
  { giornoSettimana: 2, chiuso: false, apertura: "09:00", chiusura: "18:00" },
  { giornoSettimana: 3, chiuso: false, apertura: "09:00", chiusura: "18:00" },
  { giornoSettimana: 4, chiuso: false, apertura: "09:00", chiusura: "18:00" },
  { giornoSettimana: 5, chiuso: false, apertura: "09:00", chiusura: "18:00" },
  { giornoSettimana: 6, chiuso: true },
];

const anna: Operatore = { id: "anna", attivo: true, servizioIds: ["taglio", "colore"] };
const bruno: Operatore = { id: "bruno", attivo: true, servizioIds: ["taglio"] };

function orario(h: number, m = 0, giorno = LUNEDI): Date {
  return new Date(Date.UTC(giorno.getUTCFullYear(), giorno.getUTCMonth(), giorno.getUTCDate(), h, m));
}

describe("calcolaSlotDisponibili", () => {
  it("propone slot durante l'orario di apertura, esclusa la pausa pranzo", () => {
    const slot = calcolaSlotDisponibili({
      data: LUNEDI,
      durataMinuti: 30,
      servizioId: "taglio",
      operatoreId: "anna",
      operatori: [anna],
      orari: orariStandard,
      chiusure: [],
      appuntamentiEsistenti: [],
    });

    expect(slot.length).toBeGreaterThan(0);
    // Nessuno slot deve iniziare o proseguire dentro la pausa 13:00-14:00.
    for (const s of slot) {
      const inizioMin = s.inizio.getUTCHours() * 60 + s.inizio.getUTCMinutes();
      const fineMin = s.fine.getUTCHours() * 60 + s.fine.getUTCMinutes();
      const dentroPausa = inizioMin < 14 * 60 && fineMin > 13 * 60;
      expect(dentroPausa).toBe(false);
    }
  });

  it("non propone nulla in un giorno di chiusura settimanale", () => {
    const slot = calcolaSlotDisponibili({
      data: new Date(Date.UTC(2026, 8, 6)), // domenica
      durataMinuti: 30,
      servizioId: "taglio",
      operatori: [anna],
      orari: orariStandard,
      chiusure: [],
      appuntamentiEsistenti: [],
    });
    expect(slot).toEqual([]);
  });

  it("esclude gli orari già occupati da un appuntamento confermato", () => {
    const appuntamenti: AppuntamentoEsistente[] = [
      { operatoreId: "anna", inizio: orario(10), fine: orario(11), stato: "confermato" },
    ];
    const slot = calcolaSlotDisponibili({
      data: LUNEDI,
      durataMinuti: 30,
      servizioId: "taglio",
      operatoreId: "anna",
      operatori: [anna],
      orari: orariStandard,
      chiusure: [],
      appuntamentiEsistenti: appuntamenti,
    });
    const sovrapposti = slot.filter((s) => s.inizio < orario(11) && s.fine > orario(10));
    expect(sovrapposti).toEqual([]);
  });

  it("un appuntamento cancellato non blocca lo slot", () => {
    const appuntamenti: AppuntamentoEsistente[] = [
      { operatoreId: "anna", inizio: orario(10), fine: orario(11), stato: "cancellato" },
    ];
    const slot = calcolaSlotDisponibili({
      data: LUNEDI,
      durataMinuti: 30,
      servizioId: "taglio",
      operatoreId: "anna",
      operatori: [anna],
      orari: orariStandard,
      chiusure: [],
      appuntamentiEsistenti: appuntamenti,
    });
    expect(slot.some((s) => s.inizio.getTime() === orario(10).getTime())).toBe(true);
  });

  it("rispetta il buffer tra due appuntamenti dello stesso operatore", () => {
    const appuntamenti: AppuntamentoEsistente[] = [
      { operatoreId: "anna", inizio: orario(10), fine: orario(10, 30), stato: "confermato" },
    ];
    const slotConBuffer = calcolaSlotDisponibili({
      data: LUNEDI,
      durataMinuti: 15,
      servizioId: "taglio",
      operatoreId: "anna",
      operatori: [anna],
      orari: orariStandard,
      chiusure: [],
      appuntamentiEsistenti: appuntamenti,
      bufferMinuti: 15,
    });
    // Lo slot 10:30-10:45 esisterebbe senza buffer, ma con 15' di buffer dopo un
    // appuntamento che finisce alle 10:30 il primo slot valido è alle 10:45.
    expect(slotConBuffer.some((s) => s.inizio.getTime() === orario(10, 30).getTime())).toBe(false);
    expect(slotConBuffer.some((s) => s.inizio.getTime() === orario(10, 45).getTime())).toBe(true);
  });

  it("una chiusura per ferie dell'operatore blocca solo quell'operatore, non gli altri", () => {
    const chiusure: Chiusura[] = [
      { operatoreId: "anna", data: "2026-09-07", giornoIntero: true },
    ];
    const slotAnna = calcolaSlotDisponibili({
      data: LUNEDI,
      durataMinuti: 30,
      servizioId: "taglio",
      operatoreId: "anna",
      operatori: [anna, bruno],
      orari: orariStandard,
      chiusure,
      appuntamentiEsistenti: [],
    });
    const slotBruno = calcolaSlotDisponibili({
      data: LUNEDI,
      durataMinuti: 30,
      servizioId: "taglio",
      operatoreId: "bruno",
      operatori: [anna, bruno],
      orari: orariStandard,
      chiusure,
      appuntamentiEsistenti: [],
    });
    expect(slotAnna).toEqual([]);
    expect(slotBruno.length).toBeGreaterThan(0);
  });

  it("una chiusura di tutto il salone (operatoreId null) blocca tutti", () => {
    const chiusure: Chiusura[] = [{ operatoreId: null, data: "2026-09-08", giornoIntero: true }];
    const slot = calcolaSlotDisponibili({
      data: MARTEDI,
      durataMinuti: 30,
      servizioId: "taglio",
      operatori: [anna, bruno],
      orari: orariStandard,
      chiusure,
      appuntamentiEsistenti: [],
    });
    expect(slot).toEqual([]);
  });

  it("operatore non specificato: propone slot di tutti gli operatori compatibili col servizio", () => {
    const slot = calcolaSlotDisponibili({
      data: MARTEDI,
      durataMinuti: 30,
      servizioId: "taglio", // sia Anna che Bruno lo erogano
      operatori: [anna, bruno],
      orari: orariStandard,
      chiusure: [],
      appuntamentiEsistenti: [],
    });
    const operatoriTrovati = new Set(slot.map((s) => s.operatoreId));
    expect(operatoriTrovati.has("anna")).toBe(true);
    expect(operatoriTrovati.has("bruno")).toBe(true);
  });

  it("un operatore non compatibile con il servizio non compare mai", () => {
    const slot = calcolaSlotDisponibili({
      data: MARTEDI,
      durataMinuti: 30,
      servizioId: "colore", // solo Anna lo eroga
      operatori: [anna, bruno],
      orari: orariStandard,
      chiusure: [],
      appuntamentiEsistenti: [],
    });
    expect(slot.every((s) => s.operatoreId === "anna")).toBe(true);
  });
});

describe("griglia degli orari proposti", () => {
  // Difetto reale segnalato da Gabriel il 18/09/2026: con un evento esterno
  // 13:40-15:40 importato da Google Calendar, gli slot successivi diventavano
  // 15:40, 15:55, 16:10... perché la griglia ripartiva dalla fine dell'impegno
  // invece che dall'apertura. Ora si perde al massimo un passo di poltrona,
  // ma gli orari proposti restano leggibili.
  const evento1340: AppuntamentoEsistente[] = [
    {
      operatoreId: "anna",
      inizio: orario(13, 40, MARTEDI),
      fine: orario(15, 40, MARTEDI),
      stato: "confermato",
    },
  ];

  function slotMartedi(extra: Partial<Parameters<typeof calcolaSlotDisponibili>[0]> = {}) {
    return calcolaSlotDisponibili({
      data: MARTEDI, // 09:00-18:00, senza pausa pranzo
      durataMinuti: 30,
      servizioId: "taglio",
      operatoreId: "anna",
      operatori: [anna],
      orari: orariStandard,
      chiusure: [],
      appuntamentiEsistenti: evento1340,
      ...extra,
    });
  }

  it("dopo un impegno che finisce fuori griglia riparte dalla griglia, non dalla sua fine", () => {
    const slot = slotMartedi();
    expect(slot.some((s) => s.inizio.getTime() === orario(15, 40, MARTEDI).getTime())).toBe(false);
    const primoDopo = slot.find((s) => s.inizio.getTime() >= orario(15, 40, MARTEDI).getTime());
    expect(primoDopo?.inizio.getTime()).toBe(orario(15, 45, MARTEDI).getTime());
  });

  it("ogni slot proposto cade su un multiplo del passo contato dall'apertura", () => {
    for (const s of slotMartedi()) {
      const minutiDallApertura = s.inizio.getUTCHours() * 60 + s.inizio.getUTCMinutes() - 9 * 60;
      expect(minutiDallApertura % 15).toBe(0);
    }
  });

  it("l'ancoraggio segue il passo scelto, non i 15 minuti di default", () => {
    // Con passo 30 il primo punto di griglia dopo le 15:40 è le 16:00.
    const slot = slotMartedi({ passoMinuti: 30 });
    const primoDopo = slot.find((s) => s.inizio.getTime() >= orario(15, 40, MARTEDI).getTime());
    expect(primoDopo?.inizio.getTime()).toBe(orario(16, 0, MARTEDI).getTime());
  });

  it("un impegno che finisce sulla griglia non fa perdere lo slot attaccato", () => {
    const slot = slotMartedi({
      appuntamentiEsistenti: [
        {
          operatoreId: "anna",
          inizio: orario(10, 0, MARTEDI),
          fine: orario(11, 0, MARTEDI),
          stato: "confermato",
        },
      ],
    });
    expect(slot.some((s) => s.inizio.getTime() === orario(11, 0, MARTEDI).getTime())).toBe(true);
  });

  it("resta ancorata all'apertura anche dopo la pausa pranzo", () => {
    // Lunedì: pausa 13:00-14:00, più un impegno 14:00-14:50 fuori griglia.
    const slot = calcolaSlotDisponibili({
      data: LUNEDI,
      durataMinuti: 30,
      servizioId: "taglio",
      operatoreId: "anna",
      operatori: [anna],
      orari: orariStandard,
      chiusure: [],
      appuntamentiEsistenti: [
        { operatoreId: "anna", inizio: orario(14), fine: orario(14, 50), stato: "confermato" },
      ],
    });
    const primoPomeriggio = slot.find((s) => s.inizio.getTime() >= orario(14, 50).getTime());
    expect(primoPomeriggio?.inizio.getTime()).toBe(orario(15, 0).getTime());
  });

  it("un passo non valido non manda in loop: nessuno slot", () => {
    expect(slotMartedi({ passoMinuti: 0 })).toEqual([]);
  });
});

describe("giornoChiuso", () => {
  // Bug UX segnalato da Gabriel il 14/09/2026: distinguere "il salone non
  // apre proprio questo giorno" da "il salone è aperto ma è pieno", i due
  // casi che `calcolaSlotDisponibili` collassa entrambi in un array vuoto.
  it("true per un giorno marcato esplicitamente chiuso", () => {
    expect(giornoChiuso(orariStandard, new Date(Date.UTC(2026, 8, 6)))).toBe(true); // domenica
  });

  it("true per un giorno senza nessuna riga di orario configurata", () => {
    const orariIncompleti: OrarioGiorno[] = orariStandard.filter((o) => o.giornoSettimana !== 1);
    expect(giornoChiuso(orariIncompleti, LUNEDI)).toBe(true);
  });

  it("true se apertura/chiusura mancano nonostante chiuso sia false", () => {
    const orariMalconfigurati: OrarioGiorno[] = [{ giornoSettimana: 1, chiuso: false }];
    expect(giornoChiuso(orariMalconfigurati, LUNEDI)).toBe(true);
  });

  it("false per un giorno regolarmente aperto, indipendentemente dagli slot poi trovati", () => {
    expect(giornoChiuso(orariStandard, LUNEDI)).toBe(false);
  });
});

describe("verificaConflitto", () => {
  const esistenti: AppuntamentoEsistente[] = [
    { operatoreId: "anna", inizio: orario(10), fine: orario(11), stato: "confermato" },
  ];

  it("rileva una sovrapposizione parziale", () => {
    expect(verificaConflitto(orario(10, 30), orario(11, 30), "anna", esistenti)).toBe(true);
  });

  it("non segnala conflitto per un altro operatore nello stesso orario", () => {
    expect(verificaConflitto(orario(10, 30), orario(11, 30), "bruno", esistenti)).toBe(false);
  });

  it("non segnala conflitto per uno slot adiacente senza sovrapposizione", () => {
    expect(verificaConflitto(orario(11), orario(11, 30), "anna", esistenti)).toBe(false);
  });

  it("con un buffer, uno slot adiacente diventa conflitto", () => {
    expect(verificaConflitto(orario(11), orario(11, 30), "anna", esistenti, 15)).toBe(true);
  });

  it("un appuntamento no_show non genera conflitto", () => {
    const conNoShow: AppuntamentoEsistente[] = [
      { operatoreId: "anna", inizio: orario(10), fine: orario(11), stato: "no_show" },
    ];
    expect(verificaConflitto(orario(10, 30), orario(11), "anna", conNoShow)).toBe(false);
  });
});

describe("calcolaSlotServiziConsecutivi", () => {
  it("trova uno slot solo se l'intera catena di servizi entra senza interruzioni", () => {
    const slot = calcolaSlotServiziConsecutivi(
      {
        data: MARTEDI,
        operatoreId: "anna",
        operatori: [anna],
        orari: orariStandard,
        chiusure: [],
        appuntamentiEsistenti: [],
      },
      [
        { id: "taglio", durataMinuti: 30 },
        { id: "colore", durataMinuti: 60 },
      ]
    );
    expect(slot.length).toBeGreaterThan(0);
    for (const s of slot) {
      expect((s.fine.getTime() - s.inizio.getTime()) / 60_000).toBe(90);
    }
  });

  it("esclude un operatore che non sa erogare uno dei servizi della catena", () => {
    const slot = calcolaSlotServiziConsecutivi(
      {
        data: MARTEDI,
        operatori: [anna, bruno], // bruno non fa "colore"
        orari: orariStandard,
        chiusure: [],
        appuntamentiEsistenti: [],
      },
      [
        { id: "taglio", durataMinuti: 30 },
        { id: "colore", durataMinuti: 60 },
      ]
    );
    expect(slot.every((s) => s.operatoreId === "anna")).toBe(true);
  });
});

describe("diagnosticaOperatori", () => {
  const CON_TUTTO = { id: "op-1", attivo: true, servizioIds: ["taglio", "piega"] };
  const SOLO_TAGLIO = { id: "op-2", attivo: true, servizioIds: ["taglio"] };
  const SOLO_PIEGA = { id: "op-3", attivo: true, servizioIds: ["piega"] };

  it("non accusa nessuno quando un operatore copre tutto", () => {
    expect(diagnosticaOperatori([CON_TUTTO], ["taglio", "piega"])).toBeNull();
  });

  it("nomina il servizio che nessuno sa fare", () => {
    expect(diagnosticaOperatori([SOLO_TAGLIO], ["taglio", "massaggio"])).toEqual({
      tipo: "servizi_senza_operatore",
      servizioIds: ["massaggio"],
    });
  });

  it("un operatore disattivato non conta come copertura", () => {
    expect(diagnosticaOperatori([{ ...CON_TUTTO, attivo: false }], ["taglio"])).toEqual({
      tipo: "servizi_senza_operatore",
      servizioIds: ["taglio"],
    });
  });

  it("con un operatore scelto guarda solo lui, senza mentire sugli altri", () => {
    // op-2 il taglio lo fa, la piega no: chiedendo di lui la risposta e' la
    // piega, non "nessuno fa la piega" (op-3 la fa).
    expect(diagnosticaOperatori([SOLO_TAGLIO, SOLO_PIEGA], ["taglio", "piega"], "op-2")).toEqual({
      tipo: "servizi_senza_operatore",
      servizioIds: ["piega"],
    });
  });

  it("distingue 'nessuno li fa tutti di seguito' da 'nessuno lo fa'", () => {
    // Ogni servizio ha il suo operatore, ma i servizi consecutivi vogliono la
    // stessa persona per tutta la catena: e' un motivo diverso.
    expect(diagnosticaOperatori([SOLO_TAGLIO, SOLO_PIEGA], ["taglio", "piega"])).toEqual({
      tipo: "nessuno_copre_tutta_la_catena",
    });
  });

  it("senza servizi scelti non c'e' niente da diagnosticare", () => {
    expect(diagnosticaOperatori([SOLO_TAGLIO], [])).toBeNull();
  });
});
