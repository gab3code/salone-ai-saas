import "server-only";
import { preparaOrariPerIlModello } from "./proposta-orari";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  trovaSlotEStatoGiornoTenant,
  creaAppuntamentoTenant,
  modificaAppuntamentoTenant,
  cancellaAppuntamentoTenant,
  aggiungiListaAttesaTenant,
  parsaOrarioLocale,
} from "@/lib/booking-engine.server";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { caricaImportoCaparraServizio, avviaPagamentoCaparraTenant } from "@/lib/stripe/caparra.server";
import { nomeGiornoSettimana } from "@/lib/ai/giorni-settimana";

/**
 * Strumenti che l'AI receptionist (Fase 2) usa per agire sul booking engine
 * reale -- MAI logica di prenotazione reimplementata qui, solo wrapping
 * delle stesse funzioni che usa già la dashboard (`booking-engine.server.ts`,
 * `creaAppuntamentoTenant`/`modificaAppuntamentoTenant`/
 * `cancellaAppuntamentoTenant`), con lo stesso client admin/service_role per
 * tutti gli strumenti -- CLAUDE.md punto 9: "AI e calendario devono
 * utilizzare la stessa booking engine, non voglio due sistemi separati".
 *
 * Punto 7 di CLAUDE.md: "L'AI NON DEVE INVENTARE DATI" -- ogni strumento
 * qui sotto legge/scrive SEMPRE dal database vero e restituisce solo dati
 * realmente esistenti (mai un valore plausibile inventato dal modello). Il
 * loop di tool-calling (Task #66, non ancora costruito) deve girare in un
 * ciclo MESSAGGIO -> AI -> intent -> tool -> backend -> database -> risultato
 * -> AI -> risposta, mai lasciare che l'AI risponda su disponibilità/prezzi/
 * orari senza aver chiamato lo strumento corrispondente.
 *
 * Ogni funzione qui prende `ContestoStrumento` (client admin già
 * autenticato service_role + tenantId già risolto da slug pubblico -- un
 * visitatore anonimo del sito non ha mai un utente Supabase dietro, quindi
 * niente `ottieniTenantCorrente`, che dipende da `auth.getUser()`).
 */

export interface ContestoStrumento {
  supabase: SupabaseClient;
  tenantId: string;
  /**
   * Chi esegue gli strumenti (17/09/2026). Assente = `eseguiStrumento`,
   * cioe' il comportamento di sempre: per ogni salone vero qui non cambia
   * niente.
   *
   * Esiste per la demo pubblica, che ha gli stessi strumenti ma dati finti e
   * nessun database (`src/lib/demo/strumenti-demo.ts`). E' un parametro e non
   * un ramo `if (demo)` dentro `eseguiStrumento` perche' quel ramo metterebbe
   * la demo dentro il percorso di ogni cliente pagante, cioe' il posto in cui
   * un errore costa di piu'.
   */
  esegui?: (
    nome: NomeStrumento,
    input: Record<string, unknown>,
    ctx: ContestoStrumento
  ) => Promise<Record<string, unknown>>;
  // Necessari SOLO a crea_prenotazione quando l'attività richiede una
  // caparra (Fase 6, bug trovato dal vivo il 15/09/2026: l'AI creava la
  // prenotazione confermata bypassando completamente la caparra, a
  // differenza del form pubblico manuale in azioni.ts) -- servono per
  // costruire l'URL della Stripe Checkout Session (success/cancel), risolti
  // da chi chiama (route.ts) dalla richiesta HTTP in corso, mai indovinati
  // qui. Opzionali per non forzare ogni altro chiamante/test a fornirli
  // quando non servono (praticamente tutti gli altri strumenti, e anche
  // crea_prenotazione per i tenant senza caparra attiva).
  slug?: string;
  origin?: string;
  /**
   * Numero di telefono di cui il CANALE garantisce il possesso -- non quello
   * che il visitatore dichiara in chat.
   *
   * Su WhatsApp coincide con il mittente del messaggio: è il canale stesso a
   * provare che quel numero è suo. Nella chat del sito non esiste niente del
   * genere, quindi resta `undefined`: chiunque può aprire /s/<slug> e
   * scrivere il numero di un'altra persona.
   *
   * Da questa distinzione dipendono tre strumenti (cercare, spostare e
   * cancellare le prenotazioni di un cliente). Prima del 17/09/2026 non
   * esisteva: quegli strumenti si fidavano del numero dettato in chat, e un
   * visitatore anonimo poteva farsi leggere nome e appuntamenti di chiunque
   * e poi cancellarglieli. La regola adesso è: **un'identità dichiarata non
   * è un'identità verificata**, e il prodotto tratta le due cose in modo
   * diverso.
   */
  telefonoVerificato?: string | null;
}

