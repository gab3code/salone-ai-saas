import { describe, expect, it } from "vitest";
import { eseguiStrumentoDemo, statoDemoVuoto, type StatoDemo } from "./strumenti-demo";
import { OPERATORI_DEMO, SERVIZI_DEMO } from "./salone-finto";

/**
 * REGOLA DI QUESTO FILE: date con `Date.UTC` o stringhe ISO che finiscono
 * per Z, mai `new Date(anno, mese, giorno)`.
 *
 * Questi test girano SENZA database e senza nessun finto client Supabase --
 * che è metà del motivo per cui la demo è stata rifatta senza tenant.
 */
const PRO = { haInformazioniAttivita: true };
const GROWTH = { haInformazioniAttivita: false };

const taglioDonna = SERVIZI_DEMO.find((s) => s.nome === "Taglio donna")!;
const piega = SERVIZI_DEMO.find((s) => s.nome === "Piega")!;
const barba = SERVIZI_DEMO.find((s) => s.nome === "Barba")!;
const giulia = OPERATORI_DEMO.find((o) => o.nome === "Giulia")!;
const luca = OPERATORI_DEMO.find((o) => o.nome === "Luca")!;

/** Un mercoledì: il salone è aperto (chiude domenica e lunedì). */
const MERCOLEDI = "2026-09-23";

function slotDi(risultato: Record<string, unknown>) {
  return risultato.slot as { inizio: string; fine: string; operatore_id: string }[];
}

