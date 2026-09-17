import { NextResponse, type NextRequest } from "next/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { rispondiConversazione, type MessaggioConversazione } from "@/lib/ai/agente";
import type { NomeStrumento } from "@/lib/ai/tools";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { FUSO_ORARIO_DEMO, NOME_SALONE_DEMO } from "@/lib/demo/salone-finto";
import { eseguiStrumentoDemo, statoDemoVuoto, type StatoDemo } from "@/lib/demo/strumenti-demo";
import { CHIAVE_CONTATORE_DEMO, MESSAGGI_DEMO_AL_MESE, validaRichiestaDemo } from "@/lib/demo/limiti-demo";
import { TETTI_DEMO } from "@/lib/limiti-ip";
import { consumaUsoAiPerIp } from "@/lib/limiti-ip.server";

/**
 * La chat della demo pubblica.
 *
 * Endpoint separato da `/api/chat/[slug]` di proposito, e non un ramo dentro
 * quello: quello e' il percorso di ogni cliente pagante, cioe' il posto in
 * cui un errore costa di piu'. Qui non si tocca nessun salone vero, non si
 * scrive niente da nessuna parte, e l'unica riga di database che viene
 * toccata e' il contatore mensile.
 *
 * L'assistente pero' e' lo STESSO: stessa `rispondiConversazione`, stesso
 * prompt, stessi strumenti. Cambia solo chi li esegue -- `ctx.esegui`, che
 * qui punta all'esecutore sui dati finti.
 *
 * ----------------------------------------------------------------------
 * LO STATO ARRIVA DAL BROWSER, E VA BENE COSI'
 *
 * Storico e agenda viaggiano nel corpo della richiesta. Non c'e' niente da
 * proteggere -- sono dati finti, e chi li manomette rovina solo la propria
 * demo -- ma c'e' da proteggere il COSTO, perche' uno storico gonfiato si
 * paga in token. Per questo si controlla la dimensione di quello che arriva
 * (`validaRichiestaDemo`) prima di chiamare il modello, e si tronca
 * comunque.
 *
 * L'ORDINE DEI CONTROLLI conta: prima la validazione (gratis), poi il
 * contatore (una query), poi il modello (l'unica cosa che costa davvero).
 */

export const runtime = "nodejs";

interface CorpoRichiesta {
  piano?: unknown;
  messaggio?: unknown;
  storico?: unknown;
  stato?: unknown;
}

function storicoPulito(grezzo: unknown): MessaggioConversazione[] {
  if (!Array.isArray(grezzo)) return [];
  return grezzo
    .filter((m): m is { ruolo: string; contenuto: string } =>
      !!m && typeof m === "object" &&
      (m as { ruolo?: unknown }).ruolo !== undefined &&
      typeof (m as { contenuto?: unknown }).contenuto === "string"
    )
    .map((m) => ({
      ruolo: m.ruolo === "cliente" ? ("cliente" as const) : ("assistente" as const),
      contenuto: String(m.contenuto).slice(0, 2000),
    }));
}

function statoPulito(grezzo: unknown): StatoDemo {
  if (!grezzo || typeof grezzo !== "object") return statoDemoVuoto();
  const app = (grezzo as { appuntamenti?: unknown }).appuntamenti;
  if (!Array.isArray(app)) return statoDemoVuoto();
  return {
    appuntamenti: app
      .filter((a) => !!a && typeof a === "object" && typeof (a as { inizio?: unknown }).inizio === "string")
      .map((a) => a as StatoDemo["appuntamenti"][number]),
  };
}

