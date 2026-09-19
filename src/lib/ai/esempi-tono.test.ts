import { describe, expect, it } from "vitest";
import { ESEMPI_TONO, ESEMPIO_CONFERMA_REGOLA_17, type EsempiTono } from "./agente";
import { azioniDichiarate } from "./verifica-azioni";
import { contieneEmoji } from "./tono-emoji";

/**
 * IL TEST CHE TIENE INSIEME DUE FILE CHE NON SI PARLANO (19/09/2026).
 *
 * Provando la chat vera, l'assistente ha annunciato una prenotazione che non
 * esisteva -- "Tutto fatto 🎉 Ci vediamo mercoledì 23 settembre alle 16:00" --
 * e la rete anti-bugia non l'ha vista. La frase l'avevo scritta io tre ore
 * prima, come esempio del tono: **avevo insegnato al modello un modo di
 * annunciare una prenotazione che il mio stesso controllo non riconosce.**
 *
 * Due file scritti dalla stessa mano a tre ore di distanza avevano gia' smesso
 * di parlarsi. Questo test li riattacca: gli esempi di conferma del prompt e le
 * frasi che la rete riconosce non possono piu' divergere in silenzio.
 */
describe("gli esempi del tono e la rete anti-bugia devono restare d'accordo", () => {
  const toni = Object.entries(ESEMPI_TONO) as [string, EsempiTono][];

  it.each(toni)("la conferma del tono '%s' viene riconosciuta come prenotazione dichiarata", (_tono, esempi) => {
    expect(
      [...azioniDichiarate(esempi.conferma)],
      `"${esempi.conferma}" non viene riconosciuta da verifica-azioni.ts: se il modello la imita senza aver prenotato, il cliente riceve una conferma falsa. Aggiungi la forma a FRASI_CREAZIONE, oppure riscrivi l'esempio.`
    ).toContain("creata");
  });

  it("anche la frase di esempio della REGOLA 17 viene riconosciuta", () => {
    expect([...azioniDichiarate(ESEMPIO_CONFERMA_REGOLA_17)]).toContain("creata");
  });

  it("nessun altro esempio del tono dichiara per sbaglio una prenotazione", () => {
    // Un "Che giorno ti va bene?" che risultasse una dichiarazione di
    // prenotazione farebbe scattare la rete su ogni messaggio: il difetto
    // opposto, e altrettanto caro.
    for (const [tono, esempi] of toni) {
      for (const campo of ["saluto", "servizi", "giorno", "orari", "dati", "informazione"] as const) {
        expect([...azioniDichiarate(esempi[campo])], `${tono}.${campo}`).toEqual([]);
      }
    }
  });

  it("solo il tono con le emoji ne contiene, gli altri due nessuna", () => {
    for (const [tono, esempi] of toni) {
      const campi = ["saluto", "servizi", "giorno", "orari", "dati", "informazione", "conferma"] as const;
      const conEmoji = campi.filter((c) => contieneEmoji(esempi[c]));
      if (tono === "informale_con_emoji") {
        // Se gli esempi smettono di avere emoji, il modello smette di usarle:
        // e' esattamente quello che era successo con la prima versione.
        expect(conEmoji.length).toBeGreaterThanOrEqual(5);
      } else {
        expect(conEmoji, `${tono} non deve avere esempi con emoji`).toEqual([]);
      }
    }
  });
});
