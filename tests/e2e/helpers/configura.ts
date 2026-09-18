import { expect, type Page } from "@playwright/test";

/**
 * Aggiunge un operatore dalla pagina /dashboard/configura e aspetta che
 * compaia davvero nell'elenco.
 *
 * Esiste come helper perche' e' il punto in cui gli scenari 13, 16 e 17 si
 * sono rotti due volte di fila il 18/09/2026, sempre per lo stesso motivo:
 * un locator ancorato alla POSIZIONE invece che alla STRUTTURA.
 *
 * La prima volta era il pulsante. `getByRole("button", { name: "Aggiungi"
 * }).first()`: `name` senza `exact` cerca una sottostringa, quindi il giorno
 * in cui la sezione "Ferie e chiusure" (che sta PRIMA di "Operatori") ha
 * guadagnato un pulsante "Aggiungi chiusura", `.first()` ha iniziato a
 * premere quello. Nessun errore, nessun operatore, solo un'asserzione rossa
 * venti righe piu' sotto.
 *
 * La seconda volta era l'attesa. `getByText(nome).first()` trova cinque
 * elementi -- l'`<option>` dentro il menu "Chi", la riga dell'elenco, il
 * riassunto "Orari di <nome>", la frase che lo nomina e il pulsante "Salva
 * orari di <nome>" -- e il primo in ordine di DOM e' l'`<option>`, che
 * Playwright considera sempre nascosto. Il test aspettava quindici secondi
 * che diventasse visibile una cosa che per definizione non lo e'.
 *
 * Qui si aspetta la riga dell'elenco operatori, presa per struttura: il
 * `<li>` dentro la sezione che contiene il form di inserimento. Non dipende
 * dall'ordine delle sezioni, ne' da quante altre volte il nome compare
 * altrove nella pagina.
 */
export async function aggiungiOperatore(page: Page, nome: string): Promise<void> {
  const sezione = page.locator("section", { has: page.locator("#nome_operatore") });
  const form = page.locator("form", { has: page.locator("#nome_operatore") });
  await form.locator("#nome_operatore").fill(nome);
  await form.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await expect(sezione.locator("li").filter({ hasText: nome }).first()).toBeVisible({
    timeout: 15_000,
  });
}
