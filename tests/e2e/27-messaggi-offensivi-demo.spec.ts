import { test, expect } from "@playwright/test";
import { RISPOSTA_MESSAGGIO_OFFENSIVO } from "@/lib/ai/messaggio-offensivo";
import { TURNI_FUORI_TEMA_DEMO } from "@/lib/demo/limiti-demo";

/**
 * Scenario 27 (17/09/2026): un messaggio offensivo sulla demo.
 *
 * Nasce da una prova dal vivo di Gabriel: a un insulto secco l'assistente
 * rispondeva "Mi dispiace, ma non ho capito bene. Puoi ripetere?". Chiedeva
 * di ripetere un insulto.
 *
 * Questo scenario NON COSTA NIENTE, ed e' il motivo per cui puo' stare in
 * una suite che gira spesso: il riconoscimento avviene prima della chiamata
 * al modello, quindi qui Anthropic non viene mai interpellato. Non crea
 * nessun tenant, non scrive nessuna riga, non consuma il contatore globale
 * della demo. E' deterministico al 100%: la risposta e' una costante del
 * codice, non un testo generato.
 *
 * Il caso opposto -- una richiesta vera che contiene una volgarita', che
 * deve passare -- non sta qui proprio perche' quello ARRIVA al modello e
 * costerebbe a ogni run: e' coperto dai test unitari in
 * src/lib/ai/messaggio-offensivo.test.ts, che lo verificano gratis.
 */

const INSULTO = "frocio";

test.describe("Scenario 27 -- messaggi offensivi sulla demo", () => {
  test("risponde senza mai chiedere di ripetere, e alla seconda volta chiude", async ({ page }) => {
    await page.goto("/demo");

    const campo = page.getByLabel("Messaggio per l'assistente");
    const invia = page.getByRole("button", { name: "Invia" });
    await expect(campo).toBeEnabled();

    // --- primo insulto -------------------------------------------------
    await campo.fill(INSULTO);
    await invia.click();

    await expect(page.getByText(RISPOSTA_MESSAGGIO_OFFENSIVO)).toBeVisible();

    // La frase che ha fatto nascere tutto questo non deve comparire mai.
    const testoPagina = (await page.locator("body").innerText()).toLowerCase();
    expect(testoPagina).not.toContain("puoi ripetere");
    expect(testoPagina).not.toContain("non ho capito");

    // La conversazione NON e' ancora chiusa: un turno solo non basta.
    expect(TURNI_FUORI_TEMA_DEMO).toBeGreaterThan(1);
    await expect(campo).toBeEnabled();

    // --- secondo insulto: si chiude ------------------------------------
    await campo.fill(INSULTO);
    await invia.click();

    await expect(page.getByText(/registrati/i).last()).toBeVisible();
    await expect(campo).toBeDisabled();
    await expect(campo).toHaveAttribute("placeholder", "Ricarica la pagina per ricominciare");
  });

  test("i trucchi per aggirare il filtro non funzionano", async ({ page }) => {
    await page.goto("/demo");

    const campo = page.getByLabel("Messaggio per l'assistente");
    await campo.fill("Fr0ci0");
    await page.getByRole("button", { name: "Invia" }).click();

    await expect(page.getByText(RISPOSTA_MESSAGGIO_OFFENSIVO)).toBeVisible();
  });
});
