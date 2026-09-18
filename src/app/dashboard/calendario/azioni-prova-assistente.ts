"use server";

import { creaClientServer } from "@/lib/supabase/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { tettoProvaAssistente } from "@/lib/ai/limiti";
import { consumaUsoAiInterno } from "@/lib/ai/usi-interni.server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { rispondiConversazione } from "@/lib/ai/agente";
import {
  STRUMENTI_DEMO,
  domandaDemoValida,
  pianoPuoProvareAssistente,
} from "@/lib/ai/demo-assistente";

export interface EsitoProva {
  risposta?: string;
  rimaste?: number;
  errore?: string;
}

/**
 * "Guarda cosa avrebbe risposto l'assistente": una risposta VERA, sui dati
 * veri del salone, per un piano che l'assistente non ce l'ha.
 *
 * I quattro controlli qui sotto sono in quest'ordine di proposito, e tutti
 * PRIMA della chiamata al modello: un tentativo respinto non deve costare
 * niente (stesso principio delle difese in `api/chat/[slug]/route.ts`).
 *
 *  1. PERMESSO. Solo chi puo' configurare l'attivita': e' una decisione
 *     commerciale, non una funzione operativa, e un collaboratore non deve
 *     nemmeno vederla.
 *  2. PIANO. Ricontrollato qui e non solo nella UI: una server action e' un
 *     endpoint POST chiamabile senza mai aprire la pagina. Senza questo, un
 *     tenant Growth -- che l'assistente ce l'ha gia' -- potrebbe usare
 *     questa strada per farsi rispondere FUORI dalla sua quota mensile.
 *  3. TESTO. Lunghezza minima e massima (vedi demo-assistente.ts).
 *  4. TETTO MENSILE, consumato dalla funzione `consuma_demo_ai` della
 *     migrazione 0041: controlla e incrementa nella stessa UPDATE, quindi
 *     due schede aperte insieme non consumano la stessa prova due volte.
 *     Gira con il client ADMIN perche' la funzione e' eseguibile solo dal
 *     service_role -- di proposito: se potesse chiamarla il titolare, si
 *     passerebbe da solo il limite che preferisce come secondo parametro.
 *
 * La prova consuma anche quando il modello poi fallisce. E' la scelta
 * prudente: il contrario -- consumare solo in caso di successo -- rende il
 * tetto aggirabile da chiunque riesca a far fallire la chiamata a comando,
 * e una chiamata fallita ad Anthropic e' gia' stata pagata comunque.
 */
export async function provaAssistente(domanda: string): Promise<EsitoProva> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nome, piano, telefono, telefono_whatsapp")
    .eq("id", tenantId)
    .single();
  if (!tenant) return { errore: "Attività non trovata." };

  if (!pianoHaSensoLaProva(tenant.piano)) {
    return { errore: "L'assistente è già incluso nel tuo piano: lo trovi sulla tua pagina pubblica." };
  }

  if (!domandaDemoValida(domanda)) {
    return { errore: "Scrivi la domanda di un cliente, da tre caratteri fino a trecento." };
  }

  // Dal 18/09/2026 la prova consuma la STESSA quota mensile di tutto il
  // resto (richiesta di Gabriel: il contatore deve salire anche quando il
  // salone usa l'AI dalla dashboard). Prima aveva un tetto tutto suo,
  // `tenants.demo_ai_usate`, che non compariva nel numero mostrato in
  // dashboard: due contatori per lo stesso costo.
  const { count: numeroOperatori } = await supabase
    .from("operatori")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const consumo = await consumaUsoAiInterno(
    tenantId,
    "prova_assistente",
    tettoProvaAssistente(tenant.piano, numeroOperatori ?? 1)
  );
  if (!consumo.ok) {
    if (consumo.motivo === "errore") {
      return { errore: "Non riesco a verificare le prove rimaste. Riprova fra poco." };
    }
    return {
      rimaste: 0,
      errore: "Hai usato tutte le prove di questo mese. Riparte il primo del mese prossimo.",
    };
  }

  const rimaste = consumo.rimasti;
  const admin = creaClientAdmin();

  try {
    const risultato = await rispondiConversazione([], domanda.trim(), {
      supabase: admin,
      tenantId,
      usoApi: { canale: "prova_assistente", tenantId },
      nomeAttivita: tenant.nome,
      telefono: tenant.telefono ?? null,
      telefonoWhatsapp: tenant.telefono_whatsapp ?? null,
      // La riga che tiene in piedi tutto il ragionamento sul limite: solo
      // strumenti in lettura. L'assistente della prova sa guardare
      // l'agenda, non toccarla.
      strumentiConsentiti: STRUMENTI_DEMO,
    });
    return { risposta: risultato.rispostaTesto, rimaste };
  } catch {
    // Il messaggio dell'errore vero non va a schermo: puo' contenere
    // dettagli dell'infrastruttura, e a un titolare non servirebbe.
    return { rimaste, errore: "L'assistente non è riuscito a rispondere. La prova è stata comunque consumata." };
  }
}

function pianoHaSensoLaProva(piano: string): boolean {
  return pianoPuoProvareAssistente(piano);
}
