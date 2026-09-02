import { NextRequest, NextResponse } from "next/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { risolviTenantIdDaSlug } from "@/lib/ai/tools";
import { rispondiConversazione } from "@/lib/ai/agente";
import { ottieniOCreaConversazione, caricaMessaggi, salvaMessaggio, segnaPassataAOperatore } from "@/lib/ai/conversazione.server";

/**
 * Endpoint pubblico della chat AI (Task #66) -- NESSUNA autenticazione
 * Supabase: chi scrive è un visitatore anonimo della pagina pubblica del
 * salone, riconosciuto solo dall'`identificatoreSessione` che il suo
 * browser genera e riusa (vedi conversazione.server.ts). Usa sempre il
 * client admin/service_role: non esiste un utente Supabase dietro un
 * visitatore anonimo (stesso ragionamento di tools.ts).
 *
 * Il contesto della conversazione vive nel database (`messaggi`), non nel
 * corpo della richiesta -- un client compromesso o malevolo non può quindi
 * "riscrivere la storia" della conversazione iniettando uno storico falso.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ errore: "Corpo della richiesta non valido (JSON atteso)." }, { status: 400 });
  }

  const { messaggio, identificatoreSessione } = (corpo ?? {}) as Record<string, unknown>;
  if (typeof messaggio !== "string" || !messaggio.trim()) {
    return NextResponse.json({ errore: "Campo 'messaggio' obbligatorio." }, { status: 400 });
  }
  if (messaggio.length > 2000) {
    return NextResponse.json({ errore: "Messaggio troppo lungo (massimo 2000 caratteri)." }, { status: 400 });
  }
  if (typeof identificatoreSessione !== "string" || identificatoreSessione.length < 8 || identificatoreSessione.length > 200) {
    return NextResponse.json({ errore: "Campo 'identificatoreSessione' obbligatorio (min 8 caratteri)." }, { status: 400 });
  }

  const supabase = creaClientAdmin();

  const tenantId = await risolviTenantIdDaSlug(supabase, slug);
  if (!tenantId) {
    return NextResponse.json({ errore: "Attività non trovata." }, { status: 404 });
  }

  const { data: tenant } = await supabase.from("tenants").select("nome").eq("id", tenantId).single();

  try {
    const conversazione = await ottieniOCreaConversazione(supabase, tenantId, identificatoreSessione);
    const storico = await caricaMessaggi(supabase, conversazione.id);

    await salvaMessaggio(supabase, conversazione.id, "cliente", messaggio);

    const risultato = await rispondiConversazione(storico, messaggio, {
      supabase,
      tenantId,
      nomeAttivita: tenant?.nome ?? "l'attività",
    });

    await salvaMessaggio(supabase, conversazione.id, "assistente", risultato.rispostaTesto);
    if (risultato.trasferitoAUmano) {
      await segnaPassataAOperatore(supabase, conversazione.id);
    }

    return NextResponse.json({ risposta: risultato.rispostaTesto, trasferitoAUmano: risultato.trasferitoAUmano });
  } catch (errore) {
    console.error("Errore nella chat AI:", errore);
    return NextResponse.json(
      { errore: "Si è verificato un problema, riprova tra poco o contatta l'attività direttamente." },
      { status: 500 }
    );
  }
}
