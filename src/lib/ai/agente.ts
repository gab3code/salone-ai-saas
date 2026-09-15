import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { STRUMENTI_AI, eseguiStrumento, type ContestoStrumento, type NomeStrumento } from "./tools";
import { trovaIncongruenzaPrezzoDurata, type ServizioReale } from "./verifica-numeri";
import { pulisciMarkdown } from "./pulisci-markdown";

/**
 * Il loop vero e proprio (Task #66): MESSAGGIO -> AI -> intent/contesto ->
 * tool -> backend -> database -> risultato -> AI -> risposta (punto 7 di
 * CLAUDE.md). L'AI interpreta e decide COSA fare, ma ogni fatto che finisce
 * nella sua risposta passa SEMPRE da uno strumento reale -- mai un prezzo,
 * un orario o una disponibilità inventati dal modello.
 *
 * Il modello è una costante isolata apposta (facile da cambiare in futuro,
 * non un'architettura da riscrivere): per ora `claude-haiku-4-5`, la scelta
 * più economica adatta a una conversazione strutturata di tool-calling --
 * rilevante perché il piano Free (punto 20) deve includere l'AI senza
 * costare più del ricavo che porta. Se in prova reale la qualità non basta
 * per gestire bene ambiguità/correzioni (punto 8), è una riga sola da
 * cambiare, non da presentare come scelta definitiva.
 */
const MODELLO = "claude-haiku-4-5-20251001";
const MAX_ITERAZIONI_TOOL = 8; // difesa contro un loop di tool-calling che non si ferma mai

let clientPredefinito: Anthropic | null = null;
function ottieniClientPredefinito(): Anthropic {
  if (!clientPredefinito) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY mancante in .env.local");
    clientPredefinito = new Anthropic({ apiKey });
  }
  return clientPredefinito;
}

/** Sottoinsieme minimo del client Anthropic di cui questo modulo ha bisogno -- permette di
 *  iniettare un client finto nei test senza toccare la rete reale. */
export interface ClienteAnthropic {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export interface MessaggioConversazione {
  ruolo: "cliente" | "assistente";
  contenuto: string;
}

export interface RisultatoConversazione {
  rispostaTesto: string;
  trasferitoAUmano: boolean;
  // true se in QUESTO turno (anche su più iterazioni del loop di
  // tool-calling) è stato usato almeno uno strumento reale -- usato da chi
  // chiama (route.ts) come proxy anti-abuso per "questo scambio riguardava
  // davvero una prenotazione", vedi limiti.ts e DECISIONS.md 14/09/2026.
  usoStrumenti: boolean;
}

const GIORNI_SETTIMANA_IT = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
];

/**
 * Tono dell'AI personalizzabile (Fase 5, riservato a Pro/Enterprise --
 * `pianoHaTonoPersonalizzato` in limiti.ts, gate applicato da chi chiama
 * `rispondiConversazione`, non qui dentro). Guidato a poche opzioni fisse
 * invece di un prompt libero (deciso in docs/analisi-estetia.md punto 3):
 * più accessibile per un titolare che non sa scrivere un prompt, e più
 * sicuro -- nessuna frase scritta da un titolare può mai sovrascrivere la
 * regola 8 per intero, solo scegliere tra queste varianti pre-scritte.
 */
export type StileTonoAI = "professionale" | "amichevole" | "informale_con_emoji";

const DESCRIZIONE_TONO: Record<StileTonoAI, string> = {
  professionale:
    "Tono professionale, cordiale, conciso -- risposte brevi, come una vera persona alla reception, non un elenco puntato.",
  amichevole:
    "Tono amichevole e caloroso ma comunque professionale -- rivolgiti al cliente in modo colloquiale e accogliente, come un membro dello staff che conosce bene i clienti abituali, restando comunque conciso.",
  informale_con_emoji:
    "Tono informale e frizzante, con al massimo un'emoji pertinente per messaggio (mai più di una, mai a sproposito) -- adatto a un pubblico giovane, ma le risposte restano sempre chiare, mai confuse o infantili.",
};

