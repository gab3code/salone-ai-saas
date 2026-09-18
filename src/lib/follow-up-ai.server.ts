import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_FOLLOW_UP,
  messaggioFollowUpAccettabile,
  promptFollowUp,
  MAX_CARATTERI_FOLLOW_UP,
  type DatiFollowUp,
} from "@/lib/follow-up-ai";
import { consumaUsoAiInterno } from "@/lib/ai/usi-interni.server";
import { tettoProvaAssistente } from "@/lib/ai/limiti";

/**
 * Fa scrivere all'assistente il richiamo per UN cliente (Pro).
 *
 * Tutto qui dentro e' fail-open verso il messaggio fisso: quota finita,
 * modello lento, risposta rifiutata dai controlli -- in ogni caso si
 * restituisce null e chi chiama manda il testo di sempre. Il richiamo parte
 * comunque. Saltare del tutto il contatto per un problema nostro
 * significherebbe far perdere al salone un cliente per un guasto che non e'
 * suo, che e' molto peggio di un messaggio generico.
 */
const MODELLO = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
function ottieniClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export async function scriviFollowUpPersonalizzato(
  tenantId: string,
  piano: string,
  numeroOperatori: number,
  dati: DatiFollowUp
): Promise<string | null> {
  const anthropic = ottieniClient();
  if (!anthropic) return null;

  // Anche questo e' modello che lavora per il salone: consuma la sua quota
  // come tutto il resto. Quota finita = messaggio fisso, non niente.
  const consumo = await consumaUsoAiInterno(
    tenantId,
    "follow_up",
    tettoProvaAssistente(piano, numeroOperatori)
  );
  if (!consumo.ok) return null;

  try {
    const risposta = await anthropic.messages.create({
      model: MODELLO,
      // Corto per forza: un tetto basso di token e' la difesa piu' semplice
      // contro un messaggio chilometrico, prima ancora dei controlli.
      max_tokens: 200,
      system: SYSTEM_FOLLOW_UP,
      messages: [{ role: "user", content: promptFollowUp(dati) }],
    });
    const blocco = risposta.content.find((b) => b.type === "text");
    const testo = blocco && blocco.type === "text" ? blocco.text : null;
    return messaggioFollowUpAccettabile(testo);
  } catch (errore) {
    console.error("[follow-up] il modello non ha scritto il messaggio:", tenantId, errore);
    return null;
  }
}

export { MAX_CARATTERI_FOLLOW_UP };
