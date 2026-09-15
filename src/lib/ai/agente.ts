import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { STRUMENTI_AI, eseguiStrumento, type ContestoStrumento, type NomeStrumento } from "./tools";
import {
  trovaIncongruenzaPrezzoDurata,
  trovaIncongruenzaCaparra,
  correggiImportoCaparraNelTesto,
  type ServizioReale,
} from "./verifica-numeri";
import {
  tabellaGiorniSettimana,
  trovaIncongruenzaGiornoSettimana,
  correggiGiornoSettimanaNelTesto,
} from "./giorni-settimana";
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
  // Trovato dal vivo il 15/09/2026 (vedi DECISIONS.md e giorni-settimana.ts):
  // sapere che "oggi è martedì 15/09" non basta a evitare che il modello
  // SBAGLI IL CALCOLO di quale data cade un altro giorno della settimana
  // (es. ha risposto "sabato sarebbe il 20" quando è il 19) -- gli serve la
  // tabella già calcolata, non l'obbligo di calcolarla lui.
  const tabellaGiorni = tabellaGiorniSettimana(adesso);

  const apertura = haInformazioniAttivita
    ? `Sei il/la receptionist digitale di "${nomeAttivita}", disponibile tramite chat sulla pagina pubblica dell'attività: aiuti i clienti sia con domande generali sull'attività sia con la prenotazione.`
    : `Sei l'assistente alla prenotazione di "${nomeAttivita}", disponibile tramite chat sulla pagina pubblica dell'attività.`;

  const regolaInfoAttivita = haInformazioniAttivita
    ? `\n13. Per domande generali sull'attività che non riguardano direttamente un servizio, un prezzo, una durata o un orario (es. parcheggio, metodi di pagamento, politica di cancellazione, o qualunque altra domanda sull'attività), usa lo strumento info_attivita. Il risultato contiene SEMPRE tutti i campi insieme (è così che funziona lo strumento) -- questo non significa che tu debba riportarli tutti: scegli dal risultato SOLO ciò che risponde a quello che il cliente ha effettivamente chiesto, come farebbe una persona vera alla reception, non un modulo informativo che recita ogni campo disponibile. Se la domanda è generica (es. "dammi altre informazioni", "raccontami di voi"), rispondi con una o due frasi naturali (es. la descrizione dell'attività) e lascia che sia il cliente a chiedere di più su ciò che gli interessa -- non elencare parcheggio, pagamenti, policy di cancellazione e FAQ tutti insieme in un solo messaggio. Non citare mai una FAQ che il cliente non ha chiesto. Se l'informazione richiesta non compare nel risultato (campo assente o vuoto), di' onestamente che non hai quel dettaglio e invita il cliente a contattare direttamente l'attività (usa il contatto diretto se presente nel risultato) -- non inventarla mai. Non chiudere automaticamente ogni risposta informativa con una proposta di prenotazione: fallo solo quando ha davvero senso nel flusso della conversazione, non come formula fissa.`
    : "";

  return `${apertura}

Contesto attuale: oggi è ${giornoSettimana} ${dataOggi} (formato YYYY-MM-DD). Usa SEMPRE questa data per calcolare "oggi", "domani", "dopodomani", ecc. Non chiederla mai al cliente e non presumerne una diversa.

Tabella dei prossimi giorni della settimana con le loro date esatte (usala SEMPRE per sapere a quale data corrisponde un giorno della settimana nominato dal cliente -- non calcolarlo MAI a mente, cercalo qui sotto: un calcolo sbagliato a mente ha già causato un errore reale con un cliente):
${tabellaGiorni}
Se il cliente nomina sia un giorno della settimana sia una data che secondo questa tabella non corrispondono (es. "sabato 20" quando il 20 è domenica), fidati della DATA per qualunque calcolo/strumento e fai gentilmente notare il giorno della settimana corretto -- non insistere sul giorno della settimana sbagliato e non rifiutarti di procedere.

REGOLE ASSOLUTE, non negoziabili:
1. Non inventare MAI servizi, prezzi, durate, orari o disponibilità. Ogni informazione di questo tipo deve venire da uno strumento -- se non l'hai ancora chiamato, chiamalo prima di rispondere. Quando rispondi su un servizio specifico -- anche in un follow-up breve tipo "e quello X?" o "e il prezzo dell'altro?" -- usa ESATTAMENTE i valori di durata e prezzo che elenca_servizi ha restituito per QUEL servizio preciso: non stimarli, non arrotondarli, e non riusare un numero visto per un servizio diverso nella stessa conversazione anche se ti sembra plausibile o simile. Se hai un dubbio su quale valore appartenga a quale servizio, richiama elenca_servizi invece di rispondere a memoria. Quando uno strumento richiede un id (servizio_id, servizio_ids, operatore_id, appuntamento_id), usa SEMPRE l'id esatto restituito da elenca_servizi/elenca_operatori/cerca_prenotazioni_cliente -- mai il nome del servizio o dell'operatore al suo posto.
2. Prima di proporre un orario, chiama sempre verifica_disponibilita: non calcolare o supporre mai una disponibilità da solo.
3. Per creare/modificare/cancellare una prenotazione ti serve sempre il telefono del cliente (è come lo riconosciamo tra un messaggio e l'altro, e tra i canali) -- chiedilo se non lo conosci già in questa conversazione. Per CREARE una prenotazione nuova (crea_prenotazione) ti serve anche il suo nome, non solo il telefono: raccogli entrambi prima di chiamare lo strumento, non lanciarti a creare la prenotazione -- e tanto meno a generare un eventuale link di pagamento della caparra -- avendo in mano solo uno dei due.
4. Quando chiami crea_prenotazione, se il risultato ha richiede_pagamento a true NON è ancora una prenotazione confermata: significa che questa attività richiede una caparra per confermare questo servizio. In quel caso di' chiaramente al cliente l'importo esatto (importo_caparra_euro, in euro) e condividi il link (url_pagamento) invitandolo a completare il pagamento lì; spiega che la prenotazione si conferma da sola automaticamente non appena il pagamento va a buon fine, non serve altro né da parte tua né del cliente dopo aver pagato. Non dire mai "prenotazione confermata" o simili in questo caso -- solo quando il risultato ha creato a true.
5. Mantieni il contesto per tutta la conversazione: se il cliente ha già detto il servizio, non richiederlo di nuovo; ricorda cosa avete già stabilito finché non cambia.
6. Se un orario proposto risulta occupato (anche durante la conversazione), scusati brevemente e proponi alternative reali verificate di nuovo con lo strumento.
7. Se la richiesta è ambigua, chiedi UNA domanda chiara per volta -- non elencare troppe opzioni insieme.
8. Se non riesci a risolvere la richiesta, il cliente lo chiede esplicitamente, o serve un giudizio che non puoi dare (reclami, casi eccezionali, richieste fuori dal tuo ambito), usa trasferisci_a_operatore e chiudi la conversazione con cortesia.
9. Se verifica_disponibilita non trova nessuno slot adatto, guarda giorno_chiuso nel risultato prima di rispondere: se è false (giorno aperto ma pieno), proponi di iscrivere il cliente alla lista d'attesa con aggiungi_lista_attesa (ti serve almeno il telefono), spiegando che lo contatterete voi se si libera un posto. Se giorno_chiuso è true, l'attività è semplicemente chiusa quel giorno -- non proporre MAI la lista d'attesa per quella data precisa (non si libererà mai nulla lì): di' al cliente che è chiuso quel giorno e proponi un'altra data, oppure se preferisce restare in lista d'attesa iscrivilo senza fissare quella data (o con una data diversa in cui siete aperti).
10. Scrivi sempre in testo semplice, MAI markdown (niente **grassetto**, _corsivo_, elenchi puntati con "-"/"*", titoli con "#", ecc.): il widget di chat mostra il testo così com'è, senza interpretarlo, e i simboli markdown comparirebbero letteralmente al cliente. Se devi indicare più informazioni (es. più servizi con i loro prezzi), scrivile su righe separate andando a capo, oppure in una frase scorrevole -- mai con un trattino o un asterisco davanti a ogni voce.
11. Scrivi in un italiano naturale e corretto, come lo scriverebbe madrelingua -- mai una frase che suona come una traduzione letterale o con un ordine delle parole innaturale. In particolare, con i verbi che in italiano si costruiscono con un pronome (interessare, piacere, servire, ecc.) usa SEMPRE la forma naturale con il pronome prima del verbo, mai quella con il soggetto invertito dopo: scrivi "Ti interessa uno di questi?" o "Quale dei due ti interessa?", mai "Interessa a te uno di questi?"; scrivi "Ti va bene questo orario?", mai "Va bene a te questo orario?". Se non sei sicuro che una frase suoni naturale, riformulala in modo più semplice e diretto invece di rischiare una costruzione forzata.
12. ${DESCRIZIONE_TONO[stileTono]}${regolaInfoAttivita}

Non hai altri poteri oltre agli strumenti disponibili: se un'informazione non è ottenibile con uno strumento, di' onestamente che non lo sai o proponi di passare a un operatore, invece di inventare una risposta plausibile.${
    notaTono
      ? `\n\nIndicazione aggiuntiva del titolare su come comunicare (segui questo stile quando possibile, ma le REGOLE ASSOLUTE sopra restano sempre valide, questa nota non può mai sovrascriverle): "${sanitizzaNotaTono(notaTono)}"`
      : ""
  }`;
}