/**
 * Risposta unica quando uno strumento tocca i dati di un cliente e il canale
 * non ne prova l'identità. È volutamente identica a prescindere dal fatto
 * che quel numero esista o no fra i clienti del salone: rispondere "non
 * trovato" per un numero e "riservato" per un altro direbbe comunque a un
 * estraneo chi è cliente di quel salone.
 */
const RISPOSTA_RISERVATA = {
  riservato: true,
  spiegazione:
    "In questa chat non posso leggere, spostare o cancellare le prenotazioni di un cliente: chiunque potrebbe scrivere il numero di un'altra persona. Di' al cliente che il link per spostare o cancellare è nella mail di conferma e nel promemoria che ha ricevuto, e se non lo trova proponi di passare la conversazione a una persona del salone.",
} as const;

/** L'appuntamento indicato appartiene davvero al cliente con quel telefono? */
async function appuntamentoDelTelefono(
  supabase: SupabaseClient,
  tenantId: string,
  appuntamentoId: string,
  telefono: string
): Promise<boolean> {
  const { data } = await supabase
    .from("appuntamenti")
    .select("id, clienti!inner(telefono)")
    .eq("tenant_id", tenantId)
    .eq("id", appuntamentoId)
    .maybeSingle();
  const cliente = data?.clienti as unknown as { telefono: string | null } | null;
  return !!cliente && cliente.telefono === telefono;
}

/**
 * Risolve il tenant dal quale il visitatore sta chattando/prenotando (slug
 * della pagina pubblica). Un solo retry dopo una breve pausa SOLO se la
 * query è fallita con un errore vero (rete/timeout verso Supabase, non uno
 * "slug inesistente" -- quel caso ha `error === null` e va rifiutato subito,
 * un retry lì rallenterebbe inutilmente ogni URL sbagliato/scanner senza
 * mai risolvere nulla). Aggiunto 14/09/2026 dopo aver visto dal vivo un
 * primo tentativo fallire con "Attività non trovata" su uno slug valido e
 * il retry immediato (manuale, stesso slug) riuscire subito dopo -- sintomo
 * di un blip di rete/cold-start verso Supabase, non un bug applicativo.
 * Un solo retry basta a coprire un blip isolato senza mascherare un
 * problema persistente (che continuerebbe a fallire anche al secondo giro
 * e finirebbe comunque nel log sottostante).
 */
export async function risolviTenantDaSlug(
  supabase: SupabaseClient,
  slug: string
): Promise<{ id: string; sospesa: boolean } | null> {
  const colonne = "id, sospesa";
  let { data, error } = await supabase.from("tenants").select(colonne).eq("slug", slug).maybeSingle();
  if (error) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    ({ data, error } = await supabase.from("tenants").select(colonne).eq("slug", slug).maybeSingle());
  }
  if (error) {
    // Non silenziare un errore reale (es. service_role key mancante/errata) dietro
    // un fuorviante "tenant non trovato": logghiamo per capire davvero cosa è successo.
    console.error("Errore risolvendo il tenant dallo slug (anche dopo un retry):", slug, error);
  }
  if (!data) return null;
  return { id: data.id as string, sospesa: Boolean(data.sospesa) };
}

