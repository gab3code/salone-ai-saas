import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { rendiAdminPiattaforma } from "./helpers/membri-di-prova";
import { creaClientAdminTest } from "./helpers/supabase-admin";

/**
 * Scenario 21 (Fase 5, migrazione 0029): sospensione e riattivazione.
 *
 * La sospensione ha una forma precisa e sbagliarla in entrambe le direzioni
 * fa danno: se blocca troppo poco, un salone sospeso continua a prendere
 * prenotazioni e la leva non esiste; se blocca troppo, il titolare non entra
 * più in dashboard e non può onorare gli appuntamenti già presi -- cioè si
 * puniscono i suoi clienti invece di lui.
 *
 * Il canale verificato qui è l'assistente AI, che è quello che si dimentica:
 * il form pubblico è ovvio, ma l'AI prenota davvero e su un'attività sospesa
 * resterebbe l'unica porta ancora aperta. È anche l'unico bloccato che si
 * può verificare con una richiesta secca, senza attraversare tutto il flusso
 * di prenotazione a schermo.
 */
test.describe("Scenario 21 -- sospensione e riattivazione", () => {
  let salone: TenantDiProva | null = null;
  let amministratore: TenantDiProva | null = null;

  test.afterEach(async () => {
    await salone?.pulisci();
    salone = null;
    await amministratore?.pulisci();
    amministratore = null;
  });

  test("sospesa non accetta più prenotazioni, ma il titolare entra ancora in dashboard", async ({
    page,
    baseURL,
  }) => {
    salone = await creaTenantDiProva({
      nome: "Salone E2E Da Sospendere",
      piano: "growth",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Operatrice", servizi: [0] }],
    });
    amministratore = await creaTenantDiProva({ nome: "Salone E2E Admin21", piano: "free" });
    await rendiAdminPiattaforma(amministratore.utenteId);

    const slug = salone.slug;
    const admin = creaClientAdminTest();

    // --- sospensione dal pannello ---
    await accediComeTitolare(page, amministratore.email, amministratore.password);
    await page.goto("/admin");

    const riga = page.locator("li", { hasText: "Salone E2E Da Sospendere" });
    await expect(riga).toBeVisible({ timeout: 15_000 });
    await riga.getByRole("button", { name: "Sospendi" }).click();

    // Il motivo è obbligatorio: senza, fra sei mesi nessuno saprebbe perché.
    await riga.getByRole("button", { name: "Sospendi" }).last().click();
    await expect(riga.getByText("Scrivi il motivo della sospensione.")).toBeVisible({ timeout: 10_000 });

    await riga.locator('input[type="text"]').last().fill("Abbonamento non pagato da 3 mesi");
    await riga.getByRole("button", { name: "Sospendi" }).last().click();

    await expect
      .poll(
        async () => {
          const { data } = await admin.from("tenants").select("sospesa").eq("id", salone!.id).single();
          return data?.sospesa;
        },
        { timeout: 15_000 }
      )
      .toBe(true);

    // --- il canale AI ora è chiuso ---
    const durante = await page.request.post(`${baseURL}/api/chat/${slug}`, {
      data: { messaggio: "Vorrei prenotare", identificatoreSessione: "e2e-sospensione-due" },
    });
    expect(durante.status(), "su un'attività sospesa l'assistente deve rifiutare").toBe(403);

    // --- ma il titolare entra ancora e vede la sua agenda ---
    await accediComeTitolare(page, salone.email, salone.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/dashboard/calendario");
    await expect(
      page,
      "un titolare sospeso deve poter onorare gli appuntamenti che ha già preso"
    ).toHaveURL(/\/dashboard\/calendario/);

    // --- riattivazione: tutto torna come prima ---
    await accediComeTitolare(page, amministratore.email, amministratore.password);
    await page.goto("/admin");
    const rigaRiattiva = page.locator("li", { hasText: "Salone E2E Da Sospendere" });
    await rigaRiattiva.getByRole("button", { name: "Riattiva" }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("tenants")
            .select("sospesa, sospesa_motivo")
            .eq("id", salone!.id)
            .single();
          return { sospesa: data?.sospesa, motivo: data?.sospesa_motivo };
        },
        { timeout: 15_000, message: "la riattivazione deve anche ripulire il motivo" }
      )
      .toEqual({ sospesa: false, motivo: null });

    const dopo = await page.request.post(`${baseURL}/api/chat/${slug}`, {
      data: { messaggio: "Ciao", identificatoreSessione: "e2e-sospensione-tre" },
    });
    expect(dopo.status(), "riattivata, l'assistente deve tornare a rispondere").not.toBe(403);

    // Entrambi gli interventi devono essere finiti nel registro.
    const { data: interventi } = await admin
      .from("interventi_admin")
      .select("azione")
      .eq("tenant_id", salone.id)
      .order("created_at", { ascending: true });
    expect((interventi ?? []).map((i) => i.azione)).toEqual(["sospensione", "riattivazione"]);
  });
});
