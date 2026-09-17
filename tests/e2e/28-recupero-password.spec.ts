import { test, expect } from "@playwright/test";

/**
 * Scenario 28 (17/09/2026): il recupero password.
 *
 * NESSUN TEST QUI PREME "Mandami il link". Inviare davvero significa
 * bruciare una delle poche email all'ora che il mailer di Supabase concede,
 * in una suite che gira decine di volte al giorno -- e la regola di Gabriel
 * sui test che costano e' esplicita. Si verifica tutto il resto: che la
 * strada dall'accesso al recupero esista, e soprattutto che un link
 * scaduto lo DICA invece di mostrare un form rotto.
 *
 * Quel terzo caso e' il piu' importante e il piu' facile da dimenticare:
 * chi ci arriva sopra ha gia' perso la password una volta.
 *
 * La regola sulla lunghezza minima ha i suoi 11 test in
 * src/lib/password.test.ts, gratis e senza browser.
 */

test.describe("Scenario 28 -- recupero password", () => {
  test("dalla pagina di accesso si arriva al recupero", async ({ page }) => {
    await page.goto("/accedi");

    const link = page.getByRole("link", { name: "Password dimenticata?" });
    await expect(link).toBeVisible();

    await link.click();
    await expect(page).toHaveURL(/\/recupera$/);
    await expect(page.getByRole("heading", { name: "Password dimenticata" })).toBeVisible();
  });

  test("il form chiede un indirizzo valido prima di inviare", async ({ page }) => {
    await page.goto("/recupera");

    const campo = page.getByLabel("Email");
    await expect(campo).toBeVisible();
    await expect(campo).toHaveAttribute("type", "email");
    await expect(campo).toHaveAttribute("required", "");

    // Niente click su "Mandami il link": l'invio vero non si prova mai qui.
    await expect(page.getByRole("button", { name: "Mandami il link" })).toBeEnabled();
  });

  test("un link senza token dice chiaramente che non vale piu'", async ({ page }) => {
    await page.goto("/reimposta");

    await expect(page.getByRole("heading", { name: /non vale piu/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Chiedi un link nuovo" })).toBeVisible();

    // E non deve MAI mostrare il form: una password digitata qui non
    // andrebbe da nessuna parte.
    await expect(page.getByLabel("Password nuova")).toHaveCount(0);
  });

  test("un link con un codice inventato non apre il form", async ({ page }) => {
    await page.goto("/reimposta?code=non-esiste-proprio");

    await expect(page.getByRole("heading", { name: /non vale piu/i })).toBeVisible();
    await expect(page.getByLabel("Password nuova")).toHaveCount(0);
  });
});
