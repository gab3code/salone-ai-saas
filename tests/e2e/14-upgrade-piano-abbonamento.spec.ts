import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { impostaDatiFatturazione } from "./helpers/dati-fatturazione";
import { creaClientStripeTest, firmaEventoStripeDiProva } from "./helpers/stripe-webhook";
import { priceIdPerPiano } from "@/lib/stripe/piani";

/**
 * Scenario 14 (punto 27 di CLAUDE.md): il cliente effettua l'upgrade del
 * piano. Decisione presa con Gabriel il 16/09/2026 (vedi DECISIONS.md):
 * testare SOLO il nostro codice, mai l'interfaccia di Checkout ospitata da
 * Stripe -- due test indipendenti, non uno scenario UI unico:
 *
 * 1. Che il NOSTRO endpoint `/api/stripe/checkout` generi davvero un URL di
 *    Checkout Stripe funzionante (chiamata reale, test-mode, a Stripe: crea
 *    solo una Sessione, mai un pagamento) e salvi il customer Stripe sul
 *    tenant -- senza MAI navigare dentro quell'URL.
 * 2. Che il NOSTRO webhook porti davvero il tenant sul piano giusto quando
 *    Stripe conferma un abbonamento attivo -- simulato con un evento
 *    `customer.subscription.updated` firmato di prova (stessa tecnica degli
 *    unit test esistenti su `stripe/webhook`, ma qui contro il server reale
 *    in esecuzione via HTTP, non la funzione chiamata direttamente), senza
 *    dover far esistere un vero abbonamento su Stripe per questo.
 */
