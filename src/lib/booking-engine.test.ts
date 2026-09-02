import { describe, expect, it } from "vitest";
import {
  calcolaSlotDisponibili,
  calcolaSlotServiziConsecutivi,
  verificaConflitto,
  type AppuntamentoEsistente,
  type Chiusura,
  type OrarioGiorno,
  type Operatore,
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
