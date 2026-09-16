import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { creaMembroDiProva, type MembroDiProva } from "./helpers/membri-di-prova";

/**
 * Scenario 19 (Fase 5, migrazione 0027): i permessi del collaboratore,
 * verificati dal vivo con due account veri sullo stesso salone.
 *
 * I limiti sono quelli scelti da Gabriel il 16/09/2026: uno staff lavora su
 * agenda, clienti e lista d'attesa -- inclusa l'agenda degli ALTRI operatori,
 * scelta esplicita perché in un salone piccolo chi è alla cassa risponde al
 * telefono e deve poter prenotare per la collega -- ma non vede fatturato e
 * analytics, non tocca la configurazione e la fatturazione, e non porta via
 * la rubrica clienti in CSV.
 *
 * Le pagine bloccate si controllano DUE volte apposta, e il secondo
 * controllo è quello che conta: una pagina si può solo guardare, una server
 * action e una route sono endpoint chiamabili senza mai aprire la pagina.
 * Per questo qui non ci si ferma a "il link non c'è": si va all'URL diretto e
 * si chiama l'endpoint di export a mano.
 */
test.describe("Scenario 19 -- permessi del collaboratore", () => {
  let tenant: TenantDiProva;
  let staff: MembroDiProva | null = null;

  test.afterEach(async () => {
    await staff?.pulisci();
    staff = null;
    await tenant?.pulisci();
  });

  test("il collaboratore lavora sull'agenda ma è fuori da numeri, configurazione e fatturazione", async ({
    page,
    baseURL,
  }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone E2E Scenario19",
      piano: "pro",
      servizi: [{ nome: "Piega", durataMinuti: 30, prezzoCentesimi: 2000 }],
      operatori: [{ nome: "Titolare Op", servizi: [0] }],
    });
    staff = await creaMembroDiProva(tenant.id, "staff");

    await accediComeTitolare(page, staff.email, staff.password);

    // --- quello che NON deve nemmeno vedere sulla dashboard ---
    await expect(page.getByRole("link", { name: "Analytics" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Team" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Impostazioni" })).toHaveCount(0);
    // "collaboratore", non "titolare": è la riga che gli dice chi è.
    await expect(page.locator("dd", { hasText: "collaboratore" })).toBeVisible();

    // --- quello che PUÒ fare: agenda e clienti, per tutti gli operatori ---
    await page.goto("/dashboard/calendario");
    await expect(page).toHaveURL(/\/dashboard\/calendario/);
    await page.goto("/dashboard/clienti");
    await expect(page).toHaveURL(/\/dashboard\/clienti/);

    // --- URL diretti: il layout deve rimbalzarlo, non servirgli la pagina ---
    await page.goto("/dashboard/impostazioni");
    await expect(page, "le impostazioni sono riservate al titolare").toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/analytics");
    await expect(page, "fatturato e analytics sono riservati al titolare").toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/team");
    await expect(page, "la pagina da cui si dà e si toglie l'accesso non deve aprirsi").toHaveURL(
      /\/dashboard$/
    );

    // --- la configurazione si vede, ma in sola lettura ---
    await page.goto("/dashboard/configura");
    await expect(page.getByText("Piega")).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator("#nome_operatore"),
      "un collaboratore non deve avere davanti nessun form di configurazione"
    ).toHaveCount(0);

    // --- endpoint chiamati a mano, senza passare dalla UI ---
    const export1 = await page.request.get(`${baseURL}/dashboard/clienti/export`);
    expect(export1.status(), "l'export della rubrica clienti è owner-only").toBe(403);

    const portale = await page.request.post(`${baseURL}/api/stripe/portal`);
    expect(portale.status(), "il portale abbonamento è owner-only").toBe(403);

    const checkout = await page.request.post(`${baseURL}/api/stripe/checkout`, {
      data: { piano: "growth" },
    });
    expect(checkout.status(), "un collaboratore non deve poter aprire un checkout").toBe(403);
  });

  test("il titolare, sullo stesso salone, fa tutto quello che allo staff è negato", async ({
    page,
    baseURL,
  }) => {
    // Controprova indispensabile: senza, un bug che blocca TUTTI (per esempio
    // un `normalizzaRuolo` che sbaglia a leggere il ruolo) farebbe passare il
    // test qui sopra a pieni voti.
    tenant = await creaTenantDiProva({
      nome: "Salone E2E Scenario19b",
      piano: "pro",
      servizi: [{ nome: "Piega", durataMinuti: 30, prezzoCentesimi: 2000 }],
      operatori: [{ nome: "Titolare Op", servizi: [0] }],
    });

    await accediComeTitolare(page, tenant.email, tenant.password);

    await expect(page.getByRole("link", { name: "Analytics" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Team" })).toBeVisible();

    await page.goto("/dashboard/impostazioni");
    await expect(page).toHaveURL(/\/dashboard\/impostazioni/);

    await page.goto("/dashboard/analytics");
    await expect(page).toHaveURL(/\/dashboard\/analytics/);

    await page.goto("/dashboard/team");
    await expect(page).toHaveURL(/\/dashboard\/team/);
    await expect(page.getByRole("heading", { name: "Team" })).toBeVisible();

    await page.goto("/dashboard/configura");
    await expect(page.locator("#nome_operatore")).toBeVisible();

    const esportazione = await page.request.get(`${baseURL}/dashboard/clienti/export`);
    expect(esportazione.ok(), "il titolare deve poter esportare la rubrica").toBe(true);
  });

  test("il titolare invita un collaboratore e poi gli toglie l'accesso", async ({ page }) => {
    tenant = await creaTenantDiProva({ nome: "Salone E2E Scenario19c", piano: "pro" });
    staff = await creaMembroDiProva(tenant.id, "staff");

    await accediComeTitolare(page, tenant.email, tenant.password);
    await page.goto("/dashboard/team");

    // Il collaboratore appena collegato compare fra chi lavora qui.
    await expect(page.getByText(staff.email)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Collaboratore").first()).toBeVisible();

    // Promozione a titolare e ritorno indietro: il ruolo deve cambiare sia in
    // `membri_tenant` sia in `profiles` (è quest'ultimo che i permessi
    // leggono a ogni richiesta -- se restassero disallineati, la UI direbbe
    // una cosa e il server ne farebbe un'altra).
    const riga = page.locator("li", { hasText: staff.email });
    await riga.getByRole("button", { name: "Rendi titolare" }).click();

    await expect
      .poll(
        async () => {
          const { data } = await tenant.supabase
            .from("membri_tenant")
            .select("ruolo")
            .eq("tenant_id", tenant.id)
            .eq("user_id", staff!.utenteId)
            .single();
          return data?.ruolo;
        },
        { timeout: 15_000 }
      )
      .toBe("owner");

    await expect
      .poll(
        async () => {
          const { data } = await tenant.supabase
            .from("profiles")
            .select("ruolo")
            .eq("id", staff!.utenteId)
            .single();
          return data?.ruolo;
        },
        { timeout: 15_000, message: "profiles.ruolo è quello che legge ogni gate di permesso" }
      )
      .toBe("owner");

    // Rimozione: l'appartenenza sparisce e la sede attiva di quella persona
    // non può restare puntata su un salone di cui non fa più parte,
    // altrimenti RLS continuerebbe a farle vedere tutto.
    await page.reload();
    const rigaAggiornata = page.locator("li", { hasText: staff.email });
    await rigaAggiornata.getByRole("button", { name: "Rimuovi" }).click();

    await expect
      .poll(
        async () => {
          const { count } = await tenant.supabase
            .from("membri_tenant")
            .select("user_id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id)
            .eq("user_id", staff!.utenteId);
          return count ?? 0;
        },
        { timeout: 15_000, message: "l'appartenenza deve sparire davvero" }
      )
      .toBe(0);

    // `rimuoviMembro` aggiorna la sede attiva DOPO aver cancellato
    // l'appartenenza: leggere il profilo nell'istante in cui il conteggio va a
    // zero significa correre contro la seconda scrittura. Si attende.
    await expect
      .poll(
        async () => {
          const { data } = await tenant.supabase
            .from("profiles")
            .select("tenant_id")
            .eq("id", staff!.utenteId)
            .single();
          return data?.tenant_id;
        },
        {
          timeout: 15_000,
          message: "chi è stato rimosso non deve restare con la sede attiva puntata su quel salone",
        }
      )
      .not.toBe(tenant.id);
  });
});
