import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  trovaSlotDisponibiliTenant,
  creaAppuntamentoTenant,
  modificaAppuntamentoTenant,
  cancellaAppuntamentoTenant,
  parsaOrarioLocale,
} from "@/lib/booking-engine.server";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";

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
}

/** Risolve il tenant dal quale il visitatore sta chattando (slug della pagina pubblica). */
export async function risolviTenantIdDaSlug(
  supabase: SupabaseClient,
  slug: string
): Promise<string | null> {
  const { data, error } = await supabase.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (error) {
    // Non silenziare un errore reale (es. service_role key mancante/errata) dietro
    // un fuorviante "tenant non trovato": logghiamo per capire davvero cosa è successo.
    console.error("Errore risolvendo il tenant dallo slug:", slug, error);
  }
  return data?.id ?? null;
}

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
    description: "Elenca gli operatori/professionisti attivi in questa attività.",
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
      "Verifica gli slot orari REALMENTE disponibili per uno o più servizi (consecutivi) in una data, opzionalmente per un operatore specifico. Chiamalo sempre prima di proporre un orario al cliente: non inventare mai una disponibilità.",
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
      "Cerca le prenotazioni future di un cliente esistente tramite il suo numero di telefono, per identificarlo o per sapere cosa modificare/cancellare.",
    input_schema: {
      type: "object",
      properties: {
        telefono: { type: "string", description: "Numero di telefono del cliente." },
      },
      required: ["telefono"],
    },
  },
  {
    name: "crea_prenotazione",
    description:
      "Crea una prenotazione reale sul calendario, dopo aver verificato la disponibilità con verifica_disponibilita. Se il cliente non esiste ancora, viene creato automaticamente dal telefono.",
    input_schema: {
      type: "object",
      properties: {
        servizio_id: { type: "string" },
        operatore_id: { type: "string" },
        inizio: { type: "string", description: "Data e ora di inizio, formato YYYY-MM-DDTHH:MM." },
        cliente_nome: { type: "string" },
        cliente_telefono: { type: "string" },
        note: { type: "string" },
      },
      required: ["servizio_id", "operatore_id", "inizio", "cliente_telefono"],
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
    name: "trasferisci_a_operatore",
    description:
      "Passa la conversazione a un operatore umano -- usalo quando la richiesta è ambigua oltre quanto puoi risolvere, il cliente lo chiede esplicitamente, o serve un giudizio che non puoi dare da solo.",
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
        .select("id, nome, ruolo")
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

      const slot = await trovaSlotDisponibiliTenant(supabase, tenantId, {
        data,
        servizioIds: servizioIds as string[],
        operatoreId: typeof input.operatore_id === "string" ? input.operatore_id : undefined,
      });
      return {
        slot: slot.map((s) => ({
          inizio: s.inizio.toISOString(),
          fine: s.fine.toISOString(),
          operatore_id: s.operatoreId,
        })),
      };
    }

    case "cerca_prenotazioni_cliente": {
      const telefono = input.telefono;
      if (typeof telefono !== "string" || !telefono.trim()) return { errore: "telefono obbligatorio." };

      const { data: cliente } = await supabase
        .from("clienti")
        .select("id, nome")
        .eq("tenant_id", tenantId)
        .eq("telefono", telefono.trim())
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
      const { servizio_id, operatore_id, inizio, cliente_nome, cliente_telefono, note } = input as Record<
        string,
        unknown
      >;
      if (
        typeof servizio_id !== "string" ||
        typeof operatore_id !== "string" ||
        typeof inizio !== "string" ||
        typeof cliente_telefono !== "string"
      ) {
        return { errore: "servizio_id, operatore_id, inizio e cliente_telefono sono obbligatori." };
      }
      if (!eUuidValido(servizio_id) || !eUuidValido(operatore_id)) {
        return {
          errore:
            "servizio_id e operatore_id devono essere gli id esatti (uuid) restituiti da elenca_servizi/elenca_operatori, non i loro nomi.",
        };
      }
      const inizioData = parsaOrarioLocale(inizio);
      if (!inizioData) return { errore: "inizio non valido, usa il formato YYYY-MM-DDTHH:MM." };

      const risultato = await creaAppuntamentoTenant(supabase, tenantId, {
        servizioId: servizio_id,
        operatoreId: operatore_id,
        inizio: inizioData,
        clienteNome: typeof cliente_nome === "string" ? cliente_nome : undefined,
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
      const risultato = await cancellaAppuntamentoTenant(supabase, tenantId, appuntamentoId);
      if (!risultato.ok) return { errore: risultato.errore };
      return { cancellato: true };
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
