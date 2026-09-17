import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AZIONI_INTERVENTO } from "./admin-interventi";

/**
 * Il codice e il database devono essere d'accordo su quali azioni esistono.
 *
 * Quando non lo erano (18/09/2026, "piano_con_stripe" assente dal CHECK)
 * l'insert veniva rifiutato, il codice logga e tira dritto, e il registro
 * perdeva in silenzio l'intervento piu' delicato che facciamo. Nessun test
 * guardava quella tabella, quindi il buco e' rimasto li' finche' non e'
 * comparso in un log.
 */

function checkPiuRecenteNelleMigrazioni(): string[] {
  const cartella = join(process.cwd(), "supabase", "migrations");
  const file = readdirSync(cartella)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let ultimo: string[] | null = null;
  for (const f of file) {
    const sql = readFileSync(join(cartella, f), "utf-8");
    // Prende l'ULTIMA definizione presente nel file: una migrazione puo'
    // anche togliere e rimettere il vincolo nello stesso file.
    const occorrenze = [...sql.matchAll(/azione\s+in\s*\(([^)]*)\)/gi)];
    if (occorrenze.length === 0) continue;
    const dentro = occorrenze[occorrenze.length - 1][1];
    ultimo = [...dentro.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  }

  if (!ultimo) throw new Error("Nessun CHECK su interventi_admin.azione trovato nelle migrazioni.");
  return ultimo;
}

describe("azioni del registro interventi", () => {
  it("ogni azione che il codice scrive e' ammessa dal database", () => {
    const ammesse = checkPiuRecenteNelleMigrazioni();
    for (const azione of AZIONI_INTERVENTO) {
      expect(ammesse, `"${azione}" non e' nel CHECK: serve una migrazione`).toContain(azione);
    }
  });

  it("il database non ammette azioni che il codice non scrive piu'", () => {
    const ammesse = checkPiuRecenteNelleMigrazioni();
    for (const azione of ammesse) {
      expect(AZIONI_INTERVENTO as readonly string[], `"${azione}" e' ammessa dal database ma nessuno la scrive`).toContain(
        azione
      );
    }
  });

  it("nessun doppione nella lista del codice", () => {
    expect(new Set(AZIONI_INTERVENTO).size).toBe(AZIONI_INTERVENTO.length);
  });
});
