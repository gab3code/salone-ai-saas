import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { inviaEmail } from "@/lib/email/mailjet.server";
import { escapeHtml, formattaOrario, urlBaseSito } from "@/lib/email/notifiche.server";
import { programmaMessaggioQstash } from "@/lib/qstash.server";
import {
  ORE_ATTESA_RICHIESTA_RECENSIONE,
  VALUTAZIONE_MASSIMA,
  VALUTAZIONE_MINIMA,
  LUNGHEZZA_MASSIMA_COMMENTO,
  LUNGHEZZA_MASSIMA_RISPOSTA_TITOLARE,
  calcolaMediaRecensioni,
  nomePubblicoRecensione,
  valutazioneValida,
  type RecensioneMedia,
} from "@/lib/recensioni";

type ClientAdmin = ReturnType<typeof creaClientAdmin>;

/** Le relazioni annidate di Supabase tornano oggetto singolo o array a seconda della
 * cardinalità dedotta -- stesso normalizzatore già usato altrove nel progetto. */
function uno<T>(v: unknown): T | null {
  return Array.isArray(v) ? ((v[0] as T) ?? null) : (v as T | null);
}

// ---------------------------------------------------------------------
// Programmazione (chiamata da creaAppuntamentoTenant subito dopo aver
// scritto l'appuntamento e mandato le notifiche di conferma -- Fase 3).
// ---------------------------------------------------------------------

/**
 * Programma su QStash l'invio della richiesta di recensione, `
 * ORE_ATTESA_RICHIESTA_RECENSIONE` ore dopo `fineReale` (istante reale di
 * fine dell'intero appuntamento/catena di servizi consecutivi). Fail-open
 * totale (try/catch qui + programmaMessaggioQstash già fail-open al suo
 * interno): chiamata da dentro `creaAppuntamentoTenant`, un problema qui non
 * deve MAI far sembrare fallita una prenotazione già scritta con successo,
 * stesso principio già applicato a `inviaNotificheNuovoAppuntamento`.
 *
 * Nessun controllo qui su `raccolta_recensioni_attiva` o sul canale di
 * contatto del cliente: il webhook che riceve il trigger 2 ore dopo
 * ricontrolla TUTTO da capo con dati freschi (il titolare potrebbe spegnere
 * l'interruttore nel frattempo, o l'appuntamento potrebbe essere cancellato)
 * -- stesso principio "il controllo che conta è quello autorevole al
 * momento dell'invio" già seguito da finestra-cancellazione.ts.
 */
export async function programmaRichiestaRecensione(tenantId: string, appuntamentoId: string, fineReale: Date): Promise<void> {
  try {
    const base = await urlBaseSito();
    if (!base) {
      console.error("[recensioni] URL base non determinabile: richiesta di recensione non programmata.", appuntamentoId);
      return;
    }
    const nonPrimaDi = new Date(fineReale.getTime() + ORE_ATTESA_RICHIESTA_RECENSIONE * 60 * 60 * 1000);
    await programmaMessaggioQstash(
      `${base}/api/webhooks/qstash/richiedi-recensione`,
      { tenantId, appuntamentoId },
      nonPrimaDi
    );
  } catch (errore) {
    console.error("[recensioni] Errore programmando la richiesta di recensione:", appuntamentoId, errore);
  }
}

// ---------------------------------------------------------------------
// Invio effettivo (chiamato dal webhook QStash, 2 ore dopo).
// ---------------------------------------------------------------------

export type EsitoRichiestaRecensione =
  | "inviata"
  | "gia_inviata" // claim perso: doppia consegna QStash o già gestito da un'altra esecuzione
  | "appuntamento_non_trovato"
  | "appuntamento_cancellato"
  | "raccolta_disattivata"
  | "cliente_senza_email"
  | "email_non_configurata";

/**
 * Punto autorevole: rivalida tutto da capo (mai fidarsi che fosse tutto a
 * posto 2 ore prima, al momento della programmazione) e reclama l'invio
 * PRIMA di mandare l'email con lo stesso lucchetto via update-condizionato
 * già usato in promemoria.server.ts (`recensione_richiesta_inviata_at`
 * null -> now(), vincolato dallo stesso where: se un'altra esecuzione
 * concorrente lo ha già reclamato, `data` torna vuoto e si salta senza
 * mandare due email).
 *
 * Link SOLO via email (mai SMS): stessa scelta di design già presa per il
 * link "gestisci la tua prenotazione" nei promemoria (un URL nudo in un SMS
 * aumenta il rischio phishing, vedi promemoria.server.ts) -- qui applicata
 * anche perché senza email non c'è comunque un canale sicuro per un link
 * "lascia una recensione" monouso.
 */
