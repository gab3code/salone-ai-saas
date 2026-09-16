import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 12 (punto 30): il professionista crea manualmente una
 * prenotazione dalla dashboard -- nessuna AI coinvolta, verifica lo stesso
 * percorso UI che uno staff userebbe davvero (checkbox servizio, clic su
 * uno slot proposto dal motore vero, form cliente, invio).
 */
test.describe("Scenario 12 -- prenotazione manuale da dashboard", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("lo staff crea un appuntamento dal pannello, senza passare dall'AI", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario12",
      piano: "starter", // niente AI su questo piano -- lo scenario deve funzionare comunque, è manuale
      servizi: [{ nome: "Colore", durataMinuti: 60, prezzoCentesimi: 4500 }],
      operatori: [{ nome: "Rita", servizi: [0] }],
    });
    const giorno = prossimoGiornoAperto();

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto(`/dashboard/calendario?data=${giorno.ymd}`);

    await page.getByRole("checkbox").first().check();
    await expect(page.getByText("Orari liberi")).toBeVisible();

    const primoSlot = page.locator("button", { hasText: /^\d{2}:\d{2}/ }).first();
    await expect(primoSlot).toBeVisible({ timeout: 10_000 });
    await primoSlot.click();

    // I due campi non hanno un <label htmlFor> associato nel markup (solo
    // testo visivo) -- getByLabel non li troverebbe, si usa il nome del
    // campo del form (identico a quello letto da azioni.ts via FormData).
    await page.locator('input[name="cliente_nome"]').fill("Francesca Blu");
    await page.locator('input[name="cliente_telefono"]').fill("3339990012");
    await page.getByRole("button", { name: "Conferma prenotazione" }).click();

    await expect(page.getByText("Francesca Blu")).toBeVisible({ timeout: 10_000 });

    const { data: righe } = await tenant.supabase
      .from("appuntamenti")
      .select("creato_da, clienti(nome, telefono)")
      .eq("tenant_id", tenant.id)
      .neq("stato", "cancellato");
    const riga = (righe ?? []).find((a) => {
      const cliente = Array.isArray(a.clienti) ? a.clienti[0] : a.clienti;
      return cliente?.telefono === "3339990012";
    });
    expect(riga, "appuntamento non trovato nel database dopo l'invio del form").toBeTruthy();
    expect(riga!.creato_da).toBe("manuale");
  });
});
