import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { costruisciUrlAutorizzazione } from "@/lib/calendario-esterno/google.server";

/**
 * Punto di ingresso del collegamento Google Calendar (Fase 6bis): l'owner
 * loggato clicca "Collega Google" per un operatore -> qui verifichiamo che
 * l'operatore sia davvero del suo salone (mai fidarsi solo dell'id passato
 * in query string) -> redirect alla schermata di consenso di Google.
 *
 * `state` porta l'operatoreId attraverso il giro su Google (che non sa nulla
 * della nostra sessione) insieme a un nonce anti-CSRF salvato in un cookie
 * httpOnly di breve durata, verificato di nuovo nel callback.
 */
export async function GET(request: NextRequest) {
  const operatoreId = request.nextUrl.searchParams.get("operatore_id");
  if (!operatoreId) {
    return NextResponse.json({ errore: "Parametro operatore_id mancante." }, { status: 400 });
  }

  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) {
    return NextResponse.redirect(new URL("/accedi", request.url));
  }

  const { data: operatore } = await supabase
    .from("operatori")
    .select("id")
    .eq("id", operatoreId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!operatore) {
    return NextResponse.json({ errore: "Operatore non trovato per questo salone." }, { status: 404 });
  }

  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ operatoreId, nonce })).toString("base64url");

  let urlAutorizzazione: string;
  try {
    urlAutorizzazione = costruisciUrlAutorizzazione(state);
  } catch (errore) {
    return NextResponse.json(
      { errore: errore instanceof Error ? errore.message : "Google Calendar non configurato." },
      { status: 503 }
    );
  }

  const risposta = NextResponse.redirect(urlAutorizzazione);
  risposta.cookies.set("google_oauth_nonce", nonce, {
    httpOnly: true,
    // "secure" solo in produzione: in sviluppo giriamo su http://localhost,
    // dove un cookie Secure verrebbe scartato dal browser.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minuti: giusto il tempo del giro su Google
    path: "/api/calendario/google",
  });
  return risposta;
}
