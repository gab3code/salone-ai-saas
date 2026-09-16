import Stripe from "stripe";

/**
 * Helper Stripe per gli scenari 14/15 -- decisione presa con Gabriel il
 * 16/09/2026 (vedi DECISIONS.md): questi scenari testano SOLO il nostro
 * codice (generare un URL di checkout/portale reale, reagire bene a un
 * evento webhook), mai l'interfaccia ospitata da Stripe.
 *
 * Nessuna "server-only" qui: gira sotto il test runner di Playwright (Node
 * puro), non dentro il bundler di Next -- stesso motivo di
 * `supabase-admin.ts`, che per questo evita `src/lib/supabase/admin.ts`
 * invece di riusarlo. Stessa cosa qui con `src/lib/stripe/server.ts`
 * (marcato "server-only").
 */

export function creaClientStripeTest(): Stripe {
  const chiave = process.env.STRIPE_SECRET_KEY;
  if (!chiave) {
    throw new Error("STRIPE_SECRET_KEY mancante in .env.local -- serve per gli scenari E2E su Stripe.");
  }
  return new Stripe(chiave);
}

/**
 * Firma un corpo evento Stripe con lo stesso `STRIPE_WEBHOOK_SECRET` che il
 * nostro endpoint reale (`/api/stripe/webhook`) verifica -- usando
 * `generateTestHeaderString`, l'helper ufficiale della SDK Stripe pensato
 * apposta per firmare payload di prova nei test, senza passare da un vero
 * ciclo di checkout/abbonamento su Stripe. Ritorna il corpo grezzo (stringa,
 * MAI ri-serializzato altrove: la firma è calcolata su questi byte esatti)
 * e l'header "Stripe-Signature" pronto per la richiesta.
 */
export function firmaEventoStripeDiProva(corpo: unknown): { corpoGrezzo: string; firma: string } {
  const segreto = process.env.STRIPE_WEBHOOK_SECRET;
  if (!segreto) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET mancante in .env.local -- serve per firmare gli eventi Stripe di prova negli scenari 14/15."
    );
  }
  const corpoGrezzo = JSON.stringify(corpo);
  const firma = creaClientStripeTest().webhooks.generateTestHeaderString({ payload: corpoGrezzo, secret: segreto });
  return { corpoGrezzo, firma };
}
