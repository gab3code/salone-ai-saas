import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pianoHaSms, limiteMensileSms } from "@/lib/piani";
import { inviaSms } from "./skebby.server";
import { contaSmsTenantQuestoMese } from "./limiti.server";

/**
 * Punto di ingresso UNICO per mandare un SMS a un cliente (Fase 5+SMS,
 * 14/09/2026) -- centralizza gate di piano, tetto mensile e tracciamento,
 * così notifiche.server.ts e promemoria.server.ts non duplicano questa
 * logica (punto 9 di CLAUDE.md, "non duplicare la logica di dominio in più
 * punti"). Ogni chiamante reale deve passare da qui, mai chiamare
 * `inviaSms` di skebby.server.ts direttamente.
 *
 * SOLO canale di fallback: chi chiama deve già aver verificato che il
 * cliente non ha un'email (mai SMS in aggiunta all'email, sempre in sua
 * sostituzione -- decisione di Gabriel del 14/09/2026: un SMS costa soldi
 * veri mentre l'email no, non avrebbe senso mandare entrambi allo stesso
 * cliente). Questa funzione non lo ricontrolla (non ha nemmeno l'email a
 * disposizione) -- è responsabilità del chiamante.
 *
 * Fail-open in ogni punto (piano senza SMS, tetto mensile superato,
 * credenziali Skebby mancanti, errore di rete): ritorna `false` senza mai
 * lanciare, stesso principio di `inviaEmail` in mailjet.server.ts -- un
 * problema qui non deve MAI far sembrare fallita un'operazione (una
 * prenotazione, un promemoria) il cui scopo principale è già riuscito.
 */
export async function inviaSmsSeInclusoNelPiano(
  supabase: SupabaseClient,
  tenantId: string,
  piano: string,
  telefono: string,
  messaggio: string
): Promise<boolean> {
  if (!pianoHaSms(piano)) return false;

  try {
    const { count: numeroOperatori } = await supabase
      .from("operatori")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    const limite = limiteMensileSms(piano, numeroOperatori ?? 0);
    const usatiQuestoMese = await contaSmsTenantQuestoMese(supabase, tenantId);
    if (usatiQuestoMese >= limite) {
      console.warn(`[sms] Tenant ${tenantId} ha raggiunto il tetto mensile di SMS (${limite}) -- SMS non inviato.`);
      return false;
    }

    const inviato = await inviaSms(telefono, messaggio);
    if (inviato) {
      // Tracciato SOLO dopo un invio riuscito (mai i tentativi falliti, che
      // non sono costati nulla) -- unica fonte per contaSmsTenantQuestoMese.
      const { error } = await supabase.from("sms_inviati").insert({ tenant_id: tenantId, telefono });
      if (error) console.error("[sms] Errore tracciando l'invio SMS (l'SMS è comunque partito):", tenantId, error);
    }
    return inviato;
  } catch (errore) {
    console.error("[sms] Errore nel flusso di invio SMS:", tenantId, errore);
    return false;
  }
}
