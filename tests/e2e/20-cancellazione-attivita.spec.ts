import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { creaAppuntamentoConfermato } from "./helpers/appuntamento-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { rendiAdminPiattaforma } from "./helpers/membri-di-prova";
import { creaClientAdminTest } from "./helpers/supabase-admin";
import { prossimoGiornoAperto } from "./helpers/date";

/**
 * Scenario 20 (Fase 5, migrazione 0029): la cancellazione di un'attività dal
 * pannello admin.
 *
 * È l'operazione più distruttiva dell'intero prodotto -- cancella i dati di
 * un salone E quelli dei suoi clienti finali, disdice l'abbonamento Stripe ed
 * elimina account -- ed è irreversibile. Esiste perché serve per legge
 * (diritto alla cancellazione, fine del contratto), ma proprio per questo è
 * l'ultima cosa che può restare non verificata: un bug qui non dà un errore,
 * dà dati cancellati che non tornano, oppure dati che credevi cancellati e
 * invece ci sono ancora.
 *
 * Due cose vengono verificate con la stessa attenzione: che cancelli DAVVERO
 * tutto, e che NON cancelli quando non deve.
 */
test.describe("Scenario 20 -- cancellazione di un'attività", () => {
  let vittima: TenantDiProva | null = null;
  let amministratore: TenantDiProva | null = null;

  test.afterEach(async () => {
    await vittima?.pulisci();
    vittima = null;
    await amministratore?.pulisci();
    amministratore = null;
  });

  test("cancella l'attività, i dati dei suoi clienti e l'account rimasto senza nulla", async ({ page }) => {
    const giorno = prossimoGiornoAperto();
    vittima = await creaTenantDiProva({
      nome: "Salone E2E Da Cancellare",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Operatrice", servizi: [0] }],
    });
    await creaAppuntamentoConfermato(vittima, {
      giornoYMD: giorno.ymd,
      oraHHMM: "10:00",
      clienteNome: "Cliente Da Cancellare",
      clienteTelefono: "3331112223",
    });

    amministratore = await creaTenantDiProva({ nome: "Salone E2E Admin20", piano: "free" });
    await rendiAdminPiattaforma(amministratore.utenteId);

    const idVittima = vittima.id;
    const idUtenteVittima = vittima.utenteId;

    await accediComeTitolare(page, amministratore.email, amministratore.password);
    await page.goto("/admin");

    const rigaVittima = page.locator("li", { hasText: "Salone E2E Da Cancellare" });
    await expect(rigaVittima).toBeVisible({ timeout: 15_000 });
    await rigaVittima.getByRole("button", { name: "Cancella attività" }).click();

    // Il riepilogo deve dire la verità PRIMA della conferma: è l'unica cosa
    // che sta fra una cancellazione voluta e una fatta al buio.
    await expect(rigaVittima.getByText("Stai per cancellare definitivamente")).toBeVisible({
      timeout: 15_000,
    });
    await expect(rigaVittima.getByText(/1 clienti finali/)).toBeVisible();
    await expect(rigaVittima.getByText(/1 appuntamenti/)).toBeVisible();

    const conferma = rigaVittima.locator('input[type="text"]').last();
    const bottone = rigaVittima.getByRole("button", { name: "Cancella per sempre" });

    // --- il nome sbagliato non cancella niente ---
    await conferma.fill("Salone E2E Da Cancellar");
    await expect(bottone, "con il nome incompleto il pulsante resta disattivato").toBeDisabled();

    // --- il nome esatto cancella ---
    await conferma.fill("Salone E2E Da Cancellare");
    await expect(bottone).toBeEnabled();
    await bottone.click();

    const admin = creaClientAdminTest();

    await expect
      .poll(
        async () => {
          const { count } = await admin
            .from("tenants")
            .select("id", { count: "exact", head: true })
            .eq("id", idVittima);
          return count ?? 0;
        },
        { timeout: 20_000, message: "la riga tenants deve sparire" }
      )
      .toBe(0);

    // I dati dei clienti finali spariscono con lei: è il punto per cui questa
    // funzione esiste, non un effetto collaterale gradito.
    for (const tabella of ["clienti", "appuntamenti", "operatori", "servizi", "orari_apertura"]) {
      const { count } = await admin
        .from(tabella)
        .select("tenant_id", { count: "exact", head: true })
        .eq("tenant_id", idVittima);
      expect(count ?? 0, `${tabella}: nessuna riga deve sopravvivere al tenant`).toBe(0);
    }

    // Il titolare non faceva parte di nient'altro: il suo account va via.
    const { data: profiloVittima } = await admin
      .from("profiles")
      .select("id")
      .eq("id", idUtenteVittima)
      .maybeSingle();
    expect(profiloVittima, "l'account rimasto senza nessuna attività va cancellato").toBeNull();

    // Il registro deve sopravvivere a ciò che documenta -- è il motivo per
    // cui `interventi_admin` non ha una foreign key verso `tenants`.
    const { data: intervento } = await admin
      .from("interventi_admin")
      .select("azione, tenant_nome, dettaglio")
      .eq("tenant_id", idVittima)
      .eq("azione", "cancellazione_attivita")
      .maybeSingle();
    expect(intervento?.tenant_nome).toBe("Salone E2E Da Cancellare");

    vittima = null; // già cancellata: `pulisci()` non ha più niente da fare
  });

  test("chi non è admin di piattaforma non trova nemmeno la pagina", async ({ page }) => {
    // 404 e non "non autorizzato", di proposito: a un titolare qualsiasi non
    // serve sapere che esiste un pannello di amministrazione, e un 404 non
    // conferma l'URL a chi lo sta cercando.
    amministratore = await creaTenantDiProva({ nome: "Salone E2E NonAdmin", piano: "growth" });

    await accediComeTitolare(page, amministratore.email, amministratore.password);
    const risposta = await page.goto("/admin");

    expect(risposta?.status(), "/admin deve rispondere 404 a un titolare normale").toBe(404);
    await expect(page.getByText("Piattaforma")).toHaveCount(0);
  });
});