export async function elaboraRichiestaRecensione(
  admin: ClientAdmin,
  tenantId: string,
  appuntamentoId: string
): Promise<EsitoRichiestaRecensione> {
  const { data: appuntamento } = await admin
    .from("appuntamenti")
    .select(
      "id, tenant_id, stato, recensione_richiesta_inviata_at, clienti(nome, email), servizi(nome), tenants(nome, slug, raccolta_recensioni_attiva)"
    )
    .eq("id", appuntamentoId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!appuntamento) return "appuntamento_non_trovato";
  if (appuntamento.stato !== "confermato") return "appuntamento_cancellato";

  const tenant = uno<{ nome: string; slug: string; raccolta_recensioni_attiva: boolean }>(appuntamento.tenants);
  if (!tenant || !tenant.raccolta_recensioni_attiva) return "raccolta_disattivata";

  const cliente = uno<{ nome: string | null; email: string | null }>(appuntamento.clienti);
  if (!cliente?.email) return "cliente_senza_email";

  // Reclamo PRIMA di mandare l'email (vedi commento sopra): solo se ancora
  // null vince questa esecuzione.
  const { data: reclamato } = await admin
    .from("appuntamenti")
    .update({ recensione_richiesta_inviata_at: new Date().toISOString() })
    .eq("id", appuntamentoId)
    .is("recensione_richiesta_inviata_at", null)
    .select("id")
    .maybeSingle();
  if (!reclamato) return "gia_inviata";

  const base = await urlBaseSito();
  const link = base ? `${base}/recensisci/${appuntamentoId}` : null;
  if (!link) {
    console.error("[recensioni] URL base non determinabile al momento dell'invio:", appuntamentoId);
    return "email_non_configurata";
  }

  const servizio = uno<{ nome: string }>(appuntamento.servizi);
  const nomeCliente = cliente.nome ?? "";
  const rigaServizio = servizio?.nome ? ` per ${escapeHtml(servizio.nome)}` : "";

  const inviata = await inviaEmail({
    a: cliente.email,
    oggetto: `Com'è andata da ${tenant.nome}?`,
    nomeMittente: tenant.nome,
    html: `
      <p>Ciao ${escapeHtml(nomeCliente)},</p>
      <p>grazie per essere stato da <strong>${escapeHtml(tenant.nome)}</strong>${rigaServizio}.</p>
      <p>Ci racconti com'è andata? Bastano 30 secondi.</p>
      <p><a href="${link}">Lascia una recensione</a></p>
    `,
  });

  return inviata ? "inviata" : "email_non_configurata";
}

// ---------------------------------------------------------------------
// Lettura/scrittura per la dashboard (staff loggato).
// ---------------------------------------------------------------------

export interface RecensioneDashboard {
  id: string;
  clienteNome: string | null;
  servizioNome: string | null;
  valutazione: number;
  commento: string | null;
  rispostaTitolare: string | null;
  createdAt: string;
}

/**
 * Letta con il client AUTENTICATO del chiamante (RLS `isolamento_tabella`
 * fa comunque da rete di sicurezza finale): coerente con "authenticated ha
 * solo SELECT su questa tabella" della migrazione, lo staff può leggere le
 * proprie recensioni normalmente, semplicemente non può mai scriverci.
 */
