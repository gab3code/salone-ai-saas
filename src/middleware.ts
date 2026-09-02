import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Rinfresca la sessione Supabase ad ogni richiesta (pattern standard
 * @supabase/ssr per Next.js App Router) -- senza questo, un access token
 * scaduto lascerebbe l'utente disconnesso in modo incoerente tra una pagina
 * e l'altra invece che essere rinnovato in automatico.
 */
export async function middleware(request: NextRequest) {
  let risposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesDaImpostare) {
          for (const { name, value } of cookiesDaImpostare) {
            request.cookies.set(name, value);
          }
          risposta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesDaImpostare) {
            risposta.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Il solo effetto collaterale che serve qui è il refresh del token tramite
  // i cookie sopra -- non usiamo l'utente restituito in questo file.
  await supabase.auth.getUser();

  return risposta;
}

export const config = {
  matcher: [
    /*
     * Applica il middleware a tutte le richieste tranne asset statici e
     * immagini, per non sprecare lavoro dove non serve mai una sessione.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
