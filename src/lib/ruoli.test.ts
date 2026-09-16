import { describe, expect, it } from "vitest";
import {
  eAdminPiattaforma,
  normalizzaRuolo,
  puoConfigurareAttivita,
  puoEsportareClienti,
  puoGestireAgenda,
  puoGestireFatturazione,
  puoGestireMembri,
  puoVedereAnalytics,
} from "./ruoli";

describe("normalizzaRuolo", () => {
  it("riconosce i due ruoli veri", () => {
    expect(normalizzaRuolo("owner")).toBe("owner");
    expect(normalizzaRuolo("staff")).toBe("staff");
  });

  it("tratta admin_piattaforma come owner della propria attività", () => {
    // Gabriel resta il titolare del SUO salone come chiunque altro: il
    // potere di piattaforma è una cosa separata (vedi eAdminPiattaforma).
    expect(normalizzaRuolo("admin_piattaforma")).toBe("owner");
  });

  it("in caso di dato sporco concede MENO potere, mai di più", () => {
    // profiles.ruolo esiste dalla 0001 senza nessun vincolo: può contenere
    // qualsiasi cosa. Un valore non riconosciuto non deve mai diventare
    // owner per sbaglio.
    for (const valore of [null, undefined, "", "OWNER", "titolare", "admin", "sTaff"]) {
      expect(normalizzaRuolo(valore)).toBe("staff");
    }
  });
});

describe("eAdminPiattaforma", () => {
  it("è vero solo per il ruolo di piattaforma esatto", () => {
    expect(eAdminPiattaforma("admin_piattaforma")).toBe(true);
    expect(eAdminPiattaforma("owner")).toBe(false);
    expect(eAdminPiattaforma("staff")).toBe(false);
    expect(eAdminPiattaforma(null)).toBe(false);
  });
});

describe("permessi (scelta di Gabriel del 16/09/2026)", () => {
  it("lo staff NON vede fatturato e analytics", () => {
    expect(puoVedereAnalytics("owner")).toBe(true);
    expect(puoVedereAnalytics("staff")).toBe(false);
  });

  it("lo staff NON tocca servizi, prezzi, orari e impostazioni", () => {
    expect(puoConfigurareAttivita("owner")).toBe(true);
    expect(puoConfigurareAttivita("staff")).toBe(false);
  });

  it("lo staff NON gestisce abbonamento e fatturazione", () => {
    expect(puoGestireFatturazione("owner")).toBe(true);
    expect(puoGestireFatturazione("staff")).toBe(false);
  });

  it("lo staff NON invita né rimuove colleghi", () => {
    expect(puoGestireMembri("owner")).toBe(true);
    expect(puoGestireMembri("staff")).toBe(false);
  });

  it("lo staff NON esporta l'intera rubrica clienti in CSV", () => {
    // Vedere i clienti dentro il prodotto e portarsi via il database in un
    // file sono due cose diverse.
    expect(puoEsportareClienti("owner")).toBe(true);
    expect(puoEsportareClienti("staff")).toBe(false);
  });

  it("lo staff LAVORA sull'agenda, inclusa quella degli altri operatori", () => {
    // Deciso esplicitamente: in un salone piccolo chi è alla cassa risponde
    // al telefono e deve poter prenotare per la collega.
    expect(puoGestireAgenda("owner")).toBe(true);
    expect(puoGestireAgenda("staff")).toBe(true);
  });
});
