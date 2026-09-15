import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { creaClientStripe } from "./server";
import { calcolaImportoCaparraCentesimi, type ConfigCaparra } from "./caparra";
import { verificaConflittoTenant } from "@/lib/booking-engine.server";

/**
 * Logica di avvio pagamento caparra condivisa tra il form pubblico manuale
 * (src/app/s/[slug]/azioni.ts, avviaPagamentoCaparra) e il tool AI
 * crea_prenotazione (src/lib/ai/tools.ts) -- estratta qui il 15/09/2026 dopo
 * aver trovato dal vivo che l'AI bypassava completamente la caparra: prima
 * di questa estrazione solo il form manuale conosceva questa logica, l'AI
 * creava la prenotazione direttamente. Stessa "unica fonte di verità" già
 * seguita per il booking engine (punto 9 di CLAUDE.md), applicata qui al
 * pagamento invece che alla scrittura dell'appuntamento.
 */

export interface ParametriAvvioCaparra {
  tenantId: string;
  slug: string;
  origin: string;
  servizioId: string;
  operatoreId: string;
  inizio: Date; // già parsato con parsaOrarioLocale
  inizioIso: string; // stringa originale (pseudo-UTC) da salvare invariata in richieste_caparra
  clienteNome?: string | null;
  clienteTelefono: string;
  clienteEmail?: string | null;
}

export type RisultatoAvvioCaparra =
  | { ok: true; checkoutUrl: string; importoCentesimi: number }
  | { ok: false; errore: string };

/**
 * Importo della caparra richiesta per un servizio di un tenant, in
 * centesimi -- 0 se il tenant non ha la caparra attiva o se questo
 * servizio/prezzo non genererebbe un importo addebitabile. Usata come
 * controllo leggero PRIMA di decidere se creare la prenotazione
 * direttamente o avviare il pagamento (vedi calcolaImportoCaparraCentesimi
 * per il perché 0 significa sempre "nessuna caparra", mai un errore).
 */
export async function caricaImportoCaparraServizio(
  supabase: SupabaseClient,
  tenantId: string,
  servizioId: string
): Promise<number> {
  const [tenantRes, servizioRes] = await Promise.all([
    supabase.from("tenants").select("caparra_attiva, caparra_tipo, caparra_valore").eq("id", tenantId).single(),
    supabase.from("servizi").select("prezzo_centesimi").eq("id", servizioId).eq("tenant_id", tenantId).single(),
  ]);
  if (!tenantRes.data || !servizioRes.data) return 0;

  const config: ConfigCaparra = {
    attiva: tenantRes.data.caparra_attiva,
    tipo: tenantRes.data.caparra_tipo,
    valore: tenantRes.data.caparra_valore,
  };
  return calcolaImportoCaparraCentesimi(config, servizioRes.data.prezzo_centesimi);
}

/**
 * Avvia il pagamento della caparra: crea una riga in `richieste_caparra`
 * (stato "in_attesa") + una Stripe Checkout Session in modalità "payment".
 * L'appuntamento vero NON viene creato qui -- solo quando il webhook riceve
 * "checkout.session.completed" (vedi completaPagamentoCaparra in
 * src/app/api/stripe/webhook/route.ts). Presume che il chiamante abbia già
 * verificato che una caparra sia effettivamente richiesta (vedi
 * caricaImportoCaparraServizio) -- se non lo è, ritorna comunque un errore
 * esplicito invece di generare un pagamento a importo zero (Stripe stesso lo
 * rifiuterebbe).
 *
 * `stripe` iniettabile per i test (mai la rete Stripe vera fuori da
 * produzione), stesso principio di `clientAnthropic` in agente.ts.
 */
export async function avviaPagamentoCaparraTenant(
  supabase: SupabaseClient,
  params: ParametriAvvioCaparra,
  stripe: Stripe = creaClientStripe()
): Promise<RisultatoAvvioCaparra> {
  const [tenantRes, servizioRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("nome, caparra_attiva, caparra_tipo, caparra_valore")
      .eq("id", params.tenantId)
      .single(),
    supabase
      .from("servizi")
      .select("nome, prezzo_centesimi, durata_minuti")
      .eq("id", params.servizioId)
      .eq("tenant_id", params.tenantId)
      .single(),
  ]);
  if (!tenantRes.data) return { ok: false, errore: "Attività non trovata." };
  if (!servizioRes.data) return { ok: false, errore: "Servizio non trovato." };

  const config: ConfigCaparra = {
    attiva: tenantRes.data.caparra_attiva,
    tipo: tenantRes.data.caparra_tipo,
    valore: tenantRes.data.caparra_valore,
  };
  const importoCentesimi = calcolaImportoCaparraCentesimi(config, servizioRes.data.prezzo_centesimi);
  if (importoCentesimi <= 0) {
    return { ok: false, errore: "Nessuna caparra richiesta per questa prenotazione: usa la conferma diretta." };
  }

  // Doppio controllo di conflitto PRIMA di far pagare: non è la difesa
  // finale (lo slot non resta bloccato durante il pagamento, vedi la nota
  // nella migrazione 0011), ma evita di far pagare qualcuno per uno slot già
  // occupato nel caso più comune e prevedibile.
  const fine = new Date(params.inizio.getTime() + servizioRes.data.durata_minuti * 60_000);
  const conflitto = await verificaConflittoTenant(supabase, params.tenantId, {
    inizio: params.inizio,
    fine,
    operatoreId: params.operatoreId,
  });
  if (conflitto) {
    return {
      ok: false,
      errore: "Questo operatore ha già un appuntamento in quell'orario. Scegli un altro slot.",
    };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: `Caparra -- ${servizioRes.data.nome} da ${tenantRes.data.nome}`,
          },
          unit_amount: importoCentesimi,
        },
        quantity: 1,
      },
    ],
    success_url: `${params.origin}/s/${params.slug}?caparra=successo#prenota`,
    cancel_url: `${params.origin}/s/${params.slug}?caparra=annullata#prenota`,
    metadata: { tipo: "caparra", tenant_id: params.tenantId },
  });
  if (!session.url) return { ok: false, errore: "Stripe non ha restituito un URL di pagamento." };

  const { error: erroreInsert } = await supabase.from("richieste_caparra").insert({
    tenant_id: params.tenantId,
    servizio_id: params.servizioId,
    operatore_id: params.operatoreId,
    inizio_iso: params.inizioIso,
    cliente_nome: params.clienteNome || "Cliente",
    cliente_telefono: params.clienteTelefono,
    cliente_email: params.clienteEmail ?? null,
    importo_centesimi: importoCentesimi,
    stripe_checkout_session_id: session.id,
    stato: "in_attesa",
  });
  if (erroreInsert) {
    return { ok: false, errore: `Errore avviando il pagamento: ${erroreInsert.message}` };
  }

  return { ok: true, checkoutUrl: session.url, importoCentesimi };
}
