import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaClientAdminTest } from "./helpers/supabase-admin";
import { accediComeTitolare } from "./helpers/login";

/**
 * Scenario 13 (punto 27 di CLAUDE.md): una nuova attività si registra e
 * completa l'onboarding. Diviso in due test indipendenti per un motivo
 * preciso trovato leggendo il codice (16/09/2026): `/registrati` chiama
 * `supabase.auth.signUp` e il comportamento successivo dipende da
 * un'impostazione del progetto Supabase ospitato NON visibile da questo
 * repo (conferma email attiva/disattivata) -- se attiva (default Supabase),
 * non arriva mai una sessione e non si può proseguire oltre nel browser
 * senza cliccare un link vero ricevuto via email.
 *
 * - Il primo test verifica la registrazione VERA (form reale, non
 *   `auth.admin.createUser`): che il trigger `al_nuovo_utente` scatti
 *   comunque (lui scatta sull'insert in `auth.users`, PRIMA e
 *   indipendentemente dalla conferma email) e che la UI arrivi a uno dei
 *   due esiti attesi, qualunque sia -- senza assumere quale.
 * - Il secondo verifica il "completa onboarding" vero e proprio (le sezioni
 *   manuali di `/dashboard/configura`: orari, operatori, servizi) su un
 *   tenant "vuoto" creato con l'helper esistente (stesso trigger, stesso
 *   provisioning, ma deterministico) -- evitando così di far dipendere
 *   anche questa parte dall'impostazione email del progetto.
 */
