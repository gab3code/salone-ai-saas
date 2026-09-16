import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 3 (punto 30): due clienti cercano contemporaneamente lo stesso
 * slot -- il caso che l'unit test "traduce il vincolo Postgres 23P01" in
 * booking-engine.server.test.ts già copre con un client Supabase FINTO (una
 * singola risposta d'errore simulata). Qui invece la race è VERA: due
 * richieste HTTP concorrenti contro il database reale, lo scenario che
 * l'unit test non può, per costruzione, mettere alla prova.
 *
 * Due contesti browser distinti (due "clienti"), entrambi loggati come lo
 * stesso titolare per semplicità (la prenotazione manuale da dashboard è
 * deterministica e veloce, a differenza di una conversazione AI -- ideale
 * per far collidere davvero le due richieste sullo stesso istante), stesso
 * servizio/operatore/slot, submit lanciati insieme con `Promise.all`.
 */
test.describe("Scenario 3 -- doppia prenotazione simultanea sullo stesso slot", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("solo una delle due richieste concorrenti vince lo slot, l'altra riceve un errore esplicito", async ({ browser }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario3",
      piano: "starter",
      servizi: [{ nome: "Massaggio", durataMinuti: 45, prezzoCentesimi: 4000 }],
      operatori: [{ nome: "Diego", servizi: [0] }],
    });
    const giorno = prossimoGiornoAperto();

    const contestoA = await browser.newContext();
    const contestoB = await browser.newContext();
    const paginaA = await contestoA.newPage();
    const paginaB = await contestoB.newPage();

    try {
      await accediComeTitolare(paginaA, tenant.email, tenant.password);
      await accediComeTitolare(paginaB, tenant.email, tenant.password);
      await paginaA.goto(`/dashboard/calendario?data=${giorno.ymd}`);
      await paginaB.goto(`/dashboard/calendario?data=${giorno.ymd}`);

      await paginaA.getByRole("checkbox").first().check();
      await paginaB.getByRole("checkbox").first().check();

      const slotA = paginaA.locator("button", { hasText: /^\d{2}:\d{2}/ }).first();
      const slotB = paginaB.locator("button", { hasText: /^\d{2}:\d{2}/ }).first();
      await expect(slotA).toBeVisible({ timeout: 10_000 });
      await expect(slotB).toBeVisible({ timeout: 10_000 });
      // Stesso identico slot su entrambe le pagine: stesso operatore unico
      // nel tenant, stesso servizio unico -- il motore propone lo stesso
      // primo orario libero su entrambe.
      await slotA.click();
      await slotB.click();

      await paginaA.locator('input[name="cliente_nome"]').fill("Cliente Uno");
      await paginaA.locator('input[name="cliente_telefono"]').fill("3339990031");
      await paginaB.locator('input[name="cliente_nome"]').fill("Cliente Due");
      await paginaB.locator('input[name="cliente_telefono"]').fill("3339990032");

      // Il punto dello scenario: lanciate insieme, non una dopo l'altra.
      await Promise.all([
        paginaA.getByRole("button", { name: "Conferma prenotazione" }).click(),
        paginaB.getByRole("button", { name: "Conferma prenotazione" }).click(),
      ]);

      // Aspetta che entrambe le richieste abbiano finito: o il nome del
      // cliente compare in lista (successo) o compare un messaggio di
      // errore nel form (conflitto) -- indipendentemente da quale pagina
      // vince, una delle due condizioni deve verificarsi su ciascuna.
      await Promise.all([
        Promise.race([
          paginaA.getByText("Cliente Uno").waitFor({ timeout: 10_000 }),
          paginaA.locator("p.text-red-600").waitFor({ timeout: 10_000 }),
        ]),
        Promise.race([
          paginaB.getByText("Cliente Due").waitFor({ timeout: 10_000 }),
          paginaB.locator("p.text-red-600").waitFor({ timeout: 10_000 }),
        ]),
      ]);

      const { data: righe } = await tenant.supabase
        .from("appuntamenti")
        .select("clienti(telefono)")
        .eq("tenant_id", tenant.id)
        .neq("stato", "cancellato");
      const telefoniPrenotati = (righe ?? []).map((a) => {
        const cliente = Array.isArray(a.clienti) ? a.clienti[0] : a.clienti;
        return cliente?.telefono;
      });

      expect(telefoniPrenotati.length, "sullo stesso slot deve vincere UNA sola prenotazione, non zero né due").toBe(1);
      expect(["3339990031", "3339990032"]).toContain(telefoniPrenotati[0]);
    } finally {
      await contestoA.close();
      await contestoB.close();
    }
  });
});