/**
 * La nota del titolare (`tenants.tono_ai_nota`) è testo libero breve, quindi
 * va trattata come dato non fidato quanto un messaggio di un cliente: niente
 * a capo/tab (per non poter imitare la formattazione delle REGOLE ASSOLUTE
 * sotto) e lunghezza ricontrollata qui, oltre al check già presente nel
 * database e alla validazione lato form -- difesa in profondità, stesso
 * principio già seguito per FORMATO_TELEFONO in azioni.ts.
 */
function sanitizzaNotaTono(nota: string | null | undefined): string | null {
  if (!nota) return null;
  const pulita = nota.replace(/[\r\n\t]+/g, " ").trim().slice(0, 300);
  return pulita || null;
}

function costruisciSystemPrompt(
  nomeAttivita: string,
  adesso: Date,
  stileTono: StileTonoAI = "professionale",
  notaTono?: string | null,
  haInformazioniAttivita: boolean = false
): string {
  // Verificato dal vivo (Task #66): senza questa data il modello non inventa
  // un giorno a caso (bene), ma la chiede al cliente per calcolare "domani" --
  // pessima esperienza, e se il cliente sbagliasse la data digitata sarebbe
  // comunque un dato "inventato" (dall'utente, non dal modello, ma altrettanto
  // sbagliato). Fuso orario semplificato come UTC, stessa scelta già fatta nel
  // motore di prenotazione (vedi problema noto #1 in PROJECT_STATUS.md).
  const dataOggi = adesso.toISOString().slice(0, 10);
  const giornoSettimana = GIORNI_SETTIMANA_IT[adesso.getUTCDay()];

  const apertura = haInformazioniAttivita
    ? `Sei il/la receptionist digitale di "${nomeAttivita}", disponibile tramite chat sulla pagina pubblica dell'attività: aiuti i clienti sia con domande generali sull'attività sia con la prenotazione.`
    : `Sei l'assistente alla prenotazione di "${nomeAttivita}", disponibile tramite chat sulla pagina pubblica dell'attività.`;

  const regolaInfoAttivita = haInformazioniAttivita
    ? `\n12. Per domande generali sull'attività che non riguardano direttamente un servizio, un prezzo, una durata o un orario (es. parcheggio, metodi di pagamento, politica di cancellazione, o qualunque altra domanda sull'attività), usa lo strumento info_attivita. Il risultato contiene SEMPRE tutti i campi insieme (è così che funziona lo strumento) -- questo non significa che tu debba riportarli tutti: scegli dal risultato SOLO ciò che risponde a quello che il cliente ha effettivamente chiesto, come farebbe una persona vera alla reception, non un modulo informativo che recita ogni campo disponibile. Se la domanda è generica (es. "dammi altre informazioni", "raccontami di voi"), rispondi con una o due frasi naturali (es. la descrizione dell'attività) e lascia che sia il cliente a chiedere di più su ciò che gli interessa -- non elencare parcheggio, pagamenti, policy di cancellazione e FAQ tutti insieme in un solo messaggio. Non citare mai una FAQ che il cliente non ha chiesto. Se l'informazione richiesta non compare nel risultato (campo assente o vuoto), di' onestamente che non hai quel dettaglio e invita il cliente a contattare direttamente l'attività (usa il contatto diretto se presente nel risultato) -- non inventarla mai. Non chiudere automaticamente ogni risposta informativa con una proposta di prenotazione: fallo solo quando ha davvero senso nel flusso della conversazione, non come formula fissa.`
    : "";

  return `${apertura}

Contesto attuale: oggi è ${giornoSettimana} ${dataOggi} (formato YYYY-MM-DD). Usa SEMPRE questa data per calcolare "oggi", "domani", "dopodomani", giorni della settimana, ecc. Non chiederla mai al cliente e non presumerne una diversa.

REGOLE ASSOLUTE, non negoziabili:
1. Non inventare MAI servizi, prezzi, durate, orari o disponibilità. Ogni informazione di questo tipo deve venire da uno strumento -- se non l'hai ancora chiamato, chiamalo prima di rispondere. Quando rispondi su un servizio specifico -- anche in un follow-up breve tipo "e quello X?" o "e il prezzo dell'altro?" -- usa ESATTAMENTE i valori di durata e prezzo che elenca_servizi ha restituito per QUEL servizio preciso: non stimarli, non arrotondarli, e non riusare un numero visto per un servizio diverso nella stessa conversazione anche se ti sembra plausibile o simile. Se hai un dubbio su quale valore appartenga a quale servizio, richiama elenca_servizi invece di rispondere a memoria. Quando uno strumento richiede un id (servizio_id, servizio_ids, operatore_id, appuntamento_id), usa SEMPRE l'id esatto restituito da elenca_servizi/elenca_operatori/cerca_prenotazioni_cliente -- mai il nome del servizio o dell'operatore al suo posto.
2. Prima di proporre un orario, chiama sempre verifica_disponibilita: non calcolare o supporre mai una disponibilità da solo.
3. Per creare/modificare/cancellare una prenotazione ti serve sempre il telefono del cliente (è come lo riconosciamo tra un messaggio e l'altro, e tra i canali). Chiedilo se non lo conosci già in questa conversazione.
4. Mantieni il contesto per tutta la conversazione: se il cliente ha già detto il servizio, non richiederlo di nuovo; ricorda cosa avete già stabilito finché non cambia.
5. Se un orario proposto risulta occupato (anche durante la conversazione), scusati brevemente e proponi alternative reali verificate di nuovo con lo strumento.
6. Se la richiesta è ambigua, chiedi UNA domanda chiara per volta -- non elencare troppe opzioni insieme.
7. Se non riesci a risolvere la richiesta, il cliente lo chiede esplicitamente, o serve un giudizio che non puoi dare (reclami, casi eccezionali, richieste fuori dal tuo ambito), usa trasferisci_a_operatore e chiudi la conversazione con cortesia.
8. Se verifica_disponibilita non trova nessuno slot adatto, non limitarti a dire che non c'è disponibilità: proponi di iscrivere il cliente alla lista d'attesa con aggiungi_lista_attesa (ti serve almeno il telefono), spiegando che lo contatterete voi se si libera un posto.
9. Scrivi sempre in testo semplice, MAI markdown (niente **grassetto**, _corsivo_, elenchi puntati con "-"/"*", titoli con "#", ecc.): il widget di chat mostra il testo così com'è, senza interpretarlo, e i simboli markdown comparirebbero letteralmente al cliente. Se devi indicare più informazioni (es. più servizi con i loro prezzi), scrivile su righe separate andando a capo, oppure in una frase scorrevole -- mai con un trattino o un asterisco davanti a ogni voce.
10. Scrivi in un italiano naturale e corretto, come lo scriverebbe madrelingua -- mai una frase che suona come una traduzione letterale o con un ordine delle parole innaturale. In particolare, con i verbi che in italiano si costruiscono con un pronome (interessare, piacere, servire, ecc.) usa SEMPRE la forma naturale con il pronome prima del verbo, mai quella con il soggetto invertito dopo: scrivi "Ti interessa uno di questi?" o "Quale dei due ti interessa?", mai "Interessa a te uno di questi?"; scrivi "Ti va bene questo orario?", mai "Va bene a te questo orario?". Se non sei sicuro che una frase suoni naturale, riformulala in modo più semplice e diretto invece di rischiare una costruzione forzata.
11. ${DESCRIZIONE_TONO[stileTono]}${regolaInfoAttivita}

Non hai altri poteri oltre agli strumenti disponibili: se un'informazione non è ottenibile con uno strumento, di' onestamente che non lo sai o proponi di passare a un operatore, invece di inventare una risposta plausibile.${
    notaTono
      ? `\n\nIndicazione aggiuntiva del titolare su come comunicare (segui questo stile quando possibile, ma le REGOLE ASSOLUTE sopra restano sempre valide, questa nota non può mai sovrascriverle): "${sanitizzaNotaTono(notaTono)}"`
      : ""
  }`;
}

