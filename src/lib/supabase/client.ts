"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client Supabase per componenti browser (React "use client"). Usa SOLO la
 * anon key -- ogni lettura/scrittura passa dalle policy RLS, mai un bypass.
 * Questo è il client che, ad esempio, chiama supabase.auth.signUp() nel
 * form di registrazione.
 */
export function creaClientBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Client per il SOLO recupero password, con il flusso "implicit" invece di
 * PKCE.
 *
 * Il motivo e' pratico, non teorico. Con PKCE (il default) il link ricevuto
 * per email si puo' aprire solo nel browser che ha CHIESTO il recupero: la
 * meta' segreta della coppia vive nei cookie di quel browser. Un titolare
 * che chiede il recupero dal computer del salone e poi apre la mail dal
 * telefono -- cioe' meta' delle persone -- troverebbe un errore proprio nel
 * momento in cui e' gia' in difficolta' perche' non riesce a entrare.
 *
 * Con il flusso implicit il link funziona da qualunque dispositivo. In
 * cambio, il token arriva nel frammento dell'indirizzo (la parte dopo #):
 * non viene mai spedito al server, ma resta nella cronologia di quel
 * browser. Su un link che vale pochi minuti e una volta sola, e' un prezzo
 * accettabile per non lasciare a piedi chi ha perso la password.
 *
 * Si potra' tornare a PKCE il giorno in cui il template dell'email sara'
 * modificabile (serve l'SMTP personalizzato): con un link costruito su
 * TokenHash il recupero funziona da ogni dispositivo anche con PKCE.
 */
export function creaClientBrowserRecupero() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } }
  );
}
