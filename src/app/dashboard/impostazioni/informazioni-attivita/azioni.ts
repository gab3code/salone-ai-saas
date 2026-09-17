"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { pianoHaKnowledgeBaseAi } from "@/lib/piani";

const PERCORSO = "/dashboard/impostazioni/informazioni-attivita";

// Tetto per tenant sulle FAQ libere (stesso spirito di
// MAX_REGOLE_PROMEMORIA_PER_TENANT in src/lib/promemoria.ts, ma qui non
// serve un file di dominio dedicato solo per una costante): oltre un certo
// numero una knowledge base smette di essere utile all'AI (il system prompt
// non è un database, restare concisi conta) e diventa più facile da abusare.
const MAX_FAQ_PER_TENANT = 40;

// Limiti di lunghezza per i campi strutturati: testo libero che finisce
// dentro il risultato di uno strumento AI (info_attivita) e quindi nel
// system prompt indirettamente -- lunghezze ragionevoli evitano che un
// titolare (in buona fede o meno) trasformi un campo in un prompt
// eccessivamente lungo/costoso.
const MAX_CARATTERI_CAMPO_INFORMAZIONI = 2000;

function pulisciCampo(valore: FormDataEntryValue | null): string | null {
  const testo = String(valore ?? "").trim().slice(0, MAX_CARATTERI_CAMPO_INFORMAZIONI);
  return testo || null;
}

/**
 * Informazioni strutturate sull'attività (Fase 2, Pro/Enterprise -- vedi
 * `pianoHaKnowledgeBaseAi` in piani.ts), lette dallo strumento AI
 * `info_attivita` (src/lib/ai/tools.ts). Il gate di piano è ricontrollato
 * QUI oltre che nella UI, stesso principio già seguito da `aggiornaTonoAi`
 * (impostazioni/tono-ai/azioni.ts): un utente non deve poter salvare
 * contenuti riservati a Pro/Enterprise chiamando l'azione direttamente se
 * il suo piano non li include.
 */
export async function aggiornaInformazioniAttivita(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  if (!tenant || !pianoHaKnowledgeBaseAi(tenant.piano)) {
    return { errore: "La knowledge base dell'AI receptionist è inclusa dal piano Pro in su." };
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      descrizione: pulisciCampo(formData.get("descrizione")),
      indirizzo: pulisciCampo(formData.get("indirizzo")),
      parcheggio: pulisciCampo(formData.get("parcheggio")),
      metodi_pagamento: pulisciCampo(formData.get("metodi_pagamento")),
    })
    .eq("id", tenantId);

  revalidatePath(PERCORSO);
  return error ? { errore: `Errore salvando le informazioni: ${error.message}` } : { ok: true as const };
}

/**
 * Aggiunge una FAQ libera. Stesso pattern di `aggiungiRegolaPromemoria`
 * (impostazioni/promemoria/azioni.ts): gate di piano ricontrollato, tetto
 * per tenant contato PRIMA di inserire.
 */
export async function aggiungiFaq(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  if (!tenant || !pianoHaKnowledgeBaseAi(tenant.piano)) {
    return { errore: "La knowledge base dell'AI receptionist è inclusa dal piano Pro in su." };
  }

  const domanda = String(formData.get("domanda") || "").trim();
  const risposta = String(formData.get("risposta") || "").trim();

  if (!domanda) return { errore: "La domanda è obbligatoria." };
  if (!risposta) return { errore: "La risposta è obbligatoria." };
  if (domanda.length > 300) return { errore: "La domanda può avere al massimo 300 caratteri." };
  if (risposta.length > 1000) return { errore: "La risposta può avere al massimo 1000 caratteri." };

  const { count } = await supabase
    .from("faq_attivita")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((count ?? 0) >= MAX_FAQ_PER_TENANT) {
    return { errore: `Massimo ${MAX_FAQ_PER_TENANT} domande frequenti per volta.` };
  }

  // Si fa tornare l'ID VERO della riga appena scritta, e non si lascia che
  // sia la UI a inventarselo (bug trovato nell'audit del 17/09/2026): con un
  // id finto, premere "Rimuovi" su una domanda appena aggiunta cancellava
  // zero righe -- senza nessun errore, perche' un DELETE che non trova
  // niente non e' un errore -- e la domanda spariva dallo schermo per
  // ricomparire al ricaricamento successivo. Nel frattempo continuava a
  // occupare uno dei 40 posti disponibili.
  const { data, error } = await supabase
    .from("faq_attivita")
    .insert({ tenant_id: tenantId, domanda, risposta })
    .select("id")
    .single();

  revalidatePath(PERCORSO);
  if (error) return { errore: `Errore salvando la domanda: ${error.message}` };
  return { ok: true as const, id: data.id as string };
}

/** Rimuove una FAQ -- il gate di piano non serve ricontrollarlo qui: una FAQ già esistente è
 * legittima da rimuovere anche se nel frattempo il tenant fosse sceso di piano (RLS impedisce
 * comunque di toccare righe di un altro tenant), stesso principio di `eliminaRegolaPromemoria`. */
export async function eliminaFaq(faqId: string) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const { error } = await supabase.from("faq_attivita").delete().eq("id", faqId).eq("tenant_id", tenantId);

  revalidatePath(PERCORSO);
  return error ? { errore: `Errore rimuovendo la domanda: ${error.message}` } : { ok: true as const };
}
