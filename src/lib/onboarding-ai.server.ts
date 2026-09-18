import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { validaBozzaGrezza, bozzaVuota, type BozzaOnboarding } from "./onboarding-ai";
import type { StatoSalone } from "./onboarding-ai-diff";

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

function costruisciSchemaBozza(haKnowledgeBaseAi: boolean, haPromemoria: boolean) {
  const properties: Record<string, unknown> = {
    orari: {
      type: "array",
      description:
        "SOLO i giorni di cui il testo parla, e solo quelli che CAMBIANO rispetto alla configurazione attuale. Un giorno che non metti qui resta esattamente com'e' adesso: non viene chiuso e non viene toccato. Non riportare un giorno solo per confermarlo. Metti un giorno con chiuso=true unicamente se il titolare ha detto che quel giorno e' chiuso. Elenco vuoto se il testo non parla di orari di apertura.",
      items: SCHEMA_ORARIO,
    },
    operatori: {
      type: "array",
      description:
        "Lo STATO FINALE delle persone che lavorano nell'attività: TUTTE quelle che devono esserci quando hai finito, comprese quelle già presenti che non cambiano. Chi c'è già va riportato con il suo id. Ometti una persona solo se va tolta.",
      items: {
        type: "object",
        properties: {
          id: {
            type: ["string", "null"],
            description:
              "L'id esatto preso dalla CONFIGURAZIONE ATTUALE se questa persona c'è già (anche solo per correggerle il nome). null se è nuova. Non inventare mai un id.",
          },
          nome: { type: "string" },
          descrizione: { type: ["string", "null"], description: "Specializzazione/ruolo, solo se menzionata." },
        },
        required: ["nome"],
      },
    },
    servizi: {
      type: "array",
      description:
        "Lo STATO FINALE dei servizi offerti: TUTTI quelli che devono esserci alla fine, compresi quelli già presenti che non cambiano (riportati con il loro id). Ometti un servizio solo se va tolto.",
      items: {
        type: "object",
        properties: {
          id: {
            type: ["string", "null"],
            description:
              "L'id esatto preso dalla CONFIGURAZIONE ATTUALE se questo servizio c'è già. null se è nuovo. Non inventare mai un id.",
          },
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
        "Chi fa cosa. Se il testo dice anche solo per una persona quali servizi esegue (es. 'Maria fa solo manicure e pedicure', 'il colore lo fa solo Anna'), DEVI compilare questo campo con TUTTE le coppie operatore-servizio che devono valere alla fine, non solo quelle citate. Ometti del tutto il campo (non un elenco vuoto) se il testo non dice proprio niente su chi fa cosa: un elenco vuoto significa che nessuno esegue nessun servizio. I nomi devono essere scritti ESATTAMENTE come negli elenchi operatori e servizi qui sopra.",
      items: {
        type: "object",
        properties: { operatore: { type: "string" }, servizio: { type: "string" } },
        required: ["operatore", "servizio"],
      },
    },
    regole_agenda: {
      type: ["object", "null"],
      description:
        "Come il salone riempie l'agenda, SOLO se il testo ne parla (es. 'gli appuntamenti li do ogni mezz'ora', 'fra un cliente e l'altro mi servono 10 minuti per pulire').",
      properties: {
        passo_minuti: {
          type: ["integer", "null"],
          description: "Ogni quanti minuti proporre un orario libero (5-240). Solo se il testo lo dice.",
        },
        buffer_minuti: {
          type: ["integer", "null"],
          description: "Minuti di stacco dopo ogni appuntamento, per pulire o riordinare (0-240). Solo se il testo lo dice.",
        },
        modalita_riempimento: {
          type: ["string", "null"],
          enum: ["griglia", "attaccato", null],
          description:
            "'griglia' se vuole orari ordinati (09:00, 09:15, 09:30), 'attaccato' se vuole riempire al massimo facendo iniziare il cliente dopo appena finisce il precedente. Null se il testo non ne parla.",
        },
      },
    },
    orari_operatore: {
      type: "array",
      description:
        "Orari di UNA persona specifica, quando sono diversi da quelli del salone (es. 'Rita fa solo le mattine', 'il sabato Luca non c'è'). Non elencare qui chi segue gli orari del salone.",
      items: {
        type: "object",
        properties: {
          operatore: { type: "string", description: "Il nome, scritto esattamente come nell'elenco operatori." },
          orari: { type: "array", items: SCHEMA_ORARIO },
        },
        required: ["operatore", "orari"],
      },
    },
    contatti: {
      type: ["object", "null"],
      description: "Numeri di telefono dell'attività, solo se il testo li contiene.",
      properties: {
        telefono: { type: ["string", "null"], description: "Telefono dell'attività." },
        telefono_whatsapp: { type: ["string", "null"], description: "Numero WhatsApp, se diverso o citato come tale." },
      },
    },
    caparra: {
      type: ["object", "null"],
      description:
        "Richiesta di acconto alla prenotazione, SOLO se il testo lo dice esplicitamente (es. 'chiedo 20 euro di caparra', 'faccio pagare il 30% in anticipo').",
      properties: {
        attiva: { type: "boolean" },
        tipo: { type: ["string", "null"], enum: ["percentuale", "fisso", null] },
        valore: { type: ["number", "null"], description: "La percentuale, oppure gli euro se tipo è 'fisso'." },
      },
    },
    chiusure: {
      type: "array",
      description:
        "Ferie e giorni di chiusura straordinaria citati nel testo (es. 'chiudiamo dal 10 al 20 agosto', 'il 15 siamo chiusi'). NON le chiusure settimanali fisse, che vanno negli orari. Le date vanno in formato YYYY-MM-DD: usa la data di oggi indicata nel messaggio per capire di quale anno si parla, e non inventare mai una data che il testo non permette di ricavare.",
      items: {
        type: "object",
        properties: {
          data_inizio: { type: "string", description: "YYYY-MM-DD" },
          data_fine: { type: ["string", "null"], description: "YYYY-MM-DD, null se è un giorno solo." },
          operatore: {
            type: ["string", "null"],
            description: "Nome della persona, se la chiusura riguarda solo lei. Null se chiude tutto il salone.",
          },
          giorno_intero: { type: "boolean" },
          ora_inizio: { type: ["string", "null"], description: "HH:MM, solo se giorno_intero è false." },
          ora_fine: { type: ["string", "null"] },
          motivo: { type: ["string", "null"] },
        },
        required: ["data_inizio"],
      },
    },
    ore_minime_cancellazione: {
      type: ["integer", "null"],
      description: "SOLO se il testo specifica esplicitamente una politica di cancellazione in ore (es. 'si cancella fino a 24 ore prima'). Altrimenti null.",
    },
  };
  // `associazioni` NON e' obbligatorio: la sua assenza e' un'informazione
  // ("il testo non parlava di chi fa cosa"), e obbligarlo costringerebbe il
  // modello a inventarsi un elenco vuoto, che significa il contrario.
  const required = ["orari", "operatori", "servizi"];

  if (haPromemoria) {
    properties.promemoria = {
      type: ["object", "null"],
      description:
        "Promemoria automatici al cliente prima dell'appuntamento, solo se il testo ne parla (es. 'mando un promemoria il giorno prima').",
      properties: {
        ore_preavviso: {
          type: "array",
          items: { type: "integer" },
          description: "Quante ore prima avvisare. 'il giorno prima' = 24. Più valori = più promemoria.",
        },
      },
    };
  }

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

Non aggiungere servizi, operatori o informazioni che il testo non menziona in nessun modo, anche se ti sembrano "tipici" per quel genere di attività.

COME FUNZIONA LA BOZZA: ti viene mostrata la CONFIGURAZIONE ATTUALE dell'attività, con gli id di ogni riga. Tu NON restituisci "cosa cambiare": restituisci lo STATO FINALE, cioè com'è la configurazione quando hai finito.

- Una persona o un servizio che c'è già e non cambia: riportalo comunque, con il suo id esatto.
- Una persona o un servizio che c'è già e va corretto (nome, prezzo, durata): riportalo con lo stesso id e i valori nuovi. Non toglierlo per rimetterlo: perderebbe il suo storico.
- Qualcosa di nuovo: riportalo con id null.
- Qualcosa che il titolare dice di togliere: semplicemente non riportarlo.

Questo è il motivo per cui gli id contano: se il titolare dice "siamo in due" e nella configurazione attuale ci sono già due persone, la risposta giusta è riportare quelle due con i loro id, non aggiungerne altre due.

Se una cosa esiste già ed è giusta ma il titolare non la nomina affatto, riportala invariata: il suo silenzio non vuol dire che vada tolta.`;

/**
 * La configurazione attuale come la vede il modello: JSON compatto, con gli
 * id veri. E' il pezzo che rende possibile correggere invece che duplicare.
 */
function descriviStatoAttuale(stato: StatoSalone): string {
  // Gli orari vanno mostrati SEMPRE, anche a un'attività senza operatori né
  // servizi: il trigger di registrazione crea comunque le sette righe, e un
  // modello che non li vede è costretto a riscrivere la settimana da zero.
  // È metà della correzione del 18/09/2026 (l'altra metà è diffOrari): far
  // vedere al modello cosa c'è gli toglie il bisogno di indovinarlo.
  const orari = [
    "ORARI DI APERTURA ATTUALI:",
    JSON.stringify(
      stato.orari.map((o) => ({
        giorno_settimana: o.giornoSettimana,
        chiuso: o.chiuso,
        apertura: o.apertura,
        chiusura: o.chiusura,
        pausa_inizio: o.pausaInizio,
        pausa_fine: o.pausaFine,
      })),
      null,
      1
    ),
    "Ripeti nel campo `orari` solo i giorni che devono CAMBIARE rispetto a questi.",
  ].join("\n");

  if (stato.operatori.length === 0 && stato.servizi.length === 0) {
    return [
      "CONFIGURAZIONE ATTUALE: nessun operatore e nessun servizio, l'attività è ancora da configurare.",
      orari,
    ].join("\n\n");
  }
  const nomeDi = (id: string) =>
    stato.operatori.find((o) => o.id === id)?.nome ?? stato.servizi.find((s) => s.id === id)?.nome ?? id;

  return [
    "CONFIGURAZIONE ATTUALE (usa questi id esatti per le righe che esistono già):",
    JSON.stringify(
      {
        operatori: stato.operatori.map((o) => ({ id: o.id, nome: o.nome, descrizione: o.descrizione, attivo: o.attivo })),
        servizi: stato.servizi.map((s) => ({
          id: s.id,
          nome: s.nome,
          durata_minuti: s.durataMinuti,
          prezzo_euro: s.prezzoEuro,
          attivo: s.attivo,
        })),
        chi_fa_cosa: stato.associazioni.map((a) => `${nomeDi(a.operatoreId)} -> ${nomeDi(a.servizioId)}`),
      },
      null,
      1
    ),
    "",
    orari,
  ].join("\n");
}

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
  statoAttuale: StatoSalone,
  opzioni: { haPromemoria?: boolean; oggi?: Date } = {},
  clientAnthropic: ClienteAnthropic = ottieniClientPredefinito()
): Promise<RisultatoGenerazioneBozza> {
  const haPromemoria = opzioni.haPromemoria ?? false;
  // "Chiudiamo dal 10 al 20 agosto" non si puo' tradurre in date senza
  // sapere che giorno e' oggi. Senza questa riga il modello tirerebbe a
  // indovinare l'anno, ed e' esattamente il tipo di errore che chiude un
  // salone in un giorno a caso.
  const oggi = (opzioni.oggi ?? new Date()).toISOString().slice(0, 10);
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
          input_schema: costruisciSchemaBozza(haKnowledgeBaseAi, haPromemoria),
        },
      ],
      tool_choice: { type: "tool", name: "restituisci_bozza" },
      messages: [
        {
          role: "user",
          content: `Oggi è ${oggi}.\n\n${descriviStatoAttuale(statoAttuale)}\n\nDESCRIZIONE DEL TITOLARE:\n${testoPulito}`,
        },
      ],
    });
  } catch (errore) {
    console.error("Errore generando la bozza di onboarding:", errore);
    return { ok: false, errore: "Si è verificato un problema tecnico generando la bozza. Riprova tra poco." };
  }

  const bloccoTool = risposta.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!bloccoTool) {
    return { ok: false, errore: "Il modello non ha restituito una bozza valida. Riprova, magari con una descrizione un po' più dettagliata." };
  }

  const bozza = validaBozzaGrezza(bloccoTool.input, haKnowledgeBaseAi, haPromemoria);
  if (bozzaVuota(bozza)) {
    return {
      ok: false,
      errore: "Non sono riuscito a estrarre nulla di utilizzabile da questa descrizione. Prova ad aggiungere qualche dettaglio in più (servizi, orari, chi lavora da te).",
    };
  }
  return { ok: true, bozza };
}
