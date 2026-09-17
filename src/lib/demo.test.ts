import { describe, expect, it } from "vitest";
import {
  COOKIE_GRUPPO_DEMO,
  GIORNI_CONSERVAZIONE_DATI_DEMO,
  GIORNI_COOKIE_DEMO,
  MAX_CLONI_DEMO_AL_GIORNO,
  nuovoGruppoDemo,
  slugCloneDemo,
  QUOTA_MENSILE_MESSAGGI_DEMO,
  SLUG_DEMO,
  SLUG_DEMO_GROWTH,
  SLUG_DEMO_PRO,
  STRUMENTI_VIETATI_DEMO,
  eSlugDemo,
  strumentiPerDemo,
} from "./demo";
import { STRUMENTI_AI } from "./ai/tools-nomi";
import { limiteMensileMessaggi } from "./ai/limiti";

describe("il salone dimostrativo", () => {
  it("ha due slug distinti, uno per piano", () => {
    expect(SLUG_DEMO_GROWTH).not.toBe(SLUG_DEMO_PRO);
    expect(SLUG_DEMO).toEqual([SLUG_DEMO_GROWTH, SLUG_DEMO_PRO]);
  });

  it("riconosce i suoi slug e nessun altro", () => {
    expect(eSlugDemo(SLUG_DEMO_GROWTH)).toBe(true);
    expect(eSlugDemo(SLUG_DEMO_PRO)).toBe(true);
    for (const altro of ["", "salone-vero", "demo-qualcosa", "DEMO"]) {
      expect(eSlugDemo(altro), altro).toBe(false);
    }
  });
});

describe("il tetto della demo", () => {
  it("è più basso di quello di ogni piano che la può ospitare", () => {
    // La demo gira su growth e pro, ma non la paga nessun abbonato: se il suo
    // tetto fosse uguale a quello del piano, non sarebbe un tetto.
    for (const piano of ["growth", "pro"]) {
      expect(QUOTA_MENSILE_MESSAGGI_DEMO, piano).toBeLessThan(limiteMensileMessaggi(piano));
    }
  });

  it("basta comunque per diverse decine di prenotazioni provate", () => {
    // Una conversazione di prenotazione completa sta in cinque o sei
    // messaggi. Il tetto e' PER SALONE e i saloni sono due: sotto le
    // cinquanta prove complete al mese in tutto, la demo non servirebbe.
    const proveComplete = (QUOTA_MENSILE_MESSAGGI_DEMO * SLUG_DEMO.length) / 6;
    expect(proveComplete).toBeGreaterThan(50);
  });

  it("il tetto è per salone, e i saloni sono due: il conto va fatto sul totale", () => {
    // Scritto come test perché la prima versione del commento diceva "su
    // TUTTA la demo" ed era falsa: il contatore vive sulla riga del tenant,
    // quindi ogni salone ha il suo. Chi cambia il numero deve vedere questa
    // riga e ricordarsi di moltiplicare per due.
    expect(SLUG_DEMO.length).toBe(2);
  });
});

describe("gli strumenti concessi alla demo", () => {
  it("non permettono di pescare la prenotazione di uno sconosciuto", () => {
    // Nella demo la gente scrive il proprio numero VERO. `cerca_prenotazioni_cliente`
    // trova gli appuntamenti a partire dal telefono: su un salone vero è
    // giusto, qui diventa un modo per leggere nome e orario di un estraneo
    // provando numeri.
    expect(strumentiPerDemo()).not.toContain("cerca_prenotazioni_cliente");
    expect(STRUMENTI_VIETATI_DEMO).toContain("cerca_prenotazioni_cliente");
  });

  it("permettono di prenotare davvero: è il punto della demo", () => {
    expect(strumentiPerDemo()).toContain("crea_prenotazione");
    expect(strumentiPerDemo()).toContain("verifica_disponibilita");
  });

  it("concedono tutto il resto, perché la demo mostra il prodotto intero", () => {
    expect(strumentiPerDemo()).toHaveLength(STRUMENTI_AI.length - STRUMENTI_VIETATI_DEMO.length);
    for (const nome of STRUMENTI_AI) {
      if (STRUMENTI_VIETATI_DEMO.includes(nome)) continue;
      expect(strumentiPerDemo(), nome).toContain(nome);
    }
  });

  it("ogni nome vietato esiste davvero fra gli strumenti", () => {
    // Un nome scritto male qui non darebbe nessun errore: vieterebbe uno
    // strumento inesistente e lascerebbe passare quello vero.
    for (const nome of STRUMENTI_VIETATI_DEMO) expect(STRUMENTI_AI, nome).toContain(nome);
  });
});

describe("la conservazione dei dati lasciati dai visitatori", () => {
  it("è di pochi giorni, non di mesi", () => {
    expect(GIORNI_CONSERVAZIONE_DATI_DEMO).toBeGreaterThanOrEqual(1);
    expect(GIORNI_CONSERVAZIONE_DATI_DEMO).toBeLessThanOrEqual(7);
  });
});


describe("i cloni per visitatore", () => {
  it("lo slug del clone non collide mai con quello dei modelli", () => {
    // Un clone che si chiamasse "demo" sovrascriverebbe il modello, e con lui
    // la fonte da cui tutti gli altri cloni nascono.
    const gruppo = nuovoGruppoDemo();
    expect(slugCloneDemo(gruppo, "growth")).not.toBe(SLUG_DEMO_GROWTH);
    expect(slugCloneDemo(gruppo, "pro")).not.toBe(SLUG_DEMO_PRO);
  });

  it("i due cloni dello stesso visitatore hanno slug diversi", () => {
    const gruppo = nuovoGruppoDemo();
    expect(slugCloneDemo(gruppo, "growth")).not.toBe(slugCloneDemo(gruppo, "pro"));
  });

  it("due gruppi generati di fila sono diversi", () => {
    const visti = new Set(Array.from({ length: 200 }, () => nuovoGruppoDemo()));
    expect(visti.size).toBe(200);
  });

  it("il gruppo è fatto solo di caratteri buoni per un indirizzo", () => {
    for (let i = 0; i < 50; i++) expect(nuovoGruppoDemo()).toMatch(/^[a-z0-9]+$/);
  });

  it("il cookie non dura più di quanto durino i saloni a cui punta", () => {
    // Un cookie più lungo della conservazione punterebbe a un salone che la
    // pulizia notturna ha già portato via.
    expect(GIORNI_COOKIE_DEMO).toBeLessThanOrEqual(GIORNI_CONSERVAZIONE_DATI_DEMO);
  });

  it("il tetto giornaliero dei cloni è un numero di CLONI, non di visitatori", () => {
    // Ogni visitatore ne consuma due (Growth e Pro): chi cambia il numero
    // deve saperlo, altrimenti crede di servire il doppio delle persone.
    expect(MAX_CLONI_DEMO_AL_GIORNO % 2).toBe(0);
    expect(MAX_CLONI_DEMO_AL_GIORNO / 2).toBeGreaterThan(20);
  });

  it("il nome del cookie non cambia per sbaglio", () => {
    // È scritto nei browser dei visitatori: cambiarlo significa che tutti
    // perdono il loro salone e se ne fanno creare uno nuovo.
    expect(COOKIE_GRUPPO_DEMO).toBe("salone_ai_demo");
  });
});
