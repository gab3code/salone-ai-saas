import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { prossimoGiornoAperto } from "./helpers/date";
import { formattaGiornoEsteso } from "@/lib/data-italiana";

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

  /**
   * 18/09/2026. Gabriel non riusciva a inserire un appuntamento e il pannello
   * rispondeva "nessuno slot libero per questa combinazione: prova un'altra
   * data, un altro operatore o meno servizi insieme". Il motivo vero era che
   * il servizio scelto non aveva nessun operatore assegnato -- quindi tutti e
   * tre i consigli mandavano a cercare dalla parte sbagliata, e ci sono voluti
   * venti minuti per capirlo con il database in mano.
   *
   * Un messaggio che non dice la causa non e' un dettaglio di stile: e' la
   * differenza fra un salone che sistema la configurazione in un minuto e uno
   * che chiude la scheda convinto che il prodotto sia rotto.
   */
  test("quando non ci sono orari, il pannello dice il motivo vero", async ({ page }) => {
    tenant = await creaTenantDiProva({
      nome: "Salone Test E2E S12 motivi",
      piano: "starter",
      servizi: [
        { nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2000 },
        { nome: "Massaggio", durataMinuti: 50, prezzoCentesimi: 5000 },
      ],
      // Rita fa solo il primo: il secondo resta senza nessuno, come il
      // "Massaggi rilassanti" del salone di prova vero.
      operatori: [{ nome: "Rita", servizi: [0] }],
    });
    const giorno = prossimoGiornoAperto();

    await accediComeTitolare(page, tenant.email, tenant.password);

    // 1. Servizio senza operatore: il messaggio deve nominare il servizio.
    await page.goto(`/dashboard/calendario?data=${giorno.ymd}&servizio_id=${tenant.servizi[1].id}`);
    await expect(page.getByText(/Nessun operatore può fare: Massaggio/)).toBeVisible({ timeout: 10_000 });

    // 2. Giorno di chiusura (domenica, chiusa negli orari di default): il
    //    servizio qui va bene, quindi se comparisse il messaggio sugli
    //    operatori vorrebbe dire che l'ordine delle cause e' sbagliato.
    const domenica = prossimoGiornoAperto([1, 2, 3, 4, 5, 6]);
    await page.goto(`/dashboard/calendario?data=${domenica.ymd}&servizio_id=${tenant.servizi[0].id}`);
    // Due messaggi distinti, uno per posto: la lista degli appuntamenti e il
    // pannello. Asserirli separatamente invece di prendere il primo che
    // capita -- se uno dei due tornasse generico, il test deve accorgersene.
    await expect(page.getByText(/Il salone è chiuso in questo giorno\. Cambia gli orari/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText(/Il salone è chiuso in questo giorno: scegli un altro giorno/)
    ).toBeVisible();

    // 3. La data si legge in italiano, non come "2026-09-21".
    await expect(page.getByText(formattaGiornoEsteso(domenica.ymd)).first()).toBeVisible();
  });
});
