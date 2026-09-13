/**
 * Limiti di piano per la chat AI -- decisione presa con Gabriel il
 * 02/09/2026 (vedi DECISIONS.md per il ragionamento completo su prezzi e
 * posizionamento). Due protezioni distinte e complementari, da non
 * confondere:
 *
 * 1. ACCESSO: l'AI è una funzionalità a pagamento, Free e Starter non ce
 *    l'hanno affatto (né chat web né WhatsApp). Questo NON è principalmente
 *    per coprire un costo -- il costo reale per conversazione con Claude
 *    Haiku 4.5 è basso (vedi calcolo in DECISIONS.md, centesimi non euro) --
 *    è soprattutto una leva di prodotto/posizionamento, come fa anche
 *    Estetia (AI mai nel loro Free).
 * 2. QUOTA + ANTI-BURST: anche un tenant che PAGA per l'AI ha un tetto
 *    mensile e un intervallo minimo tra messaggi, perché l'endpoint
 *    `/api/chat/[slug]` è pubblico e non autenticato -- senza questo, uno
 *    script che manda migliaia di messaggi farebbe pagare la bolletta
 *    Anthropic a Gabriel a prescindere dal piano del cliente colpito. Questo
 *    SÌ è puramente difesa costi, non prodotto.
 */

export const PIANI_CON_AI_CHAT_WEB = new Set(["growth", "pro", "enterprise"]);
// WhatsApp riservato al piano più costoso a prezzo fisso (Pro) -- Enterprise
// lo include ovviamente, essendo superiore a Pro in tutto il resto.
export const PIANI_CON_AI_WHATSAPP = new Set(["pro", "enterprise"]);
// Tono dell'AI personalizzabile (Fase 5): stessa fascia di WhatsApp,
// pubblicizzato su Pro in Prezzi.tsx -- Growth ha l'AI ma col tono di
// default ("professionale"), non puo' cambiarlo.
export const PIANI_CON_TONO_PERSONALIZZATO = new Set(["pro", "enterprise"]);

export function pianoHaAccessoAIChatWeb(piano: string): boolean {
  return PIANI_CON_AI_CHAT_WEB.has(piano);
}

export function pianoHaAccessoAIWhatsapp(piano: string): boolean {
  return PIANI_CON_AI_WHATSAPP.has(piano);
}

export function pianoHaTonoPersonalizzato(piano: string): boolean {
  return PIANI_CON_TONO_PERSONALIZZATO.has(piano);
}

// Numeri di partenza, deliberatamente prudenti e facili da cambiare (non una
// scienza esatta): a questi volumi anche Growth, il piano più economico con
// AI, resta ampiamente in margine pure nel caso limite di quota piena ogni
// mese -- vedi il calcolo costi in DECISIONS.md. Da rivedere con dati reali
// di utilizzo appena disponibili.
const QUOTA_MENSILE_MESSAGGI_PER_PIANO: Record<string, number> = {
  growth: 1000,
  pro: 3000,
  enterprise: Infinity,
};

export function limiteMensileMessaggi(piano: string): number {
  return QUOTA_MENSILE_MESSAGGI_PER_PIANO[piano] ?? 0;
}

// Anti-burst: un vero cliente non manda due messaggi a meno di 2 secondi di
// distanza scrivendo a mano su una tastiera -- una cadenza più fitta è quasi
// certamente uno script, non una persona.
export const INTERVALLO_MINIMO_MS_TRA_MESSAGGI = 2000;
