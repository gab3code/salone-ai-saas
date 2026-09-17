/**
 * "Guarda cosa avrebbe risposto l'assistente" -- la prova per i piani senza
 * AI (Fase 5, ultimo punto aperto, chiuso il 17/09/2026).
 *
 * L'IDEA. Il momento giusto per vendere l'assistente a un salone Starter
 * non e' la tabella prezzi: e' quando ha appena finito di fare a mano il
 * lavoro che l'assistente gli toglierebbe. Nel prodotto quel momento
 * esiste ed e' uno solo -- quando inserisce un appuntamento a mano in
 * agenda, perche' un appuntamento inserito a mano E' una telefonata a cui
 * ha risposto lui.
 *
 * (L'idea scritta in PIANO.md il 16/09 diceva "subito dopo che ha risposto
 * LUI a mano a una richiesta in chat". Non si poteva fare: Free e Starter
 * non hanno la chat affatto -- `pianoHaAccessoAIChatWeb` -- quindi quella
 * richiesta a cui rispondere non esiste da nessuna parte. L'appuntamento
 * manuale e' lo stesso momento, che pero' nel prodotto c'e' davvero.)
 *
 * LA SCELTA DI GABRIEL (17/09/2026): "AI risposta vera ma un limite vero".
 * Quindi una chiamata vera al modello, sui dati veri del suo salone -- i
 * suoi servizi, i suoi prezzi, i suoi orari, la sua agenda -- perche' un
 * esempio statico si riconosce subito e non convince nessuno.
 *
 * ----------------------------------------------------------------------
 * IL LIMITE, E PERCHE' E' FATTO DI TRE PEZZI E NON DI UN NUMERO
 *
 * Il vincolo di prodotto deciso il 16/09/2026 e scritto in PIANO.md e'
 * netto: "a Starter non va data MAI un po' di AI, nemmeno una quota
 * simbolica di messaggi omaggio". Una prova che regala cinque risposte al
 * mese rischia di essere esattamente quello. Serve che sia
 * STRUTTURALMENTE inutile come strumento di lavoro, non solo scarsa:
 *
 * 1. NON PUO' SCRIVERE NIENTE. Il modello riceve solo gli strumenti in
 *    sola lettura (`STRUMENTI_DEMO`): puo' elencare i servizi, dire gli
 *    orari, guardare la disponibilita' vera. Non puo' prenotare,
 *    modificare, cancellare, mettere in lista d'attesa. E' la linea esatta
 *    del prodotto: la prova mostra la VOCE dell'assistente, non la sua
 *    CAPACITA', ed e' la capacita' che si paga.
 * 2. TETTO MENSILE VERO, applicato nel database. Vedi la migrazione 0041:
 *    il contatore sta su `tenants`, nessun `grant update` lo espone al
 *    titolare, e chi consuma e' una funzione `security definer` che
 *    controlla e incrementa nella STESSA update -- quindi due schede aperte
 *    insieme non se lo mangiano due volte.
 * 3. COSTA PIU' TEMPO CHE FARLO A MANO. Il titolare deve scrivere la
 *    domanda del cliente, aspettare, leggere. Con l'agenda aperta davanti
 *    e' sempre piu' lento che guardare. Nessuno lo userebbe come
 *    receptionist nemmeno se il tetto fosse cento.
 *
 * Il tetto e' DIECI, non cinque: il costo reale di una prova con Haiku e'
 * di qualche millesimo di euro, quindi il numero non serve a contenere una
 * spesa -- serve a dire che non e' un servizio. Dieci e' abbastanza per
 * provarci sul serio (piu' domande, anche difficili) e ridicolo come
 * strumento di lavoro per un salone che riceve decine di telefonate a
 * settimana.
 */

/** Piani senza assistente: sono quelli a cui la prova ha senso mostrarla. */
export function pianoPuoProvareAssistente(piano: string): boolean {
  return piano === "free" || piano === "starter";
}

export const DEMO_AI_MAX_AL_MESE = 10;

/**
 * Quanto puo' essere lunga la domanda del cliente da incollare.
 *
 * Corta apposta: una domanda al telefono e' una frase, e un tetto basso
 * rende anche impossibile usare la prova per far masticare al modello
 * testi lunghi a spese nostre.
 */
export const LUNGHEZZA_MASSIMA_DOMANDA_DEMO = 300;

/**
 * Gli strumenti concessi alla prova: SOLO lettura.
 *
 * Sono NOMI e non riferimenti a `STRUMENTI_AI` anche per un motivo
 * pratico, trovato al primo build del 17/09/2026: questo file lo importa
 * pure il riquadro nella dashboard, che gira nel browser, e `tools.ts`
 * si porta dietro mezzo lato server (`server-only`, `next/headers`). Un
 * `import` da li' faceva fallire il build. Che i nomi esistano davvero lo
 * verifica il test, che invece puo' importarli entrambi.
 *
 * Elencati per nome invece che per esclusione, di proposito: uno strumento
 * nuovo aggiunto domani a `STRUMENTI_AI` deve nascere FUORI dalla prova e
 * entrarci solo se qualcuno lo decide, non finirci dentro da solo. Se il
 * verso fosse rovesciato ("tutti tranne questi"), il primo strumento di
 * scrittura aggiunto senza pensarci sarebbe regalato ai piani senza AI.
 */
export const STRUMENTI_DEMO: readonly string[] = [
  "elenca_servizi",
  "elenca_operatori",
  "info_orari",
  "verifica_disponibilita",
];

export const DOMANDE_ESEMPIO: readonly string[] = [
  "Buongiorno, avete posto giovedì pomeriggio per un taglio?",
  "Quanto viene una piega e quanto ci vuole?",
  "Vorrei spostare l'appuntamento di sabato, si può?",
];

export interface StatoDemo {
  /** Quante ne restano questo mese. */
  rimaste: number;
  esaurite: boolean;
}

export function statoDemo(mese: string | null, usate: number, adesso: Date): StatoDemo {
  const meseCorrente = `${adesso.getUTCFullYear()}-${String(adesso.getUTCMonth() + 1).padStart(2, "0")}`;
  // Un contatore di un mese passato vale zero: il database lo azzera da
  // solo alla prima prova del mese nuovo, ma a schermo il numero giusto va
  // mostrato subito, senza aspettare che qualcuno consumi una prova.
  const usateQuestoMese = mese === meseCorrente ? usate : 0;
  const rimaste = Math.max(0, DEMO_AI_MAX_AL_MESE - usateQuestoMese);
  return { rimaste, esaurite: rimaste === 0 };
}

export function domandaDemoValida(testo: string): boolean {
  const pulito = testo.trim();
  return pulito.length >= 3 && pulito.length <= LUNGHEZZA_MASSIMA_DOMANDA_DEMO;
}
