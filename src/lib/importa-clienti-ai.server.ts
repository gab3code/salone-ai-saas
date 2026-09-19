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

/* ------------------------------------------------------------------
 * LA FOTO DELL'AGENDA (19/09/2026).
 *
 * Il caso vero: un quaderno, una pagina di agenda, lo schermo del vecchio
 * gestionale fotografato col telefono. Qui il modello non "recupera" righe
 * che il codice ha gia' visto: e' l'unico lettore, e quindi le reti devono
 * stringersi di piu', non di meno.
 *
 * Il patto e' lo stesso -- propone, il titolare conferma -- con tre cose in
 * piu' rispetto alle righe di testo:
 *  1. il modello TRASCRIVE ogni voce cosi' com'e' scritta, e la trascrizione
 *     torna al titolare accanto alla proposta: e' il suo modo di controllare
 *     con gli occhi, sulla foto che ha davanti, prima di spuntare;
 *  2. dove una cifra non si legge il modello scrive "?", e una voce con un
 *     "?" nella trascrizione NON viene proposta, mai. Un numero con una
 *     cifra indovinata e' peggio di un numero mancante: al primo il salone
 *     scrive, e nessuno risponde;
 *  3. il numero proposto deve comparire nella trascrizione (stessa rete di
 *     `numeroPresoDallaRiga`): cosi' quello che il titolare vede e quello
 *     che viene scritto sono la stessa cosa.
 *
 * Le voci non proposte non spariscono: tornano come "non lette", con la
 * trascrizione, cosi' si aggiungono a mano guardando la foto.
 *
 * Costo: una chiamata per foto, con l'immagine (ridotta dal browser a 1568
 * px sul lato lungo: e' il massimo che il modello usa, oltre butta via
 * pixel e basta), registrata come "import_clienti". La quota e' la stessa
 * delle righe non capite: una foto = un uso.
 */

export const TIPI_IMMAGINE_IMPORT = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type TipoImmagineImport = (typeof TIPI_IMMAGINE_IMPORT)[number];
/** Oltre questa dimensione (in byte, decodificata) la foto non parte: 4 MB bastano a una pagina a 1568 px. */
export const MAX_BYTE_FOTO_IMPORT = 4 * 1024 * 1024;
export const MAX_VOCI_PER_FOTO = 150;

export interface VoceNonLetta {
  trascrizione: string;
  /** Perche' non si propone: cifre incerte, nessun numero, numero non riconoscibile. */
  motivo: "cifre_incerte" | "senza_numero" | "numero_non_riconoscibile";
}

export interface EsitoLetturaFoto {
  proposte: (ClienteImportato & { rigaOriginale: string })[];
  nonLette: VoceNonLetta[];
  /** true quando il modello dice che nella foto non c'e' un elenco di persone. */
  nonEUnaRubrica: boolean;
}

const ISTRUZIONI_FOTO = `Ricevi la foto di un elenco di clienti di un salone: una pagina di agenda, un quaderno, un foglio, lo schermo di un programma. Devi trascrivere ogni voce e, da ognuna, estrarre nome, telefono, email.

Regole:
- "trascrizione": la voce cosi' com'e' scritta nella foto, parola per parola e cifra per cifra, senza interpretare. Dove una cifra NON si legge con certezza scrivi "?" al suo posto. Meglio un "?" in piu' che una cifra indovinata.
- "telefono": le cifre COPIATE dalla trascrizione. Non completare, non correggere, non indovinare. Se nella trascrizione c'e' un "?" fra le cifre del numero, metti telefono null e cifre_incerte true.
- "nome": il nome della persona, senza soprannomi o descrizioni ("Maria la bionda" -> "Maria"). Se non c'e', null.
- "note": tutto il resto della voce (preferenze, giorni, servizi), breve. Se non c'e', null.
- Un elemento per OGNI voce che vedi, anche quando non trovi un numero.
- Se la foto non contiene un elenco di persone (e' un paesaggio, un documento di altro tipo, illeggibile), restituisci "non_e_una_rubrica" true e nessuna voce.`;

