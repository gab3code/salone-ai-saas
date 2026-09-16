import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { creaSupabaseFinto } from "@/test/supabase-finto";
import { statoAbbonamentoDaStripe, sincronizzaAbbonamento } from "./abbonamento.server";

describe("statoAbbonamentoDaStripe", () => {
  it("mappa gli stati Stripe più comuni sul vocabolario già in tenants.stato_abbonamento", () => {
    expect(statoAbbonamentoDaStripe("trialing")).toBe("trialing");
    expect(statoAbbonamentoDaStripe("active")).toBe("attivo");
    expect(statoAbbonamentoDaStripe("canceled")).toBe("cancellato");
  });

  it("gli stati di pagamento in difficoltà diventano 'scaduto', non 'cancellato' (l'accesso non è ancora perso)", () => {
    expect(statoAbbonamentoDaStripe("past_due")).toBe("scaduto");
    expect(statoAbbonamentoDaStripe("unpaid")).toBe("scaduto");
    expect(statoAbbonamentoDaStripe("incomplete")).toBe("scaduto");
  });

  it("uno stato Stripe non previsto non fa esplodere il webhook -- fail-safe verso 'scaduto', mai verso 'attivo'", () => {
    expect(statoAbbonamentoDaStripe("qualcosa_di_nuovo_di_stripe" as Stripe.Subscription.Status)).toBe("scaduto");
  });
});

describe("sincronizzaAbbonamento", () => {
  const ENV_ORIGINALE = { ...process.env };

  beforeEach(() => {
    process.env.STRIPE_PRICE_GROWTH = "price_growth_test";
    process.env.STRIPE_PRICE_PRO = "price_pro_test";
  });

  afterEach(() => {
    process.env = { ...ENV_ORIGINALE };
  });

  function subscriptionFinta(overrides: Partial<Stripe.Subscription>): Stripe.Subscription {
    return {
      id: "sub_123",
      status: "active",
      items: { data: [{ price: { id: "price_growth_test" } }] },
      ...overrides,
    } as unknown as Stripe.Subscription;
  }

  it("un abbonamento attivo aggiorna piano e stato in base al Price ID reale", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        // Lettura di `piano_manuale` (migrazione 0028): false = il tenant è
        // gestito da Stripe come sempre.
        select: [{ data: { piano_manuale: false }, error: null }],
        update: [{ data: null, error: null }],
      },
    });

    await sincronizzaAbbonamento(supabase, subscriptionFinta({ status: "active" }));

    expect(supabase.registro.update).toEqual([
      { tabella: "tenants", payload: { stato_abbonamento: "attivo", piano: "growth" } },
    ]);
  });

  it("un abbonamento cancellato riporta SEMPRE il tenant a Free, anche se il Price ID è ancora quello di Pro", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        // Lettura di `piano_manuale` (migrazione 0028): false = il tenant è
        // gestito da Stripe come sempre.
        select: [{ data: { piano_manuale: false }, error: null }],
        update: [{ data: null, error: null }],
      },
    });

    await sincronizzaAbbonamento(
      supabase,
      subscriptionFinta({ status: "canceled", items: { data: [{ price: { id: "price_pro_test" } }] } as never })
    );

    expect(supabase.registro.update).toEqual([
      { tabella: "tenants", payload: { stato_abbonamento: "cancellato", piano: "free" } },
    ]);
  });

  it("un Price ID non riconosciuto (non ancora mappato in env) aggiorna lo stato ma NON tocca il piano esistente", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        // Lettura di `piano_manuale` (migrazione 0028): false = il tenant è
        // gestito da Stripe come sempre.
        select: [{ data: { piano_manuale: false }, error: null }],
        update: [{ data: null, error: null }],
      },
    });

    await sincronizzaAbbonamento(
      supabase,
      subscriptionFinta({ status: "past_due", items: { data: [{ price: { id: "price_sconosciuto" } }] } as never })
    );

    expect(supabase.registro.update).toEqual([{ tabella: "tenants", payload: { stato_abbonamento: "scaduto" } }]);
  });

  it("un abbonamento Pro con 2 line item (base + operatore extra) riconosce il piano anche se il Price base NON è il primo dell'array", async () => {
    const supabase = creaSupabaseFinto({
      tenants: {
        // Lettura di `piano_manuale` (migrazione 0028): false = il tenant è
        // gestito da Stripe come sempre.
        select: [{ data: { piano_manuale: false }, error: null }],
        update: [{ data: null, error: null }],
      },
    });

    await sincronizzaAbbonamento(
      supabase,
      subscriptionFinta({
        status: "active",
        items: {
          data: [
            // Il primo item è l'add-on "operatore extra" -- Stripe non
            // garantisce un ordine, e price_operatore_extra_test non è
            // mappato in pianoPerPriceId apposta.
            { price: { id: "price_operatore_extra_test" }, quantity: 2 },
            { price: { id: "price_pro_test" }, quantity: 1 },
          ],
        } as never,
      })
    );

    expect(supabase.registro.update).toEqual([
      { tabella: "tenants", payload: { stato_abbonamento: "attivo", piano: "pro" } },
    ]);
  });
  it("un tenant con piano gestito a mano NON viene toccato da Stripe (migrazione 0028)", async () => {
    // Il caso per cui esiste `piano_manuale`: Enterprise è a preventivo e gli
    // account omaggio non hanno un abbonamento Stripe che dica la verità sul
    // loro piano. Senza questa guardia, il primo evento della loro vecchia
    // subscription li riporterebbe a free da solo.
    const supabase = creaSupabaseFinto({
      tenants: { select: [{ data: { piano_manuale: true }, error: null }] },
    });

    await sincronizzaAbbonamento(supabase, subscriptionFinta({ status: "canceled" }));

    expect(supabase.registro.update).toEqual([]);
  });
});
