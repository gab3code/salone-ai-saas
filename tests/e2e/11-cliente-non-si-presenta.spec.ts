import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaAppuntamentoConfermato } from "./helpers/appuntamento-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 11 (punto 27 di CLAUDE.md) -- "cliente non si presenta".
 *
 * IMPORTANTE, verificato leggendo il codice prima di scrivere questo test
 * (16/09/2026): marcare un appuntamento come no-show NON è un flusso di
 * prodotto implementato oggi. Lo stato `no_show` esiste solo a livello di
 * schema (colonna `appuntamenti.stato`, commento SQL, tipo TypeScript) e il
 * motore lo tratta già correttamente come "non occupa lo slot" -- coperto
 * da un unit test esistente (`booking-engine.test.ts`, "un appuntamento
 * no_show non genera conflitto") -- ma NESSUN pulsante o azione, in
 * dashboard o via AI, scrive oggi quello stato su una riga reale (vedi
 * PROJECT_STATUS.md, "No-show non ancora tracciato"). Testare "il cliente
 * non si presenta" come interazione utente sarebbe testare un'azione che
 * non esiste da nessuna parte nel prodotto.
 *
 * Questo scenario si riduce quindi a verificare, con uno stato `no_show`
 * inserito direttamente (come dovrebbe arrivare il giorno in cui esisterà
 * un pulsante vero), che il resto del sistema si comporti già bene: (a) il
 * database accetta quello stato senza vincoli che lo blocchino, (b) un
 * appuntamento no_show libera davvero lo slot -- verificato non contro il
 * motore puro (già fatto dall'unit test) ma contro il vincolo Postgres
 * REALE (`niente_sovrapposizioni`, che esclude solo `stato='confermato'`) e
 * contro la query reale che calcola gli slot liberi in dashboard, unendo
 * booking-engine.server.ts e la UI in un solo controllo end-to-end.
 */
test.describe("Scenario 11 -- cliente non si presenta (no-show, funzionalità non ancora implementata)", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("uno slot marcato no_show libera davvero l'orario, sia per il vincolo DB sia per la dashboard", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Scenario11",
      piano: "starter", // nessuna AI coinvolta, comportamento manuale/DB puro
      servizi: [{ nome: "Piega", durataMinuti: 30, prezzoCentesimi: 2000 }],
      operatori: [{ nome: "Rita", servizi: [0] }],
    });

    const giorno = prossimoGiornoAperto();

    const appuntamentoNoShow = await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorno.ymd,
      oraHHMM: "11:00",
      clienteNome: "Cliente Sparito",
      clienteTelefono: "3339990011",
      stato: "no_show",
    });

    // La dashboard non deve considerare quello slot occupato: lo stesso
    // operatore/orario deve comparire tra gli "Orari liberi" e restare
    // prenotabile per un cliente diverso.
    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto(`/dashboard/calendario?data=${giorno.ymd}`);
    await page.getByRole("checkbox").first().check();
    await expect(page.getByText("Orari liberi")).toBeVisible();

    const slotOreUndici = page.locator("button", { hasText: "11:00" }).first();
    await expect(slotOreUndici).toBeVisible({ timeout: 10_000 });
    await slotOreUndici.click();

    await page.locator('input[name="cliente_nome"]').fill("Cliente Nuovo");
    await page.locator('input[name="cliente_telefono"]').fill("3339990111");
    await page.getByRole("button", { name: "Conferma prenotazione" }).click();
    await expect(page.getByText("Cliente Nuovo")).toBeVisible({ timeout: 10_000 });

    // Il vincolo Postgres `niente_sovrapposizioni` esclude solo le righe
    // `confermato`: la nuova prenotazione confermata deve poter coesistere
    // con quella no_show sullo stesso operatore/orario, senza errore.
    const { data: righe } = await tenant.supabase
      .from("appuntamenti")
      .select("id, stato, clienti(telefono)")
      .eq("tenant_id", tenant.id)
      .eq("operatore_id", tenant.operatori[0].id);
    expect(righe?.length, "devono coesistere la riga no_show originale e la nuova prenotazione confermata").toBe(2);
    const statiPresenti = (righe ?? []).map((r) => r.stato).sort();
    expect(statiPresenti).toEqual(["confermato", "no_show"]);

    const { data: rigaOriginale } = await tenant.supabase
      .from("appuntamenti")
      .select("stato")
      .eq("id", appuntamentoNoShow.id)
      .single();
    expect(rigaOriginale?.stato, "la riga no_show inserita all'inizio deve restare invariata").toBe("no_show");
  });
});