test.describe("Scenario 13 -- nuova attività si registra e completa l'onboarding", () => {
  test("la registrazione reale da /registrati fa scattare il provisioning automatico", async ({ page }) => {
    const admin = creaClientAdminTest();
    const suffisso = Math.random().toString(36).slice(2, 8);
    const nomeSalone = `Salone Registrazione E2E ${suffisso}`;
    const email = `e2e-registrazione-${suffisso}@example.com`;
    const password = `TestE2E-${suffisso}!`;

    try {
      await page.goto("/registrati");
      await page.locator("#nomeSalone").fill(nomeSalone);
      await page.locator("#nomePersona").fill("Titolare Di Prova");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Crea account" }).click();

      // Due esiti possibili a seconda della conferma email del progetto
      // Supabase collegato -- entrambi validi, non si assume quale.
      await Promise.race([
        page.waitForURL(/\/dashboard/, { timeout: 15_000 }),
        page.getByText("Controlla la tua email").waitFor({ timeout: 15_000 }),
      ]);

      // Il trigger scatta sull'insert in auth.users, PRIMA di qualunque
      // conferma -- deve aver già creato tenant/profilo/orari a prescindere
      // da quale dei due rami sopra si sia verificato. Piccolo retry: la
      // insert e la query qui sono due round-trip separati verso lo stesso
      // database, non serve altro.
      let tenantRiga: { id: string } | null = null;
      for (let i = 0; i < 10 && !tenantRiga; i++) {
        const { data } = await admin.from("tenants").select("id").eq("nome", nomeSalone).maybeSingle();
        tenantRiga = data;
        if (!tenantRiga) await new Promise((r) => setTimeout(r, 500));
      }
      expect(tenantRiga, "il trigger al_nuovo_utente non ha creato il tenant atteso dopo la registrazione reale").toBeTruthy();

      const { data: orari } = await admin.from("orari_apertura").select("id").eq("tenant_id", tenantRiga!.id);
      expect(orari?.length, "il trigger deve creare le 7 righe orari_apertura (una per giorno)").toBe(7);

      const { data: profilo } = await admin
        .from("profiles")
        .select("ruolo")
        .eq("tenant_id", tenantRiga!.id)
        .maybeSingle();
      expect(profilo?.ruolo).toBe("owner");

      // Pulizia: stesso ordine di tenant-di-prova.ts (figli prima dei genitori).
      await admin.from("orari_apertura").delete().eq("tenant_id", tenantRiga!.id);
      await admin.from("profiles").delete().eq("tenant_id", tenantRiga!.id);
      await admin.from("tenants").delete().eq("id", tenantRiga!.id);
    } finally {
      const { data: elenco } = await admin.auth.admin.listUsers();
      const utente = elenco?.users.find((u) => u.email === email);
      if (utente) await admin.auth.admin.deleteUser(utente.id);
    }
  });

  test.describe("completamento onboarding (sezioni manuali di /dashboard/configura)", () => {
    let tenant: TenantDiProva;

    test.afterEach(async () => {
      await tenant?.pulisci();
    });

    test("orari, primo operatore e primo servizio configurati a mano diventano visibili sulla pagina pubblica", async ({
      page,
    }) => {
      // Tenant "vuoto" come subito dopo una registrazione vera: zero
      // operatori, zero servizi, tutti i giorni chiusi (il trigger reale
      // parte così -- creaTenantDiProva normalmente apre già una settimana
      // tipo per gli altri scenari, qui va sovrascritto apposta).
      tenant = await creaTenantDiProva({
        nome: "Salone Test E2E Scenario13",
        piano: "starter",
        servizi: [],
        operatori: [],
        orari: [0, 1, 2, 3, 4, 5, 6].map((g) => ({ giornoSettimana: g, chiuso: true })),
      });

      await accediComeTitolare(page, tenant.email, tenant.password);
      await page.goto("/dashboard/configura");

      // Attività vuota -> le sezioni manuali sono chiuse dentro un
      // <details> sotto il wizard AI (vedi page.tsx, "Preferisci configurare
      // tutto a mano?") -- vanno espanse prima di poterci interagire.
      await page.getByText("Preferisci configurare tutto a mano?").click();

      // Apre il Lunedì (giorno_settimana 1), lasciando tutto il resto come
      // arriva dal trigger (chiuso).
      await page.locator('input[name="chiuso_1"]').uncheck();
      await page.getByRole("button", { name: "Salva orari" }).click();
      await expect(page.locator('input[name="chiuso_1"]')).not.toBeChecked();

      const formOperatore = page.locator("form", { has: page.locator("#nome_operatore") });
      await formOperatore.locator("#nome_operatore").fill("Marta Rossi");
      await formOperatore.getByRole("button", { name: "Aggiungi" }).click();
      await expect(page.getByText("Marta Rossi")).toBeVisible();

      const formServizio = page.locator("form", { has: page.locator("#nome_servizio") });
      await formServizio.locator("#nome_servizio").fill("Manicure");
      await formServizio.locator("#durata").fill("45");
      await formServizio.locator("#prezzo").fill("25");
      await formServizio.getByRole("button", { name: "Aggiungi" }).click();
      await expect(page.getByText("Manicure", { exact: false })).toBeVisible();

      // Un solo operatore e un solo servizio -> una sola cella nella
      // tabella "Chi eroga quale servizio", nessuna ambiguità.
      await page.getByRole("button", { name: "+ associa" }).click();
      await expect(page.getByRole("button", { name: "✓ associato" })).toBeVisible();

      const { data: orariRiga } = await tenant.supabase
        .from("orari_apertura")
        .select("chiuso, apertura, chiusura")
        .eq("tenant_id", tenant.id)
        .eq("giorno_settimana", 1)
        .single();
      expect(orariRiga?.chiuso).toBe(false);
      expect(orariRiga?.apertura?.slice(0, 5)).toBe("09:00");
      expect(orariRiga?.chiusura?.slice(0, 5)).toBe("19:00");

      const { data: operatore } = await tenant.supabase
        .from("operatori")
        .select("id, nome")
        .eq("tenant_id", tenant.id)
        .single();
      expect(operatore?.nome).toBe("Marta Rossi");

      const { data: servizio } = await tenant.supabase
        .from("servizi")
        .select("id, nome, durata_minuti, prezzo_centesimi")
        .eq("tenant_id", tenant.id)
        .single();
      expect(servizio?.nome).toBe("Manicure");
      expect(servizio?.durata_minuti).toBe(45);
      expect(servizio?.prezzo_centesimi).toBe(2500);

      const { data: associazione } = await tenant.supabase
        .from("operatori_servizi")
        .select("operatore_id, servizio_id")
        .eq("operatore_id", operatore!.id)
        .eq("servizio_id", servizio!.id)
        .maybeSingle();
      expect(associazione, "l'associazione operatore/servizio deve essere salvata").toBeTruthy();

      // Prova finale, end-to-end: il servizio appena configurato a mano è
      // davvero visibile sulla pagina pubblica del salone.
      await page.goto(`/s/${tenant.slug}`);
      await expect(page.getByText("Manicure", { exact: false })).toBeVisible();
    });
  });
});
