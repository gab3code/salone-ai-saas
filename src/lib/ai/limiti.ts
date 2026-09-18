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
  // Alzata da 1.000 a 2.500 il 17/09/2026. Mille messaggi sono circa 120-150
  // conversazioni al mese, cioe' 4-5 al giorno: per un salone che va bene e
  // che mette il link della pagina pubblica ovunque, non sono tante. E la
  // quota di Growth NON scala con gli operatori, quindi un salone con cinque
  // poltrone aveva lo stesso tetto di uno che lavora da solo.
  //
  // Quando la quota finisce, l'assistente smette di rispondere ai clienti di
  // un salone CHE PAGA, per un limite che protegge noi. Con i costi reali
  // (circa 0,02$ a prenotazione completa) 2.500 messaggi sono ~8$ al mese nel
  // caso peggiore su 39,90€ incassati: il tetto vecchio proteggeva qualcosa
  // che non aveva bisogno di essere protetto cosi' stretto.
  growth: 2500,
  pro: 3000,
  // ALTO ma FINITO, corretto il 17/09/2026 dopo un audit. Prima era
  // `Infinity`, che su carta vuol dire "nessun limite commerciale" e nella
  // pratica voleva dire che l'unico endpoint PUBBLICO e NON AUTENTICATO che
  // chiama il modello non aveva, per quei tenant, nessun tetto superiore:
  // chiunque conoscesse lo slug poteva far crescere la bolletta all'infinito.
  //
  // Un tetto commerciale generoso e un tetto tecnico contro l'abuso sono due
  // cose diverse, e Infinity le confondeva. 50.000 messaggi al mese sono
  // fuori portata per qualunque uso legittimo (un salone grande non arriva a
  // 3.000) e restano un muro contro uno script.
  enterprise: 50_000,
};

// Quota AI per Pro scalata per operatore (decisione 14/09/2026, vedi
// DECISIONS.md -- stesso ragionamento e stesso pattern di
// `limiteMensileSms` in `piani.ts`): un salone Pro con più operatori genera
// più conversazioni/prenotazioni, ed essendo anche il prezzo di Pro ora
// scalato per operatore (+20€/mese ciascuno oltre il primo), è coerente che
// anche la quota AI cresca di pari passo invece di restare fissa mentre il
// salone cresce e il costo Anthropic con lui. Growth resta volutamente
// FISSO indipendentemente dal numero di operatori: il suo prezzo (39,90€)
// non scala per operatore, quindi non avrebbe senso far scalare la quota
// senza far scalare il prezzo che la copre -- Growth non ha comunque un
// tetto sul numero di operatori, solo un prezzo piatto.
/**
 * Quanto cresce la quota per ogni operatore OLTRE IL PRIMO.
 *
 * Growth aggiunto il 18/09/2026, correggendo un ragionamento sbagliato. Il
 * commento che c'era qui diceva che la quota di Growth non scala "perche' il
 * suo prezzo non scala per operatore": ma scala eccome, sono 15 euro al mese
 * per ogni operatore in piu' (vedi PREZZO_OPERATORE_EXTRA_CENTESIMI).
 *
 * L'effetto era questo: un salone Growth con quattro poltrone pagava 84,90
 * al mese e aveva lo stesso tetto di chi lavora da solo. Passava a Pro solo
 * quando l'assistente smetteva di rispondere ai suoi clienti a meta' mese --
 * cioe' un upgrade venduto da un guasto, di cui il titolare da' la colpa a
 * noi. Un tetto che si raggiunge per aver lavorato tanto non e' una leva
 * commerciale, e' una brutta figura che si ripete.
 *
 * Pro resta molto sopra: ha una base piu' alta e cresce sei volte piu' in
 * fretta, coerentemente con i 20 euro per operatore invece di 15.
 */
