import { NextRequest, NextResponse } from "next/server";
import { creaClientServer } from "@/lib/supabase/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientStripe } from "@/lib/stripe/server";

/**
 * Apre il Customer Portal Stripe (self-service: cambio piano, aggiornamento
 * carta, cancellazione) per il tenant dell'utente loggato -- mantiene la
 * promessa "Cancella quando vuoi" di CTAFinale.tsx senza dover costruire
 * un'interfaccia di gestione abbonamento da zero.
 */
export async function POST(request: NextRequest) {
  const supabase = await creaClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ errore: "Devi accedere." }, { status: 401 });
  }

  const { data: profilo } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profilo) {
    return NextResponse.json({ errore: "Nessuna attività trovata." }, { status: 404 });
  }

  const admin = creaClientAdmin();
  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", profilo.tenant_id)
    .single();
  if (!tenant?.stripe_customer_id) {
    return NextResponse.json({ errore: "Nessun abbonamento a pagamento attivo per questa attività." }, { status: 400 });
  }

  const stripe = creaClientStripe();
  const origin = request.nextUrl.origin;
  const portale = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: `${origin}/dashboard/impostazioni`,
  });

  return NextResponse.json({ url: portale.url });
}
