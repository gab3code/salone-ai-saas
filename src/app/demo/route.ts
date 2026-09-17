import { NextResponse, type NextRequest } from "next/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { COOKIE_GRUPPO_DEMO, GIORNI_COOKIE_DEMO } from "@/lib/demo";
import { ottieniOCreaSaloneDemo } from "@/lib/demo.server";

/**
 * `/demo` -- l'indirizzo fisso della demo.
 *
 * E' una rotta e non una pagina perche' deve SCRIVERE un cookie, e un Server
 * Component non puo': il cookie e' quello che fa ritrovare al visitatore il
 * salone che aveva gia', invece di dargliene uno nuovo a ogni visita e
 * riempire il database di cloni abbandonati.
 *
 * Dove porta e' comunque `/s/<slug>`: la demo NON e' una pagina a parte, e'
 * la stessa identica pagina pubblica di ogni salone, con dentro dati finti.
 * Una demo costruita a parte diverge dal prodotto vero al primo cambio.
 */
export async function GET(request: NextRequest) {
  const gruppoEsistente = request.cookies.get(COOKIE_GRUPPO_DEMO)?.value ?? null;

  const admin = creaClientAdmin();
  const salone = await ottieniOCreaSaloneDemo(admin, gruppoEsistente);

  const risposta = NextResponse.redirect(new URL(`/s/${salone.slugGrowth}`, request.url));

  if (salone.gruppo) {
    risposta.cookies.set(COOKIE_GRUPPO_DEMO, salone.gruppo, {
      maxAge: GIORNI_COOKIE_DEMO * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "lax",
      // Nessun dato personale qui dentro: e' un identificatore casuale che
      // punta a un salone finto. Resta httpOnly comunque, perche' non c'e'
      // nessun motivo per cui il JavaScript della pagina debba leggerlo.
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }

  return risposta;
}
