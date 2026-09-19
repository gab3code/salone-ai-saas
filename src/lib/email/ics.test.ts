import { describe, expect, it } from "vitest";
import { costruisciIcs, dataIcs, piegaRiga, testoIcs } from "./ics";

describe("ics", () => {
  const evento = {
    uid: "app-1@salone-ai",
    inizio: new Date(Date.UTC(2026, 8, 23, 14, 0, 0)),
    fine: new Date(Date.UTC(2026, 8, 23, 14, 30, 0)),
    titolo: "Pedicure da prova gabriel",
    descrizione: "Con Giorgia.\nGestisci: https://esempio.it/gestisci/app-1",
    luogo: "Via Dante 15, Milano",
    url: "https://esempio.it/gestisci/app-1",
    generatoIl: new Date(Date.UTC(2026, 8, 19, 4, 0, 0)),
  };

  it("scrive le date in UTC con la Z, senza fuso locale", () => {
    expect(dataIcs(evento.inizio)).toBe("20260923T140000Z");
  });

  it("scappa virgole, punti e virgola e a capo", () => {
    expect(testoIcs("Via Dante 15, Milano; piano 2\nCitofono")).toBe("Via Dante 15\\, Milano\\; piano 2\\nCitofono");
  });

  it("piega le righe lunghe a 75 ottetti, contando i byte e non i caratteri", () => {
    const lunga = "DESCRIPTION:" + "è".repeat(60); // 2 byte l'una
    const piegata = piegaRiga(lunga);
    for (const riga of piegata.split("\r\n ")) {
      expect(Buffer.byteLength(riga, "utf8")).toBeLessThanOrEqual(75);
    }
    // Ricomposta, e' la riga di partenza.
    expect(piegata.replace(/\r\n /g, "")).toBe(lunga);
  });

  it("produce un VCALENDAR completo, con CRLF e UID stabile", () => {
    const ics = costruisciIcs(evento);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("\r\nUID:app-1@salone-ai\r\n");
    expect(ics).toContain("DTSTART:20260923T140000Z");
    expect(ics).toContain("DTEND:20260923T143000Z");
    expect(ics).toContain("SUMMARY:Pedicure da prova gabriel");
    expect(ics).toContain("LOCATION:Via Dante 15\\, Milano");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Nessuna riga nuda senza CRLF.
    expect(ics.includes("\n") && !ics.includes("\r\n")).toBe(false);
  });

  it("senza luogo e descrizione non scrive righe vuote", () => {
    const ics = costruisciIcs({ ...evento, descrizione: undefined, luogo: undefined, url: undefined });
    expect(ics).not.toContain("LOCATION");
    expect(ics).not.toContain("DESCRIPTION");
    expect(ics).not.toContain("URL:");
  });
});
