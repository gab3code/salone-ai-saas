import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { validaBozzaGrezza, bozzaVuota, type BozzaOnboarding } from "./onboarding-ai";

/**
 * Fase 3 di PIANO.md: parte lato server (unica dipendenza da rete/Anthropic
 * di questo modulo) -- chiama il modello con un tool-calling FORZATO su un
 * unico strumento ("restituisci_bozza"), così la risposta è direttamente il
 * JSON strutturato dell'input del tool, mai testo libero da fare il parsing
 * a mano (stesso principio già usato per ogni altro strumento AI del
 * progetto, vedi src/lib/ai/tools.ts).
 */
const MODELLO = "claude-haiku-4-5-20251001"; // stessa scelta di src/lib/ai/agente.ts

export interface ClienteAnthropic {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

let clientPredefinito: Anthropic | null = null;
function ottieniClientPredefinito(): Anthropic {
  if (!clientPredefinito) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY mancante in .env.local");
    clientPredefinito = new Anthropic({ apiKey });
  }
  return clientPredefinito;
}

const SCHEMA_ORARIO = {
  type: "object" as const,
  properties: {
    giorno_settimana: { type: "integer", minimum: 0, maximum: 6, description: "0=domenica, 1=lunedì, ... 6=sabato" },
    chiuso: { type: "boolean" },
    apertura: { type: ["string", "null"], description: "Formato HH:MM, solo se chiuso è false." },
    chiusura: { type: ["string", "null"], description: "Formato HH:MM, solo se chiuso è false." },
    pausa_inizio: { type: ["string", "null"], description: "Formato HH:MM, solo se il testo menziona una pausa pranzo." },
    pausa_fine: { type: ["string", "null"] },
  },
  required: ["giorno_settimana", "chiuso"],
};

function costruisciSchemaBozza(haKnowledgeBaseAi: boolean) {
  const properties: Record<string, unknown> = {
    orari: {
      type: "array",
      description:
        "Un elemento per OGNI giorno della settimana citato o implicito nel testo (non serve includere i giorni di cui il testo non parla affatto -- verranno considerati chiusi).",
      items: SCHEMA_ORARIO,
    },
    operatori: {
      type: "array",
      description: "Le persone che lavorano nell'attività, se il testo le nomina o le conta (es. 'siamo in tre').",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          descrizione: { type: ["string", "null"], description: "Specializzazione/ruolo, solo se menzionata." },
        },
        required: ["nome"],
      },
    },
    servizi: {
      type: "array",
      description: "I servizi offerti.",
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          durata_minuti: {
            type: ["integer", "null"],
            description: "SOLO se il testo la specifica esplicitamente. MAI una stima -- lascia null se non sei sicuro.",
          },
          prezzo_euro: {
            type: ["number", "null"],
            description: "SOLO se il testo lo specifica esplicitamente. MAI un prezzo inventato -- lascia null se non menzionato.",
          },
        },
        required: ["nome"],
      },
    },
    associazioni: {
      type: "array",
      description:
        "Quale operatore esegue quale servizio, SOLO se il testo lo rende chiaro (es. 'Maria fa solo manicure e pedicure'). Lascia vuoto se il testo non lo specifica: verrà usato un default ragionevole (ogni operatore associato a ogni servizio).",
      items: {
        type: "object",
        properties: { operatore: { type: "string" }, servizio: { type: "string" } },
        required: ["operatore", "servizio"],
      },
    },
    ore_minime_cancellazione: {
      type: ["integer", "null"],
      description: "SOLO se il testo specifica esplicitamente una politica di cancellazione in ore (es. 'si cancella fino a 24 ore prima'). Altrimenti null.",
    },
  };
  const required = ["orari", "operatori", "servizi", "associazioni"];

  if (haKnowledgeBaseAi) {
    properties.informazioni_attivita = {
      type: ["object", "null"],
      description: "Informazioni generali sull'attività per rispondere a domande dei clienti (non di prenotazione).",
      properties: {
        descrizione: { type: ["string", "null"], description: "Breve descrizione dell'attività, tono e atmosfera." },
        indirizzo: { type: ["string", "null"] },
        parcheggio: { type: ["string", "null"], description: "Informazioni sul parcheggio, solo se menzionate." },
        metodi_pagamento: { type: ["string", "null"], description: "Es. 'contanti, carta, bancomat', solo se menzionati." },
      },
    };
    properties.faq = {
      type: "array",
      description: "Domande frequenti chiaramente utili SOLO se il testo fornisce già domanda e risposta, o l'informazione per costruirle entrambe con certezza. Meglio un elenco vuoto che una FAQ inventata.",
      items: {
        type: "object",
        properties: { domanda: { type: "string" }, risposta: { type: "string" } },
        required: ["domanda", "risposta"],
      },
    };
  }

  return { type: "object" as const, properties, required };
}