describe("gli elenchi", () => {
  it("i servizi hanno la stessa forma di quelli veri, prezzo in euro", () => {
    const { risultato } = eseguiStrumentoDemo("elenca_servizi", {}, statoDemoVuoto(), GROWTH);
    const servizi = risultato.servizi as Record<string, unknown>[];
    expect(servizi).toHaveLength(SERVIZI_DEMO.length);
    expect(Object.keys(servizi[0]).sort()).toEqual(
      ["categoria", "descrizione", "durata_minuti", "id", "nome", "prezzo_euro"].sort()
    );
    expect(servizi.find((s) => s.nome === "Taglio donna")?.prezzo_euro).toBe(35);
  });

  it("gli id dei servizi sono uuid veri", () => {
    // Non è estetica: gli strumenti veri validano il formato e rifiutano un
    // id che non lo sia. Con id finti la demo divergerebbe dal prodotto
    // proprio nel punto più delicato.
    for (const s of SERVIZI_DEMO) expect(s.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
    for (const o of OPERATORI_DEMO) expect(o.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });
});

describe("la knowledge base è un gate di piano", () => {
  it("su Pro risponde con parcheggio, pagamenti e FAQ", () => {
    const { risultato } = eseguiStrumentoDemo("info_attivita", {}, statoDemoVuoto(), PRO);
    expect(risultato.parcheggio).toBeTruthy();
    expect((risultato.faq as unknown[]).length).toBeGreaterThan(0);
  });

  it("su Growth non risponde, anche se lo strumento viene chiamato lo stesso", () => {
    // Il modello su Growth non vede nemmeno lo strumento, ma un gate che
    // esiste in un posto solo prima o poi viene aggirato da un cambio altrove.
    const { risultato } = eseguiStrumentoDemo("info_attivita", {}, statoDemoVuoto(), GROWTH);
    expect(risultato.errore).toBeTruthy();
    expect(risultato.parcheggio).toBeUndefined();
  });
});

describe("la disponibilità", () => {
  it("un giorno di chiusura lo dice, e non propone slot", () => {
    const { risultato } = eseguiStrumentoDemo(
      "verifica_disponibilita",
      { servizio_ids: [taglioDonna.id], data: "2026-09-21" }, // lunedì
      statoDemoVuoto(),
      GROWTH
    );
    expect(risultato.giorno_chiuso).toBe(true);
    expect(slotDi(risultato)).toHaveLength(0);
    expect(risultato.giorno_settimana_richiesto).toBe("lunedì");
  });

  it("in un giorno aperto propone slot veri, dentro l'orario e fuori dalla pausa", () => {
    const { risultato } = eseguiStrumentoDemo(
      "verifica_disponibilita",
      { servizio_ids: [taglioDonna.id], data: MERCOLEDI },
      statoDemoVuoto(),
      GROWTH
    );
    expect(risultato.giorno_chiuso).toBe(false);
    const slot = slotDi(risultato);
    expect(slot.length).toBeGreaterThan(0);
    for (const s of slot) {
      const ora = new Date(s.inizio).getUTCHours();
      const fine = new Date(s.fine);
      expect(ora).toBeGreaterThanOrEqual(9);
      expect(fine.getUTCHours() * 60 + fine.getUTCMinutes()).toBeLessThanOrEqual(19 * 60);
      // Nessuno slot può attraversare la pausa 13:00-14:00.
      const inizioMin = ora * 60 + new Date(s.inizio).getUTCMinutes();
      const fineMin = fine.getUTCHours() * 60 + fine.getUTCMinutes();
      expect(inizioMin < 13 * 60 ? fineMin <= 13 * 60 : inizioMin >= 14 * 60).toBe(true);
    }
  });

  it("propone solo operatori che sanno fare quel servizio", () => {
    const { risultato } = eseguiStrumentoDemo(
      "verifica_disponibilita",
      { servizio_ids: [barba.id], data: MERCOLEDI },
      statoDemoVuoto(),
      GROWTH
    );
    // La barba la fa solo Luca: se proponesse Giulia, la demo mostrerebbe
    // una capacità che il prodotto non ha.
    for (const s of slotDi(risultato)) expect(s.operatore_id).toBe(luca.id);
  });

  it("i servizi consecutivi restano sullo stesso operatore e durano la somma", () => {
    const { risultato } = eseguiStrumentoDemo(
      "verifica_disponibilita",
      { servizio_ids: [taglioDonna.id, piega.id], data: MERCOLEDI },
      statoDemoVuoto(),
      GROWTH
    );
    const slot = slotDi(risultato);
    expect(slot.length).toBeGreaterThan(0);
    const durata = (new Date(slot[0].fine).getTime() - new Date(slot[0].inizio).getTime()) / 60000;
    expect(durata).toBe(taglioDonna.durataMinuti + piega.durataMinuti);
  });

  it("rifiuta i nomi al posto degli id, con lo stesso messaggio del prodotto", () => {
    const { risultato } = eseguiStrumentoDemo(
      "verifica_disponibilita",
      { servizio_ids: ["Taglio donna"], data: MERCOLEDI },
      statoDemoVuoto(),
      GROWTH
    );
    expect(String(risultato.errore)).toContain("id esatti (uuid)");
  });

  it("una data scritta male non fa esplodere niente", () => {
    const { risultato } = eseguiStrumentoDemo(
      "verifica_disponibilita",
      { servizio_ids: [taglioDonna.id], data: "23 settembre" },
      statoDemoVuoto(),
      GROWTH
    );
    expect(String(risultato.errore)).toContain("YYYY-MM-DD");
  });
});

describe("la prenotazione", () => {
  function prenota(stato: StatoDemo, ora: string, operatoreId = giulia.id, servizi = [taglioDonna.id]) {
    return eseguiStrumentoDemo(
      "crea_prenotazione",
      {
        servizio_ids: servizi,
        operatore_id: operatoreId,
        inizio: `${MERCOLEDI}T${ora}`,
        cliente_nome: "Anna",
        cliente_telefono: "3331112223",
      },
      stato,
      GROWTH
    );
  }

  it("crea l'appuntamento nella sessione, e da nessun'altra parte", () => {
    const esito = prenota(statoDemoVuoto(), "10:00");
    expect(esito.risultato.creato).toBe(true);
    expect(esito.stato?.appuntamenti).toHaveLength(1);
    expect(esito.stato?.appuntamenti[0].clienteNome).toBe("Anna");
  });

  it("senza nome chiede il nome, non prenota a vuoto", () => {
    const esito = eseguiStrumentoDemo(
      "crea_prenotazione",
      { servizio_ids: [taglioDonna.id], operatore_id: giulia.id, inizio: `${MERCOLEDI}T10:00`, cliente_nome: "  ", cliente_telefono: "333" },
      statoDemoVuoto(),
      GROWTH
    );
    expect(String(esito.risultato.errore)).toContain("cliente_nome");
    expect(esito.stato).toBeUndefined();
  });

  it("non lascia prenotare un operatore che non fa quel servizio", () => {
    const esito = prenota(statoDemoVuoto(), "10:00", luca.id, [taglioDonna.id]);
    expect(String(esito.risultato.errore)).toContain("non esegue");
  });

  it("lo stesso orario non si prende due volte", () => {
    const primo = prenota(statoDemoVuoto(), "10:00");
    const secondo = prenota(primo.stato!, "10:00");
    expect(String(secondo.risultato.errore)).toContain("non è più libero");
    expect(secondo.stato).toBeUndefined();
  });

  it("un orario che si sovrappone in parte è comunque un conflitto", () => {
    const primo = prenota(statoDemoVuoto(), "10:00"); // 45 minuti
    const secondo = prenota(primo.stato!, "10:30");
    expect(String(secondo.risultato.errore)).toContain("non è più libero");
  });

  it("due operatori diversi possono avere lo stesso orario", () => {
    const primo = prenota(statoDemoVuoto(), "10:00", giulia.id);
    const marta = OPERATORI_DEMO.find((o) => o.nome === "Marta")!;
    const secondo = prenota(primo.stato!, "10:00", marta.id);
    expect(secondo.risultato.creato).toBe(true);
  });

  it("dopo la prenotazione quello slot sparisce dalla disponibilità", () => {
    const dopo = prenota(statoDemoVuoto(), "10:00").stato!;
    const { risultato } = eseguiStrumentoDemo(
      "verifica_disponibilita",
      { servizio_ids: [taglioDonna.id], data: MERCOLEDI, operatore_id: giulia.id },
      dopo,
      GROWTH
    );
    const alleDieci = slotDi(risultato).filter((s) => s.inizio.includes("T10:00"));
    expect(alleDieci, "lo slot appena preso non può essere ancora libero").toHaveLength(0);
  });
});

describe("isolamento fra visitatori", () => {
  it("l'agenda di uno non tocca quella di un altro", () => {
    // È il punto che ha fatto buttare le due architetture precedenti: qui
    // l'isolamento è gratis, perché lo stato è un oggetto in memoria e ogni
    // visitatore ha il suo.
    const visitatoreA = statoDemoVuoto();
    const visitatoreB = statoDemoVuoto();

    const dopoA = eseguiStrumentoDemo(
      "crea_prenotazione",
      { servizio_ids: [taglioDonna.id], operatore_id: giulia.id, inizio: `${MERCOLEDI}T10:00`, cliente_nome: "A", cliente_telefono: "1" },
      visitatoreA,
      GROWTH
    ).stato!;

    const esitoB = eseguiStrumentoDemo(
      "crea_prenotazione",
      { servizio_ids: [taglioDonna.id], operatore_id: giulia.id, inizio: `${MERCOLEDI}T10:00`, cliente_nome: "B", cliente_telefono: "2" },
      visitatoreB,
      GROWTH
    );

    expect(dopoA.appuntamenti).toHaveLength(1);
    expect(esitoB.risultato.creato, "B prenota lo stesso orario senza accorgersi di A").toBe(true);
    expect(visitatoreA.appuntamenti, "l'oggetto di A non è stato mutato").toHaveLength(0);
  });
});

describe("quello che la demo non sa fare", () => {
  it("non cerca le prenotazioni da un numero di telefono", () => {
    const { risultato } = eseguiStrumentoDemo("cerca_prenotazioni_cliente", {}, statoDemoVuoto(), GROWTH);
    expect(risultato.errore).toBeTruthy();
    expect(risultato.prenotazioni).toBeUndefined();
  });

  it("uno strumento sconosciuto risponde con un errore, non con un'eccezione", () => {
    expect(() => eseguiStrumentoDemo("qualcosa_di_inventato", {}, statoDemoVuoto(), PRO)).not.toThrow();
  });
});