const QUOTA_PER_OPERATORE_EXTRA: Record<string, number> = {
  growth: 500,
  pro: 3000, // prima era una moltiplicazione: 3000 x operatori, stessi numeri
  enterprise: 0, // 50.000 e' gia' un muro contro l'abuso, non un tetto commerciale
};

export function limiteMensileMessaggi(piano: string, numeroOperatori: number = 1): number {
  const base = QUOTA_MENSILE_MESSAGGI_PER_PIANO[piano] ?? 0;
  if (base === 0 || !Number.isFinite(base)) return base;
  const extra = QUOTA_PER_OPERATORE_EXTRA[piano] ?? 0;
  return base + extra * Math.max(0, numeroOperatori - 1);
}

/**
 * Quante bozze di configurazione puo' farsi preparare dall'AI, IN TUTTO, un
 * salone che non paga (Free, Starter).
 *
 * Non zero e non infinite: tre. Zero vorrebbe dire far pagare prima di aver
 * fatto vedere qualcosa, proprio nel momento in cui una persona sta
 * decidendo se il prodotto vale qualcosa -- e la configurazione a mano e' il
 * punto in cui piu' gente molla. Infinite vorrebbero dire regalare per
 * sempre la cosa che su Growth si paga.
 *
 * Tre e' quanto serve davvero: una per configurare il salone, due per
 * sbagliare e riprovare. La quarta volta la domanda non e' piu' "funziona?"
 * ma "mi conviene?", e a quella risponde il listino.
 *
 * A VITA, non al mese (decisione di Gabriel, 18/09/2026): un tetto mensile
 * su un'operazione che serve una volta sola e' un tetto che non si vede mai.
 */
export const BOZZE_ONBOARDING_SENZA_PIANO = 3;

/**
 * Quante volte al mese un salone senza quota AI puo' provare l'assistente
 * dalla dashboard. Questa resta MENSILE anche su Free e Starter: e' l'altra
 * meta' della leva commerciale -- far vedere l'assistente all'opera a chi
 * non ce l'ha -- e azzerarla dopo tre volte toglierebbe proprio la cosa che
 * convince.
 */
export const PROVE_ASSISTENTE_SENZA_PIANO = 10;

export interface TettoUsoAi {
  limite: number;
  /** true = si conta da sempre, non nel mese corrente. */
  daSempre: boolean;
}

/**
 * Il tetto per una BOZZA di configurazione.
 *
 * Su un piano con quota AI la bozza consuma quella, come tutto il resto: un
 * costo solo, un numero solo. Su Free e Starter, che quota non ne hanno,
 * vale il tetto a vita qui sopra.
 */
export function tettoBozzaOnboarding(piano: string, numeroOperatori: number = 1): TettoUsoAi {
  const quota = limiteMensileMessaggi(piano, numeroOperatori);
  return quota > 0
    ? { limite: quota, daSempre: false }
    : { limite: BOZZE_ONBOARDING_SENZA_PIANO, daSempre: true };
}

/** Il tetto per una PROVA dell'assistente: mensile su tutti i piani. */
export function tettoProvaAssistente(piano: string, numeroOperatori: number = 1): TettoUsoAi {
  const quota = limiteMensileMessaggi(piano, numeroOperatori);
  return { limite: quota > 0 ? quota : PROVE_ASSISTENTE_SENZA_PIANO, daSempre: false };
}

/**
 * Il tetto mensile che vale per TUTTO quello che il salone fa fare al
 * modello: i messaggi dei suoi clienti e gli usi dalla dashboard (bozze di
 * onboarding, prove dell'assistente), sommati.
 *
 * Un solo numero perche' il costo e' uno solo. Prima gli usi dalla dashboard
 * non comparivano da nessuna parte: l'onboarding AI non aveva contatore ne'
 * tetto ne' gate di piano (18/09/2026).
 */
/**
 * Il tetto mensile da MOSTRARE in dashboard: quanto puo' fare lavorare il
 * modello, in tutto, questo salone in un mese. Per i piani senza quota e'
 * il tetto delle prove, che e' l'unica cosa ricorrente che possono fare.
 */