export async function POST(request: NextRequest) {
  let corpo: CorpoRichiesta;
  try {
    corpo = (await request.json()) as CorpoRichiesta;
  } catch {
    return NextResponse.json({ errore: "Richiesta non valida." }, { status: 400 });
  }

  const suPro = corpo.piano === "pro";
  const storico = storicoPulito(corpo.storico);
  const stato = statoPulito(corpo.stato);

  const valida = validaRichiestaDemo({
    messaggio: corpo.messaggio,
    numeroMessaggiStorico: storico.length,
    numeroAppuntamenti: stato.appuntamenti.length,
  });
  if (!valida.ok) return NextResponse.json({ errore: valida.errore }, { status: 400 });
  const messaggio = String(corpo.messaggio).trim();

  const admin = creaClientAdmin();

  // PRIMA di tutto il resto: il tetto per singolo chiamante. Il tetto mensile
  // qui sotto e' condiviso fra tutti i visitatori, quindi senza questo uno
  // solo poteva consumare la demo di tutti gli altri. Un tentativo respinto
  // qui non consuma il contatore globale, che e' il punto.
  const limiteIp = await consumaUsoAiPerIp(admin, request.headers, "demo", TETTI_DEMO);
  if (!limiteIp.consentito) {
    return NextResponse.json(
      {
        errore:
          limiteIp.motivo === "tetto"
            ? "Hai provato la demo parecchie volte di fila. Riprova fra un'ora: il limite serve a lasciarla disponibile anche agli altri."
            : "Non riesco a verificare il limite di utilizzo adesso. Riprova fra poco.",
      },
      { status: 429 }
    );
  }

  // Il tetto mensile globale: una riga sola nel database, quindi e' l'unico
  // limite che non si aggira aprendo una scheda nuova. Si consuma PRIMA di
  // chiamare il modello -- consumarlo dopo, solo in caso di successo,
  // renderebbe il tetto aggirabile da chi riesce a far fallire la chiamata,
  // e una chiamata fallita ad Anthropic e' gia' stata pagata comunque.
  const { data: restano, error: erroreContatore } = await admin.rpc("consuma_contatore_globale", {
    p_chiave: CHIAVE_CONTATORE_DEMO,
    p_limite: MESSAGGI_DEMO_AL_MESE,
  });
  if (erroreContatore || typeof restano !== "number" || restano < 0) {
    // Errore del contatore = si chiude, non si apre. Qui non c'e' nessun
    // cliente reale da proteggere da un falso positivo, e dall'altra parte
    // c'e' una bolletta.
    return NextResponse.json(
      {
        errore:
          "La demo ha finito le prove di questo mese e riparte il primo del mese prossimo. Il resto della pagina funziona lo stesso.",
      },
      { status: 429 }
    );
  }

  // Lo stato cambia dentro l'esecutore: si tiene qui e si rimanda indietro
  // al browser, che lo ripresentera' alla richiesta dopo. Nessuna riga
  // scritta da nessuna parte.
  let statoCorrente = stato;

  try {
    const risultato = await rispondiConversazione(
      storico,
      messaggio,
      {
        // `supabase` e `tenantId` non vengono usati da nessuno, perche'
        // `esegui` scavalca l'esecutore vero: restano perche' il tipo del
        // contesto li richiede. Il client admin e' quello gia' creato sopra,
        // cosi' non se ne apre un altro per niente.
        supabase: admin,
        tenantId: "demo",
        nomeAttivita: NOME_SALONE_DEMO,
        // Su Pro l'assistente conosce anche l'attivita': e' la differenza
        // che l'interruttore in pagina fa provare.
        haInformazioniAttivita: suPro,
        tonoAi: suPro ? "amichevole" : undefined,
        telefono: null,
        telefonoWhatsapp: null,
        strumentiConsentiti: [
          "elenca_servizi",
          "elenca_operatori",
          "info_orari",
          "verifica_disponibilita",
          "crea_prenotazione",
          "trasferisci_a_operatore",
          ...(suPro ? ["info_attivita"] : []),
        ],
        esegui: async (nome: NomeStrumento, input: Record<string, unknown>) => {
          const esito = eseguiStrumentoDemo(nome, input, statoCorrente, {
            haInformazioniAttivita: suPro,
          });
          if (esito.stato) statoCorrente = esito.stato;
          return esito.risultato;
        },
      },
      undefined,
      realeAPseudoUtc(new Date(), FUSO_ORARIO_DEMO)
    );

    return NextResponse.json({
      risposta: risultato.rispostaTesto,
      stato: statoCorrente,
      proveRimaste: restano,
    });
  } catch (errore) {
    console.error("[demo/chat] l'assistente non ha risposto:", errore);
    return NextResponse.json(
      { errore: "L'assistente della demo non è riuscito a rispondere. Riprova fra un attimo." },
      { status: 500 }
    );
  }
}
