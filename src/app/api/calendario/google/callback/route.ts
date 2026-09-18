import { NextRequest, NextResponse } from "next/server";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { scambiaCodiceGoogle } from "@/lib/calendario-esterno/google.server";
import { cifra } from "@/lib/cifratura";

const PAGINA_IMPOSTAZIONI = "/dashboard/impostazioni/calendari";

/**
 * Google torna qui dopo il consenso dell'operatore, con `code` (da scambiare
 * per i token veri) e lo stesso `state` che avevamo generato in /connect.
 * Verifica in 3 passi prima di salvare qualunque cosa: (1) l'utente è ancora
 * loggato ORA, (2) il nonce nel cookie combacia con quello dentro state
 * (anti-CSRF), (3) l'operatore indicato in state è davvero del tenant
 * dell'utente loggato ORA -- così anche uno state manomesso non potrebbe mai
 * collegare il calendario di un operatore di un salone diverso.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const erroreGoogle = request.nextUrl.searchParams.get("error");

  if (erroreGoogle) {
    return redirectConEsito(request, `Collegamento annullato: ${erroreGoogle}`);
  }
  if (!code || !state) {
    return redirectConEsito(request, "Risposta di Google incompleta (manca code o state).");
  }

  let operatoreId: string;
  let nonce: string;
  try {
    const decodificato = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    operatoreId = decodificato.operatoreId;
    nonce = decodificato.nonce;
    if (!operatoreId || !nonce) throw new Error("campi mancanti");
  } catch {
    return redirectConEsito(request, "Parametro state non valido.");
  }

  const nonceAtteso = request.cookies.get("google_oauth_nonce")?.value;
  if (!nonceAtteso || nonceAtteso !== nonce) {
    return redirectConEsito(request, "Sessione di collegamento scaduta o non valida, riprova.");
  }

  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) {
    return redirectConEsito(request, "Devi essere loggato per completare il collegamento.");
  }

  const { data: operatore } = await supabase
    .from("operatori")
    .select("id")
    .eq("id", operatoreId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!operatore) {
    return redirectConEsito(request, "Operatore non trovato per questo salone.");
  }

  try {
    const token = await scambiaCodiceGoogle(code);
    if (!token.refreshToken) {
      // Capita se l'operatore aveva già autorizzato l'app in passato E Google
      // decide comunque di non reinviarlo nonostante prompt=consent (raro,
      // ma documentato da Google) -- senza refresh_token non possiamo
      // rinnovare l'accesso dopo che scade in ~1h, quindi è un errore reale,
      // non un collegamento "quasi riuscito".
      return redirectConEsito(
        request,
        "Google non ha restituito un token di aggiornamento permanente. Riprova il collegamento."
      );
    }

    const { error } = await supabase.from("collegamenti_calendario_esterni").upsert(
      {
        tenant_id: tenantId,
        operatore_id: operatoreId,
        provider: "google",
        stato: "connesso",
        ultimo_errore: null,
        // Cifrati a riposo (vedi cifratura.ts): il refresh token e' la chiave
        // del calendario personale di una persona, non un dato del salone.
        google_access_token: cifra(token.accessToken),
        google_refresh_token: cifra(token.refreshToken),
        google_token_scadenza: token.scadenza.toISOString(),
        google_calendar_id: "primary",
        aggiornato_il: new Date().toISOString(),
      },
      { onConflict: "operatore_id,provider" }
    );
    if (error) {
      return redirectConEsito(request, `Collegato a Google ma errore salvando: ${error.message}`);
    }
  } catch (errore) {
    console.error("Google Calendar: scambio codice fallito", errore);
    return redirectConEsito(
      request,
      errore instanceof Error ? `Collegamento fallito: ${errore.message}` : "Collegamento fallito."
    );
  }

  const risposta = redirectConEsito(request, null);
  // Stesso "path" con cui è stato creato in /connect -- senza, il browser lo
  // tratterebbe come un cookie diverso e non lo cancellerebbe davvero
  // (resterebbe comunque fino ai suoi 5 minuti di maxAge, ma meglio pulire
  // subito quando il giro OAuth è completato con successo).
  risposta.cookies.set("google_oauth_nonce", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/calendario/google",
  });
  return risposta;
}

function redirectConEsito(request: NextRequest, errore: string | null): NextResponse {
  const url = new URL(PAGINA_IMPOSTAZIONI, request.url);
  if (errore) url.searchParams.set("errore_google", errore);
  else url.searchParams.set("google_collegato", "1");
  return NextResponse.redirect(url);
}
