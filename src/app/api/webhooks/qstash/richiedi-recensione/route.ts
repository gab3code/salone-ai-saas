import { NextRequest, NextResponse } from "next/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { verificaFirmaQstash } from "@/lib/qstash.server";
import { elaboraRichiestaRecensione } from "@/lib/recensioni.server";

/**
 * Webhook QStash: destinazione del messaggio programmato da
 * `programmaRichiestaRecensione` (booking-engine.server.ts), consegnato non
 * prima di `ORE_ATTESA_RICHIESTA_RECENSIONE` ore dopo la fine
 * dell'appuntamento (vedi src/lib/recensioni.ts). Stesso principio di
 * sicurezza del webhook Stripe (src/app/api/stripe/webhook/route.ts): firma
 * verificata SEMPRE prima di leggere il corpo come JSON, quindi il corpo va
 * letto come testo grezzo (`verificaFirmaQstash` ne ha bisogno per
 * ricalcolare l'HMAC).
 *
 * Verifica SENZA controllare l'URL nella firma (parametro lasciato vuoto in
 * `verificaFirmaQstash`, che lo passa a sua volta a `Receiver.verify` --
 * "Omit empty to disable checking the url" per la libreria ufficiale):
 * dietro Vercel l'URL "vero" della richiesta può differire leggermente da
 * quello con cui QStash ha firmato il messaggio (proxy, redirect,
 * normalizzazione), un rischio di falsi negativi che eviterebbe di
 * verificare l'unico controllo che conta davvero qui -- l'HMAC del corpo
 * col signing key, che DA SOLO garantisce già che il messaggio venga da
 * QStash e non sia stato alterato in transito.
 *
 * QStash garantisce consegna "almeno una volta", mai "esattamente una
 * volta": la vera difesa contro un doppio invio non è qui, ma nel
 * claim-before-send dentro `elaboraRichiestaRecensione`
 * (`recensione_richiesta_inviata_at`) -- questo endpoint risponde comunque
 * sempre 200 su un esito "già gestito", per non far ritentare QStash
 * all'infinito su un caso che non è un errore.
 */
export async function POST(request: NextRequest) {
  const firma = request.headers.get("upstash-signature");
  const corpoGrezzo = await request.text();

  const firmaValida = await verificaFirmaQstash(firma, corpoGrezzo);
  if (!firmaValida) {
    return NextResponse.json({ errore: "Firma non valida." }, { status: 401 });
  }

  let payload: { tenantId?: string; appuntamentoId?: string };
  try {
    payload = JSON.parse(corpoGrezzo);
  } catch {
    return NextResponse.json({ errore: "Corpo non valido." }, { status: 400 });
  }

  const { tenantId, appuntamentoId } = payload;
  if (!tenantId || !appuntamentoId) {
    return NextResponse.json({ errore: "tenantId/appuntamentoId mancanti." }, { status: 400 });
  }

  const admin = creaClientAdmin();
  const esito = await elaboraRichiestaRecensione(admin, tenantId, appuntamentoId);

  return NextResponse.json({ esito });
}
