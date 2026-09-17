import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessaggioConversazione } from "./agente";
import { SOGLIA_INATTIVITA_NUOVA_CONVERSAZIONE_MS } from "./limiti";

/**
 * Persistenza della conversazione (punto 8 di CLAUDE.md: "l'AI deve
 * mantenere il contesto lungo tutta la conversazione senza ricominciare da
 * zero") -- il contesto vero vive nella tabella `messaggi`, non nella
 * richiesta HTTP: ogni turno rilegge lo storico dal database, così un
 * visitatore che torna il giorno dopo (stesso identificatore di sessione
 * salvato nel suo browser) ritrova la conversazione dove l'aveva lasciata.
 *
 * Un visitatore anonimo della chat web non ha un cliente_id finché non lo
 * identifichiamo (telefono) -- per questo la conversazione si ritrova per
 * `identificatore_sessione`, non per cliente (colonna aggiunta dalla
 * migrazione 0006 proprio per questo).
 */

export interface Conversazione {
  id: string;
  stato: string;
  // Contatore anti-abuso (migrazione 0019, default 0 per ogni conversazione
  // nuova) -- vedi LIMITE_TURNI_SENZA_STRUMENTI_CONSECUTIVI in limiti.ts.
  turniSenzaToolConsecutivi: number;
}

export async function ottieniOCreaConversazione(
  supabase: SupabaseClient,
  tenantId: string,
  identificatoreSessione: string
): Promise<Conversazione> {
  const { data: esistente } = await supabase
    .from("conversazioni")
    .select("id, stato, turni_senza_tool_consecutivi")
    .eq("tenant_id", tenantId)
    .eq("identificatore_sessione", identificatoreSessione)
    .eq("stato", "aperta")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Riusata SOLO se ancora "fresca" (vedi SOGLIA_INATTIVITA_NUOVA_CONVERSAZIONE_MS
  // in limiti.ts, trovato dal vivo 15/09/2026): un identificatore_sessione che
  // torna dopo ore/giorni non deve ripescare il contatore anti-abuso di una
  // conversazione morta, altrimenti un messaggio nuovo e legittimo può essere
  // bloccato subito da turni non collegati a lui. La riga vecchia resta nel
  // database così com'è (semplicemente non più ripescata: la nuova sotto avrà
  // un created_at più recente e vincerà sempre l'ORDER BY di questa query).
  if (esistente && !(await conversazioneTroppoVecchia(supabase, esistente.id))) {
    return {
      id: esistente.id,
      stato: esistente.stato,
      turniSenzaToolConsecutivi: esistente.turni_senza_tool_consecutivi ?? 0,
    };
  }

  const { data: nuova, error } = await supabase
    .from("conversazioni")
    .insert({ tenant_id: tenantId, canale: "web", identificatore_sessione: identificatoreSessione })
    .select("id, stato, turni_senza_tool_consecutivi")
    .single();
  if (error) throw new Error(`Errore creando la conversazione: ${error.message}`);
  return {
    id: nuova.id,
    stato: nuova.stato,
    turniSenzaToolConsecutivi: nuova.turni_senza_tool_consecutivi ?? 0,
  };
}

/**
 * "Vecchia" = l'ultima attività (ultimo messaggio, o la creazione stessa se
 * non ne ha ancora nessuno) risale a più di SOGLIA_INATTIVITA_NUOVA_CONVERSAZIONE_MS
 * fa. Guarda l'ultimo MESSAGGIO, non `created_at`/`updated_at` della
 * conversazione (quest'ultimo non viene aggiornato dalle scritture di stato
 * come segnaPassataAOperatore/aggiornaTurniSenzaStrumenti): una conversazione
 * creata ore fa ma ancora attiva ogni pochi minuti non deve essere spezzata.
 * Fail-safe sull'errore: se non riesco a leggere l'ultimo messaggio, meglio
 * trattarla come vecchia (si crea una nuova conversazione pulita) che
 * rischiare di riusare un contatore anti-abuso di cui non so l'età reale.
 */
async function conversazioneTroppoVecchia(supabase: SupabaseClient, conversazioneId: string): Promise<boolean> {
  const { data: ultimoMessaggio, error } = await supabase
    .from("messaggi")
    .select("created_at")
    .eq("conversazione_id", conversazioneId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return true;
  if (!ultimoMessaggio) return false; // conversazione appena creata, nessun messaggio ancora: mai "vecchia"
  const eta = Date.now() - new Date(ultimoMessaggio.created_at).getTime();
  return eta > SOGLIA_INATTIVITA_NUOVA_CONVERSAZIONE_MS;
}

export async function caricaMessaggi(
  supabase: SupabaseClient,
  conversazioneId: string
): Promise<MessaggioConversazione[]> {
  const { data, error } = await supabase
    .from("messaggi")
    .select("ruolo, contenuto")
    .eq("conversazione_id", conversazioneId)
    .in("ruolo", ["cliente", "assistente"]) // i messaggi "sistema"/"operatore" non entrano nel prompt del modello
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Errore caricando i messaggi: ${error.message}`);
  return (data ?? []).map((m) => ({ ruolo: m.ruolo as "cliente" | "assistente", contenuto: m.contenuto }));
}

export async function salvaMessaggio(
  supabase: SupabaseClient,
  conversazioneId: string,
  ruolo: "cliente" | "assistente",
  contenuto: string
): Promise<void> {
  const { error } = await supabase.from("messaggi").insert({ conversazione_id: conversazioneId, ruolo, contenuto });
  if (error) throw new Error(`Errore salvando il messaggio: ${error.message}`);
}

/**
 * Segna la conversazione come passata a una persona.
 *
 * Ritorna `true` SOLO quando lo stato è cambiato davvero in questa chiamata
 * (17/09/2026). Serve a chi deve avvisare il titolare
 * (`inviaNotificaPassaggioAOperatore`): senza il `neq`, ogni messaggio
 * successivo in una conversazione già passata a un operatore rifarebbe
 * l'update e farebbe partire un'altra email identica. Il filtro sta nella
 * query, non in una lettura-poi-scrittura, così due richieste in parallelo
 * non possono entrambe credere di essere la prima.
 */
export async function segnaPassataAOperatore(
  supabase: SupabaseClient,
  conversazioneId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversazioni")
    .update({ stato: "passata_a_operatore" })
    .eq("id", conversazioneId)
    .neq("stato", "passata_a_operatore")
    .select("id");
  if (error) throw new Error(`Errore aggiornando lo stato della conversazione: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Aggiorna il contatore anti-abuso dopo un turno in cui il modello È STATO
 * chiamato (vedi limiti.ts): azzerato se il turno ha usato almeno uno
 * strumento, incrementato di uno altrimenti. Fail-open (logga e non
 * rilancia, stesso principio di `inviaEmail`/`inviaSms`): un problema qui è
 * solo una difesa anti-abuso che manca per un turno, non deve mai rompere
 * una conversazione reale il cui scopo principale (rispondere al cliente)
 * è già riuscito.
 */
export async function aggiornaTurniSenzaStrumenti(
  supabase: SupabaseClient,
  conversazioneId: string,
  usoStrumenti: boolean,
  valoreAttuale: number
): Promise<void> {
  const nuovoValore = usoStrumenti ? 0 : valoreAttuale + 1;
  const { error } = await supabase
    .from("conversazioni")
    .update({ turni_senza_tool_consecutivi: nuovoValore })
    .eq("id", conversazioneId);
  if (error) console.error("Errore aggiornando il contatore anti-abuso:", conversazioneId, error);
}
