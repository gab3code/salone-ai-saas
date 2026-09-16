import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { collegaUtenteATenant } from "./helpers/membri-di-prova";

/**
 * Scenario 18 (Fase 5, migrazione 0027): multi-sede.
 *
 * Verifica la scelta architetturale presa con Gabriel il 16/09/2026: una
 * catena con due negozi NON è un tenant con dentro due "sedi", ma due tenant
 * separati collegati a un unico account che ci passa in mezzo con un
 * selettore. La cosa che conta davvero qui non è che il selettore compaia --
 * è che cambiando sede la dashboard mostri SOLO i dati di quella sede.
 * L'isolamento fra saloni è la promessa più seria del prodotto ("Isolamento
 * dati reale", `Funzionalita.tsx`), e il multi-sede è l'unico punto del
 * progetto in cui un utente legittimo attraversa quel confine: se si rompe
 * qualcosa, si rompe qui.
 */
test.describe("Scenario 18 -- più attività, un solo accesso", () => {
  let sedeA: TenantDiProva;
  let sedeB: TenantDiProva;

  test.afterEach(async () => {
    await sedeA?.pulisci();
    await sedeB?.pulisci();
  });

  test("il titolare passa da una sede all'altra e vede solo i dati di quella attiva", async ({ page }) => {
    sedeA = await creaTenantDiProva({
      nome: "Salone E2E Sede Centro",
      piano: "enterprise",
      servizi: [{ nome: "Taglio Centro", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Anna Centro", servizi: [0] }],
    });
    sedeB = await creaTenantDiProva({
      nome: "Salone E2E Sede Periferia",
      piano: "enterprise",
      servizi: [{ nome: "Taglio Periferia", durataMinuti: 45, prezzoCentesimi: 3500 }],
      operatori: [{ nome: "Bruno Periferia", servizi: [0] }],
    });

    // Il titolare della sede A diventa owner anche della sede B: è quello che
    // fa Gabriel a mano in onboarding su un contratto Enterprise (non esiste
    // un pulsante self-service per crearsi una seconda attività, di
    // proposito -- vedi PIANO.md Fase 5).
    await collegaUtenteATenant(sedeA.utenteId, sedeB.id, "owner");

    await accediComeTitolare(page, sedeA.email, sedeA.password);

    // Con due attività collegate il selettore deve esserci (con una sola non
    // compare affatto: un menu a tendina da un elemento è solo rumore).
    const selettore = page.locator("#selettore_sede");
    await expect(selettore).toBeVisible({ timeout: 15_000 });
    // Si asserisce il VALORE del select, non il testo: il nome della sede sta
    // dentro un <option>, che Playwright considera sempre nascosto. Ed e'
    // anche l'asserzione piu' forte delle due -- dice QUALE sede e' attiva.
    await expect(selettore).toHaveValue(sedeA.id);

    // Prova dell'isolamento, versione A: i servizi della sede attiva.
    await page.goto("/dashboard/configura");
    await expect(page.getByText("Taglio Centro").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Taglio Periferia")).toHaveCount(0);

    // --- cambio sede ---
    await page.goto("/dashboard");
    await expect(selettore).toBeVisible({ timeout: 15_000 });
    await selettore.selectOption(sedeB.id);

    await expect(selettore).toHaveValue(sedeB.id, { timeout: 15_000 });

    // Prova dell'isolamento, versione B: ora si vede l'altro salone, e
    // soltanto quello. Questa è l'asserzione che conta.
    await page.goto("/dashboard/configura");
    await expect(page.getByText("Taglio Periferia").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Taglio Centro")).toHaveCount(0);
    await expect(page.getByText("Bruno Periferia").first()).toBeVisible();
    await expect(page.getByText("Anna Centro")).toHaveCount(0);

    // La sede attiva è persistita su profiles.tenant_id -- è quello che legge
    // `auth_tenant_id()` e quindi ogni policy RLS: se non fosse aggiornata,
    // l'isolamento sopra sarebbe solo apparente (UI giusta, database no).
    const { data: profilo } = await sedeA.supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", sedeA.utenteId)
      .single();
    expect(profilo?.tenant_id).toBe(sedeB.id);
  });

  test("con una sola attività il selettore non compare, e le altre attività restano invisibili", async ({
    page,
  }) => {
    // Due controlli in uno: che il selettore non sporchi la dashboard di chi
    // ha un salone solo (il caso della quasi totalità dei clienti), e che
    // l'esistenza di un ALTRO tenant sul database non filtri in nessun modo
    // dentro la sessione di questo utente.
    // La guardia server-side di `cambiaSedeAttiva` -- quella che impedisce di
    // saltare in un'attività altrui passando un id a mano -- non è
    // verificabile da qui (una server action richiede l'id generato dal
    // bundler per essere invocata da fuori): vive come test dedicato in
    // `src/lib/membri.server.test.ts`.
    sedeA = await creaTenantDiProva({ nome: "Salone E2E Sede Propria", piano: "growth" });
    sedeB = await creaTenantDiProva({ nome: "Salone E2E Sede Altrui", piano: "growth" });

    await accediComeTitolare(page, sedeA.email, sedeA.password);

    await expect(page.locator("#selettore_sede")).toHaveCount(0);
    await expect(page.getByText("Salone E2E Sede Altrui")).toHaveCount(0);

    const { data: profilo } = await sedeA.supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", sedeA.utenteId)
      .single();
    expect(profilo?.tenant_id).toBe(sedeA.id);
  });
});
