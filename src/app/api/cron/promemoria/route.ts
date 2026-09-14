import { NextRequest, NextResponse } from "next/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { eseguiPromemoriaGiornalieri } from "@/lib/promemoria.server";

/**
 * Endpoint chiamato da Vercel Cron una volta al giorno (vedi vercel.json,
 * "0 8 * * *" -- 08:00 UTC) per il motore di "Promemoria automatici" (Fase
 * 6, vedi src/lib/promemoria.ts per tutta la logica di decisione).
 *
 * Protetto da CRON_SECRET: Vercel aggiunge automaticamente l'header
 * `Authorization: Bearer <CRON_SECRET>` alle chiamate che genera lui stesso
 * per i cron di questo progetto (documentazione Vercel Cron Jobs), quindi
 * basta confrontare lo stesso valore impostato come variabile d'ambiente.
 * A differenza del resto del modulo email (fail-open by design): qui NON
 * fail-open se il secret manca -- questo endpoint manda email vere a
 * clienti veri e scrive sul database, un endpoint di questo tipo
 * raggiungibile senza autenticazione sarebbe un vettore di abuso reale
 * (chiunque potrebbe forzare l'invio ripetuto a tutti i clienti di ogni
 * tenant), non solo un fastidio.
 */
export async function GET(request: NextRequest) {
  const segreto = process.env.CRON_SECRET;
  if (!segreto) {
    console.error("[cron/promemoria] CRON_SECRET non configurato: rifiuto l'esecuzione.");
    return NextResponse.json({ errore: "CRON_SECRET non configurato" }, { status: 500 });
  }

  const autorizzazione = request.headers.get("authorization");
  if (autorizzazione !== `Bearer ${segreto}`) {
    return NextResponse.json({ errore: "non autorizzato" }, { status: 401 });
  }

  const admin = creaClientAdmin();
  const esito = await eseguiPromemoriaGiornalieri(admin, new Date());
  return NextResponse.json(esito);
}