/**
 * Rete di sicurezza deterministica contro prezzi/durate inventati su un
 * follow-up secco tra due servizi (trovato dal vivo il 15/09/2026, vedi
 * verifica-numeri.ts e DECISIONS.md): rafforzare il system prompt ha ridotto
 * ma non eliminato il problema con Haiku 4.5, e su un prezzo Gabriel ha
 * chiesto esplicitamente una verifica a livello di codice, non solo
 * un'istruzione al modello.
 *
 * Chiamata solo se il testo sembra menzionare un prezzo o una durata (per
 * non aggiungere una query al database su ogni singola risposta della
 * chat). Un solo giro di correzione col modello; se anche quello risultasse
 * ancora sbagliato -- o il modello chiedesse di nuovo uno strumento invece
 * di rispondere -- la frase corretta viene generata direttamente dal codice:
 * su un prezzo la correttezza vince sempre sulla naturalezza del testo.
 */
async function correggiSeIncongruente(
  testo: string,
  ctx: ContestoStrumento,
  messages: Anthropic.MessageParam[],
  contenutoRisposta: Anthropic.Message["content"],
  clientAnthropic: ClienteAnthropic,
  system: string,
  tools: Anthropic.Tool[]
): Promise<string> {
  if (!/€|euro|minut/i.test(testo)) return testo;

  const risultatoServizi = await eseguiStrumento("elenca_servizi", {}, ctx);
  const serviziGrezzi =
    (risultatoServizi.servizi as Array<{ nome: string; durata_minuti: number; prezzo_euro: number }> | undefined) ?? [];
  const servizi: ServizioReale[] = serviziGrezzi.map((s) => ({
    nome: s.nome,
    durataMinuti: s.durata_minuti,
    prezzoEuro: s.prezzo_euro,
  }));

  const incongruenza = trovaIncongruenzaPrezzoDurata(testo, servizi);
  if (!incongruenza) return testo;

  const rispostaCorretta = await clientAnthropic.messages.create({
    model: MODELLO,
    max_tokens: 1024,
    system,
    tools,
    messages: [...messages, { role: "assistant", content: contenutoRisposta }, { role: "user", content: incongruenza }],
  });

  const haRichiestoStrumento = rispostaCorretta.content.some((blocco) => blocco.type === "tool_use");
  const testoCorretto = rispostaCorretta.content
    .filter((blocco): blocco is Anthropic.TextBlock => blocco.type === "text")
    .map((blocco) => blocco.text)
    .join("\n")
    .trim();

  if (!haRichiestoStrumento && testoCorretto && !trovaIncongruenzaPrezzoDurata(testoCorretto, servizi)) {
    return testoCorretto;
  }

  // Il modello non si è corretto: fallback deterministico, garantito corretto
  // anche se meno naturale del solito -- meglio una frase secca ma esatta che
  // rischiare un secondo numero inventato.
  const servizioMenzionato = servizi.find((s) => new RegExp(`\\b${s.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(testo));
  return servizioMenzionato
    ? `Il servizio "${servizioMenzionato.nome}" costa ${servizioMenzionato.prezzoEuro}€ e dura ${servizioMenzionato.durataMinuti} minuti.`
    : testo;
}

/**
 * Gestisce un turno di conversazione: prende lo storico + il nuovo
 * messaggio del cliente, esegue il ciclo di tool-calling finché il modello
 * non produce una risposta testuale finale (o finché non si supera il
 * limite di sicurezza), e restituisce testo pronto da mandare al cliente.
 *
 * `ctx` include già tenantId + client Supabase admin (chi chiama ha già
 * risolto il tenant dallo slug pubblico, vedi risolviTenantIdDaSlug in
 * tools.ts) -- questa funzione non fa provisioning, solo conversazione.
 */
export async function rispondiConversazione(
  storico: MessaggioConversazione[],
  messaggioNuovo: string,
  ctx: ContestoStrumento & {
    nomeAttivita: string;
    tonoAi?: StileTonoAI;
    tonoAiNota?: string | null;
    haInformazioniAttivita?: boolean;
  },
  clientAnthropic: ClienteAnthropic = ottieniClientPredefinito(),
  adesso: Date = new Date()
): Promise<RisultatoConversazione> {
  const messages: Anthropic.MessageParam[] = [
    ...storico.map(
      (m): Anthropic.MessageParam => ({
        role: m.ruolo === "cliente" ? "user" : "assistant",
        content: m.contenuto,
      })
    ),
    { role: "user", content: messaggioNuovo },
  ];

  let trasferitoAUmano = false;
  let usoStrumenti = false;

  // Il tool info_attivita esiste solo per i tenant con la knowledge base
  // dell'AI receptionist (Pro/Enterprise, `pianoHaKnowledgeBaseAi` in
  // piani.ts, gate applicato da chi chiama questa funzione) -- un tenant
  // Growth mantiene la chat AI transazionale di oggi, ma il modello non deve
  // nemmeno vedere l'esistenza di questo strumento, altrimenti potrebbe
  // provare a chiamarlo comunque.
  const strumentiDisponibili = ctx.haInformazioniAttivita
    ? STRUMENTI_AI
    : STRUMENTI_AI.filter((s) => s.name !== "info_attivita");

  for (let iterazione = 0; iterazione < MAX_ITERAZIONI_TOOL; iterazione++) {
    const risposta = await clientAnthropic.messages.create({
      model: MODELLO,
      max_tokens: 1024,
      system: costruisciSystemPrompt(ctx.nomeAttivita, adesso, ctx.tonoAi, ctx.tonoAiNota, ctx.haInformazioniAttivita),
      tools: strumentiDisponibili as unknown as Anthropic.Tool[],
      messages,
    });

    const blocchiToolUse = risposta.content.filter(
      (blocco): blocco is Anthropic.ToolUseBlock => blocco.type === "tool_use"
    );

    if (blocchiToolUse.length === 0) {
      const testoGrezzo = risposta.content
        .filter((blocco): blocco is Anthropic.TextBlock => blocco.type === "text")
        .map((blocco) => blocco.text)
        .join("\n")
        .trim();
      // pulisciMarkdown PRIMA di correggiSeIncongruente (così la verifica
      // prezzo/durata lavora sul testo pulito) e di nuovo DOPO (il giro di
      // autocorrezione richiama lo stesso modello con lo stesso system
      // prompt, quindi può reintrodurre markdown allo stesso modo -- il
      // fallback deterministico non ne contiene mai, la seconda passata è a
      // costo zero in quel caso).
      const testo = testoGrezzo ? pulisciMarkdown(testoGrezzo) : testoGrezzo;
      const testoFinale = testo
        ? pulisciMarkdown(
            await correggiSeIncongruente(
              testo,
              ctx,
              messages,
              risposta.content,
              clientAnthropic,
              costruisciSystemPrompt(ctx.nomeAttivita, adesso, ctx.tonoAi, ctx.tonoAiNota, ctx.haInformazioniAttivita),
              strumentiDisponibili as unknown as Anthropic.Tool[]
            )
          )
        : testo;
      return { rispostaTesto: testoFinale || "Non sono riuscito a formulare una risposta.", trasferitoAUmano, usoStrumenti };
    }

    usoStrumenti = true;

    // Il modello vuole usare uno o più strumenti: eseguili DAVVERO (mai
    // simulare un risultato) e restituiscigli l'esito prima di continuare.
    messages.push({ role: "assistant", content: risposta.content });

    const risultatiTool: Anthropic.ToolResultBlockParam[] = [];
    for (const blocco of blocchiToolUse) {
      const risultato = await eseguiStrumento(blocco.name as NomeStrumento, blocco.input as Record<string, unknown>, ctx);
      if (blocco.name === "trasferisci_a_operatore") trasferitoAUmano = true;
      risultatiTool.push({
        type: "tool_result",
        tool_use_id: blocco.id,
        content: JSON.stringify(risultato),
      });
    }
    messages.push({ role: "user", content: risultatiTool });
  }

  // Troppi giri di tool-calling senza una risposta finale: meglio fermarsi
  // e passare a un umano che continuare a girare a vuoto sul cliente reale.
  return {
    rispostaTesto:
      "Mi scuso, sto avendo difficoltà a completare questa richiesta. Ti metto in contatto con un operatore.",
    trasferitoAUmano: true,
    usoStrumenti: true, // per finire qui ogni iterazione ha per forza usato uno strumento
  };
}