export async function caricaRecensioniDashboard(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ recensioni: RecensioneDashboard[]; media: RecensioneMedia }> {
  const { data, error } = await supabase
    .from("recensioni")
    .select("id, valutazione, commento, risposta_titolare, created_at, clienti(nome), appuntamenti(servizi(nome))")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Errore caricando le recensioni: ${error.message}`);

  const righe = (data ?? []).map((r) => {
    const cliente = uno<{ nome: string | null }>(r.clienti);
    const appuntamento = uno<{ servizi: unknown }>(r.appuntamenti);
    const servizio = appuntamento ? uno<{ nome: string }>(appuntamento.servizi) : null;
    return {
      id: r.id,
      clienteNome: cliente?.nome ?? null,
      servizioNome: servizio?.nome ?? null,
      valutazione: r.valutazione,
      commento: r.commento,
      rispostaTitolare: r.risposta_titolare,
      createdAt: r.created_at,
    };
  });

  return { recensioni: righe, media: calcolaMediaRecensioni(righe.map((r) => r.valutazione)) };
}

/**
 * Aggiunge/aggiorna la risposta pubblica del titolare -- SOLO queste due
 * colonne, mai `valutazione`/`commento` (vedi 0026_recensioni.sql: il
 * titolare non ha comunque il permesso Postgres di scriverle, questo client
 * ADMIN bypassa RLS di proposito, quindi il vincolo "non tocca mai il
 * contenuto della recensione" è applicativo qui, non lasciato al database).
 * `tenantId` ricontrollato nel `.eq(...)`: un titolare non deve poter
 * rispondere alla recensione di un ALTRO tenant passando un id a caso.
 */
export async function rispondiRecensioneTenant(
  tenantId: string,
  recensioneId: string,
  risposta: string
): Promise<{ ok: true } | { ok: false; errore: string }> {
  const testo = risposta.trim();
  if (testo.length > LUNGHEZZA_MASSIMA_RISPOSTA_TITOLARE) {
    return { ok: false, errore: `La risposta può avere al massimo ${LUNGHEZZA_MASSIMA_RISPOSTA_TITOLARE} caratteri.` };
  }

  const admin = creaClientAdmin();
  const { data, error } = await admin
    .from("recensioni")
    .update({ risposta_titolare: testo || null, risposta_titolare_creato_at: testo ? new Date().toISOString() : null })
    .eq("id", recensioneId)
    .eq("tenant_id", tenantId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, errore: `Errore salvando la risposta: ${error.message}` };
  if (!data) return { ok: false, errore: "Recensione non trovata." };
  return { ok: true };
}

// ---------------------------------------------------------------------
// Pagina pubblica del salone (/s/[slug]).
// ---------------------------------------------------------------------

export interface RecensionePubblica {
  nomeCliente: string;
  valutazione: number;
  commento: string | null;
  rispostaTitolare: string | null;
  createdAt: string;
}

/**
 * `null` se l'interruttore è spento (la pagina pubblica non mostra affatto
 * la sezione, non solo una lista vuota) -- letta con il client ADMIN come
 * il resto del profilo pubblico (pagina-pubblica.server.ts): un visitatore
 * anonimo non ha un utente Supabase Auth dietro, quindi RLS (che qui dà
 * comunque solo SELECT ad "authenticated") non lo farebbe passare.
 */
export async function caricaRecensioniPubbliche(
  admin: ClientAdmin,
  tenantId: string
): Promise<{ recensioni: RecensionePubblica[]; media: RecensioneMedia } | null> {
  const { data: tenant } = await admin.from("tenants").select("raccolta_recensioni_attiva").eq("id", tenantId).single();
  if (!tenant?.raccolta_recensioni_attiva) return null;

  const { data, error } = await admin
    .from("recensioni")
    .select("valutazione, commento, risposta_titolare, created_at, clienti(nome)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[recensioni] Errore caricando le recensioni pubbliche:", tenantId, error);
    return { recensioni: [], media: { media: null, totale: 0 } };
  }

  const righe = (data ?? []).map((r) => {
    const cliente = uno<{ nome: string | null }>(r.clienti);
    return {
      nomeCliente: nomePubblicoRecensione(cliente?.nome ?? null),
      valutazione: r.valutazione,
      commento: r.commento,
      rispostaTitolare: r.risposta_titolare,
      createdAt: r.created_at,
    };
  });

  return { recensioni: righe, media: calcolaMediaRecensioni(righe.map((r) => r.valutazione)) };
}

// ---------------------------------------------------------------------
// Invio della recensione dal link (visitatore anonimo, /recensisci/[id]).
// ---------------------------------------------------------------------

/**
 * Verifica-visita (richiesta esplicita di Gabriel, "come booking.com"):
 * `appuntamentoId` arriva SOLO dal link mandato via email da
 * `elaboraRichiestaRecensione`, quindi solo a un cliente che ha davvero
 * ricevuto il servizio (appuntamento confermato, non cancellato) --
 * l'esistenza stessa della riga e il suo stato sono la verifica, non serve
 * altro (stesso modello di sicurezza già usato dal link "gestisci la tua
 * prenotazione": id UUID v4 imprevedibile, mai un login separato per il
 * cliente finale).
 */
export async function inserisciRecensionePubblica(
  appuntamentoId: string,
  valutazione: number,
  commento: string
): Promise<{ ok: true } | { ok: false; errore: string }> {
  if (!valutazioneValida(valutazione)) {
    return { ok: false, errore: `La valutazione deve essere un numero intero tra ${VALUTAZIONE_MINIMA} e ${VALUTAZIONE_MASSIMA}.` };
  }
  const testoCommento = commento.trim();
  if (testoCommento.length > LUNGHEZZA_MASSIMA_COMMENTO) {
    return { ok: false, errore: `Il commento può avere al massimo ${LUNGHEZZA_MASSIMA_COMMENTO} caratteri.` };
  }

  const admin = creaClientAdmin();

  const { data: appuntamento } = await admin
    .from("appuntamenti")
    .select("id, tenant_id, cliente_id, stato")
    .eq("id", appuntamentoId)
    .maybeSingle();
  if (!appuntamento) return { ok: false, errore: "Prenotazione non trovata: controlla di aver aperto il link corretto." };
  if (appuntamento.stato === "cancellato") {
    return { ok: false, errore: "Questa prenotazione è stata cancellata, non è possibile lasciare una recensione." };
  }

  // Controllo di cortesia PRIMA di scrivere (messaggio chiaro): il vincolo
  // unique su appuntamento_id resta comunque la vera difesa contro un
  // doppio invio in corsa (stesso schema del vincolo niente_sovrapposizioni
  // sulle prenotazioni).
  const { data: esistente } = await admin
    .from("recensioni")
    .select("id")
    .eq("appuntamento_id", appuntamentoId)
    .maybeSingle();
  if (esistente) return { ok: false, errore: "Hai già lasciato una recensione per questo appuntamento." };

  const { error } = await admin.from("recensioni").insert({
    tenant_id: appuntamento.tenant_id,
    appuntamento_id: appuntamentoId,
    cliente_id: appuntamento.cliente_id,
    valutazione,
    commento: testoCommento || null,
  });

  if (error) {
    // 23505 = unique_violation: stessa race gestita altrove nel progetto
    // (vedi promemoria_appuntamento_inviati) -- un secondo invio quasi
    // simultaneo (doppio click, due tab) non deve mostrare un errore
    // Postgres grezzo.
    if (error.code === "23505") return { ok: false, errore: "Hai già lasciato una recensione per questo appuntamento." };
    return { ok: false, errore: `Errore salvando la recensione: ${error.message}` };
  }

  return { ok: true };
}

/** Solo per mostrare il contesto (nome attività, servizio, quando) nella
 * pagina di invio recensione, prima che il cliente scelga le stelle. */
export interface ContestoRecensione {
  tenantNome: string;
  servizioNome: string | null;
  quando: string;
  giaRecensito: boolean;
  appuntamentoCancellato: boolean;
}

export async function caricaContestoRecensione(appuntamentoId: string): Promise<ContestoRecensione | null> {
  const admin = creaClientAdmin();
  const { data: appuntamento } = await admin
    .from("appuntamenti")
    .select("id, tenant_id, inizio, stato, servizi(nome), tenants(nome)")
    .eq("id", appuntamentoId)
    .maybeSingle();
  if (!appuntamento) return null;

  const tenant = uno<{ nome: string }>(appuntamento.tenants);
  const servizio = uno<{ nome: string }>(appuntamento.servizi);
  const fusoOrario = await caricaFusoOrarioTenant(admin, appuntamento.tenant_id);
  const quando = formattaOrario(new Date(appuntamento.inizio), fusoOrario);

  const { data: esistente } = await admin.from("recensioni").select("id").eq("appuntamento_id", appuntamentoId).maybeSingle();

  return {
    tenantNome: tenant?.nome ?? "Salone AI",
    servizioNome: servizio?.nome ?? null,
    quando,
    giaRecensito: !!esistente,
    appuntamentoCancellato: appuntamento.stato === "cancellato",
  };
}