const SYSTEM_PROMPT = `Aiuti un professionista a impostare velocemente la configurazione iniziale della sua attività (un salone, uno studio, o un'attività simile su appuntamento) a partire da una sua descrizione libera in italiano.

Chiama SEMPRE lo strumento restituisci_bozza, una sola volta, con tutto quello che riesci a estrarre con ragionevole certezza dal testo.

REGOLA FONDAMENTALE, non negoziabile: non inventare MAI un prezzo, una durata, un orario o qualunque altro dato specifico che il testo non menziona esplicitamente o non rende inequivocabile. Se non sei sicuro di un valore, ometti quel campo (lascialo null) invece di stimarlo o indovinarlo -- è molto meglio lasciare un campo vuoto che il titolare completerà lui stesso, piuttosto che inventare un numero sbagliato che potrebbe finire salvato per davvero. Questo vale soprattutto per prezzi e durate dei servizi.

Non aggiungere servizi, operatori o informazioni che il testo non menziona in nessun modo, anche se ti sembrano "tipici" per quel genere di attività.`;

export type RisultatoGenerazioneBozza = { ok: true; bozza: BozzaOnboarding } | { ok: false; errore: string };

/**
 * Genera una bozza di configurazione da una descrizione libera dell'attività.
 * Non scrive MAI nel database -- restituisce solo la bozza, che il
 * chiamante mostra al titolare per la revisione (vedi
 * applicaBozzaOnboarding in dashboard/configura/azioni.ts per il passo
 * successivo, quello che scrive davvero, solo dopo conferma esplicita).
 */
export async function generaBozzaOnboarding(
  descrizione: string,
  haKnowledgeBaseAi: boolean,
  clientAnthropic: ClienteAnthropic = ottieniClientPredefinito()
): Promise<RisultatoGenerazioneBozza> {
  const testoPulito = descrizione.trim().slice(0, 4000); // stesso ordine di grandezza di MAX_CARATTERI_CAMPO_INFORMAZIONI, generoso per una descrizione libera
  if (!testoPulito) return { ok: false, errore: "Scrivi prima una descrizione della tua attività." };

  let risposta: Anthropic.Message;
  try {
    risposta = await clientAnthropic.messages.create({
      model: MODELLO,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: "restituisci_bozza",
          description: "Restituisce la bozza di configurazione estratta dalla descrizione dell'attività.",
          input_schema: costruisciSchemaBozza(haKnowledgeBaseAi),
        },
      ],
      tool_choice: { type: "tool", name: "restituisci_bozza" },
      messages: [{ role: "user", content: testoPulito }],
    });
  } catch (errore) {
    console.error("Errore generando la bozza di onboarding:", errore);
    return { ok: false, errore: "Si è verificato un problema tecnico generando la bozza. Riprova tra poco." };
  }

  const bloccoTool = risposta.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!bloccoTool) {
    return { ok: false, errore: "Il modello non ha restituito una bozza valida. Riprova, magari con una descrizione un po' più dettagliata." };
  }

  const bozza = validaBozzaGrezza(bloccoTool.input, haKnowledgeBaseAi);
  if (bozzaVuota(bozza)) {
    return {
      ok: false,
      errore: "Non sono riuscito a estrarre nulla di utilizzabile da questa descrizione. Prova ad aggiungere qualche dettaglio in più (servizi, orari, chi lavora da te).",
    };
  }
  return { ok: true, bozza };
}