export async function risolviTenantIdDaSlug(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null> {
  return (await risolviTenantDaSlug(supabase, slug))?.id ?? null;
}

/**
 * Messaggio mostrato al CLIENTE FINALE quando un'attività è sospesa
 * (migrazione 0029). Volutamente neutro: il cliente del salone non c'entra
 * niente con il motivo della sospensione, e non deve leggere sulla pagina
 * pubblica che il suo parrucchiere non ha pagato l'abbonamento.
 */
export const MESSAGGIO_ATTIVITA_SOSPESA =
  "Le prenotazioni online non sono al momento disponibili. Contatta direttamente l'attività.";

// Parsing dell'orario che arriva dall'AI ("2026-09-05T15:00", senza fuso):
// stessa funzione condivisa e validata in modo rigido usata dalla dashboard
// -- vedi `parsaOrarioLocale` in booking-engine.server.ts per il perché
// della validazione rigida (il parser lenient di V8 altrimenti accetta
// stringhe non-ISO senza senso invece di restituire NaN). Non duplicata qui.

// ---------------------------------------------------------------------
// Tool schema in formato compatibile con l'Anthropic Messages API
// (`tools: [...]` nella richiesta) -- il loop vero e proprio (Task #66)
// importerà questo elenco così com'è.
// ---------------------------------------------------------------------

export const STRUMENTI_AI = [
  {
    name: "elenca_servizi",
    description:
      "Elenca i servizi realmente offerti da questa attività, con durata e prezzo. Usalo prima di proporre un servizio: non inventare mai nomi, durate o prezzi.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "elenca_operatori",
    description:
      "Elenca gli operatori/professionisti attivi in questa attività, con un'eventuale descrizione/specializzazione se il titolare l'ha configurata.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "info_orari",
    description: "Restituisce gli orari di apertura reali per ogni giorno della settimana.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "verifica_disponibilita",
    description:
      "Verifica gli slot orari REALMENTE disponibili per uno o più servizi (consecutivi) in una data, opzionalmente per un operatore specifico. Chiamalo sempre prima di proporre un orario al cliente: non inventare mai una disponibilità. Il risultato include giorno_chiuso: se true, l'attività è semplicemente chiusa quel giorno (nessuno slot esisterà mai lì, anche in futuro) -- diverso da un giorno aperto ma senza slot liberi, dove invece ha senso proporre la lista d'attesa (vedi aggiungi_lista_attesa). Il risultato include anche giorno_settimana_richiesto: il vero nome del giorno della settimana per la data passata. USA SEMPRE ESATTAMENTE questo valore quando dici al cliente che giorno hai controllato (es. 'chiusi domenica 20 settembre') -- non ricalcolarlo tu, è facile sbagliare a mente quale giorno della settimana cade su una data e questo causerebbe una risposta falsa rispetto agli orari reali.",
    input_schema: {
      type: "object",
      properties: {
        servizio_ids: {
          type: "array",
          items: { type: "string" },
          description: "Uno o più id di servizio (più di uno = servizi consecutivi nello stesso appuntamento).",
        },
        data: { type: "string", description: "Data nel formato YYYY-MM-DD." },
        operatore_id: { type: "string", description: "Opzionale: id dell'operatore richiesto." },
      },
      required: ["servizio_ids", "data"],
    },
  },
  {
    name: "cerca_prenotazioni_cliente",
    description:
      "Cerca le prenotazioni future del cliente con cui stai parlando. Funziona SOLO su canali in cui il numero di chi scrive è garantito dal canale stesso (WhatsApp). Nella chat del sito restituisce sempre una risposta riservata, qualunque numero venga dettato: in quel caso non insistere e non riprovare con un altro numero, di\u2019 al cliente che il link per spostare o cancellare è nella mail di conferma e nel promemoria, e offriti di passarlo a una persona del salone.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "crea_prenotazione",
    description:
      "Crea una prenotazione reale sul calendario, dopo aver verificato la disponibilità con verifica_disponibilita e dopo aver raccolto nome E telefono del cliente (chiedili entrambi se non li conosci già in questa conversazione, non solo il telefono). Se il cliente non esiste ancora, viene creato automaticamente. Passa più id in servizio_ids (nello stesso ordine con cui il cliente li vuole) per prenotare servizi consecutivi con lo stesso operatore nello stesso appuntamento -- stessi id già usati in verifica_disponibilita. Se questa attività richiede una caparra per confermare (non tutte la richiedono), lo strumento NON crea la prenotazione subito: restituisce invece richiede_pagamento=true con un url_pagamento e l'importo in euro -- la prenotazione vera si conferma da sola automaticamente al pagamento, non richiamare questo strumento dopo aver condiviso il link. La caparra oggi non è supportata su una catena di più servizi: se l'attività la richiede e il cliente vuole più servizi consecutivi, prenotali uno alla volta oppure invitalo a contattare l'attività direttamente.",
    input_schema: {
      type: "object",
      properties: {
        servizio_ids: {
          type: "array",
          items: { type: "string" },
          description: "Uno o più id di servizio (più di uno = servizi consecutivi nello stesso appuntamento, stesso operatore).",
        },
        operatore_id: { type: "string" },
        inizio: { type: "string", description: "Data e ora di inizio, formato YYYY-MM-DDTHH:MM." },
        cliente_nome: { type: "string" },
        cliente_telefono: { type: "string" },
        note: { type: "string" },
      },
      required: ["servizio_ids", "operatore_id", "inizio", "cliente_nome", "cliente_telefono"],
    },
  },
  {
    name: "modifica_prenotazione",
    description: "Sposta una prenotazione esistente su un nuovo orario e/o operatore.",
    input_schema: {
      type: "object",
      properties: {
        appuntamento_id: { type: "string" },
        operatore_id: { type: "string" },
        inizio: { type: "string", description: "Nuova data/ora, formato YYYY-MM-DDTHH:MM." },
      },
      required: ["appuntamento_id", "operatore_id", "inizio"],
    },
  },
  {
    name: "cancella_prenotazione",
    description: "Cancella una prenotazione esistente (dopo aver verificato con il cliente di cosa si tratta).",
    input_schema: {
      type: "object",
      properties: { appuntamento_id: { type: "string" } },
      required: ["appuntamento_id"],
    },
  },
  {
    name: "aggiungi_lista_attesa",
    description:
      "Iscrive il cliente alla lista d'attesa per un servizio, da usare SOLO dopo che verifica_disponibilita non ha trovato nessuno slot per quello che il cliente chiedeva E il giorno NON è giorno_chiuso. Se il giorno richiesto risulta chiuso (giorno_chiuso=true), non ha senso iscrivere in lista d'attesa per quella data precisa (l'attività non lavora mai quel giorno): di' al cliente che è chiuso quel giorno e proponi un'altra data, oppure iscrivilo alla lista d'attesa omettendo data_preferita (qualunque giorno andrà bene) o indicandone una diversa in cui l'attività è aperta. Se in seguito si libera un posto adatto (es. per una cancellazione), il salone lo contatta -- non è una prenotazione, non blocca nessuno slot.",
    input_schema: {
      type: "object",
      properties: {
        servizio_id: { type: "string" },
        operatore_id: { type: "string", description: "Opzionale: solo se il cliente vuole proprio quell'operatore." },
        data_preferita: {
          type: "string",
          description:
            "Opzionale, formato YYYY-MM-DD: solo se il cliente ha in mente un giorno preciso. Se qualunque giorno va bene, ometti questo campo.",
        },
        cliente_nome: { type: "string" },
        cliente_telefono: { type: "string" },
        note: { type: "string" },
      },
      required: ["servizio_id", "cliente_telefono"],
    },
  },
  {
    name: "info_attivita",
    description:
      "Restituisce informazioni generali sull'attività non legate a un servizio specifico: descrizione, indirizzo, parcheggio, metodi di pagamento, politica di cancellazione, un contatto diretto, e le domande frequenti (FAQ) configurate dal titolare. Usalo per domande come 'avete parcheggio?', 'accettate carte?', 'come funziona la cancellazione?', o qualunque altra domanda generale sull'attività -- servizi/prezzi/durate/orari/disponibilità hanno i loro strumenti dedicati, non usare questo per quelli. Se un campo del risultato è assente o vuoto, quell'informazione non è disponibile: dillo onestamente, non inventarla.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "trasferisci_a_operatore",
    description:
      "Segnala (solo internamente, per le statistiche del titolare) che questa richiesta va oltre quello che puoi risolvere -- usalo quando è ambigua oltre le tue possibilità, il cliente lo chiede esplicitamente, o serve un giudizio che non puoi dare da solo. NON avvisa davvero nessun operatore umano, oggi questo canale non esiste: dopo averlo chiamato tocca comunque a te, nella tua risposta di testo, invitare il cliente a contattare l'attività direttamente (vedi REGOLA ASSOLUTA 9) -- non dire mai che qualcuno lo ricontatterà.",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Breve motivo del passaggio, utile all'operatore umano." },
      },
      required: ["motivo"],
    },
  },
] as const;