export async function leggiRubricaDaFoto(
  immagine: { base64: string; tipo: TipoImmagineImport },
  opzioni: { tenantId: string | null },
  client: ClienteAnthropicImport = ottieniClientPredefinito()
): Promise<{ ok: true; esito: EsitoLetturaFoto } | { ok: false; errore: string }> {
  let risposta: Anthropic.Message;
  try {
    risposta = await client.messages.create({
      model: MODELLO,
      max_tokens: 8192,
      system: ISTRUZIONI_FOTO,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: immagine.tipo, data: immagine.base64 } },
            { type: "text", text: "Trascrivi le voci di questa foto e restituiscile con lo strumento." },
          ],
        },
      ],
      tools: [
        {
          name: "restituisci_voci_foto",
          description: "Le voci trascritte dalla foto, una per persona.",
          input_schema: {
            type: "object",
            properties: {
              non_e_una_rubrica: { type: "boolean" },
              voci: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    trascrizione: { type: "string", description: "La voce come e' scritta, con '?' al posto delle cifre illeggibili." },
                    nome: { type: ["string", "null"] },
                    telefono: { type: ["string", "null"] },
                    email: { type: ["string", "null"] },
                    note: { type: ["string", "null"] },
                    cifre_incerte: { type: "boolean" },
                  },
                  required: ["trascrizione", "nome", "telefono", "email", "note", "cifre_incerte"],
                },
              },
            },
            required: ["non_e_una_rubrica", "voci"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "restituisci_voci_foto" },
    });
  } catch (errore) {
    console.error("Import clienti: lettura della foto fallita", errore);
    return { ok: false, errore: "Non sono riuscito a leggere la foto adesso. Riprova fra poco." };
  }

  registraUsoApi({
    tenantId: opzioni.tenantId,
    canale: "import_clienti",
    modello: MODELLO,
    usage: (risposta as { usage?: unknown }).usage,
  });

  const blocco = risposta.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const input = blocco?.input as { non_e_una_rubrica?: unknown; voci?: unknown } | undefined;
  if (!input || !Array.isArray(input.voci)) {
    return { ok: false, errore: "Il modello non ha restituito niente di utilizzabile da questa foto." };
  }

  const esito: EsitoLetturaFoto = { proposte: [], nonLette: [], nonEUnaRubrica: input.non_e_una_rubrica === true };
  for (const voce of input.voci.slice(0, MAX_VOCI_PER_FOTO)) {
    if (!voce || typeof voce !== "object") continue;
    const v = voce as { trascrizione?: unknown; nome?: unknown; telefono?: unknown; email?: unknown; note?: unknown; cifre_incerte?: unknown };
    const trascrizione = pulisci(v.trascrizione, 300);
    if (!trascrizione) continue;
    // Rete 2: un "?" nella trascrizione, o il modello che si dichiara incerto,
    // e la voce non si propone. In codice, non nel prompt.
    if (v.cifre_incerte === true || trascrizione.includes("?")) {
      esito.nonLette.push({ trascrizione, motivo: "cifre_incerte" });
      continue;
    }
    const telefono = typeof v.telefono === "string" ? v.telefono.replace(/[\s.\-()]/g, "") : "";
    if (telefono === "") {
      esito.nonLette.push({ trascrizione, motivo: "senza_numero" });
      continue;
    }
    // Rete 1 e 3: numero riconoscibile, e preso dalla trascrizione.
    if (!telefonoUtilizzabile(telefono) || !numeroPresoDallaRiga(telefono, trascrizione)) {
      esito.nonLette.push({ trascrizione, motivo: "numero_non_riconoscibile" });
      continue;
    }
    esito.proposte.push({
      rigaOriginale: trascrizione,
      nome: pulisci(v.nome, 200),
      telefono,
      email: pulisci(v.email, 200),
      note: pulisci(v.note, 500),
    });
  }
  return { ok: true, esito };
}
