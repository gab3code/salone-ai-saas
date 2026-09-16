import type { Page } from "@playwright/test";

/**
 * Login da dashboard per gli scenari che agiscono come titolare/staff
 * (12, 13, 14, 15) -- stesso form di `/accedi` (id "email"/"password",
 * bottone "Accedi"), MAI una password reale di Gabriel: solo le credenziali
 * generate da `creaTenantDiProva()` per un tenant usa-e-getta.
 */
export async function accediComeTitolare(page: Page, email: string, password: string) {
  await page.goto("/accedi");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await page.waitForURL("**/dashboard");
}