test.describe("Scenario 14 -- upgrade del piano", () => {
  let tenant: TenantDiProva;
  let stripeCustomerIdCreato: string | null = null;

  test.afterEach(async () => {
    if (stripeCustomerIdCreato) {
      await creaClientStripeTest()
        .customers.del(stripeCustomerIdCreato)
        .catch(() => {}); // pulizia best-effort: un customer di test rimasto non blocca nulla
      stripeCustomerIdCreato = null;
    }
    await tenant?.pulisci();
  });

  test("l'endpoint di checkout genera un vero URL Stripe e salva il customer sul tenant", async ({ page, baseURL }) => {
    tenant = await creaTenantDiProva({ nome: "Salone Test E2E Scenario14a", piano: "free" });
    await impostaDatiFatturazione(tenant.id);
    await accediComeTitolare(page, tenant.email, tenant.password);

    const risposta = await page.request.post(`${baseURL}/api/stripe/checkout`, { data: { piano: "growth" } });
    expect(risposta.ok(), `risposta non ok: ${await risposta.text()}`).toBe(true);
    const corpo = (await risposta.json()) as { url?: string };
    expect(corpo.url, "deve restituire un vero URL di Checkout Stripe, mai navigato in questo test").toMatch(
      /^https:\/\/checkout\.stripe\.com\//
    );

    const { data: tenantAggiornato } = await tenant.supabase
      .from("tenants")
      .select("stripe_customer_id")
      .eq("id", tenant.id)
      .single();
    expect(tenantAggiornato?.stripe_customer_id, "il customer Stripe appena creato va salvato sul tenant").toBeTruthy();
    stripeCustomerIdCreato = tenantAggiornato!.stripe_customer_id;
  });

  test("il webhook porta il tenant sul piano corretto quando Stripe conferma l'abbonamento attivo", async ({
    page,
    baseURL,
  }) => {
    tenant = await creaTenantDiProva({ nome: "Salone Test E2E Scenario14b", piano: "starter" });

    // Il webhook (sincronizzaAbbonamento) trova il tenant cercandolo per
    // stripe_subscription_id: basta che il tenant lo abbia già per testare
    // SOLO la reazione del nostro codice, senza un vero abbonamento Stripe.
    const idAbbonamentoFinto = `sub_e2e_${tenant.id.slice(0, 8)}`;
    await tenant.supabase.from("tenants").update({ stripe_subscription_id: idAbbonamentoFinto }).eq("id", tenant.id);

    const evento = {
      id: `evt_e2e_${tenant.id.slice(0, 8)}`,
      object: "event",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: idAbbonamentoFinto,
          object: "subscription",
          status: "active",
          items: { object: "list", data: [{ price: { id: priceIdPerPiano("pro") } }] },
        },
      },
    };
    const { corpoGrezzo, firma } = firmaEventoStripeDiProva(evento);

    const risposta = await page.request.post(`${baseURL}/api/stripe/webhook`, {
      data: corpoGrezzo,
      headers: { "content-type": "application/json", "stripe-signature": firma },
    });
    expect(risposta.ok(), `webhook non ok: ${await risposta.text()}`).toBe(true);

    const { data: tenantAggiornato } = await tenant.supabase
      .from("tenants")
      .select("piano, stato_abbonamento")
      .eq("id", tenant.id)
      .single();
    expect(tenantAggiornato?.piano).toBe("pro");
    expect(tenantAggiornato?.stato_abbonamento).toBe("attivo");
  });

  /**
   * Il gate aggiunto il 17/09/2026. Non è una preferenza: per un servizio
   * digitale venduto a un cliente italiano la fattura è sempre obbligatoria,
   * e senza partita IVA, indirizzo e recapito SdI non si può comporre.
   * Fermarsi qui costa trenta secondi al cliente; incassare e poi rincorrere
   * i dati costa una nota di variazione.
   */
  test("senza i dati per la fattura il checkout non parte, e indica dove metterli", async ({
    page,
    baseURL,
  }) => {
    tenant = await creaTenantDiProva({ nome: "Salone Test E2E Scenario14c", piano: "free" });
    await accediComeTitolare(page, tenant.email, tenant.password);

    const risposta = await page.request.post(`${baseURL}/api/stripe/checkout`, {
      data: { piano: "growth" },
    });
    expect(risposta.status(), "senza dati di fatturazione il checkout deve rifiutare").toBe(409);

    const corpo = (await risposta.json()) as { errore?: string; vaiA?: string };
    expect(corpo.vaiA, "deve dire DOVE andare, non solo che manca qualcosa").toContain(
      "/dashboard/fatturazione"
    );
    expect(corpo.vaiA, "e deve portarsi dietro il piano, così il pagamento riparte da solo").toContain(
      "piano=growth"
    );

    // Nessun customer creato su Stripe: ci si ferma PRIMA di toccare
    // qualunque cosa, altrimenti resterebbero customer orfani per ogni
    // tentativo andato a vuoto.
    const { data: dopo } = await tenant.supabase
      .from("tenants")
      .select("stripe_customer_id")
      .eq("id", tenant.id)
      .single();
    expect(dopo?.stripe_customer_id).toBeNull();
  });

  /**
   * Il giro di attivazione, rifatto il 17/09/2026 perché quello vecchio
   * passava da quattro schermate e faceva lampeggiare la dashboard prima del
   * pagamento. Il lampo non era estetica: la decisione di andare a pagare la
   * prendeva un componente client, cioè il browser, a pagina già disegnata.
   * Adesso il rimbalzo avviene sul server, prima che venga disegnato
   * qualsiasi cosa -- e questo test è quello che se ne accorgerebbe se
   * qualcuno rimettesse la logica lato client.
   */
  test("chi arriva con un piano scelto finisce sulla pagina di attivazione, non sulla dashboard", async ({
    page,
  }) => {
    tenant = await creaTenantDiProva({ nome: "Salone Test E2E Scenario14d", piano: "free" });
    await accediComeTitolare(page, tenant.email, tenant.password);

    await page.goto("/dashboard?piano=growth");
    await expect(page, "il redirect deve avvenire sul server").toHaveURL(
      /\/dashboard\/abbonamento\?piano=growth/
    );
    await expect(page.getByText("Stai attivando")).toBeVisible({ timeout: 15_000 });
    // I dati della fattura si chiedono qui, sulla stessa schermata: non c'è
    // nessun altro passaggio fra la scelta del piano e il pagamento.
    await expect(page.getByLabel("Partita IVA")).toBeVisible();
  });

  test("dalle impostazioni non si finisce più sulla landing", async ({ page }) => {
    // Era un ripiego di quando dentro l'app non esisteva un posto dove
    // scegliere un piano: chi era già dentro e già riconosciuto veniva
    // spedito sul sito vetrina.
    tenant = await creaTenantDiProva({ nome: "Salone Test E2E Scenario14e", piano: "free" });
    await accediComeTitolare(page, tenant.email, tenant.password);

    await page.goto("/dashboard/impostazioni");
    await page.getByRole("link", { name: "Passa a un piano a pagamento" }).click();
    await expect(page).toHaveURL(/\/dashboard\/abbonamento/);
    await expect(page.getByRole("heading", { name: "Abbonamento" })).toBeVisible();
  });
});
