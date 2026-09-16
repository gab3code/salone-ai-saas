import { test, expect } from "@playwright/test";
import { creaTenantDiProva, type TenantDiProva } from "./helpers/tenant-di-prova";
import { accediComeTitolare } from "./helpers/login";
import { creaClientStripeTest, firmaEventoStripeDiProva } from "./helpers/stripe-webhook";

/**
 * Scenario 15 (punto 27 di CLAUDE.md): il cliente cancella l'abbonamento.
 * Stessa disciplina dello Scenario 14 (decisione con Gabriel 16/09/2026,
 * vedi DECISIONS.md): SOLO il nostro codice, mai il Customer Portal
 * ospitato da Stripe -- due test indipendenti:
 *
 * 1. Che il NOSTRO endpoint `/api/stripe/portal` generi davvero un URL del
 *    Customer Portal funzionante per un tenant con un abbonamento a
 *    pagamento -- senza MAI navigare dentro quell'URL (è lì che vivrebbe
 *    il vero pulsante "Cancella abbonamento", fuori dal nostro controllo).
 * 2. Che il NOSTRO webhook riporti davvero il tenant a Free quando Stripe
 *    conferma la cancellazione -- simulato con un evento
 *    `customer.subscription.deleted` firmato di prova, stesso principio
 *    dello Scenario 14b.
 */
test.describe("Scenario 15 -- il cliente cancella l'abbonamento", () => {
  let tenant: TenantDiProva;
  let stripeCustomerIdCreato: string | null = null;

  test.afterEach(async () => {
    if (stripeCustomerIdCreato) {
      await creaClientStripeTest()
        .customers.del(stripeCustomerIdCreato)
        .catch(() => {});
      stripeCustomerIdCreato = null;
    }
    await tenant?.pulisci();
  });

  test("l'endpoint del portale genera un vero URL Stripe per un tenant con abbonamento attivo", async ({
    page,
    baseURL,
  }) => {
    tenant = await creaTenantDiProva({ nome: "Salone Test E2E Scenario15a", piano: "growth" });

    // Il portale richiede un customer Stripe reale sul tenant (altrimenti
    // il nostro endpoint rifiuta con "Nessun abbonamento a pagamento
    // attivo", vedi src/app/api/stripe/portal/route.ts) -- creato qui
    // direttamente (stessa chiamata che farebbe il nostro checkout), senza
    // passare da un vero giro di pagamento.
    const stripe = creaClientStripeTest();
    const customer = await stripe.customers.create({ name: tenant.nome, metadata: { tenant_id: tenant.id, test_e2e: "true" } });
    stripeCustomerIdCreato = customer.id;
    await tenant.supabase.from("tenants").update({ stripe_customer_id: customer.id }).eq("id", tenant.id);

    await accediComeTitolare(page, tenant.email, tenant.password);
    const risposta = await page.request.post(`${baseURL}/api/stripe/portal`);
    expect(risposta.ok(), `risposta non ok: ${await risposta.text()}`).toBe(true);
    const corpo = (await risposta.json()) as { url?: string };
    expect(corpo.url, "deve restituire un vero URL del Customer Portal, mai navigato in questo test").toMatch(
      /^https:\/\/billing\.stripe\.com\//
    );
  });

  test("il webhook riporta il tenant a Free quando Stripe conferma la cancellazione", async ({ page, baseURL }) => {
    tenant = await creaTenantDiProva({ nome: "Salone Test E2E Scenario15b", piano: "pro" });

    const idAbbonamentoFinto = `sub_e2e_${tenant.id.slice(0, 8)}`;
    await tenant.supabase
      .from("tenants")
      .update({ stripe_subscription_id: idAbbonamentoFinto, stato_abbonamento: "attivo" })
      .eq("id", tenant.id);

    const evento = {
      id: `evt_e2e_${tenant.id.slice(0, 8)}`,
      object: "event",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: idAbbonamentoFinto,
          object: "subscription",
          status: "canceled",
          items: { object: "list", data: [] },
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
    expect(tenantAggiornato?.piano, "un abbonamento cancellato deve riportare il tenant a Free, mai lasciarlo bloccato").toBe(
      "free"
    );
    expect(tenantAggiornato?.stato_abbonamento).toBe("cancellato");
  });
});
