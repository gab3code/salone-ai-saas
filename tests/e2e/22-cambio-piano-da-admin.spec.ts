import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { creaAbbonamentoDiProva, type AbbonamentoDiProva } from "./helpers/abbonamento-di-prova";
import { rendiAdminPiattaforma } from "./helpers/membri-di-prova";
import { priceIdOperatoreExtra, priceIdPerPiano } from "@/lib/stripe/piani";

/**
 * Scenario 22 (17/09/2026): il cambio piano fatto dal pannello admin, con e
 * senza toccare Stripe.
 *
 * Nasce da una richiesta precisa di Gabriel -- poter cambiare l'abbonamento
 * di un salone senza aprire Stripe e senza cancellare e rifare tutto -- e
 * tocca l'unica cosa del prodotto che è irreversibile davvero: quanto un
 * cliente si trova addebitato. Per questo le due strade vengono verificate
 * separatamente e in modo simmetrico: quella che NON deve toccare Stripe
 * viene controllata anche su Stripe (che sia rimasto identico), e quella che
 * lo tocca viene controllata anche sul database.
 */
test.describe("Scenario 22 -- cambio piano dal pannello admin", () => {
  let salone: TenantDiProva | null = null;
  let amministratore: TenantDiProva | null = null;
  let abbonamento: AbbonamentoDiProva | null = null;

  test.afterEach(async () => {
    await abbonamento?.pulisci();
    abbonamento = null;
    await salone?.pulisci();
    salone = null;
    await amministratore?.pulisci();
    amministratore = null;
  });

  async function preparaSalone(nome: string) {
    const tenant = await creaTenantDiProva({
      nome,
      piano: "starter",
      servizi: [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }],
      operatori: [{ nome: "Prima", servizi: [0] }, { nome: "Seconda", servizi: [0] }],
    });

    const sub = await creaAbbonamentoDiProva("starter", "Scenario22");
    await tenant.supabase
      .from("tenants")
      .update({ stripe_subscription_id: sub.subscriptionId, stato_abbonamento: "attivo" })
      .eq("id", tenant.id);

    return { tenant, sub };
  }

  test("aggiornando anche Stripe, l'abbonamento passa davvero al prezzo del piano nuovo", async ({
    page,
  }) => {
    const priceGrowth = priceIdPerPiano("growth");
    const priceExtraGrowth = priceIdOperatoreExtra("growth");
    expect(priceExtraGrowth, "serve STRIPE_PRICE_GROWTH_OPERATORE_EXTRA in .env.local").toBeTruthy();

    const preparato = await preparaSalone("Salone E2E Cambio Piano");
    salone = preparato.tenant;
    abbonamento = preparato.sub;

    amministratore = await creaTenantDiProva({ nome: "Salone E2E Admin22", piano: "free" });
    await rendiAdminPiattaforma(amministratore.utenteId);

    await accediComeTitolare(page, amministratore.email, amministratore.password);
    await page.goto("/admin");

    const riga = page
      .getByTestId("elenco-attivita")
      .locator("li", { hasText: "Salone E2E Cambio Piano" });
    await expect(riga).toBeVisible({ timeout: 15_000 });
    await riga.getByRole("button", { name: "Intervieni sul piano" }).click();

    await riga.getByLabel("Piano").selectOption("growth");
    await riga.getByRole("radio", { name: "Aggiorna anche Stripe" }).check();

    // L'anteprima è obbligatoria: finché non è stata letta, applicare non si
    // può. È il punto per cui questa funzione è accettabile -- nessuna cifra
    // cambia senza che qualcuno l'abbia vista prima.
    const bottoneApplica = riga.getByRole("button", { name: "Applica su Stripe" });
    await expect(bottoneApplica, "senza anteprima non si applica niente").toBeDisabled();

    await riga.getByRole("button", { name: /Vedi cosa cambia/ }).click();
    // Su Stripe questo abbonamento ha la sola riga base di Starter (19,90):
    // l'helper non gli attacca nessuna quota operatore. Il salone però ha due
    // operatori configurati, quindi su Growth pagherebbe 39,90 + 15,00 -- ed
    // è esattamente il tipo di disallineamento che questa anteprima serve a
    // far vedere PRIMA di applicare, non dopo.
    // Si punta alla riga di riepilogo e non a "19,90" ovunque: la stessa
    // cifra compare anche nell'elenco dei line item attuali, e un selettore
    // per solo testo ne pescherebbe due.
    const riepilogoPrezzo = riga.getByText(/al mese →/);
    await expect(riepilogoPrezzo).toBeVisible({ timeout: 20_000 });
    await expect(riepilogoPrezzo).toContainText("19,90");
    await expect(riepilogoPrezzo).toContainText("54,90");
    // Il salone finirebbe per pagare di più: l'avviso deve esserci.
    await expect(riga.getByText(/fa pagare di più al cliente/)).toBeVisible();

    await expect(bottoneApplica).toBeEnabled();
    await bottoneApplica.click();

    await expect
      .poll(
        async () => {
          const item = await abbonamento!.leggiItem();
          return item.map((i) => `${i.priceId} x${i.quantita}`).sort();
        },
        {
          timeout: 20_000,
          message: "su Stripe deve restare il piano Growth con la sua quota per operatore",
        }
      )
      .toEqual([`${priceGrowth} x1`, `${priceExtraGrowth} x1`].sort());

    // E il database deve seguire, senza restare "manuale": i due sistemi
    // adesso concordano, quindi i webhook devono poter tornare a lavorare.
    await expect
      .poll(
        async () => {
          const { data } = await salone!.supabase
            .from("tenants")
            .select("piano, piano_manuale")
            .eq("id", salone!.id)
            .single();
          return `${data?.piano}/${data?.piano_manuale}`;
        },
        { timeout: 15_000 }
      )
      .toBe("growth/false");
  });

  test("scegliendo 'solo qui', Stripe non viene toccato e il piano diventa manuale", async ({
    page,
  }) => {
    const preparato = await preparaSalone("Salone E2E Piano Manuale");
    salone = preparato.tenant;
    abbonamento = preparato.sub;

    const primaSuStripe = (await abbonamento.leggiItem())
      .map((i) => `${i.priceId} x${i.quantita}`)
      .sort();

    amministratore = await creaTenantDiProva({ nome: "Salone E2E Admin22b", piano: "free" });
    await rendiAdminPiattaforma(amministratore.utenteId);

    await accediComeTitolare(page, amministratore.email, amministratore.password);
    await page.goto("/admin");

    const riga = page
      .getByTestId("elenco-attivita")
      .locator("li", { hasText: "Salone E2E Piano Manuale" });
    await expect(riga).toBeVisible({ timeout: 15_000 });
    await riga.getByRole("button", { name: "Intervieni sul piano" }).click();

    await riga.getByLabel("Piano").selectOption("pro");
    await riga.getByRole("button", { name: "Applica solo qui" }).click();

    await expect
      .poll(
        async () => {
          const { data } = await salone!.supabase
            .from("tenants")
            .select("piano, piano_manuale")
            .eq("id", salone!.id)
            .single();
          return `${data?.piano}/${data?.piano_manuale}`;
        },
        { timeout: 15_000, message: "il piano deve diventare pro e restare manuale" }
      )
      .toBe("pro/true");

    // Il controllo che conta: su Stripe non si deve essere mosso niente.
    // Senza questa asserzione, un bug che aggiorna Stripe anche quando non
    // dovrebbe passerebbe inosservato -- e si scoprirebbe da una fattura.
    expect(
      (await abbonamento.leggiItem()).map((i) => `${i.priceId} x${i.quantita}`).sort(),
      "'solo qui' non deve toccare l'abbonamento su Stripe"
    ).toEqual(primaSuStripe);
  });
});