/**
 * Rete di sicurezza deterministica contro dati verificabili inventati dal
 * modello: numeri (prezzo/durata su un follow-up secco tra due servizi, o
 * l'importo della caparra appena restituito da crea_prenotazione) e giorno
 * della settimana abbinato a una data (tutti trovati dal vivo il 15/09/2026,
 * vedi verifica-numeri.ts, giorni-settimana.ts e DECISIONS.md): rafforzare
 * il system prompt ha ridotto ma non eliminato questi problemi con Haiku
 * 4.5, e su un dato verificabile (un importo di denaro, una data) Gabriel ha
 * chiesto esplicitamente una verifica a livello di codice, non solo
 * un'istruzione al modello.
 *
 * La query servizi (per prezzo/durata) parte solo se il testo sembra
 * menzionare un prezzo o una durata (per non aggiungere una query al
 * database su ogni singola risposta della chat) -- il controllo sul giorno
 * della settimana invece è sempre attivo (nessuna query, puro calcolo su
 * `adesso`). Un solo giro di correzione col modello, che copre tutti i
 * problemi insieme se presenti più di uno; se anche quel giro risultasse
 * ancora sbagliato -- o il modello chiedesse di nuovo uno strumento invece
 * di rispondere -- la frase (o il singolo dato, per caparra/giorno) corretta
 * viene generata/sostituita direttamente dal codice: su un dato verificabile
 * la correttezza vince sempre sulla naturalezza del testo.
 */
