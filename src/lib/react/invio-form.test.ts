import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * PREVENIRE, NON CURARE (richiesta esplicita di Gabriel, 19/09/2026).
 *
 * Lo stesso difetto e' arrivato tre volte in tre schermate diverse prima che
 * ne capissi la causa: `<form action={...}>` di React 19 resetta il form
 * quando l'azione finisce, e il reset riporta indietro `checked` e le select
 * (misurazione e spiegazione in `invio-form.ts`).
 *
 * Una regola scritta in CLAUDE.md la si puo' dimenticare; questo test no.
 * Cerca nel codice vero la combinazione che non deve esistere -- un form con
 * `action` che contiene una spunta, un radio o una select -- e dice quale
 * file, cosi' la decima schermata non ripete il giro.
 */
function tuttiITsx(cartella: string): string[] {
  return readdirSync(cartella).flatMap((voce) => {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) return tuttiITsx(percorso);
    return percorso.endsWith(".tsx") ? [percorso] : [];
  });
}

/** Il contenuto di ogni `<form action={...}>` del file, fino alla `</form>`. */
function formConAction(sorgente: string): string[] {
  const pezzi: string[] = [];
  let da = 0;
  for (;;) {
    const inizio = sorgente.indexOf("<form action={", da);
    if (inizio === -1) return pezzi;
    const fine = sorgente.indexOf("</form>", inizio);
    pezzi.push(sorgente.slice(inizio, fine === -1 ? undefined : fine));
    da = fine === -1 ? sorgente.length : fine;
  }
}

const CAMPI_CHE_IL_RESET_RIPORTA_INDIETRO = [
  { cerca: 'type="checkbox"', nome: "una spunta" },
  { cerca: 'type="radio"', nome: "un radio" },
  { cerca: "<select", nome: "una select" },
];

describe("nessun <form action> con campi che il reset di React riporta indietro", () => {
  it("usa onSubmit + alInvio dove ci sono spunte, radio o select", () => {
    const colpevoli: string[] = [];

    for (const file of tuttiITsx("src")) {
      const sorgente = readFileSync(file, "utf8");
      for (const form of formConAction(sorgente)) {
        for (const campo of CAMPI_CHE_IL_RESET_RIPORTA_INDIETRO) {
          if (form.includes(campo.cerca)) {
            colpevoli.push(`${file}: <form action={...}> contiene ${campo.nome}`);
          }
        }
      }
    }

    expect(
      colpevoli,
      `Questi form si resettano da soli dopo il salvataggio e l'utente vede tornare indietro quello che ha appena scelto.\nSostituisci action={azione} con onSubmit={alInvio(azione)} (src/lib/react/invio-form.ts):\n${colpevoli.join("\n")}`
    ).toEqual([]);
  });
});
