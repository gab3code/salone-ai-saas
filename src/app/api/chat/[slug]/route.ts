import { NextRequest, NextResponse } from "next/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { risolviTenantDaSlug, MESSAGGIO_ATTIVITA_SOSPESA } from "@/lib/ai/tools";
import { rispondiConversazione } from "@/lib/ai/agente";
import {
  ottieniOCreaConversazione,
  caricaMessaggi,
  salvaMessaggio,
  segnaPassataAOperatore,
  aggiornaTurniSenzaStrumenti,
} from "@/lib/ai/conversazione.server";
import {
  pianoHaAccessoAIChatWeb,
  pianoHaTonoPersonalizzato,
  limiteMensileMessaggi,
  INTERVALLO_MINIMO_MS_TRA_MESSAGGI,
  LIMITE_MESSAGGI_CLIENTE_PER_CONVERSAZIONE,
  LIMITE_TURNI_SENZA_STRUMENTI_CONSECUTIVI,
} from "@/lib/ai/limiti";
import { pianoHaKnowledgeBaseAi } from "@/lib/piani";
import type { StileTonoAI } from "@/lib/ai/agente";
import { contaMessaggiClienteQuestoMese, ultimoMessaggioTroppoRecente } from "@/lib/ai/limiti.server";
import { FUSO_ORARIO_PREDEFINITO, realeAPseudoUtc } from "@/lib/fuso-orario";
import { istruzioniContatto } from "@/lib/contatti";
import { TETTI_CHAT_SALONE } from "@/lib/limiti-ip";
import { consumaUsoAiPerIp } from "@/lib/limiti-ip.server";

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

  const tenantRisolto = await risolviTenantDaSlug(supabase, slug);
  if (!tenantRisolto) {
    return NextResponse.json({ errore: "Attività non trovata." }, { status: 404 });
  }
  // L'assistente AI prenota davvero: su un'attività sospesa va zittito come
  // il form pubblico, altrimenti resterebbe l'unica porta ancora aperta.
  if (tenantRisolto.sospesa) {
    return NextResponse.json({ errore: MESSAGGIO_ATTIVITA_SOSPESA }, { status: 403 });
  }
  const tenantId = tenantRisolto.id;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nome, piano, fuso_orario, tono_ai, tono_ai_nota, telefono, telefono_whatsapp")
    .eq("id", tenantId)
    .single();

  // Gate di piano (Free/Starter non hanno la chat AI affatto -- decisione
  // 02/09/2026, vedi DECISIONS.md): controllato PRIMA di creare/toccare
  // qualunque conversazione, così un tenant senza AI non lascia comunque
  // tracce nel database per ogni visitatore che prova a scriverci.
  if (!tenant || !pianoHaAccessoAIChatWeb(tenant.piano)) {
    return NextResponse.json(
      { errore: "La chat AI non è inclusa nel piano di questa attività." },
      { status: 403 }
    );
  }

  // Tetto per singolo chiamante, PRIMA di toccare qualunque cosa -- prima
  // ancora di creare o ripescare una conversazione.
  //
  // E' l'unica difesa di questo endpoint che non si aggira dal client. Tutte
  // le altre (intervallo minimo fra messaggi, tetto per conversazione, turni
  // fuori tema) sono agganciate a `identificatore_sessione`, che pero' lo
  // sceglie chi chiama: uno script che ne genera uno nuovo a ogni richiesta
  // le salta tutte, e restava solo la quota mensile del salone -- che una
  // persona sola poteva bruciare in pochi minuti, togliendola ai clienti veri
  // di quel salone.
  //
  // I numeri stanno larghi apposta (vedi limiti-ip.ts): qui dall'altra parte
  // c'e' un cliente che sta prenotando, e bloccarlo costa al salone molto piu'
  // di quanto costi a noi qualche messaggio in piu'.
  const limiteIp = await consumaUsoAiPerIp(supabase, request.headers, "chat", TETTI_CHAT_SALONE);
  if (!limiteIp.consentito) {
    return NextResponse.json(
      {
        errore:
          limiteIp.motivo === "tetto"
            ? "Hai scritto molti messaggi in poco tempo. Riprova fra un'ora, oppure contatta direttamente l'attività."
            : "Non riesco a rispondere in questo momento. Riprova fra poco.",
      },
      { status: 429 }
    );
  }

  try {
    const conversazione = await ottieniOCreaConversazione(supabase, tenantId, identificatoreSessione);

    // Anti-burst e quota mensile: l'endpoint è pubblico e non autenticato,
    // quindi queste due difese vengono PRIMA di salvare il messaggio e PRIMA
    // di chiamare il modello -- un messaggio rifiutato qui non genera alcun
    // costo Anthropic (vedi limiti.ts per il perché di entrambe).
    if (await ultimoMessaggioTroppoRecente(supabase, conversazione.id, INTERVALLO_MINIMO_MS_TRA_MESSAGGI)) {
      return NextResponse.json(
        { errore: "Stai scrivendo troppo velocemente, aspetta un attimo e riprova." },
        { status: 429 }
      );
    }
    const usatiQuestoMese = await contaMessaggiClienteQuestoMese(supabase, tenantId);
    // Numero operatori solo per Pro (unico piano la cui quota scala con
    // essi, vedi limiti.ts) -- niente query in più per Growth/Enterprise,
    // dove il conteggio non cambierebbe comunque il risultato.
    const numeroOperatori =
      tenant.piano === "pro"
        ? ((await supabase.from("operatori").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId)).count ?? 0)
        : 1;
    if (usatiQuestoMese >= limiteMensileMessaggi(tenant.piano, numeroOperatori)) {
      return NextResponse.json(
        { errore: "Questa attività ha raggiunto il limite mensile di messaggi AI. Contattala direttamente per prenotare." },
        { status: 429 }
      );
    }

    const storico = await caricaMessaggi(supabase, conversazione.id);

    // Anti-abuso lato cliente (14/09/2026, vedi limiti.ts e DECISIONS.md):
    // controllato PRIMA di chiamare il modello, come le difese sopra --
    // niente costo Anthropic per un turno che finisce comunque passato a un
    // operatore. Il messaggio del cliente viene comunque salvato (l'operatore
    // deve poterlo leggere), solo non arriva mai all'AI.
    const messaggiClienteConversazione = storico.filter((m) => m.ruolo === "cliente").length + 1;
    const troppiMessaggi = messaggiClienteConversazione > LIMITE_MESSAGGI_CLIENTE_PER_CONVERSAZIONE;
    const troppiTurniSenzaStrumenti =
      conversazione.turniSenzaToolConsecutivi >= LIMITE_TURNI_SENZA_STRUMENTI_CONSECUTIVI;

    if (troppiMessaggi || troppiTurniSenzaStrumenti) {
      await salvaMessaggio(supabase, conversazione.id, "cliente", messaggio);
      // Mai promettere un passaggio a un operatore che non avvisa nessuno
      // (15/09/2026, riconfermato il 17/09 dopo aver provato e scartato
      // l'email al titolare): si dà il recapito vero, costruito dalla stessa
      // `istruzioniContatto` della REGOLA 8 del prompt -- un solo posto che
      // decide come si dice "fatti sentire".
      const comeContattare = istruzioniContatto({
        telefono: tenant.telefono ?? null,
        telefonoWhatsapp: tenant.telefono_whatsapp ?? null,
      });
      const rispostaAntiAbuso = `Non riesco a risponderti oltre da qui. Puoi ${
        comeContattare ?? "contattare l'attività direttamente"
      }, ti aiutano subito.`;
      await salvaMessaggio(supabase, conversazione.id, "assistente", rispostaAntiAbuso);
      await segnaPassataAOperatore(supabase, conversazione.id);
      return NextResponse.json({ risposta: rispostaAntiAbuso, trasferitoAUmano: true });
    }

    await salvaMessaggio(supabase, conversazione.id, "cliente", messaggio);

    // "Adesso" passato esplicitamente in pseudo-UTC (mai il new Date() reale
    // di default di rispondiConversazione): il system prompt dell'AI
    // costruisce data/giorno-settimana da questo valore con gli stessi
    // getUTC* usati ovunque nel booking engine (vedi src/lib/fuso-orario.ts).
    const adessoPseudo = realeAPseudoUtc(new Date(), tenant?.fuso_orario || FUSO_ORARIO_PREDEFINITO);

    // Tono personalizzato applicato SOLO se il piano lo include (Pro/
    // Enterprise, vedi Prezzi.tsx) -- un tenant Growth ha comunque salvato
    // in tenants.tono_ai il default "professionale" (colonna sempre
    // valorizzata), ma se avesse un valore diverso per qualunque motivo
    // (es. un downgrade da Pro a Growth) il gate qui lo ignora comunque:
    // stesso principio già usato per pianoHaAccessoAIWhatsapp, mai fidarsi
    // solo del dato salvato, ricontrollare il piano ad ogni richiesta.
    const tonoAi = pianoHaTonoPersonalizzato(tenant?.piano ?? "") ? (tenant?.tono_ai as StileTonoAI) : undefined;
    const tonoAiNota = pianoHaTonoPersonalizzato(tenant?.piano ?? "") ? tenant?.tono_ai_nota : undefined;

    // Knowledge base dell'AI receptionist (Fase 2, Pro/Enterprise -- vedi
    // `pianoHaKnowledgeBaseAi` in piani.ts): gate NUOVO E INDIPENDENTE da
    // quello della chat AI base sopra e da quello del tono personalizzato --
    // un tenant Growth mantiene la chat AI transazionale di oggi, ma NON la
    // capacità informativa. Nessun dato salvato da ricontrollare qui (a
    // differenza di tonoAi/tonoAiNota): il gate è puro, ricalcolato ad ogni
    // richiesta dal piano corrente.
    const haInformazioniAttivita = pianoHaKnowledgeBaseAi(tenant?.piano ?? "");

    // slug/origin passati al contesto SOLO per il tool crea_prenotazione,
    // per l'eventuale Stripe Checkout Session di una caparra (vedi
    // src/lib/stripe/caparra.server.ts e DECISIONS.md 15/09/2026) -- stesso
    // modo di risolvere l'origine già usato in azioni.ts (avviaPagamentoCaparra),
    // non `request.nextUrl.origin` diretto, per coerenza con quel codice.
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("host");
    const origin = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${proto}://${host}` : undefined);

    const risultato = await rispondiConversazione(
      storico,
      messaggio,
      {
        supabase,
        tenantId,
        slug,
        origin,
        nomeAttivita: tenant?.nome ?? "l'attività",
        tonoAi,
        tonoAiNota,
        haInformazioniAttivita,
        telefono: tenant?.telefono ?? null,
        telefonoWhatsapp: tenant?.telefono_whatsapp ?? null,
      },
      undefined, // client Anthropic di default (parametro 5° è "adesso", non va confuso)
      adessoPseudo
    );

    await salvaMessaggio(supabase, conversazione.id, "assistente", risultato.rispostaTesto);
    if (risultato.trasferitoAUmano) {
      await segnaPassataAOperatore(supabase, conversazione.id);
    }
    // Aggiorna il contatore anti-abuso DOPO la risposta (fail-open, non
    // deve mai far fallire un turno riuscito -- vedi conversazione.server.ts).
    await aggiornaTurniSenzaStrumenti(
      supabase,
      conversazione.id,
      risultato.usoStrumenti,
      conversazione.turniSenzaToolConsecutivi
    );

    return NextResponse.json({ risposta: risultato.rispostaTesto, trasferitoAUmano: risultato.trasferitoAUmano });
  } catch (errore) {
    console.error("Errore nella chat AI:", errore);
    return NextResponse.json(
      { errore: "Si è verificato un problema, riprova tra poco o contatta l'attività direttamente." },
      { status: 500 }
    );
  }
}
