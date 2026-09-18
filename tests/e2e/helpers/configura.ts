import { expect, type Page } from "@playwright/test";

/**
 * Aggiunge un operatore dalla pagina /dashboard/configura.
 *
 * Esiste come helper per un motivo preciso, trovato il 18/09/2026: gli
 * scenari 16 e 17 facevano
 *
 *   page.getByRole("button", { name: "Aggiungi" }).first().click()
 *
 * e hanno smesso di funzionare nel momento in cui la pagina ha guadagnato la
 * sezione "Ferie e chiusure", che sta PRIMA di "Operatori" e ha un pulsante
 * "Aggiungi chiusura". `name` senza `exact` cerca una sottostringa, quindi
 * quel pulsante e' diventato il primo della lista e i due scenari premevano
 * il pulsante sbagliato: nessun errore, nessun operatore, solo
 * un'asserzione rossa venti righe piu' sotto.
 *
 * La lezione, e il motivo per cui questo helper e' l'unico posto in cui si
 * aggiunge un operatore: un locator ancorato alla POSIZIONE ("il primo
 * pulsante che si chiama cosi'") e' una scommessa sull'ordine del DOM, e
 * l'ordine del DOM cambia ogni volta che si aggiunge una sezione. Un locator
 * ancorato alla STRUTTURA (il form che contiene #nome_operatore) sopravvive.
 */
export async function aggiungiOperatore(page: Page, nome: string): Promise<void> {
  const form = page.locator("form", { has: page.locator("#nome_operatore") });
  await form.locator("#nome_operatore").fill(nome);
  await form.getByRole("button", { name: "Aggiungi", exact: true }).click();
  await expect(page.getByText(nome).first()).toBeVisible({ timeout: 15_000 });
}
