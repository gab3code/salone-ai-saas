import { describe, expect, it } from "vitest";
import { calcolaMetriche, type AppuntamentoMetrica, type ClienteMetrica } from "./metriche";

const OGGI = new Date(Date.UTC(2026, 8, 2, 10, 0, 0)); // 2026-09-02 10:00 UTC

function appuntamento(overrides: Partial<AppuntamentoMetrica>): AppuntamentoMetrica {
  return {
    inizio: new Date(Date.UTC(2026, 8, 2, 9, 0, 0)),
    fine: new Date(Date.UTC(2026, 8, 2, 9, 30, 0)),
    stato: "confermato",
    clienteId: "cliente-1",
    operatoreId: "operatore-1",
    servizioId: "servizio-1",
    ...overrides,
  };
}

const orarioApertoOggi = { chiuso: false, apertura: "09:00", chiusura: "19:00" };
const prezzi = new Map([["servizio-1", 2500]]);

describe("calcolaMetriche", () => {
  it("conta solo gli appuntamenti confermati di oggi, non quelli di altri giorni o cancellati", () => {
    const m = calcolaMetriche({
      adesso: OGGI,
      appuntamenti: [
        appuntamento({}), // oggi, confermato
        appuntamento({ inizio: new Date(Date.UTC(2026, 8, 1, 9, 0, 0)) }), // ieri
        appuntamento({ stato: "cancellato" }), // oggi ma cancellato
      ],
      clienti: [],
      prezzoCentesimiPerServizio: prezzi,
      orarioOggi: orarioApertoOggi,
    });
    expect(m.appuntamentiOggi).toBe(1);
  });

  it("somma il prezzo reale del servizio per il valore prenotazioni di oggi, mai un numero inventato", () => {
    const m = calcolaMetriche({
      adesso: OGGI,
      appuntamenti: [appuntamento({}), appuntamento({ servizioId: "servizio-sconosciuto" })],
      clienti: [],
      prezzoCentesimiPerServizio: prezzi,
      orarioOggi: orarioApertoOggi,
    });
    // Un servizio senza prezzo noto contribuisce 0, non un prezzo a caso.
    expect(m.valorePrenotazioniOggiCentesimi).toBe(2500);
  });

  it("calcola l'occupazione di oggi come minuti occupati su minuti aperti, pausa esclusa", () => {
    const m = calcolaMetriche({
      adesso: OGGI,
      appuntamenti: [appuntamento({})], // 30 minuti occupati
      clienti: [],
      prezzoCentesimiPerServizio: prezzi,
      orarioOggi: { chiuso: false, apertura: "09:00", chiusura: "11:00", pausaInizio: "10:00", pausaFine: "10:30" },
    });
    // Aperto 9-11 (120 min) meno pausa 30 min = 90 min aperti; 30 occupati -> 33%.
    expect(m.minutiApertiOggi).toBe(90);
    expect(m.minutiOccupatiOggi).toBe(30);
    expect(m.percentualeOccupazioneOggi).toBe(33);
  });

  it("restituisce occupazione null (non 0 o NaN) se il salone è chiuso oggi", () => {
    const m = calcolaMetriche({
      adesso: OGGI,
      appuntamenti: [],
      clienti: [],
      prezzoCentesimiPerServizio: prezzi,
      orarioOggi: { chiuso: true },
    });
    expect(m.percentualeOccupazioneOggi).toBeNull();
    expect(m.minutiApertiOggi).toBe(0);
  });

  it("conta un cliente come inattivo solo se ha prenotato in passato ma non negli ultimi 60 giorni", () => {
    const clienti: ClienteMetrica[] = [
      { id: "mai-prenotato", createdAt: new Date(Date.UTC(2026, 7, 1)) },
      { id: "recente", createdAt: new Date(Date.UTC(2026, 0, 1)) },
      { id: "lapsed", createdAt: new Date(Date.UTC(2025, 0, 1)) },
    ];
    const m = calcolaMetriche({
      adesso: OGGI,
      appuntamenti: [
        // "recente" ha prenotato ieri -> non inattivo.
        appuntamento({ clienteId: "recente", inizio: new Date(Date.UTC(2026, 8, 1, 9, 0, 0)) }),
        // "lapsed" ha prenotato 100 giorni fa -> inattivo.
        appuntamento({ clienteId: "lapsed", inizio: new Date(Date.UTC(2026, 4, 25, 9, 0, 0)) }),
        // "mai-prenotato" non ha nessun appuntamento confermato -> NON è "inattivo" (mai iniziato).
      ],
      clienti,
      prezzoCentesimiPerServizio: prezzi,
      orarioOggi: orarioApertoOggi,
    });
    expect(m.clientiInattiviDa60Giorni).toBe(1);
  });

  it("conta i nuovi clienti solo se creati negli ultimi 30 giorni", () => {
    const m = calcolaMetriche({
      adesso: OGGI,
      appuntamenti: [],
      clienti: [
        { id: "nuovo", createdAt: new Date(Date.UTC(2026, 8, 1)) },
        { id: "vecchio", createdAt: new Date(Date.UTC(2026, 0, 1)) },
      ],
      prezzoCentesimiPerServizio: prezzi,
      orarioOggi: orarioApertoOggi,
    });
    expect(m.nuoviClientiUltimi30Giorni).toBe(1);
    expect(m.clientiTotali).toBe(2);
  });
});
