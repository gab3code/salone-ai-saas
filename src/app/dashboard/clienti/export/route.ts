import { NextRequest, NextResponse } from "next/server";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { elencaClientiInattivi } from "@/lib/metriche";
import { clientiACsv } from "@/lib/csv";

/**
 * Esportazione CSV dei clienti del tenant loggato (PIANO.md "Export/import
 * CSV clienti", vedi csv.ts per il perché e per cosa manca ancora). Stessi
 * filtri `q`/`filtro` già supportati da `/dashboard/clienti` (page.tsx) --
 * "esporta quello che vedi", non un secondo comportamento da spiegare a
 * parte. Route handler (non una server action) perché il browser deve
 * scaricare un file vero con `Content-Disposition: attachment`, non ricevere
 * una risposta JSON.
 *
 * Autenticazione: `ottieniTenantCorrente` verifica già l'utente loggato al
 * suo interno (vedi supabase/tenant.ts) -- nessun controllo duplicato qui.
 * RLS resta comunque la rete di sicurezza finale sulla query sotto, come in
 * ogni altra pagina della dashboard.
 */
export async function GET(request: NextRequest) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) {
    return NextResponse.json({ errore: "Nessun salone associato a questo utente." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  const filtro = searchParams.get("filtro");

  let query = supabase
    .from("clienti")
    .select("nome, telefono, email, tag, creato_da_ai, created_at, id")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`nome.ilike.%${q}%,telefono.ilike.%${q}%`);
  }

  const { data: clientiGrezzi, error } = await query;
  if (error) {
    return NextResponse.json({ errore: `Errore esportando i clienti: ${error.message}` }, { status: 500 });
  }

  let clienti = clientiGrezzi ?? [];

  if (filtro === "inattivi") {
    const { data: righeAppuntamenti } = await supabase
      .from("appuntamenti")
      .select("cliente_id, inizio, stato")
      .eq("tenant_id", tenantId)
      .not("cliente_id", "is", null);

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

  const csv = clientiACsv(
    clienti.map((c) => ({
      nome: c.nome,
      telefono: c.telefono,
      email: c.email,
      tag: c.tag,
      // Stessa etichetta già mostrata nella tabella di /dashboard/clienti
      // (limite noto: un cliente "pubblico" risulta ancora "Manuale", vedi
      // PIANO.md sulla migrazione di creato_da_ai a tre stati).
      origine: c.creato_da_ai ? "AI" : "Manuale",
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
