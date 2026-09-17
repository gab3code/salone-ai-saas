import { describe, expect, it } from "vitest";
import {
  DEMO_AI_MAX_AL_MESE,
  LUNGHEZZA_MASSIMA_DOMANDA_DEMO,
  STRUMENTI_DEMO,
  domandaDemoValida,
  pianoPuoProvareAssistente,
  statoDemo,
} from "./demo-assistente";
import { STRUMENTI_AI } from "./tools";
import { pianoHaAccessoAIChatWeb } from "./limiti";

describe("pianoPuoProvareAssistente", () => {
  it("la prova si mostra esattamente ai piani che l'AI non ce l'hanno", () => {
    for (const piano of ["free", "starter", "growth", "pro", "enterprise"]) {
      expect(pianoPuoProvareAssistente(piano), piano).toBe(!pianoHaAccessoAIChatWeb(piano));
    }
  });

  it("un piano sconosciuto non apre la prova", () => {
    expect(pianoPuoProvareAssistente("qualcosa-di-strano")).toBe(false);
  });
});

describe("STRUMENTI_DEMO -- la prova non può scrivere niente", () => {
  it("i nomi elencati esistono davvero fra gli strumenti dell'assistente", () => {
    // `demo-assistente.ts` elenca i nomi come stringhe e NON importa
    // `tools.ts` (si porterebbe dietro il lato server dentro un componente
    // del browser), quindi un rinomino non darebbe nessun errore di
    // compilazione: il filtro scarterebbe lo strumento in silenzio e la
    // prova perderebbe un pezzo senza che nessuno se ne accorga. Questo
    // test e' l'unico posto che collega le due liste.
    const esistenti = new Set(STRUMENTI_AI.map((s) => s.name as string));
    for (const nome of STRUMENTI_DEMO) expect(esistenti.has(nome), nome).toBe(true);
  });

  it("nessuno strumento che modifica qualcosa è concesso", () => {
    const scrivono = ["crea_prenotazione", "modifica_prenotazione", "cancella_prenotazione", "aggiungi_lista_attesa"];
    for (const nome of scrivono) {
      expect(STRUMENTI_AI.some((s) => (s.name as string) === nome), `${nome} deve esistere`).toBe(true);
      expect(STRUMENTI_DEMO, `${nome} non va concesso alla prova`).not.toContain(nome);
    }
  });

  it("nemmeno gli strumenti che leggono dati di altri clienti", () => {
    // `cerca_prenotazioni_cliente` legge le prenotazioni di una persona a
    // partire dal telefono: non serve a mostrare come risponde l'assistente
    // e allarga la superficie senza motivo.
    expect(STRUMENTI_DEMO).not.toContain("cerca_prenotazioni_cliente");
    // `info_attivita` è la knowledge base, riservata a Pro.
    expect(STRUMENTI_DEMO).not.toContain("info_attivita");
  });

  it("gli strumenti concessi bastano a rispondere a una domanda vera", () => {
    for (const nome of ["elenca_servizi", "info_orari", "verifica_disponibilita"]) {
      expect(STRUMENTI_DEMO).toContain(nome);
    }
  });
});

describe("statoDemo", () => {
  const settembre = new Date(Date.UTC(2026, 8, 17, 12));

  it("senza nessuna prova consumata sono tutte disponibili", () => {
    expect(statoDemo(null, 0, settembre)).toEqual({ rimaste: DEMO_AI_MAX_AL_MESE, esaurite: false });
  });

  it("scala quelle già usate nel mese corrente", () => {
    expect(statoDemo("2026-09", 3, settembre).rimaste).toBe(DEMO_AI_MAX_AL_MESE - 3);
  });

  it("un contatore di un mese passato vale zero, subito e non dopo la prima prova", () => {
    const stato = statoDemo("2026-08", DEMO_AI_MAX_AL_MESE, settembre);
    expect(stato.rimaste).toBe(DEMO_AI_MAX_AL_MESE);
    expect(stato.esaurite).toBe(false);
  });

  it("il mese si formatta con lo zero davanti, come lo scrive il database", () => {
    const gennaio = new Date(Date.UTC(2027, 0, 5, 12));
    expect(statoDemo("2027-01", 1, gennaio).rimaste).toBe(DEMO_AI_MAX_AL_MESE - 1);
    expect(statoDemo("2027-1", 1, gennaio).rimaste, "'2027-1' non è il formato del database").toBe(
      DEMO_AI_MAX_AL_MESE
    );
  });

  it("a quota piena risulta esaurita e non va sotto zero", () => {
    expect(statoDemo("2026-09", DEMO_AI_MAX_AL_MESE, settembre)).toEqual({ rimaste: 0, esaurite: true });
    expect(statoDemo("2026-09", DEMO_AI_MAX_AL_MESE + 5, settembre).rimaste).toBe(0);
  });

  it("non dipende dal fuso orario di chi guarda", () => {
    // Capodanno alle 23 UTC: in Italia è già l'anno dopo, il mese del
    // contatore no. Il database scrive in UTC, quindi qui si legge in UTC.
    const capodanno = new Date(Date.UTC(2026, 11, 31, 23, 30));
    expect(statoDemo("2026-12", 2, capodanno).rimaste).toBe(DEMO_AI_MAX_AL_MESE - 2);
  });
});

describe("domandaDemoValida", () => {
  it("rifiuta il vuoto e le frasi troppo corte per essere una domanda", () => {
    for (const t of ["", "   ", "ok", " a "]) expect(domandaDemoValida(t), JSON.stringify(t)).toBe(false);
  });

  it("accetta una domanda normale", () => {
    expect(domandaDemoValida("Avete posto giovedì pomeriggio per un taglio?")).toBe(true);
  });

  it("rifiuta un testo oltre il tetto", () => {
    expect(domandaDemoValida("a".repeat(LUNGHEZZA_MASSIMA_DOMANDA_DEMO))).toBe(true);
    expect(domandaDemoValida("a".repeat(LUNGHEZZA_MASSIMA_DOMANDA_DEMO + 1))).toBe(false);
  });

  it("gli spazi intorno non fanno passare un testo troppo lungo", () => {
    expect(domandaDemoValida(`  ${"a".repeat(LUNGHEZZA_MASSIMA_DOMANDA_DEMO)}  `)).toBe(true);
  });
});
