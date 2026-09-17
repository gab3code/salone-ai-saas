import { describe, expect, it } from "vitest";
import {
  GIORNI_CONSERVAZIONE_DATI_DEMO,
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
    // messaggi: sotto le cinquanta prove al mese la demo non servirebbe.
    expect(QUOTA_MENSILE_MESSAGGI_DEMO / 6).toBeGreaterThan(50);
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