export function limiteUsiAiMensile(piano: string, numeroOperatori: number = 1): number {
  return tettoProvaAssistente(piano, numeroOperatori).limite;
}

// Anti-burst: un vero cliente non manda due messaggi a meno di 2 secondi di
// distanza scrivendo a mano su una tastiera -- una cadenza più fitta è quasi
// certamente uno script, non una persona.
export const INTERVALLO_MINIMO_MS_TRA_MESSAGGI = 2000;

// Anti-abuso lato CLIENTE (decisione 14/09/2026, richiesta esplicita di
// Gabriel: "l'ai deve avere un anti abuso da parte del cliente, ad esempio
// clienti che scrivono cose che non centrano, o scrivono troppo"). Due
// difese distinte e complementari, entrambe controllate PRIMA di chiamare
// il modello in route.ts (stesso principio della quota mensile/anti-burst
// sopra -- un turno bloccato qui non genera alcun costo Anthropic):
//
// 1. "Scrivono troppo": tetto sui messaggi CLIENTE della singola
//    conversazione -- diverso dalla quota mensile per tenant sopra (quella
//    è condivisa tra tutti i clienti del tenant ed è molto più alta). Oltre
//    questa soglia una conversazione non sta più prenotando qualcosa di
//    reale, sta solo consumando quota: meglio passarla a un operatore.
//    Soglia scelta bassa apposta (15, non 40 come una prima stima troppo
//    permissiva corretta da Gabriel il 14/09/2026): un vero flusso di
//    prenotazione, anche complesso -- più servizi, cambio data,
//    riprogrammazione -- raramente supera 10-15 messaggi cliente. A 40, una
//    singola conversazione incastrata o abusiva poteva consumare il 4%
//    dell'intera quota MENSILE di Growth (1000 messaggi TOTALI, condivisi
//    tra tutti i clienti del tenant) prima che scattasse qualunque difesa.
// 2. "Scrivono cose che non centrano": non esiste un modo deterministico di
//    giudicare "è in tema" senza un altro giro di AI (costoso e
//    aggirabile), quindi si usa un proxy comportamentale -- una vera
//    conversazione di prenotazione chiama quasi sempre uno strumento
//    (elenca_servizi, verifica_disponibilita, ecc.) entro pochi turni. Una
//    sequenza di risposte SOLO testuali, senza mai uno strumento, è il
//    segnale che il cliente sta chiacchierando fuori tema (o cercando di
//    far "ragionare" il modello su qualcos'altro). Il contatore vive su
//    `conversazioni.turni_senza_tool_consecutivi` (si azzera ad ogni turno
//    che invece usa almeno uno strumento) -- vedi conversazione.server.ts.
export const LIMITE_MESSAGGI_CLIENTE_PER_CONVERSAZIONE = 15;
export const LIMITE_TURNI_SENZA_STRUMENTI_CONSECUTIVI = 3;

// Trovato dal vivo il 15/09/2026 (vedi DECISIONS.md): una conversazione
// "aperta" non scade mai da sola, quindi lo stesso identificatore_sessione
// che torna ore/giorni dopo ripesca la riga vecchia con il SUO contatore
// anti-abuso -- un contatore già a 3 per turni non collegati a questo nuovo
// messaggio blocca subito anche una domanda legittima e la manda dritta
// all'anti-abuso, senza nemmeno chiamare il modello (visto dal vivo:
// "dove si trova il parcheggio" su una conversazione ripescata da 9 ore
// prima). Oltre questa soglia di inattività, `ottieniOCreaConversazione`
// tratta la sessione come nuova invece di riusare quella vecchia (che resta
// comunque nel database, semplicemente non più ripescata).
export const SOGLIA_INATTIVITA_NUOVA_CONVERSAZIONE_MS = 3 * 60 * 60 * 1000; // 3 ore