export type NomeStrumento = (typeof STRUMENTI_AI)[number]["name"];

// Tutti gli id in questo schema sono uuid generati dal database (mai scelti
// dal chiamante) -- una validazione di formato PRIMA di interrogare il
// database trasforma un errore Postgres criptico ("invalid input syntax for
// type uuid") in un messaggio che l'AI può capire e correggere da sola nello
// stesso turno (es. ha passato il NOME del servizio invece del suo id).
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function eUuidValido(valore: unknown): valore is string {
  return typeof valore === "string" && FORMATO_UUID.test(valore);
}

const FORMATO_DATA_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Esegue lo strumento richiesto dal modello e restituisce SEMPRE un oggetto
 * serializzabile (mai un'eccezione non gestita) -- il loop di tool-calling
 * lo passa indietro al modello come risultato del tool_use, errore incluso:
 * un errore reale ("slot occupato", "servizio non trovato") è informazione
 * utile all'AI per rispondere onestamente, non un caso da nascondere.
 */
export async function eseguiStrumento(
  nome: NomeStrumento,
  input: Record<string, unknown>,
  ctx: ContestoStrumento
): Promise<Record<string, unknown>> {
  // Le funzioni di booking-engine.server.ts LANCIANO su errore (contratto
  // corretto per la dashboard, dove un umano vede una pagina d'errore e
  // riprova) -- ma qui romperebbero la promessa di questa funzione e
  // farebbero fallire l'intera richiesta HTTP della chat con un 500, invece
  // di lasciare che l'AI legga l'errore e si corregga da sola nello stesso
  // turno (es. un id di servizio sbagliato passato dal modello invece
  // dell'id vero restituito da elenca_servizi -- visto dal vivo il
  // 02/09/2026: "invalid input syntax for type uuid" su un nome anziché un
  // id). Da qui in giù: mai lasciar scappare un'eccezione non gestita.
  try {
    return await eseguiStrumentoInterno(nome, input, ctx);
  } catch (errore) {
    console.error(`Errore eseguendo lo strumento "${nome}":`, errore);
    return {
      errore:
        "Si è verificato un problema tecnico eseguendo questa operazione. Riprova, e se il problema persiste passa la conversazione a un operatore.",
    };
  }
}

async function eseguiStrumentoInterno(
  nome: NomeStrumento,
  input: Record<string, unknown>,
  ctx: ContestoStrumento
): Promise<Record<string, unknown>> {
  const { supabase, tenantId } = ctx;

  switch (nome) {
    case "elenca_servizi": {
      const { data, error } = await supabase
        .from("servizi")
        .select("id, nome, descrizione, categoria, durata_minuti, prezzo_centesimi")
        .eq("tenant_id", tenantId)
        .eq("attivo", true)
        .order("nome");
      if (error) return { errore: error.message };
      return {
        servizi: (data ?? []).map((s) => ({
          id: s.id,
          nome: s.nome,
          descrizione: s.descrizione,
          categoria: s.categoria,
          durata_minuti: s.durata_minuti,
          prezzo_euro: s.prezzo_centesimi / 100,
        })),
      };
    }

    case "elenca_operatori": {
      const { data, error } = await supabase
        .from("operatori")
        .select("id, nome, ruolo, descrizione")
        .eq("tenant_id", tenantId)
        .eq("attivo", true)
        .order("nome");
      if (error) return { errore: error.message };
      return { operatori: data ?? [] };
    }

    case "info_orari": {
      const { data, error } = await supabase
        .from("orari_apertura")
        .select("giorno_settimana, chiuso, apertura, chiusura, pausa_inizio, pausa_fine")
        .eq("tenant_id", tenantId)
        .order("giorno_settimana");
      if (error) return { errore: error.message };
      return { orari: data ?? [] };
    }

    case "verifica_disponibilita": {
      const servizioIds = input.servizio_ids;
      const dataStr = input.data;
      if (!Array.isArray(servizioIds) || servizioIds.length === 0 || typeof dataStr !== "string") {
        return { errore: "servizio_ids e data sono obbligatori." };
      }
      if (!servizioIds.every(eUuidValido)) {
        return {
          errore:
            "servizio_ids deve contenere gli id esatti (uuid) restituiti da elenca_servizi, non i nomi dei servizi. Chiama prima elenca_servizi se non li hai già.",
        };
      }
      if (input.operatore_id !== undefined && !eUuidValido(input.operatore_id)) {
        return { errore: "operatore_id deve essere l'id esatto (uuid) restituito da elenca_operatori." };
      }
      const data = new Date(`${dataStr}T00:00:00Z`);
      if (Number.isNaN(data.getTime())) return { errore: "Data non valida, usa il formato YYYY-MM-DD." };

      const { slot, giornoChiuso } = await trovaSlotEStatoGiornoTenant(supabase, tenantId, {
        data,
        servizioIds: servizioIds as string[],
        operatoreId: typeof input.operatore_id === "string" ? input.operatore_id : undefined,
      });
      // Gli orari arrivano al modello GIA' PRONTI DA SCRIVERE, non come
      // timestamp da riformattare: vedi proposta-orari.ts per il caso vero
      // che ha portato a questa scelta (quaranta slot ISO, e il modello che
      // se li riassume inventando una lista che comprendeva la pausa
      // pranzo). Ogni trasformazione chiesta al modello e' un'occasione di
      // sbagliare, e quella gliel'avevamo creata noi.
      //
      // `fine` non c'e' piu': il modello non l'ha mai usata (la durata la
      // sa dal servizio) e quaranta timestamp in piu' erano solo contesto da
      // pagare a ogni chiamata successiva del turno.
      const perIlModello = preparaOrariPerIlModello(
        slot.map((s) => ({ inizio: s.inizio.toISOString(), operatoreId: s.operatoreId }))
      );
      return {
        ...perIlModello,
        slot: slot.map((s) => ({
          inizio: s.inizio.toISOString(),
          operatore_id: s.operatoreId,
        })),
        giorno_chiuso: giornoChiuso,
        giorno_settimana_richiesto: nomeGiornoSettimana(data),
      };
    }

    case "cerca_prenotazioni_cliente": {
      // Il numero NON si prende dall'input: si prende dal canale, e solo se
      // il canale lo garantisce. Quello dettato in chat resta ignorato anche
      // quando c'è -- altrimenti basterebbe dettarne un altro.
      const telefono = ctx.telefonoVerificato?.trim();
      if (!telefono) return RISPOSTA_RISERVATA;

      const { data: cliente } = await supabase
        .from("clienti")
        .select("id, nome")
        .eq("tenant_id", tenantId)
        .eq("telefono", telefono)
        .maybeSingle();
      if (!cliente) return { trovato: false, prenotazioni: [] };

      const { data: appuntamenti, error } = await supabase
        .from("appuntamenti")
        .select("id, inizio, fine, stato, servizi(nome), operatori(nome)")
        .eq("tenant_id", tenantId)
        .eq("cliente_id", cliente.id)
        .eq("stato", "confermato")
        .gte("inizio", new Date().toISOString())
        .order("inizio");
      if (error) return { errore: error.message };

      // `inizio`/`fine` in colonna sono istanti reali (timestamptz):
      // convertiti qui all'ora civile del salone prima di restituirli
      // all'AI, che li ripete al cliente come se fossero già l'ora giusta
      // da leggere -- mai un istante reale grezzo in una risposta in chat.
      const fusoOrario = await caricaFusoOrarioTenant(supabase, tenantId);
      return {
        trovato: true,
        cliente_nome: cliente.nome,
        prenotazioni: (appuntamenti ?? []).map((a) => ({
          id: a.id,
          inizio: realeAPseudoUtc(new Date(a.inizio), fusoOrario).toISOString(),
          fine: realeAPseudoUtc(new Date(a.fine), fusoOrario).toISOString(),
          // Le relazioni Supabase su chiave singola tornano un oggetto, non un array.
          servizio: (a.servizi as unknown as { nome: string } | null)?.nome ?? null,
          operatore: (a.operatori as unknown as { nome: string } | null)?.nome ?? null,
        })),
      };
    }

    case "crea_prenotazione": {
      const { servizio_ids, operatore_id, inizio, cliente_nome, cliente_telefono, note } = input as Record<
        string,
        unknown
      >;
      if (
        !Array.isArray(servizio_ids) ||
        servizio_ids.length === 0 ||
        typeof operatore_id !== "string" ||
        typeof inizio !== "string" ||
        typeof cliente_telefono !== "string"
      ) {
        return { errore: "servizio_ids, operatore_id, inizio e cliente_telefono sono obbligatori." };
      }
      // Nome obbligatorio (non solo il telefono): richiesta di Gabriel dal
      // vivo 15/09/2026, vedi DECISIONS.md -- prima di generare qualunque
      // prenotazione (a maggior ragione un link di pagamento vero per la
      // caparra) l'AI deve aver raccolto anche il nome, non solo il
      // telefono, invece di lasciare un cliente "senza nome" nello storico e
      // nella richiesta di pagamento.
      if (typeof cliente_nome !== "string" || !cliente_nome.trim()) {
        return { errore: "cliente_nome è obbligatorio: chiedi il nome del cliente prima di procedere." };
      }
      if (!servizio_ids.every(eUuidValido) || !eUuidValido(operatore_id)) {
        return {
          errore:
            "servizio_ids e operatore_id devono essere gli id esatti (uuid) restituiti da elenca_servizi/elenca_operatori, non i loro nomi.",
        };
      }
      const inizioData = parsaOrarioLocale(inizio);
      if (!inizioData) return { errore: "inizio non valido, usa il formato YYYY-MM-DDTHH:MM." };

      // Gate caparra (Fase 6, bug trovato dal vivo il 15/09/2026, vedi
      // DECISIONS.md): PRIMA di creare qualunque cosa, controlla se questa
      // attività la richiede -- se sì, NON confermare mai direttamente,
      // stesso comportamento del form pubblico manuale
      // (src/app/s/[slug]/azioni.ts, prenotaPubblico) tramite la stessa
      // funzione condivisa (src/lib/stripe/caparra.server.ts): un'unica
      // fonte di verità, l'AI non deve avere una scappatoia che il form non
      // ha. `caparra_attiva` è un interruttore per TENANT, non per servizio
      // (vedi caricaImportoCaparraServizio): basta controllarlo sul primo
      // servizio della lista per sapere se questa attività la richiede.
      // Servizi consecutivi + caparra NON è supportato in questo giro
      // (sommare/dividere un pagamento anticipato su più servizi è una
      // decisione di prodotto a parte, vedi DECISIONS.md 16/09/2026): se
      // richiesta e la catena ha più di un servizio, si chiede di prenotarli
      // uno alla volta invece di gestire male i soldi del cliente.
      const importoCaparra = await caricaImportoCaparraServizio(supabase, tenantId, servizio_ids[0]);
      if (importoCaparra === null) {
        // Non si e' potuto leggere se questa attivita' chiede una caparra:
        // non si prenota alla cieca (vedi caparra.server.ts).
        return { errore: "Non riesco a verificare le condizioni di prenotazione adesso. Riprova fra poco." };
      }
      if (importoCaparra > 0 && servizio_ids.length > 1) {
        return {
          errore:
            "Questa attività richiede una caparra e oggi non posso prenotare più servizi consecutivi con pagamento anticipato in un colpo solo. Prenota un servizio alla volta, oppure invita il cliente a contattare l'attività direttamente per più servizi insieme.",
        };
      }
      if (importoCaparra > 0) {
        if (!ctx.slug || !ctx.origin) {
          // Non dovrebbe mai succedere in produzione (route.ts li passa
          // sempre) -- se succede, meglio un errore esplicito che lasciare
          // che l'AI catturi un'eccezione o, peggio, confermi comunque senza
          // pagamento.
          console.error(
            "crea_prenotazione: caparra richiesta ma slug/origin mancanti nel ContestoStrumento (tenant",
            tenantId,
            ")"
          );
          return {
            errore:
              "Impossibile avviare il pagamento della caparra in questo momento. Riprova, e se il problema persiste passa la conversazione a un operatore.",
          };
        }
        const risultatoCaparra = await avviaPagamentoCaparraTenant(supabase, {
          tenantId,
          slug: ctx.slug,
          origin: ctx.origin,
          servizioId: servizio_ids[0],
          operatoreId: operatore_id,
          inizio: inizioData,
          inizioIso: inizio,
          clienteNome: cliente_nome,
          clienteTelefono: cliente_telefono,
        });
        if (!risultatoCaparra.ok) return { errore: risultatoCaparra.errore };
        return {
          richiede_pagamento: true,
          url_pagamento: risultatoCaparra.checkoutUrl,
          importo_caparra_euro: risultatoCaparra.importoCentesimi / 100,
        };
      }

      const risultato = await creaAppuntamentoTenant(supabase, tenantId, {
        servizioId: servizio_ids,
        operatoreId: operatore_id,
        inizio: inizioData,
        clienteNome: cliente_nome,
        clienteTelefono: cliente_telefono,
        creatoDa: "ai",
        note: typeof note === "string" ? note : undefined,
      });
      if (!risultato.ok) return { errore: risultato.errore };
      return { creato: true, appuntamento_id: risultato.appuntamentoId };
    }

    case "modifica_prenotazione": {
      const { appuntamento_id, operatore_id, inizio } = input as Record<string, unknown>;
      if (typeof appuntamento_id !== "string" || typeof operatore_id !== "string" || typeof inizio !== "string") {
        return { errore: "appuntamento_id, operatore_id e inizio sono obbligatori." };
      }
      if (!eUuidValido(appuntamento_id) || !eUuidValido(operatore_id)) {
        return {
          errore:
            "appuntamento_id e operatore_id devono essere gli id esatti (uuid) restituiti dagli altri strumenti (es. cerca_prenotazioni_cliente, elenca_operatori), non nomi o descrizioni.",
        };
      }
      const inizioData = parsaOrarioLocale(inizio);
      if (!inizioData) return { errore: "inizio non valido, usa il formato YYYY-MM-DDTHH:MM." };

      // Appartenenza al tenant non basta: senza questo controllo, un id
      // valido (indovinato o ottenuto altrove) lascerebbe spostare
      // l'appuntamento di un'altra persona.
      const telefonoModifica = ctx.telefonoVerificato?.trim();
      if (!telefonoModifica) return RISPOSTA_RISERVATA;
      if (!(await appuntamentoDelTelefono(supabase, tenantId, appuntamento_id, telefonoModifica))) {
        return RISPOSTA_RISERVATA;
      }

      const risultato = await modificaAppuntamentoTenant(supabase, tenantId, appuntamento_id, {
        operatoreId: operatore_id,
        inizio: inizioData,
      });
      if (!risultato.ok) return { errore: risultato.errore };
      return { modificato: true };
    }

    case "cancella_prenotazione": {
      const appuntamentoId = input.appuntamento_id;
      if (!eUuidValido(appuntamentoId)) {
        return {
          errore:
            "appuntamento_id deve essere l'id esatto (uuid) restituito da cerca_prenotazioni_cliente, non una descrizione.",
        };
      }
      const telefonoCancella = ctx.telefonoVerificato?.trim();
      if (!telefonoCancella) return RISPOSTA_RISERVATA;
      if (!(await appuntamentoDelTelefono(supabase, tenantId, appuntamentoId, telefonoCancella))) {
        return RISPOSTA_RISERVATA;
      }

      const risultato = await cancellaAppuntamentoTenant(supabase, tenantId, appuntamentoId);
      if (!risultato.ok) return { errore: risultato.errore };
      return { cancellato: true };
    }

    case "aggiungi_lista_attesa": {
      const { servizio_id, operatore_id, data_preferita, cliente_nome, cliente_telefono, note } = input as Record<
        string,
        unknown
      >;
      if (typeof servizio_id !== "string" || typeof cliente_telefono !== "string" || !cliente_telefono.trim()) {
        return { errore: "servizio_id e cliente_telefono sono obbligatori." };
      }
      if (!eUuidValido(servizio_id)) {
        return {
          errore: "servizio_id deve essere l'id esatto (uuid) restituito da elenca_servizi, non il suo nome.",
        };
      }
      if (operatore_id !== undefined && !eUuidValido(operatore_id)) {
        return { errore: "operatore_id deve essere l'id esatto (uuid) restituito da elenca_operatori." };
      }
      if (data_preferita !== undefined && (typeof data_preferita !== "string" || !FORMATO_DATA_YMD.test(data_preferita))) {
        return { errore: "data_preferita deve essere nel formato YYYY-MM-DD." };
      }

      const risultato = await aggiungiListaAttesaTenant(supabase, tenantId, {
        servizioId: servizio_id,
        operatoreId: typeof operatore_id === "string" ? operatore_id : undefined,
        dataPreferitaYMD: typeof data_preferita === "string" ? data_preferita : undefined,
        clienteNome: typeof cliente_nome === "string" ? cliente_nome : undefined,
        clienteTelefono: cliente_telefono,
        note: typeof note === "string" ? note : undefined,
        creatoDa: "ai",
      });
      if (!risultato.ok) return { errore: risultato.errore };
      return { iscritto: true };
    }

    case "info_attivita": {
      const [{ data: tenant }, { data: faqGrezze }] = await Promise.all([
        supabase
          .from("tenants")
          .select("descrizione, indirizzo, parcheggio, metodi_pagamento, ore_minime_cancellazione, telefono")
          .eq("id", tenantId)
          .single(),
        supabase.from("faq_attivita").select("domanda, risposta").eq("tenant_id", tenantId).order("created_at"),
      ]);
      if (!tenant) return { errore: "Informazioni non disponibili." };
      return {
        descrizione: tenant.descrizione,
        indirizzo: tenant.indirizzo,
        parcheggio: tenant.parcheggio,
        metodi_pagamento: tenant.metodi_pagamento,
        politica_cancellazione: `Le cancellazioni sono possibili gratuitamente fino a ${tenant.ore_minime_cancellazione} ore prima dell'appuntamento; oltre questo termine il cliente deve contattare direttamente l'attività${tenant.telefono ? ` (${tenant.telefono})` : ""}.`,
        contatto_diretto: tenant.telefono ?? null,
        domande_frequenti: (faqGrezze ?? []).map((f) => ({ domanda: f.domanda, risposta: f.risposta })),
      };
    }

    case "trasferisci_a_operatore": {
      const motivo = typeof input.motivo === "string" ? input.motivo : "Non specificato";
      // La scrittura dello stato "passata_a_operatore" sulla riga di
      // conversazioni vera vive nel motore di conversazione (Task #65,
      // non ancora costruito) che ha il conversazione_id in contesto -- qui
      // lo strumento restituisce solo il segnale, il chiamante decide cosa
      // farne (fermare l'AI, notificare il titolare, ecc).
      return { trasferito: true, motivo };
    }

    default:
      return { errore: `Strumento sconosciuto: ${nome}` };
  }
}
