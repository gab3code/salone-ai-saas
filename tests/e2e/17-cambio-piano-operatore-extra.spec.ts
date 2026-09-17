import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { creaAbbonamentoDiProva, type AbbonamentoDiProva } from "./helpers/abbonamento-di-prova";
import { priceIdOperatoreExtra, priceIdPerPiano } from "@/lib/stripe/piani";

/**
 * Scenario 17 (Fase 5, 16/09/2026): quando un salone cambia piano, la riga
 * "operatore extra" del piano vecchio viene SOSTITUITA da quella del piano
 * nuovo, non affiancata.
 *
 * È il caso più facile da sbagliare di tutta la fatturazione per operatore,
 * ed è nato il giorno stesso in cui la quota è passata da una sola cifra
 * (20€ su Pro) a tre diverse (10/15/20). Un salone che passa da Starter a
 * Growth con 3 operatori si porta dietro la riga da 10€: se la
 * sincronizzazione cerca solo il price del piano ATTUALE, non la riconosce,
 * ne aggiunge una seconda da 15€ e il cliente si ritrova a pagare entrambe.
 * Da qui `tuttiPriceIdOperatoreExtra()` in stripe/piani.ts, di cui questo
 * scenario è la verifica dal vivo.
 */
test.describe("Scenario 17 -- cambio piano e quota per operatore", () => {
  let tenant: TenantDiProva;
  let abbonamento: AbbonamentoDiProva | null = null;

  test.afterEach(async () => {
    await abbonamento?.pulisci();
    abbonamento = null;
    await tenant?.pulisci();
  });

  test("da Starter a Growth la quota da 10€ sparisce e resta solo quella da 15€", async ({ page }) => {
    const priceExtraStarter = priceIdOperatoreExtra("starter");
    const priceExtraGrowth = priceIdOperatoreExtra("growth");
    expect(priceExtraStarter, "serve STRIPE_PRICE_STARTER_OPERATORE_EXTRA in .env.local").toBeTruthy();
    expect(priceExtraGrowth, "serve STRIPE_PRICE_GROWTH_OPERATORE_EXTRA in .env.local").toBeTruthy();

    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario17",
      piano: "starter",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Prima", servizi: [0] }],
    });

    abbonamento = await creaAbbonamentoDiProva("starter", "Scenario17");
    await tenant.supabase
      .from("tenants")
      .update({ stripe_subscription_id: abbonamento.subscriptionId })
      .eq("id", tenant.id);

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/configura");

    // Si parte da un salone Starter con 2 operatori: 1 quota da 10€.
    await page.locator("#nome_operatore").fill("Seconda");
    await page.getByRole("button", { name: "Aggiungi" }).first().click();
    await expect(page.getByText("Seconda").first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => (await abbonamento!.leggiItem()).map((i) => i.priceId), { timeout: 15_000 })
      .toContain(priceExtraStarter!);

    // Il salone passa a Growth DAVVERO: si cambia il price della riga base
    // sull'abbonamento, che è quello che succede con un upgrade dal Customer
    // Portal. Scrivere solo `tenants.piano` -- come faceva questo test fino
    // al 17/09/2026 -- non è un cambio piano ma un disallineamento fra
    // database e Stripe, e da quando la quota per operatore si sceglie in
    // base al piano DAVVERO FATTURATO il prodotto si rifiuta (giustamente)
    // di attaccare una quota Growth a una base Starter.
    //
    // Quel disallineamento è anche la ragione per cui questo scenario era
    // intermittente: il webhook di Stripe, consegnato alla produzione che
    // scrive sullo stesso database, riportava `piano` a starter quando
    // faceva in tempo ad arrivare prima del terzo operatore -- e il test
    // falliva o passava a seconda della latenza di consegna.
    await abbonamento.cambiaPianoBase("growth");
    await tenant.supabase.from("tenants").update({ piano: "growth" }).eq("id", tenant.id);

    // Si aspetta di RILEGGERE growth dal database prima di proseguire.
    // Sembra pedanteria, non lo è: il 17/09/2026 questo scenario è fallito in
    // modo intermittente perché la sincronizzazione ha aggiornato la quantità
    // della riga Starter invece di sostituirla, cosa possibile solo se il
    // server ha letto `piano` ancora come "starter" mentre contava già 3
    // operatori. Con questa attesa, se il caso si ripresenta il dubbio
    // "forse la scrittura non era ancora arrivata" è escluso: il database
    // diceva growth e il server ha letto altro.
    await expect
      .poll(
        async () => (await abbonamento!.leggiItem()).map((i) => i.priceId),
        { timeout: 15_000, message: "la riga base su Stripe deve essere passata a Growth" }
      )
      .toContain(priceIdPerPiano("growth"));

    // Prima occasione utile in cui la sincronizzazione rigira: un altro
    // operatore. È anche il caso peggiore -- la quantità cambia E il price
    // cambia nello stesso giro.
    await page.reload();
    await page.locator("#nome_operatore").fill("Terza");
    await page.getByRole("button", { name: "Aggiungi" }).first().click();
    await expect(page.getByText("Terza").first()).toBeVisible({ timeout: 15_000 });

    // Si asserisce sull'elenco COMPLETO dei price presenti, non su due
    // booleani: quando fallisce, il messaggio di Playwright deve dire cosa
    // c'è davvero sull'abbonamento, altrimenti resta da indovinare.
    await expect
      .poll(
        async () => {
          const item = await abbonamento!.leggiItem();
          return item
            .map((i) => `${i.priceId}${i.quantita !== undefined ? ` x${i.quantita}` : ""}`)
            .sort();
        },
        {
          timeout: 20_000,
          message:
            "dopo il passaggio a Growth deve restare SOLO la quota da 15€ (x2), mai quella da 10€",
        }
      )
      .toEqual([`${priceIdPerPiano("growth")} x1`, `${priceExtraGrowth} x2`].sort());
  });
});