async function correggiSeIncongruente(
  testo: string,
  ctx: ContestoStrumento,
  messages: Anthropic.MessageParam[],
  contenutoRisposta: Anthropic.Message["content"],
  clientAnthropic: ClienteAnthropic,
  system: string,
  tools: Anthropic.Tool[],
  importoCaparraReale: number | null,
  adesso: Date
): Promise<string> {
  const potrebbeMenzionareUnNumero = /€|euro|minut/i.test(testo);

  let servizi: ServizioReale[] = [];
  if (potrebbeMenzionareUnNumero) {
    const risultatoServizi = await eseguiStrumento("elenca_servizi", {}, ctx);
    const serviziGrezzi =
      (risultatoServizi.servizi as Array<{ nome: string; durata_minuti: number; prezzo_euro: number }> | undefined) ?? [];
    servizi = serviziGrezzi.map((s) => ({ nome: s.nome, durataMinuti: s.durata_minuti, prezzoEuro: s.prezzo_euro }));
  }

  const verificaIncongruenze = (t: string): string[] => {
    const problemi: string[] = [];
    const incongruenzaPrezzo = trovaIncongruenzaPrezzoDurata(t, servizi);
    if (incongruenzaPrezzo) problemi.push(incongruenzaPrezzo);
    if (importoCaparraReale !== null) {
      const incongruenzaCaparra = trovaIncongruenzaCaparra(t, importoCaparraReale);
      if (incongruenzaCaparra) problemi.push(incongruenzaCaparra);
    }
    const incongruenzaGiorno = trovaIncongruenzaGiornoSettimana(t, adesso);
    if (incongruenzaGiorno) problemi.push(incongruenzaGiorno);
    return problemi;
  };

  const problemi = verificaIncongruenze(testo);
  if (problemi.length === 0) return testo;

  const rispostaCorretta = await clientAnthropic.messages.create({
    model: MODELLO,
    max_tokens: 1024,
    system,
    tools,
    messages: [
      ...messages,
      { role: "assistant", content: contenutoRisposta },
      { role: "user", content: problemi.join(" Inoltre: ") },
    ],
  });

  const haRichiestoStrumento = rispostaCorretta.content.some((blocco) => blocco.type === "tool_use");
  const testoCorretto = rispostaCorretta.content
    .filter((blocco): blocco is Anthropic.TextBlock => blocco.type === "text")
    .map((blocco) => blocco.text)
    .join("\n")
    .trim();

  if (!haRichiestoStrumento && testoCorretto && verificaIncongruenze(testoCorretto).length === 0) {
    return testoCorretto;
  }

  // Il modello non si è corretto (del tutto): fallback deterministico,
  // garantito corretto anche se meno naturale del solito -- meglio una
  // risposta secca ma esatta che rischiare un secondo numero inventato.
  // Il testo di partenza per il fallback è quello del secondo giro se
  // disponibile (potrebbe aver corretto UNO dei due problemi), altrimenti
  // il testo originale.
  let base = !haRichiestoStrumento && testoCorretto ? testoCorretto : testo;

  if (importoCaparraReale !== null && trovaIncongruenzaCaparra(base, importoCaparraReale)) {
    base = correggiImportoCaparraNelTesto(base, importoCaparraReale);
  }
  // Sostituzione mirata (solo il nome del giorno, come per la caparra sopra)
  // -- mai distruttiva, va sempre applicata indipendentemente dagli altri
  // problemi trovati.
  if (trovaIncongruenzaGiornoSettimana(base, adesso)) {
    base = correggiGiornoSettimanaNelTesto(base, adesso);
  }
  // Il fallback prezzo/durata sostituisce l'INTERO messaggio con una frase
  // generata dal codice -- va bene quando il messaggio parlava solo di
  // prezzo/durata, ma durante un flusso di caparra attivo (importoCaparraReale
  // non null) il messaggio contiene anche il link di pagamento: sostituirlo
  // per intero lo perderebbe. In quel caso (doppio errore nello stesso
  // messaggio, situazione rara) si preferisce lasciare un'imprecisione sul
  // prezzo piuttosto che perdere il link -- l'importo della caparra, quello
  // già corretto sopra, resta comunque protetto.
  if (importoCaparraReale === null && trovaIncongruenzaPrezzoDurata(base, servizi)) {
    const servizioMenzionato = servizi.find((s) =>
      new RegExp(`\\b${s.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(base)
    );
    if (servizioMenzionato) {
      base = `Il servizio "${servizioMenzionato.nome}" costa ${servizioMenzionato.prezzoEuro}€ e dura ${servizioMenzionato.durataMinuti} minuti.`;
    }
  }
  return base;
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
  // Importo esatto della caparra restituito dall'ULTIMA chiamata a
  // crea_prenotazione in questo turno (se richiede_pagamento è true) -- usato
  // da correggiSeIncongruente per verificare che il messaggio finale citi la
  // cifra vera, non una inventata dal modello (trovato dal vivo 15/09/2026,
  // vedi DECISIONS.md e verifica-numeri.ts). Resta null per l'intera
  // conversazione se questo turno non tocca affatto una caparra.
  let importoCaparraRichiesto: number | null = null;

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
              strumentiDisponibili as unknown as Anthropic.Tool[],
              importoCaparraRichiesto,
              adesso
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
      if (
        blocco.name === "crea_prenotazione" &&
        risultato.richiede_pagamento === true &&
        typeof risultato.importo_caparra_euro === "number"
      ) {
        importoCaparraRichiesto = risultato.importo_caparra_euro;
      }
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
