import { describe, expect, it } from "vitest";
import {
  valutaEliminazioneOperatore,
  valutaEliminazioneServizio,
} from "./configura-sicurezza";

describe("cosa si puo' cancellare davvero", () => {
  it("un operatore mai usato si cancella", () => {
    expect(valutaEliminazioneOperatore({ appuntamenti: 0 })).toEqual({ consentita: true });
  });

  it("un operatore con anche un solo appuntamento non si cancella", () => {
    const esito = valutaEliminazioneOperatore({ appuntamenti: 1 });
    expect(esito.consentita).toBe(false);
    // Il messaggio deve dire cosa fare, non solo cosa non si puo' fare:
    // chi legge sta cercando di togliere qualcuno dall'agenda.
    expect(esito.consentita === false && esito.motivo).toContain("Disattivalo");
  });

  it("conta anche gli appuntamenti passati, non solo i futuri", () => {
    // Lo storico serve alle statistiche per operatore: un appuntamento
    // dell'anno scorso senza operatore e' un dato perso, non un dettaglio.
    expect(valutaEliminazioneOperatore({ appuntamenti: 300 }).consentita).toBe(false);
  });

  it("singolare e plurale: il messaggio non dice mai '1 appuntamenti'", () => {
    const uno = valutaEliminazioneOperatore({ appuntamenti: 1 });
    const due = valutaEliminazioneOperatore({ appuntamenti: 2 });
    expect(uno.consentita === false && uno.motivo).toContain("C'è 1 appuntamento collegato");
    expect(due.consentita === false && due.motivo).toContain("Ci sono 2 appuntamenti collegati");
  });

  it("un servizio mai usato si cancella", () => {
    expect(valutaEliminazioneServizio({ appuntamenti: 0, richiesteCaparra: 0 })).toEqual({
      consentita: true,
    });
  });

  it("le caparre vengono prima: sono soldi, e sparirebbero a cascata", () => {
    const esito = valutaEliminazioneServizio({ appuntamenti: 0, richiesteCaparra: 1 });
    expect(esito.consentita).toBe(false);
    expect(esito.consentita === false && esito.motivo).toContain("caparra");
  });

  it("con caparre E appuntamenti il motivo citato e' quello dei soldi", () => {
    const esito = valutaEliminazioneServizio({ appuntamenti: 5, richiesteCaparra: 2 });
    expect(esito.consentita === false && esito.motivo).toContain("pagamenti");
  });
});
