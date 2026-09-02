import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MessaggioConversazione } from "./agente";

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

export async function ottieniOCreaConversazione(
  supabase: SupabaseClient,
  tenantId: string,
  identificatoreSessione: string
): Promise<{ id: string; stato: string }> {
  const { data: esistente } = await supabase
    .from("conversazioni")
    .select("id, stato")
    .eq("tenant_id", tenantId)
    .eq("identificatore_sessione", identificatoreSessione)
    .eq("stato", "aperta")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (esistente) return esistente;

  const { data: nuova, error } = await supabase
    .from("conversazioni")
    .insert({ tenant_id: tenantId, canale: "web", identificatore_sessione: identificatoreSessione })
    .select("id, stato")
    .single();
  if (error) throw new Error(`Errore creando la conversazione: ${error.message}`);
  return nuova;
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

export async function segnaPassataAOperatore(supabase: SupabaseClient, conversazioneId: string): Promise<void> {
  const { error } = await supabase
    .from("conversazioni")
    .update({ stato: "passata_a_operatore" })
    .eq("id", conversazioneId);
  if (error) throw new Error(`Errore aggiornando lo stato della conversazione: ${error.message}`);
}
