import { describe, expect, it } from "vitest";
import {
  calcolaRicavi,
  cosaMancaPerPartire,
  ricavoMensileStimatoCentesimi,
  segnaliAttivita,
  type RigaAdmin,
} from "./admin";

/**
 * Logica del pannello di piattaforma (Fase 5). Sono numeri che Gabriel
 * guarderà per decidere -- quanto incassa, chi sta per abbandonare, chi è
 * fermo -- quindi un errore qui non rompe niente a schermo: racconta una
 * cosa falsa con l'aria di essere un dato.
 */

function riga(sovrascritture: Partial<RigaAdmin> = {}): RigaAdmin {
  return {
    tenantId: "t1",
    nome: "Salone",
    slug: "salone",
    piano: "growth",
    statoAbbonamento: "attivo",
    pianoManuale: false,
    sospesa: false,
    sospesaMotivo: null,
    creatoIl: "2026-01-01T00:00:00Z",
    haStripe: true,
    emailTitolari: ["t@esempio.it"],
    membri: 1,
    operatori: 1,
    servizi: 2,
    orariConfigurati: true,
    clienti: 10,
    appuntamenti: 20,
    appuntamenti30Giorni: 5,
    prenotazioniMeseCorrente: 5,
    ultimaAttivita: "2026-01-01T00:00:00Z",
    ...sovrascritture,
  };
}

describe("ricavoMensileStimatoCentesimi", () => {
  it("somma il prezzo base e la quota di ogni operatore oltre il primo", () => {
    // Growth: 39,90 + 15 × 2 operatori extra = 69,90
    expect(ricavoMensileStimatoCentesimi(riga({ piano: "growth", operatori: 3 }))).toBe(6990);
    // Starter: 19,90 + 10 × 3 = 49,90 -- il caso che rende Starter meno
    // "economico" di quanto dica il cartellino, vedi PIANO.md.
    expect(ricavoMensileStimatoCentesimi(riga({ piano: "starter", operatori: 4 }))).toBe(4990);
    // Pro con un solo operatore: nessuna quota extra.
    expect(ricavoMensileStimatoCentesimi(riga({ piano: "pro", operatori: 1 }))).toBe(8990);
  });

  it("conta solo gli abbonamenti attivi: una prova non è un ricavo, uno scaduto non lo è più", () => {
    for (const stato of ["trialing", "scaduto", "cancellato"]) {
      expect(ricavoMensileStimatoCentesimi(riga({ statoAbbonamento: stato }))).toBe(0);
    }
  });

  it("Enterprise non entra nella stima: è a preventivo, un prezzo di listino non ce l'ha", () => {
    expect(ricavoMensileStimatoCentesimi(riga({ piano: "enterprise", operatori: 5 }))).toBe(0);
  });

  it("zero operatori non genera mai una quota negativa", () => {
    // Un tenant appena registrato ha 0 operatori: `operatori - 1` sarebbe -1.
    expect(ricavoMensileStimatoCentesimi(riga({ piano: "pro", operatori: 0 }))).toBe(8990);
  });
});

describe("calcolaRicavi", () => {
  it("separa chi paga, chi è in prova e chi è a preventivo invece di sommarli in un totale unico", () => {
    const ricavi = calcolaRicavi([
      riga({ tenantId: "a", piano: "growth", operatori: 1 }),
      riga({ tenantId: "b", piano: "pro", operatori: 2 }),
      riga({ tenantId: "c", piano: "growth", statoAbbonamento: "trialing" }),
      riga({ tenantId: "d", piano: "enterprise", statoAbbonamento: "attivo" }),
      riga({ tenantId: "e", piano: "free", statoAbbonamento: "attivo" }),
    ]);

    // growth(3990) + pro(8990 + 2000) = 14980
    expect(ricavi.mrrCentesimi).toBe(14980);
    expect(ricavi.paganti).toBe(2);
    expect(ricavi.inProva).toBe(1);
    expect(ricavi.aPreventivo).toBe(1);
  });
});

