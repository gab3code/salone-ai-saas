import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { registraUsoApi } from "@/lib/ai/costi.server";
import { telefonoUtilizzabile, type ClienteImportato } from "@/lib/importa-clienti";

/**
 * Le righe dell'import che il codice non ha capito, passate al modello.
 *
 * `leggiIncolla` legge senza modello i tre casi che coprono quasi tutto
 * (Excel, CSV di un altro gestionale, "nome, numero"). Quello che resta --
 * righe irregolari, colonne mischiate, tutto in un campo solo, "Maria la
 * bionda del martedi' 333..." -- finiva fra le "non capite": si vedeva, ma
 * nessuno lo recuperava. Questo e' il posto naturale per il modello, con lo
 * stesso schema dell'onboarding assistito: **propone, il titolare conferma**.
 *
 * Tre regole, tutte in codice e non nel prompt:
 *  - ogni proposta passa da `telefonoUtilizzabile`: un numero che il codice
 *    non riconosce non entra, qualunque cosa dica il modello;
 *  - il numero proposto deve comparire nella riga originale (a meno di
 *    spazi, punti, trattini e parentesi): il modello puo' ripulire, non
 *    inventare. E' la rete contro il difetto piu' caro di tutti qui -- un
 *    numero "corretto" a cui poi il salone scrive senza risposta;
 *  - le proposte tornano marcate `propostoDallAi` e in revisione partono NON
 *    spuntate. Il silenzio non e' un ordine (stessa regola del diff).
 *
 * Costo: una chiamata per giro, poche righe, registrata in `usi_api_ai` con
 * canale "import_clienti"; la quota la consuma chi chiama, PRIMA.
 */

const MODELLO = "claude-haiku-4-5-20251001"; // stessa scelta di src/lib/ai/agente.ts
export const MAX_RIGHE_PER_RECUPERO = 60;

/** Lo stesso contratto minimo dell'onboarding: nei test si passa un finto. */
export interface ClienteAnthropicImport {
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

export interface EsitoRecupero {
  proposte: (ClienteImportato & { rigaOriginale: string })[];
  /** Righe per cui nemmeno il modello ha trovato un numero utilizzabile. */
  nonRecuperate: string[];
}

const ISTRUZIONI = `Ricevi righe di un elenco clienti di un salone che un lettore automatico non e' riuscito a interpretare. Per ogni riga estrai, se ci sono: il nome della persona, il numero di telefono, l'email.

Regole:
- Il numero di telefono lo COPI dalla riga, ripulito da spazi, punti, trattini e parentesi. Non lo completare, non lo correggere, non lo inventare: se nella riga non c'e' un numero di telefono, restituisci telefono null.
- Il nome e' quello della persona, senza soprannomi, note o descrizioni ("Maria la bionda del martedi'" -> "Maria"). Se il nome non c'e', null.
- Tutto quello che non e' nome, telefono o email (note, preferenze, giorni) va in "note", cosi' com'e', breve.
- Una riga puo' contenere piu' persone: in quel caso restituisci un elemento per persona, con la stessa riga_originale.
- Restituisci un elemento per OGNI riga ricevuta, anche quando non hai trovato niente (con i campi null).`;

/** Solo cifre, per confrontare il numero proposto con la riga da cui viene. */
function soloCifre(testo: string): string {
  return testo.replace(/\D/g, "");
}

/**
 * Il numero proposto e' "lo stesso" della riga se la sequenza di cifre del
 * numero compare in quella della riga. Un prefisso +39 aggiunto dal modello
 * viene accettato togliendolo: la riga contiene le cifre restanti.
 */
export function numeroPresoDallaRiga(telefono: string, riga: string): boolean {
  const cifreRiga = soloCifre(riga);
  const cifre = soloCifre(telefono);
  if (cifre === "" || cifreRiga === "") return false;
  if (cifreRiga.includes(cifre)) return true;
  const senzaPrefisso = cifre.replace(/^(0039|39)/, "");
  return senzaPrefisso.length >= 6 && cifreRiga.includes(senzaPrefisso);
}

export async function recuperaRigheConModello(
  righe: string[],
  opzioni: { tenantId: string | null },
  client: ClienteAnthropicImport = ottieniClientPredefinito()
): Promise<{ ok: true; esito: EsitoRecupero } | { ok: false; errore: string }> {
  const daLeggere = righe.map((r) => r.trim()).filter((r) => r !== "").slice(0, MAX_RIGHE_PER_RECUPERO);
  if (daLeggere.length === 0) return { ok: true, esito: { proposte: [], nonRecuperate: [] } };

  let risposta: Anthropic.Message;
  try {
    risposta = await client.messages.create({
      model: MODELLO,
      max_tokens: 4096,
      system: ISTRUZIONI,
      messages: [
        {
          role: "user",
          content: daLeggere.map((r, i) => `${i + 1}. ${r}`).join("\n"),
        },
      ],
      tools: [
        {
          name: "restituisci_clienti",
          description: "Le persone trovate nelle righe, una voce per persona.",
          input_schema: {
            type: "object",
            properties: {
              clienti: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    riga: { type: "integer", description: "Il numero della riga da cui viene (1-based)." },
                    nome: { type: ["string", "null"] },
                    telefono: { type: ["string", "null"] },
                    email: { type: ["string", "null"] },
                    note: { type: ["string", "null"] },
                  },
                  required: ["riga", "nome", "telefono", "email", "note"],
                },
              },
            },
            required: ["clienti"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "restituisci_clienti" },
    });
  } catch (errore) {
    console.error("Import clienti: chiamata al modello fallita", errore);
    return { ok: false, errore: "Non sono riuscito a leggere queste righe adesso. Riprova fra poco, o aggiungile a mano." };
  }

  registraUsoApi({
    tenantId: opzioni.tenantId,
    canale: "import_clienti",
    modello: MODELLO,
    usage: (risposta as { usage?: unknown }).usage,
  });

  const blocco = risposta.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const grezzo = (blocco?.input as { clienti?: unknown } | undefined)?.clienti;
  if (!Array.isArray(grezzo)) {
    return { ok: false, errore: "Il modello non ha restituito niente di utilizzabile. Aggiungi queste righe a mano." };
  }

  const proposte: EsitoRecupero["proposte"] = [];
  const righeRecuperate = new Set<number>();
  for (const voce of grezzo) {
    if (!voce || typeof voce !== "object") continue;
    const v = voce as { riga?: unknown; nome?: unknown; telefono?: unknown; email?: unknown; note?: unknown };
    const indice = typeof v.riga === "number" ? v.riga - 1 : -1;
    const rigaOriginale = daLeggere[indice];
    if (!rigaOriginale) continue;
    const telefono = typeof v.telefono === "string" ? v.telefono.replace(/[\s.\-()]/g, "") : "";
    // Le due reti deterministiche: numero riconoscibile, e preso dalla riga.
    if (!telefonoUtilizzabile(telefono) || !numeroPresoDallaRiga(telefono, rigaOriginale)) continue;
    proposte.push({
      rigaOriginale,
      nome: pulisci(v.nome, 200),
      telefono,
      email: pulisci(v.email, 200),
      note: pulisci(v.note, 500),
    });
    righeRecuperate.add(indice);
  }

  const nonRecuperate = daLeggere.filter((_, i) => !righeRecuperate.has(i));
  return { ok: true, esito: { proposte, nonRecuperate } };
}

function pulisci(valore: unknown, max: number): string | null {
  if (typeof valore !== "string") return null;
  const v = valore.trim().slice(0, max);
  return v === "" ? null : v;
}
