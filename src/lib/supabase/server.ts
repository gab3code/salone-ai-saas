import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Client Supabase per Server Component/Server Action/Route Handler. Anche
 * questo usa SOLO la anon key: l'utente resta soggetto a RLS, la differenza
 * con il client browser è solo che legge/scrive la sessione nei cookie
 * della richiesta invece che nel browser. "server-only" fa fallire la build
 * se per errore questo file finisse importato in un componente client.
 */
export async function creaClientServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesDaImpostare) {
          try {
            for (const { name, value, options } of cookiesDaImpostare) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // set() chiamato da un Server Component (non da una Server
            // Action/Route Handler): il middleware si occupa comunque di
            // rinfrescare la sessione, quindi si può ignorare in sicurezza.
          }
        },
      },
    }
  );
}