describe("cosaMancaPerPartire", () => {
  it("elenca quello che impedisce davvero a un salone di ricevere prenotazioni", () => {
    expect(cosaMancaPerPartire(riga({ orariConfigurati: false, servizi: 0, operatori: 0 }))).toEqual([
      "orari",
      "servizi",
      "operatori",
    ]);
  });

  it("un'attività completa non ha mancanze", () => {
    expect(cosaMancaPerPartire(riga())).toEqual([]);
  });
});

describe("segnaliAttivita", () => {
  const adesso = new Date("2026-06-15T12:00:00Z");

  it("un'attività sana non produce nessun segnale", () => {
    // Il controllo che conta davvero: se tutto segnalasse sempre qualcosa,
    // il filtro "solo quelle da guardare" sarebbe inutile e i casi veri si
    // perderebbero nel rumore.
    expect(segnaliAttivita(riga({ ultimaAttivita: "2026-06-14T10:00:00Z" }), adesso)).toEqual([]);
  });

  it("segnala la sospensione e il pagamento non riuscito come urgenze", () => {
    const sospesa = segnaliAttivita(riga({ sospesa: true, ultimaAttivita: "2026-06-14T10:00:00Z" }), adesso);
    expect(sospesa.some((s) => s.testo.includes("Sospesa") && s.gravita === "alta")).toBe(true);

    const scaduta = segnaliAttivita(
      riga({ statoAbbonamento: "scaduto", ultimaAttivita: "2026-06-14T10:00:00Z" }),
      adesso
    );
    expect(scaduta.some((s) => s.testo.includes("Pagamento non riuscito"))).toBe(true);
  });

  it("avvisa PRIMA che il tetto del piano Free sia raggiunto, non dopo", () => {
    // 60 prenotazioni/mese su Free: a 48 (80%) si avvisa, a 60 è già tardi --
    // il salone sta perdendo prenotazioni mentre leggi.
    const vicina = segnaliAttivita(
      riga({ piano: "free", prenotazioniMeseCorrente: 48, ultimaAttivita: "2026-06-14T10:00:00Z" }),
      adesso
    );
    expect(vicina.some((s) => s.testo.includes("Vicina al tetto") && s.gravita === "media")).toBe(true);

    const oltre = segnaliAttivita(
      riga({ piano: "free", prenotazioniMeseCorrente: 61, ultimaAttivita: "2026-06-14T10:00:00Z" }),
      adesso
    );
    expect(oltre.some((s) => s.testo.includes("Tetto del piano raggiunto") && s.gravita === "alta")).toBe(true);
  });

  it("i piani a pagamento non hanno tetto, quindi non producono mai quel segnale", () => {
    const segnali = segnaliAttivita(
      riga({ piano: "pro", prenotazioniMeseCorrente: 5000, ultimaAttivita: "2026-06-14T10:00:00Z" }),
      adesso
    );
    expect(segnali.some((s) => s.testo.includes("tetto"))).toBe(false);
  });

  it("l'inattività sale di gravità con i giorni", () => {
    const venti = segnaliAttivita(riga({ ultimaAttivita: "2026-05-26T12:00:00Z" }), adesso);
    expect(venti.some((s) => s.testo.includes("20 giorni") && s.gravita === "media")).toBe(true);

    const quaranta = segnaliAttivita(riga({ ultimaAttivita: "2026-05-06T12:00:00Z" }), adesso);
    expect(quaranta.some((s) => s.testo.includes("40 giorni") && s.gravita === "alta")).toBe(true);
  });

  it("un'attività che non ha MAI avuto appuntamenti non viene segnalata come ferma", () => {
    // Altrimenti ogni iscritto di ieri risulterebbe "abbandonato", e il
    // pannello si riempirebbe di allarmi su gente che deve ancora iniziare.
    const segnali = segnaliAttivita(riga({ appuntamenti: 0, ultimaAttivita: null }), adesso);
    expect(segnali.some((s) => s.testo.includes("Nessuna prenotazione da"))).toBe(false);
  });

  it("segnala un piano Free con più operatori di quanti ne includa", () => {
    const segnali = segnaliAttivita(
      riga({ piano: "free", operatori: 3, ultimaAttivita: "2026-06-14T10:00:00Z" }),
      adesso
    );
    expect(segnali.some((s) => s.testo.includes("3 operatori su un piano che ne include 1"))).toBe(true);
  });
});
