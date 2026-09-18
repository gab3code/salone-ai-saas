import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaAppuntamentoConfermato } from "./helpers/appuntamento-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 30 -- la configurazione del salone, dal form fino agli orari che
 * il cliente si vede proporre.
 *
 * Cosa copre e perche' proprio questo. Tutte le cose verificate qui sono
 * nate nella stessa giornata (18/09/2026) e hanno in comune una cosa sola:
 * erano MEZZE FUNZIONALITA'. Un pezzo c'era -- una colonna, un parametro,
 * una tabella -- e il pezzo che lo rendeva vero no.
 *
 *  - `chiusure` era letta dal motore dalla migrazione 0002 e non la scriveva
 *    nessuna schermata: le ferie non erano inseribili dal prodotto;
 *  - `bufferMinuti` esisteva nel motore, aveva un test verde, e nessuna
 *    schermata lo passava: in produzione valeva zero per tutti;
 *  - `attivo` su operatori e servizi era letta dal motore dal primo giorno e
 *    non la scriveva nessuno;
 *  - gli orari erano solo del salone, mai della singola persona;
 *  - cancellare un operatore svuotava in silenzio i suoi appuntamenti
 *    (`on delete set null`), passati e pagati compresi.
 *
 * Un test unitario su una funzione non avrebbe visto niente di tutto questo:
 * il difetto stava nel PONTE fra livelli, non dentro un livello. Per questo
 * qui si passa sempre dalla schermata vera e si verifica sempre l'effetto
 * finale, cioe' gli orari proposti.
 *
 * Volutamente NON coperto qui: la generazione della bozza dell'onboarding
 * AI, che chiamerebbe il modello davvero -- lenta, a pagamento e non
 * deterministica. La sua logica (diff con la configurazione esistente,
 * rimozioni mai automatiche, silenzio diverso da elenco vuoto) e' coperta
 * da onboarding-ai-diff.test.ts e onboarding-ai-azioni.test.ts. Qui si
 * verifica il risultato di quella logica quando arriva al database.
 */

/** Gli orari liberi mostrati dal pannello "nuovo appuntamento" del calendario. */
async function orariProposti(
  page: import("@playwright/test").Page,
  tenant: TenantDiProva,
  ymd: string,
  servizioIndice = 0
): Promise<string[]> {
  await page.goto(`/dashboard/calendario?data=${ymd}&servizio_id=${tenant.servizi[servizioIndice].id}`);
  await page.getByText("Orari liberi").waitFor();
  const bottoni = page.locator("button", { hasText: /^\d{2}:\d{2}/ });
  return (await bottoni.allInnerTexts()).map((t) => t.trim());
}

