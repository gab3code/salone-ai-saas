import { describe, expect, it } from "vitest";
import { estraiIntervalliOccupati, parsaIcs } from "./ics";

const FINESTRA_DA = new Date(Date.UTC(2026, 8, 1));
const FINESTRA_A = new Date(Date.UTC(2026, 8, 30));

function icsConEventi(...vevents: string[]): string {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", ...vevents, "END:VCALENDAR"].join("\r\n");
}

describe("parsaIcs", () => {
  it("estrae un evento semplice con orario UTC (suffisso Z)", () => {
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:evento-1@esempio.it",
      "DTSTART:20260905T090000Z",
      "DTEND:20260905T100000Z",
      "SUMMARY:Palestra",
      "END:VEVENT"
    );
    const eventi = parsaIcs(ics);
    expect(eventi).toHaveLength(1);
    expect(eventi[0].uid).toBe("evento-1@esempio.it");
    expect(eventi[0].dtStart.toISOString()).toBe("2026-09-05T09:00:00.000Z");
    expect(eventi[0].dtEnd.toISOString()).toBe("2026-09-05T10:00:00.000Z");
  });

  it("rispetta le righe foldate su più righe fisiche (RFC 5545)", () => {
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:evento-2@esempio.it",
      "DTSTART:20260905T090000Z",
      "DTEND:20260905T100000Z",
      "SUMMARY:Una descrizione molto lunga che\r\n continua sulla riga dopo",
      "END:VEVENT"
    );
    const eventi = parsaIcs(ics);
    expect(eventi).toHaveLength(1); // non deve rompersi sul folding
  });

  it("converte un orario con TZID esplicito (Europe/Rome, ora legale CEST=UTC+2) in UTC reale", () => {
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:evento-3@esempio.it",
      "DTSTART;TZID=Europe/Rome:20260905T090000",
      "DTEND;TZID=Europe/Rome:20260905T100000",
      "END:VEVENT"
    );
    const eventi = parsaIcs(ics);
    // 09:00 CEST (UTC+2 a inizio settembre) = 07:00 UTC
    expect(eventi[0].dtStart.toISOString()).toBe("2026-09-05T07:00:00.000Z");
  });

  it("un evento tutto il giorno (VALUE=DATE) copre 24h, senza TZID trattato come UTC", () => {
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:evento-4@esempio.it",
      "DTSTART;VALUE=DATE:20260910",
      "END:VEVENT"
    );
    const eventi = parsaIcs(ics);
    expect(eventi[0].interoGiorno).toBe(true);
    expect(eventi[0].dtStart.toISOString()).toBe("2026-09-10T00:00:00.000Z");
    expect(eventi[0].dtEnd.toISOString()).toBe("2026-09-11T00:00:00.000Z");
  });

  it("usa DURATION quando DTEND è assente", () => {
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:evento-5@esempio.it",
      "DTSTART:20260905T090000Z",
      "DURATION:PT1H30M",
      "END:VEVENT"
    );
    const eventi = parsaIcs(ics);
    expect(eventi[0].dtEnd.toISOString()).toBe("2026-09-05T10:30:00.000Z");
  });
});

describe("estraiIntervalliOccupati", () => {
  it("esclude gli eventi CANCELLED", () => {
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:evento-6@esempio.it",
      "DTSTART:20260905T090000Z",
      "DTEND:20260905T100000Z",
      "STATUS:CANCELLED",
      "END:VEVENT"
    );
    expect(estraiIntervalliOccupati(ics, FINESTRA_DA, FINESTRA_A)).toHaveLength(0);
  });

  it("esclude gli eventi fuori dalla finestra richiesta", () => {
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:evento-7@esempio.it",
      "DTSTART:20261025T090000Z", // ottobre, fuori dalla finestra di settembre
      "DTEND:20261025T100000Z",
      "END:VEVENT"
    );
    expect(estraiIntervalliOccupati(ics, FINESTRA_DA, FINESTRA_A)).toHaveLength(0);
  });

  it("espande un RRULE settimanale (BYDAY) in più occorrenze dentro la finestra", () => {
    // Primo martedì di settembre 2026 alle 18:00, ripetuto ogni settimana.
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:corso-settimanale@esempio.it",
      "DTSTART:20260901T180000Z",
      "DTEND:20260901T190000Z",
      "RRULE:FREQ=WEEKLY;BYDAY=TU",
      "END:VEVENT"
    );
    const occupati = estraiIntervalliOccupati(ics, FINESTRA_DA, FINESTRA_A);
    // Settembre 2026 ha 5 martedì (1, 8, 15, 22, 29).
    expect(occupati.length).toBe(5);
    expect(occupati.every((o) => o.fine.getTime() - o.inizio.getTime() === 60 * 60_000)).toBe(true);
  });

  it("rispetta EXDATE escludendo una singola occorrenza ricorrente", () => {
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:corso-con-eccezione@esempio.it",
      "DTSTART:20260901T180000Z",
      "DTEND:20260901T190000Z",
      "RRULE:FREQ=WEEKLY;BYDAY=TU",
      "EXDATE:20260908T180000Z",
      "END:VEVENT"
    );
    const occupati = estraiIntervalliOccupati(ics, FINESTRA_DA, FINESTRA_A);
    expect(occupati.length).toBe(4); // 5 martedì meno l'8 settembre escluso
    expect(occupati.some((o) => o.inizio.toISOString().startsWith("2026-09-08"))).toBe(false);
  });

  it("un RRULE mensile/annuale non espanso mostra comunque l'occorrenza originale (fail-safe)", () => {
    const ics = icsConEventi(
      "BEGIN:VEVENT",
      "UID:evento-mensile@esempio.it",
      "DTSTART:20260905T090000Z",
      "DTEND:20260905T100000Z",
      "RRULE:FREQ=MONTHLY",
      "END:VEVENT"
    );
    const occupati = estraiIntervalliOccupati(ics, FINESTRA_DA, FINESTRA_A);
    expect(occupati).toHaveLength(1);
    expect(occupati[0].inizio.toISOString()).toBe("2026-09-05T09:00:00.000Z");
  });
});
