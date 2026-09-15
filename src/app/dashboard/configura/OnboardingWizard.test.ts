import { describe, expect, it } from "vitest";
import { costruisciDescrizioneOnboarding, RISPOSTE_INIZIALI, type RisposteWizard } from "./OnboardingWizard";

/**
 * Copre solo `costruisciDescrizioneOnboarding` -- la parte pura e testabile
 * del wizard (l'onboarding a domande guidate richiesto da Gabriel il
 * 15/09/2026). Il resto del componente è UI multi-step senza logica propria
 * da verificare: si appoggia sulla stessa `generaBozzaOnboardingAction` e
 * sulla stessa `RevisioneBozzaOnboarding` già testate altrove.
 */
describe("costruisciDescrizioneOnboarding", () => {
  it("usa il nome del titolare quando lavora da solo, invece di un'etichetta generica", () => {
    const testo = costruisciDescrizioneOnboarding(RISPOSTE_INIZIALI, "Marco");
    expect(testo).toContain("Il titolare, Marco, lavora da solo");
    expect(testo).not.toContain("altre persone");
  });

  it("elenca i nomi degli altri operatori quando non lavora da solo", () => {
    const risposte: RisposteWizard = { ...RISPOSTE_INIZIALI, soloLavoro: false, altriNomi: "Luca, Sara" };
    const testo = costruisciDescrizioneOnboarding(risposte, "Marco");
    expect(testo).toContain("Il titolare si chiama Marco");
    expect(testo).toContain("Luca, Sara");
  });

  it("include gli orari e la pausa pranzo quando indicata", () => {
    const risposte: RisposteWizard = {
      ...RISPOSTE_INIZIALI,
      giorniSelezionati: [1, 2, 3, 4, 5],
      apertura: "09:00",
      chiusura: "18:00",
      pausaSi: true,
      pausaInizio: "13:00",
      pausaFine: "14:00",
    };
    const testo = costruisciDescrizioneOnboarding(risposte, "Marco");
    expect(testo).toContain("lunedì, martedì, mercoledì, giovedì, venerdì");
    expect(testo).toContain("dalle 09:00 alle 18:00");
    expect(testo).toContain("pausa pranzo dalle 13:00 alle 14:00");
  });

  it("non menziona la pausa pranzo quando non c'è", () => {
    const risposte: RisposteWizard = { ...RISPOSTE_INIZIALI, pausaSi: false };
    const testo = costruisciDescrizioneOnboarding(risposte, "Marco");
    expect(testo).not.toContain("pausa pranzo");
  });

  it("segnala esplicitamente nessun giorno di apertura se la selezione è vuota", () => {
    const risposte: RisposteWizard = { ...RISPOSTE_INIZIALI, giorniSelezionati: [] };
    const testo = costruisciDescrizioneOnboarding(risposte, "Marco");
    expect(testo).toContain("Nessun giorno di apertura indicato");
  });

  it("include la descrizione dei servizi scritta dal titolare, senza modificarla", () => {
    const risposte: RisposteWizard = {
      ...RISPOSTE_INIZIALI,
      descrizioneServizi: "Taglio uomo, 30 minuti, 20€. Piega, 45 minuti, 35€.",
    };
    const testo = costruisciDescrizioneOnboarding(risposte, "Marco");
    expect(testo).toContain("Taglio uomo, 30 minuti, 20€. Piega, 45 minuti, 35€.");
  });

  it("include il tipo di attività scelto", () => {
    const risposte: RisposteWizard = { ...RISPOSTE_INIZIALI, tipoAttivita: "Estetista" };
    const testo = costruisciDescrizioneOnboarding(risposte, "Marco");
    expect(testo).toContain("Tipo di attività: Estetista");
  });

  it("ordina i giorni selezionati in ordine di settimana anche se scelti fuori ordine", () => {
    const risposte: RisposteWizard = { ...RISPOSTE_INIZIALI, giorniSelezionati: [5, 1, 3] };
    const testo = costruisciDescrizioneOnboarding(risposte, "Marco");
    expect(testo).toContain("lunedì, mercoledì, venerdì");
  });
});
