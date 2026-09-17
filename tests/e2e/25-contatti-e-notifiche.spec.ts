import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";

/**
 * Scenario 25 (17/09/2026) -- i due pannelli nuovi delle impostazioni.
 *
 * Perché end-to-end e non solo unit test: la logica pura è già coperta
 * (`contatti.test.ts`, `notifiche-prenotazione.test.ts`). Quello che solo un
 * test dal vivo dimostra è che il giro completo funziona -- il form scrive
 * davvero sulla colonna giusta passando dalla RLS del titolare, che dalla
 * migrazione 0030 concede l'UPDATE colonna per colonna: una colonna nuova
 * dimenticata nel `grant` non fa fallire niente a schermo, salva
 * silenziosamente zero righe.
 */
test.describe("Scenario 25 -- contatti e notifiche", () => {
  let tenant: TenantDiProva;

  test.afterEach(async () => {
    await tenant?.pulisci();
  });

  test("il titolare salva telefono e WhatsApp, e l'anteprima dice cosa sentirà il cliente", async ({
    page,
  }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E Scenario25", piano: "growth" });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/impostazioni/contatti");

    await page.locator('input[name="telefono"]').fill("02 1234567");
    // Di default la spunta "stesso numero" è spenta (i due campi partono
    // vuoti), quindi il campo WhatsApp è scrivibile.
    await page.locator('input[name="telefono_whatsapp"]').fill("333 7654321");

    // L'anteprima è il punto della pagina: mostra la frase VERA che l'AI
    // dirà, costruita dalla stessa funzione del prompt.
    await expect(
      page.getByText("chiamare il 02 1234567 oppure scrivere su WhatsApp al 333 7654321")
    ).toBeVisible();
    await expect(page.getByText("https://wa.me/393337654321")).toBeVisible();

    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByText("Contatti salvati.")).toBeVisible();

    const { data } = await tenant.supabase
      .from("tenants")
      .select("telefono, telefono_whatsapp")
      .eq("id", tenant.id)
      .single();
    expect(data?.telefono).toBe("02 1234567");
    expect(data?.telefono_whatsapp).toBe("333 7654321");
  });

  test("con 'stesso numero' spuntato, il WhatsApp salvato è il telefono e non resta vuoto", async ({
    page,
  }) => {
    // Un input disabilitato non entra nel FormData: senza il travaso fatto a
    // mano nel pannello, salvare cancellerebbe il numero invece di copiarlo.
    tenant = await creaTenantDiProva({ nome: "Salone E2E Scenario25b", piano: "growth" });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/impostazioni/contatti");

    await page.locator('input[name="telefono"]').fill("333 1112223");
    await page.getByText("Su WhatsApp uso lo stesso numero").click();
    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByText("Contatti salvati.")).toBeVisible();

    const { data } = await tenant.supabase
      .from("tenants")
      .select("telefono, telefono_whatsapp")
      .eq("id", tenant.id)
      .single();
    expect(data?.telefono_whatsapp).toBe("333 1112223");
    expect(data?.telefono_whatsapp).toBe(data?.telefono);
  });

  test("le notifiche si spengono davvero, e le opzioni SMS restano chiuse sotto Pro", async ({
    page,
  }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E Scenario25c", piano: "growth" });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/impostazioni/notifiche");

    // Sotto Pro l'opzione esiste a schermo -- nasconderla farebbe sembrare
    // il prodotto più povero di quello che è -- ma non si può scegliere.
    const soloSms = page.locator('input[name="conferma_cliente_canale"][value="solo_sms"]');
    await expect(soloSms).toBeDisabled();
    await expect(page.getByText("Richiede l'SMS, incluso dal piano Pro in su.")).toBeVisible();

    await page.getByText("Avvisami a ogni nuova prenotazione").click();
    await page.locator('input[name="conferma_cliente_canale"][value="nessuna"]').check();
    await expect(
      page.getByText("Senza conferma il cliente non riceve nemmeno il link per cancellare")
    ).toBeVisible();

    await page.getByRole("button", { name: "Salva" }).click();
    await expect(page.getByText("Notifiche salvate.")).toBeVisible();

    const { data } = await tenant.supabase
      .from("tenants")
      .select("notifica_titolare_nuova_prenotazione, conferma_cliente_canale")
      .eq("id", tenant.id)
      .single();
    expect(data?.notifica_titolare_nuova_prenotazione).toBe(false);
    expect(data?.conferma_cliente_canale).toBe("nessuna");
  });

  /**
   * Follow-up ai clienti spariti (migrazione 0040). Il controllo che conta
   * non è che il numero si salvi, ma che si salvi NELL'UNICO posto: la
   * stessa soglia governa il job notturno, la card della dashboard e il
   * filtro della rubrica. Se una delle tre restasse a 60 fisso, un salone
   * leggerebbe una cosa e riceverebbe email partite su un'altra.
   */
  test("la soglia del follow-up guida anche la card della dashboard e il filtro della rubrica", async ({
    page,
  }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E Scenario25d", piano: "growth" });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/impostazioni/promemoria");

    await page.locator('input[name="giorni"]').fill("90");
    await expect(
      page.getByText(/non riscriviamo più di una volta ogni/),
      "sopra i 60 giorni la finestra segue la soglia"
    ).toContainText("90 giorni");

    await page.locator('textarea[name="messaggio"]').fill("Ehi {nome}, torna a trovarci!");
    await expect(page.getByText("Ehi Giulia, torna a trovarci!")).toBeVisible();

    await page.getByRole("button", { name: "Salva" }).last().click();
    await expect(page.getByText("Follow-up salvato.")).toBeVisible();

    const { data } = await tenant.supabase
      .from("tenants")
      .select("follow_up_inattivi_attivo, follow_up_inattivi_giorni, follow_up_inattivi_messaggio")
      .eq("id", tenant.id)
      .single();
    expect(data?.follow_up_inattivi_giorni).toBe(90);
    expect(data?.follow_up_inattivi_messaggio).toBe("Ehi {nome}, torna a trovarci!");
    expect(data?.follow_up_inattivi_attivo).toBe(true);

    // Il numero deve essere cambiato ANCHE qui, non solo nelle impostazioni.
    await page.goto("/dashboard/clienti?filtro=inattivi");
    await expect(page.getByText(/non negli ultimi 90 giorni/)).toBeVisible();
  });

  test("con l'interruttore spento, sotto una soglia bassa, il valore resta quello scelto", async ({
    page,
  }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E Scenario25e", piano: "growth" });

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/impostazioni/promemoria");

    await page.getByText("Manda il messaggio automaticamente").click();
    await page.locator('input[name="giorni"]').fill("14");
    // Sotto i 60 la finestra NON segue la soglia: è il pavimento anti-spam.
    await expect(page.getByText(/non riscriviamo più di una volta ogni/)).toContainText("60 giorni");

    await page.getByRole("button", { name: "Salva" }).last().click();
    await expect(page.getByText("Follow-up salvato.")).toBeVisible();

    const { data } = await tenant.supabase
      .from("tenants")
      .select("follow_up_inattivi_attivo, follow_up_inattivi_giorni")
      .eq("id", tenant.id)
      .single();
    expect(data?.follow_up_inattivi_attivo).toBe(false);
    expect(data?.follow_up_inattivi_giorni).toBe(14);
  });
});