test.describe("Scenario 30 -- configurazione completa del salone", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("le ferie tolgono davvero gli orari, e si tolgono di nuovo", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Ferie",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Anna", servizi: [0] }],
    });
    const giorno = prossimoGiornoAperto();
    await accediComeTitolare(page, tenant.email, tenant.password);

    // Prima delle ferie: il giorno ha orari liberi.
    expect((await orariProposti(page, tenant, giorno.ymd)).length).toBeGreaterThan(0);

    await page.goto("/dashboard/configura");
    await page.locator("#chiusura_inizio").fill(giorno.ymd);
    await page.locator("#chiusura_motivo").fill("Ferie E2E");
    await page.getByRole("button", { name: "Aggiungi chiusura" }).click();
    await expect(page.getByText("Ferie E2E")).toBeVisible();

    // Dopo: nessun orario proponibile in quel giorno.
    expect(await orariProposti(page, tenant, giorno.ymd)).toEqual([]);

    // E la chiusura si toglie: una ferie messa per sbaglio non deve
    // richiedere di andare nel database.
    await page.goto("/dashboard/configura");
    await page.getByRole("button", { name: "Togli" }).first().click();
    await expect(page.getByText("Ferie E2E")).toHaveCount(0);
    expect((await orariProposti(page, tenant, giorno.ymd)).length).toBeGreaterThan(0);
  });

  test("un periodo di ferie copre tutti i giorni in mezzo, non solo i due estremi", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Periodo",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Anna", servizi: [0] }],
    });
    const inizio = prossimoGiornoAperto();
    const fine = new Date(inizio.data);
    fine.setUTCDate(fine.getUTCDate() + 3);
    const fineYmd = fine.toISOString().slice(0, 10);

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/configura");
    await page.locator("#chiusura_inizio").fill(inizio.ymd);
    await page.locator("#chiusura_fine").fill(fineYmd);
    await page.locator("#chiusura_motivo").fill("Chiusura estiva E2E");
    await page.getByRole("button", { name: "Aggiungi chiusura" }).click();

    const { data: righe } = await tenant.supabase
      .from("chiusure")
      .select("data")
      .eq("tenant_id", tenant.id)
      .order("data");
    // Quattro giorni, estremi inclusi: il periodo diventa una riga per
    // giorno perche' e' cosi' che il motore lo sa leggere.
    expect((righe ?? []).map((r) => r.data)).toEqual([
      inizio.ymd,
      new Date(inizio.data.getTime() + 86400000).toISOString().slice(0, 10),
      new Date(inizio.data.getTime() + 2 * 86400000).toISOString().slice(0, 10),
      fineYmd,
    ]);

    // In elenco resta UNA voce, non quattro: si legge come e' stata pensata.
    await page.goto("/dashboard/configura");
    await expect(page.getByText("Chiusura estiva E2E")).toHaveCount(1);
  });

  test("il passo dell'agenda cambia gli orari che il salone propone", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Passo",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Anna", servizi: [0] }],
    });
    const giorno = prossimoGiornoAperto();
    await accediComeTitolare(page, tenant.email, tenant.password);

    // Di default: un orario ogni quarto d'ora.
    const conQuindici = await orariProposti(page, tenant, giorno.ymd);
    expect(conQuindici.some((o) => o.startsWith("09:15"))).toBe(true);

    await page.goto("/dashboard/configura");
    await page.locator("#passo_slot_minuti").fill("30");
    await page.getByRole("button", { name: "Salva regole" }).click();
    await expect(page.locator("#passo_slot_minuti")).toHaveValue("30");

    const conTrenta = await orariProposti(page, tenant, giorno.ymd);
    expect(conTrenta.some((o) => o.startsWith("09:00"))).toBe(true);
    expect(conTrenta.some((o) => o.startsWith("09:30"))).toBe(true);
    expect(conTrenta.some((o) => o.startsWith("09:15")), "il passo non e' arrivato al motore").toBe(false);
  });

  test("lo stacco fra appuntamenti toglie l'orario attaccato a quello occupato", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Buffer",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Anna", servizi: [0] }],
    });
    const giorno = prossimoGiornoAperto();
    await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorno.ymd,
      oraHHMM: "10:00",
      clienteTelefono: "3339930001",
    });

    await accediComeTitolare(page, tenant.email, tenant.password);

    // Senza stacco, il primo orario dopo un appuntamento 10:00-10:30 e' le 10:30.
    expect((await orariProposti(page, tenant, giorno.ymd)).some((o) => o.startsWith("10:30"))).toBe(true);

    await page.goto("/dashboard/configura");
    await page.locator("#buffer_minuti").fill("15");
    await page.getByRole("button", { name: "Salva regole" }).click();
    await expect(page.locator("#buffer_minuti")).toHaveValue("15");

    // Con 15 minuti di stacco: le 10:30 non si possono piu' prenotare, le 10:45 si'.
    // Fino al 18/09/2026 questo parametro esisteva nel motore, aveva un test
    // verde, e nessuna schermata lo passava: valeva zero per tutti.
    const conStacco = await orariProposti(page, tenant, giorno.ymd);
    expect(conStacco.some((o) => o.startsWith("10:30")), "lo stacco non e' arrivato al motore").toBe(false);
    expect(conStacco.some((o) => o.startsWith("10:45"))).toBe(true);
  });

  test("gli orari di una persona la tolgono dalle ore in cui non c'e'", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E PartTime",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [
        { nome: "Rita", servizi: [0] },
        { nome: "Bruno", servizi: [0] },
      ],
    });
    const giorno = prossimoGiornoAperto();
    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/configura");

    // Rita lavora solo di mattina, nel giorno che il test guardera'.
    await page.getByText("Orari di Rita").click();
    const modulo = page.locator("form", { has: page.locator('input[name="segue_salone"]') }).first();
    await modulo.locator('input[name="segue_salone"]').uncheck();
    for (let g = 0; g <= 6; g++) {
      if (g === giorno.giornoSettimana) {
        await modulo.locator(`input[name="op_chiuso_${g}"]`).uncheck();
        await modulo.locator(`input[name="op_apertura_${g}"]`).fill("09:00");
        await modulo.locator(`input[name="op_chiusura_${g}"]`).fill("13:00");
      } else {
        await modulo.locator(`input[name="op_chiuso_${g}"]`).check();
      }
    }
    await modulo.getByRole("button", { name: /^Salva orari di Rita$/ }).click();
    await expect(page.getByText("Orari propri").first()).toBeVisible();

    const orari = await orariProposti(page, tenant, giorno.ymd);
    const pomeriggio = orari.filter((o) => Number(o.slice(0, 2)) >= 14);
    expect(pomeriggio.length, "il pomeriggio deve restare aperto per Bruno").toBeGreaterThan(0);
    expect(pomeriggio.every((o) => !o.includes("Rita")), "Rita proposta quando non lavora").toBe(true);
    expect(orari.some((o) => o.includes("Rita")), "Rita deve esserci di mattina").toBe(true);
  });

  test("un operatore con appuntamenti non si cancella: si disattiva, e lo dice", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E Storico",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [
        { nome: "Anna", servizi: [0] },
        { nome: "Bruno", servizi: [0] },
      ],
    });
    const giorno = prossimoGiornoAperto();
    await creaAppuntamentoConfermato(tenant, {
      giornoYMD: giorno.ymd,
      oraHHMM: "11:00",
      operatoreIndice: 0,
      clienteTelefono: "3339930002",
    });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/configura");

    const rigaAnna = page.locator("li", { hasText: "Anna" }).first();
    await rigaAnna.getByRole("button", { name: "Elimina" }).click();

    // Il rifiuto si VEDE. Prima il valore di ritorno dell'azione finiva nel
    // vuoto: l'utente cliccava e non succedeva niente.
    await expect(page.getByRole("alert")).toContainText("Disattivalo");

    const { data: operatori } = await tenant.supabase
      .from("operatori")
      .select("id, attivo")
      .eq("tenant_id", tenant.id);
    expect(operatori).toHaveLength(2);

    // L'appuntamento e' ancora suo: e' il dato che la cancellazione avrebbe
    // svuotato in silenzio (`on delete set null`).
    const { data: appuntamenti } = await tenant.supabase
      .from("appuntamenti")
      .select("operatore_id")
      .eq("tenant_id", tenant.id);
    expect(appuntamenti?.[0]?.operatore_id).toBe(tenant.operatori[0].id);

    // La strada suggerita funziona davvero.
    await rigaAnna.getByRole("button", { name: "Disattiva" }).click();
    await expect(page.getByText("non attivo, non riceve prenotazioni")).toBeVisible();

    const orari = await orariProposti(page, tenant, giorno.ymd);
    expect(orari.some((o) => o.includes("Anna")), "un operatore disattivato non riceve prenotazioni").toBe(false);
    expect(orari.some((o) => o.includes("Bruno"))).toBe(true);
  });

  test("chi fa cosa: togliere il collegamento toglie l'operatore da quel servizio", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E ChiFaCosa",
      piano: "growth",
      servizi: [
        { nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 },
        { nome: "Colore", durataMinuti: 60, prezzoCentesimi: 6000 },
      ],
      operatori: [
        { nome: "Anna", servizi: [0, 1] },
        { nome: "Bruno", servizi: [0, 1] },
      ],
    });
    const giorno = prossimoGiornoAperto();
    await accediComeTitolare(page, tenant.email, tenant.password);

    expect((await orariProposti(page, tenant, giorno.ymd, 1)).some((o) => o.includes("Bruno"))).toBe(true);

    // Bruno non fa il colore.
    await page.goto("/dashboard/configura");
    const collegamento = page.getByRole("button", { name: "Bruno esegue Colore" });
    await expect(collegamento).toHaveAttribute("aria-pressed", "true");
    await collegamento.click();
    await expect(page.getByRole("button", { name: "Bruno esegue Colore" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );

    const dopo = await orariProposti(page, tenant, giorno.ymd, 1);
    expect(dopo.some((o) => o.includes("Bruno")), "Bruno proposto per un servizio che non fa").toBe(false);
    expect(dopo.some((o) => o.includes("Anna"))).toBe(true);
  });
});
