import { describe, expect, it } from "vitest";
import {
  campoModificato,
  haModificheNonSalvate,
  type CampoConfrontabile,
} from "./AvvisoModificheNonSalvate";

/**
 * Copre solo la parte pura del segnale "modifiche non salvate": il confronto
 * fra il valore di un campo e quello con cui e' nato. La lettura del DOM e
 * gli eventi restano nel componente e si vedono dal vivo; qui si fissa la
 * regola con cui un campo conta come modificato, perche' e' li' che un
 * errore (guardare `value` su una checkbox, per dire) non farebbe rumore:
 * il segnale semplicemente non comparirebbe mai, che e' la situazione da
 * cui si parte.
 */
function testo(value: string, defaultValue: string, type = "time"): CampoConfrontabile {
  return { type, value, defaultValue, checked: false, defaultChecked: false };
}

function spunta(checked: boolean, defaultChecked: boolean, type = "checkbox"): CampoConfrontabile {
  // `value` di una checkbox e' sempre "on", modificata o no: se il confronto
  // lo guardasse, un "Chiuso" tolto o messo non si vedrebbe mai.
  return { type, value: "on", defaultValue: "on", checked, defaultChecked };
}

describe("campoModificato", () => {
  it("un orario diverso da quello di partenza e' una modifica", () => {
    expect(campoModificato(testo("09:00", "00:00"))).toBe(true);
  });

  it("un orario uguale a quello di partenza non lo e'", () => {
    expect(campoModificato(testo("09:00", "09:00"))).toBe(false);
  });

  it("una pausa lasciata vuota com'era non e' una modifica", () => {
    expect(campoModificato(testo("", ""))).toBe(false);
  });

  it("una pausa svuotata dopo essere stata compilata lo e'", () => {
    expect(campoModificato(testo("", "13:00"))).toBe(true);
  });

  it("una checkbox si giudica da `checked`, non da `value`", () => {
    expect(campoModificato(spunta(false, true))).toBe(true);
    expect(campoModificato(spunta(true, true))).toBe(false);
  });

  it("un radio si giudica come una checkbox", () => {
    expect(campoModificato(spunta(true, false, "radio"))).toBe(true);
  });
});

describe("haModificheNonSalvate", () => {
  // Il form degli orari com'era il 19/09/2026 dopo "Applica alla
  // configurazione": sabato salvato dall'AI come 00:00-19:00.
  const formSalvato = (): CampoConfrontabile[] => [
    spunta(false, false),
    testo("00:00", "00:00"),
    testo("19:00", "19:00"),
    testo("", ""),
    testo("", ""),
    testo("", "", "submit"),
  ];

  it("un form appena renderizzato non ha modifiche", () => {
    expect(haModificheNonSalvate(formSalvato())).toBe(false);
  });

  it("basta un campo corretto a mano perche' il form ne abbia (il sabato del 19/09)", () => {
    const campi = formSalvato();
    campi[1] = testo("09:00", "00:00");
    expect(haModificheNonSalvate(campi)).toBe(true);
  });

  it("rimettere il valore di partenza fa sparire il segnale", () => {
    const campi = formSalvato();
    campi[1] = testo("00:00", "00:00");
    expect(haModificheNonSalvate(campi)).toBe(false);
  });

  it("un form senza campi non ha modifiche", () => {
    expect(haModificheNonSalvate([])).toBe(false);
  });
});
