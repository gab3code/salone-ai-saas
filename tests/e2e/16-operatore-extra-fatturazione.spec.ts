import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { creaAbbonamentoDiProva, type AbbonamentoDiProva } from "./helpers/abbonamento-di-prova";
import { priceIdOperatoreExtra, priceIdPerPiano } from "@/lib/stripe/piani";

/**
 * Scenario 16 (Fase 5, 16/09/2026): la quota per operatore finisce davvero
 * sull'abbonamento Stripe, con il prezzo del piano giusto e la quantità
 * giusta, quando il titolare aggiunge o toglie operatori dalla dashboard.
 *
 * Perché serve uno scenario E2E e non bastano gli unit test: qui si
 * verificano tre cose che solo un giro completo può smentire -- che la
 * server action `creaOperatore` chiami davvero la sincronizzazione, che
 * `sincronizzaQuantitaOperatoriStripe` scelga il price del piano del tenant
 * (10€ Starter, non 20€ Pro), e che Stripe accetti davvero quelle chiamate.
 * `sincronizzaQuantitaOperatoriStripe` è fail-open per scelta (inghiotte ogni
 * errore per non impedire mai di creare un operatore vero), quindi un errore
 * di integrazione qui non farebbe fallire NIENTE a runtime: si vedrebbe solo
 * come un cliente che non paga quello che dovrebbe. Questo test è l'unico
 * posto in cui quel silenzio diventa rumore.
 */
test.describe("Scenario 16 -- fatturazione dell'operatore extra", () => {
  let tenant: TenantDiProva;
  let abbonamento: AbbonamentoDiProva | null = null;

  test.afterEach(async () => {
    await abbonamento?.pulisci();
    abbonamento = null;
    await tenant?.pulisci();
  });

  test("su Starter ogni operatore oltre il primo aggiunge la quota da 10€, e toglierlo la riduce", async ({
    page,
  }) => {
    const priceBase = priceIdPerPiano("starter");
    const priceExtra = priceIdOperatoreExtra("starter");
    expect(
      priceExtra,
      "STRIPE_PRICE_STARTER_OPERATORE_EXTRA deve essere in .env.local perché questo scenario abbia senso"
    ).toBeTruthy();

    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario16",
      piano: "starter",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Prima", servizi: [0] }],
    });

    abbonamento = await creaAbbonamentoDiProva("starter", "Scenario16");
    await tenant.supabase
      .from("tenants")
      .update({ stripe_subscription_id: abbonamento.subscriptionId })
      .eq("id", tenant.id);

    // Punto di partenza: un solo operatore, quindi solo il prezzo base.
    expect(await abbonamento.leggiItem()).toEqual([{ priceId: priceBase, quantita: 1 }]);

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/configura");

    // --- secondo operatore -> 1 extra ---
    await page.locator("#nome_operatore").fill("Seconda");
    await page.getByRole("button", { name: "Aggiungi" }).first().click();
    await expect(page.getByText("Seconda")).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => await abbonamento!.leggiItem(), {
        timeout: 15_000,
        message: "Stripe deve avere la riga 'operatore extra' del piano STARTER con quantità 1",
      })
      .toEqual(
        expect.arrayContaining([
          { priceId: priceBase, quantita: 1 },
          { priceId: priceExtra, quantita: 1 },
        ])
      );

    // --- terzo operatore -> 2 extra ---
    await page.locator("#nome_operatore").fill("Terza");
    await page.getByRole("button", { name: "Aggiungi" }).first().click();
    await expect(page.getByText("Terza")).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => (await abbonamento!.leggiItem()).find((i) => i.priceId === priceExtra)?.quantita, {
        timeout: 15_000,
        message: "il terzo operatore deve portare la quantità a 2",
      })
      .toBe(2);

    // --- si elimina un operatore -> torna a 1 extra ---
    const rigaTerza = page.locator("li", { hasText: "Terza" }).first();
    await rigaTerza.getByRole("button", { name: "Elimina" }).click();
    await expect(page.getByText("Terza")).toHaveCount(0, { timeout: 15_000 });

    await expect
      .poll(async () => (await abbonamento!.leggiItem()).find((i) => i.priceId === priceExtra)?.quantita, {
        timeout: 15_000,
        message: "eliminando un operatore la quantità fatturata deve scendere, non restare ferma",
      })
      .toBe(1);
  });

  test("su Pro viene usato il price da 20€, non quello di Starter", async ({ page }) => {
    // Il bug che questo test esclude è denaro vero addebitato male: un salone
    // Pro a cui viene applicata la quota di Starter paga 10€ invece di 20€
    // per ogni persona, e nessuno se ne accorge finché non si guardano le
    // fatture una per una.
    const priceExtraPro = priceIdOperatoreExtra("pro");
    const priceExtraStarter = priceIdOperatoreExtra("starter");
    expect(priceExtraPro).toBeTruthy();

    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario16b",
      piano: "pro",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Prima", servizi: [0] }],
    });

    abbonamento = await creaAbbonamentoDiProva("pro", "Scenario16b");
    await tenant.supabase
      .from("tenants")
      .update({ stripe_subscription_id: abbonamento.subscriptionId })
      .eq("id", tenant.id);

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/configura");
    await page.locator("#nome_operatore").fill("Seconda");
    await page.getByRole("button", { name: "Aggiungi" }).first().click();
    await expect(page.getByText("Seconda")).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => (await abbonamento!.leggiItem()).map((i) => i.priceId), { timeout: 15_000 })
      .toContain(priceExtraPro!);

    const priceIdPresenti = (await abbonamento.leggiItem()).map((i) => i.priceId);
    expect(priceIdPresenti, "la quota di Starter non deve mai finire su un tenant Pro").not.toContain(
      priceExtraStarter!
    );
  });
});
