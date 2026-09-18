import { NextRequest, NextResponse } from "next/server";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoEsportareClienti, ERRORE_PERMESSO_NEGATO } from "@/lib/ruoli";
import { elencaClientiInattivi } from "@/lib/metriche";
import { clientiACsv } from "@/lib/csv";
import { originePerCliente } from "@/lib/origine-cliente";
import { terminoRicercaSicuro } from "@/lib/ricerca";
import { elencaClienti } from "@/lib/clienti.server";

/**
 * Esportazione CSV dei clienti del tenant loggato (PIANO.md "Export/import
 * CSV clienti", vedi csv.ts per il perché e per cosa manca ancora). Stessi
 * filtri `q`/`filtro` già supportati da `/dashboard/clienti` (page.tsx) --
 * "esporta quello che vedi", non un secondo comportamento da spiegare a
 * parte. Route handler (non una server action) perché il browser deve
 * scaricare un file vero con `Content-Disposition: attachment`, non ricevere
 * una risposta JSON.
 *
 * Autenticazione: `ottieniSessioneTenant` verifica già l'utente loggato al
 * suo interno (vedi supabase/tenant.ts) -- nessun controllo duplicato qui.
 * RLS resta comunque la rete di sicurezza finale sulla query sotto, come in
 * ogni altra pagina della dashboard.
 *
 * Riservato al titolare (Fase 5, migrazione 0027): lo staff i clienti li
 * vede uno per uno dentro il prodotto, ma portarsi via l'intera rubrica in
 * un file è un'altra cosa -- ed è quella che un titolare non si aspetta che
 * un dipendente possa fare.
 */
export async function GET(request: NextRequest) {
  const supabase = await creaClientServer();
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) {
    return NextResponse.json({ errore: "Nessun salone associato a questo utente." }, { status: 401 });
  }
  if (!puoEsportareClienti(sessione.ruolo)) {
    return NextResponse.json({ errore: ERRORE_PERMESSO_NEGATO }, { status: 403 });
  }
  const tenantId = sessione.tenantId;

  const { searchParams } = request.nextUrl;
  // Stessa ripulitura della rubrica: l'export deve esportare esattamente
  // quello che la pagina mostra, filtro compreso.
  const q = terminoRicercaSicuro(searchParams.get("q"));
  const filtro = searchParams.get("filtro");

  // Vedi clienti.server.ts: dalla migrazione 0051 nemmeno il titolare legge
  // `clienti` con il proprio JWT -- il permesso di esportare resta quello
  // controllato qui sopra, ma la query passa dal gateway.
  const { clienti: clientiGrezzi, errore } = await elencaClienti(tenantId, { termine: q, perExport: true });
  if (errore) {
    return NextResponse.json({ errore: `Errore esportando i clienti: ${errore}` }, { status: 500 });
  }

  let clienti = clientiGrezzi;

  // Caricata sempre (non solo per il filtro "inattivi"): serve anche per
  // l'origine di ogni cliente sotto, stesso principio "una query sola per
  // più usi" di /dashboard/clienti (page.tsx).
  const { data: righeAppuntamenti } = await supabase
    .from("appuntamenti")
    .select("cliente_id, inizio, stato, creato_da, created_at")
    .eq("tenant_id", tenantId)
    .not("cliente_id", "is", null);

  if (filtro === "inattivi") {
    const inattivi = elencaClientiInattivi(
      (righeAppuntamenti ?? []).map((r) => ({
        inizio: new Date(r.inizio),
        fine: new Date(r.inizio),
        stato: r.stato,
        clienteId: r.cliente_id,
        operatoreId: null,
        servizioId: null,
      })),
      new Date(),
      60
    );
    clienti = clienti.filter((c) => inattivi.has(c.id));
  }

  const origineCliente = originePerCliente(
    (righeAppuntamenti ?? []).map((r) => ({
      clienteId: r.cliente_id,
      creatoDa: r.creato_da,
      createdAt: new Date(r.created_at),
    }))
  );

  const csv = clientiACsv(
    clienti.map((c) => ({
      nome: c.nome,
      telefono: c.telefono,
      email: c.email,
      tag: c.tag,
      // Stessa origine (canale del primo appuntamento) già mostrata in
      // /dashboard/clienti -- "esporta quello che vedi", vedi origine-cliente.ts.
      origine: origineCliente.get(c.id) ?? (c.creato_da_ai ? "AI" : "Manuale"),
      createdAt: new Date(c.created_at),
    }))
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clienti.csv"',
    },
  });
}
