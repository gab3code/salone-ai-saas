import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { creaClientServer } from "@/lib/supabase/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientStripe } from "@/lib/stripe/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoGestireFatturazione, ERRORE_PERMESSO_NEGATO } from "@/lib/ruoli";
import { pianoEPagante, priceIdPerPiano, priceIdOperatoreExtra, giorniDiProva } from "@/lib/stripe/piani";

/**
 * Crea una Checkout Session Stripe per il tenant dell'utente loggato
 * (chiamata da Prezzi.tsx via /registrati?piano=... o dalla dashboard dopo
 * conferma email, vedi AvviaCheckoutSeNecessario).
 *
 * Il tenant_id si legge SEMPRE dal profilo dell'utente autenticato via
 * cookie di sessione (creaClientServer, RLS attiva), mai da un valore
 * passato dal client -- altrimenti un client malevolo potrebbe far
 * addebitare/associare l'abbonamento al tenant di qualcun altro.
 */
export async function POST(request: NextRequest) {
  const supabase = await creaClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ errore: "Devi accedere prima di scegliere un piano." }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ errore: "Corpo della richiesta non valido." }, { status: 400 });
  }
  const { piano } = (corpo ?? {}) as Record<string, unknown>;
  if (typeof piano !== "string" || !pianoEPagante(piano)) {
    return NextResponse.json({ errore: "Piano non valido." }, { status: 400 });
  }

  // Solo il titolare paga: un dipendente con accesso staff (Fase 5,
  // migrazione 0027) non deve poter aprire un checkout a nome dell'attività.
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) {
    return NextResponse.json({ errore: "Nessuna attività trovata per questo utente." }, { status: 404 });
  }
  if (!puoGestireFatturazione(sessione.ruolo)) {
    return NextResponse.json({ errore: ERRORE_PERMESSO_NEGATO }, { status: 403 });
  }
  const profilo = { tenant_id: sessione.tenantId };

  // Da qui in poi client ADMIN: serve scrivere stripe_customer_id, un campo
  // che il tenant owner non può toccare direttamente via RLS (di proposito,
  // per non permettere a un client di spoofare il proprio ID Stripe). Sicuro
  // perché il tenant_id sopra viene dalla sessione verificata, non dal
  // client -- si scrive sempre e solo il PROPRIO tenant.
  const admin = creaClientAdmin();
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, nome, stripe_customer_id")
    .eq("id", profilo.tenant_id)
    .single();
  if (!tenant) {
    return NextResponse.json({ errore: "Attività non trovata." }, { status: 404 });
  }

  const stripe = creaClientStripe();

  // Un solo Customer Stripe per tenant, riusato tra checkout successivi
  // (upgrade/downgrade) invece di crearne uno nuovo ogni volta -- altrimenti
  // customer portal e cronologia pagamenti si spezzano su più "clienti"
  // Stripe distinti per lo stesso salone.
  let stripeCustomerId = tenant.stripe_customer_id as string | null;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: tenant.nome,
      metadata: { tenant_id: tenant.id },
    });
    stripeCustomerId = customer.id;
    await admin.from("tenants").update({ stripe_customer_id: stripeCustomerId }).eq("id", tenant.id);
  }

  const origin = request.nextUrl.origin;
  const trialDays = giorniDiProva(piano);

  // Su tutti e tre i piani a pagamento il prezzo base include 1 operatore,
  // ognuno oltre il primo costa una quota fissa in più: 10€ su Starter, 15€
  // su Growth, 20€ su Pro (deciso con Gabriel il 16/09/2026, estendendo a
  // Starter/Growth la regola che dal 14/09/2026 valeva solo su Pro -- vedi
  // `priceIdOperatoreExtra` in stripe/piani.ts e DECISIONS.md).
  // Secondo line item aggiunto SOLO se il salone ha già più di un operatore
  // configurato al momento del checkout (tipicamente 0 se sta ancora facendo
  // l'onboarding, ma un tenant che cambia piano può già averne). `count`
  // conta sul client ADMIN (non RLS-limitato, stesso client già in uso qui
  // sopra per leggere/scrivere il tenant).
  // `priceIdOperatoreExtra` può restituire null finché Gabriel non ha creato
  // il Price su Stripe per quel piano: in quel caso il checkout parte senza
  // add-on invece di fallire, e la sincronizzazione lo aggiungerà da sé
  // appena la variabile d'ambiente esiste.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: priceIdPerPiano(piano), quantity: 1 },
  ];
  const priceIdExtra = priceIdOperatoreExtra(piano);
  if (priceIdExtra) {
    const { count } = await admin
      .from("operatori")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id);
    const operatoriExtra = Math.max(0, (count ?? 0) - 1);
    if (operatoriExtra > 0) {
      lineItems.push({ price: priceIdExtra, quantity: operatoriExtra });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: lineItems,
    success_url: `${origin}/dashboard?checkout=successo`,
    cancel_url: `${origin}/#prezzi`,
    client_reference_id: tenant.id,
    subscription_data: {
      metadata: { tenant_id: tenant.id, piano },
      ...(trialDays ? { trial_period_days: trialDays } : {}),
    },
    metadata: { tenant_id: tenant.id, piano },
  });

  if (!session.url) {
    return NextResponse.json({ errore: "Stripe non ha restituito un URL di checkout." }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
