import { limiteMensilePrenotazioni, limiteOperatori } from "@/lib/piani";

/**
 * Parte PURA del pannello admin (Fase 5): tipi, prezzi e tutti i calcoli
 * derivati, separati dal caricamento dati (`admin.server.ts`, che usa il
 * service_role e non può finire in un bundle del browser -- un componente
 * client può importarne solo un tipo, mai un valore).
 *
 * Qui dentro non entra MAI un dato personale di un cliente finale di un
 * salone: solo conteggi aggregati. È la linea che tiene in piedi tutto il
 * pannello dal punto di vista legale -- su quei dati Salone AI è
 * responsabile del trattamento, non titolare, e contarli serve davvero
 * (i tetti del piano Free e la fatturazione per operatore si applicano su
 * quei numeri), mentre leggerli uno per uno no.
 *
 * Le metriche aggregate di piattaforma (imbuto, coorti, serie settimanali,
 * uso reale) stanno in `admin-metriche.ts`, che importa i tipi da qui.
 */

export const PIANI_ASSEGNABILI = ["free", "starter", "growth", "pro", "enterprise"] as const;
export type PianoAssegnabile = (typeof PIANI_ASSEGNABILI)[number];

/** Stati possibili di `tenants.stato_abbonamento` (migrazione 0001). */
export const STATI_ABBONAMENTO = ["trialing", "attivo", "scaduto", "cancellato"] as const;

export function pianoAssegnabileValido(piano: string): boolean {
  return (PIANI_ASSEGNABILI as readonly string[]).includes(piano);
}

export function statoAbbonamentoValido(stato: string): boolean {
  return (STATI_ABBONAMENTO as readonly string[]).includes(stato);
}

/**
 * Prezzi di listino in centesimi, per la stima dei ricavi nel pannello.
 *
 * ATTENZIONE: la verità sulla fatturazione è Stripe, non questa mappa. Serve
 * solo a mostrare una stima interna senza interrogare Stripe per ogni riga
 * della pagina. Se cambi i prezzi su Stripe e ti dimentichi di qui, il
 * numero mostrato sbaglia -- per questo il pannello lo etichetta come
 * "stimato" e non come incasso.
 * Enterprise è a preventivo: non ha un prezzo di listino, quindi non entra
 * mai nella stima (e il pannello dice quante attività sono escluse, invece
 * di far sparire il problema in un totale).
 */
export const PREZZO_BASE_CENTESIMI: Record<string, number> = {
  free: 0,
  starter: 1990,
  growth: 3990,
  pro: 8990,
};

/** Quota mensile per ogni operatore oltre il primo (vedi stripe/piani.ts). */
export const PREZZO_OPERATORE_EXTRA_CENTESIMI: Record<string, number> = {
  starter: 1000,
  growth: 1500,
  pro: 2000,
};

export type RigaAdmin = {
  tenantId: string;
  nome: string;
  slug: string;
  piano: string;
  statoAbbonamento: string;
  /** true = piano deciso a mano, il webhook Stripe non lo tocca (migrazione 0028). */
  pianoManuale: boolean;
  /** true = la pagina pubblica non accetta più prenotazioni (migrazione 0029). */
  sospesa: boolean;
  sospesaMotivo: string | null;
  creatoIl: string;
  haStripe: boolean;
  /**
   * true = esiste un abbonamento Stripe collegato a questa attività.
   *
   * Diverso da `haStripe` (che è solo il customer): un customer esiste
   * appena si apre un checkout, un abbonamento solo se il checkout è andato
   * a buon fine. È questa la differenza fra un'attività che PAGA e una a cui
   * il piano è stato assegnato a mano -- vedi `ricavoMensileStimatoCentesimi`.
   */
  haAbbonamentoStripe: boolean;
  /**
   * true = abbiamo il codice destinatario SdI o la PEC di questa attività
   * (migrazione 0031). Senza, la sua fattura elettronica non si può
   * trasmettere: è un dato che si raccoglie al checkout ma è opzionale
   * lì, per non bloccare chi non sa cosa sia davanti al pagamento.
   */
  datiFatturaCompleti: boolean;
  /**
   * Esito della verifica VIES della partita IVA (migrazione 0034):
   * "verified" | "unverified" | "pending" | null. Non blocca niente, ma una
   * partita IVA che il registro europeo non trova è una fattura che verrà
   * intestata a nessuno.
   */
  verificaPartitaIva: string | null;
  emailTitolari: string[];
  membri: number;
  operatori: number;
  servizi: number;
  orariConfigurati: boolean;
  clienti: number;
  appuntamenti: number;
  appuntamenti30Giorni: number;
  /** Prenotazioni create nel mese corrente: è il numero su cui agisce il tetto del piano Free. */
  prenotazioniMeseCorrente: number;
  /** Quante delle sue prenotazioni le ha prese l'assistente AI (`appuntamenti.creato_da`). */
  appuntamentiAi: number;
  /** Appuntamenti finiti in no-show: è la promessa centrale del prodotto, va misurata. */
  noShow: number;
  /** ISO del primo appuntamento creato: serve per il tempo fra iscrizione e prima prenotazione. */
  primaAttivita: string | null;
  /** ISO dell'ultimo appuntamento creato, per capire se un'attività è ferma. */
  ultimaAttivita: string | null;
};

/** Ricavo di una riga spezzato nelle sue due componenti, prima di sommarlo. */
export type DettaglioRicavo = { baseCentesimi: number; operatoriCentesimi: number; totaleCentesimi: number };

const RICAVO_ZERO: DettaglioRicavo = { baseCentesimi: 0, operatoriCentesimi: 0, totaleCentesimi: 0 };

/**
 * Ricavo mensile stimato di una singola attività: prezzo base del piano più
 * la quota per ogni operatore oltre il primo.
 *
 * Due condizioni, entrambe necessarie:
 *  - abbonamento ATTIVO. Un trial non è ancora un ricavo e uno scaduto o
 *    cancellato non lo è più.
 *  - un abbonamento Stripe che esiste davvero. Senza questa seconda
 *    condizione ogni account omaggio o assegnato a mano dal pannello (piano
 *    "pro", stato "attivo", zero euro incassati) entrerebbe nel totale: la
 *    stima si gonfierebbe proprio con i clienti che NON pagano, cioè si
 *    romperebbe nel modo peggiore possibile -- restando credibile.
 */
export function dettaglioRicavo(riga: {
  piano: string;
  statoAbbonamento: string;
  operatori: number;
  haAbbonamentoStripe: boolean;
}): DettaglioRicavo {
  if (riga.statoAbbonamento !== "attivo") return RICAVO_ZERO;
  if (!riga.haAbbonamentoStripe) return RICAVO_ZERO;

  const baseCentesimi = PREZZO_BASE_CENTESIMI[riga.piano];
  if (baseCentesimi === undefined) return RICAVO_ZERO; // enterprise, o un piano non riconosciuto

  const quotaOperatore = PREZZO_OPERATORE_EXTRA_CENTESIMI[riga.piano] ?? 0;
  const operatoriExtra = Math.max(0, riga.operatori - 1);
  const operatoriCentesimi = quotaOperatore * operatoriExtra;

  return { baseCentesimi, operatoriCentesimi, totaleCentesimi: baseCentesimi + operatoriCentesimi };
}

export function ricavoMensileStimatoCentesimi(riga: {
  piano: string;
  statoAbbonamento: string;
  operatori: number;
  haAbbonamentoStripe: boolean;
}): number {
  return dettaglioRicavo(riga).totaleCentesimi;
}

export type RicavoPerPiano = { piano: string; paganti: number; mrrCentesimi: number };

export type Ricavi = {
  mrrCentesimi: number;
  /** Quanto del MRR viene dal prezzo base dei piani. */
  baseCentesimi: number;
  /** Quanto viene invece dalla quota per operatore: dice se il modello per posto sta funzionando. */
  operatoriCentesimi: number;
  paganti: number;
  inProva: number;
  /** Attività su Enterprise: a preventivo, fuori dalla stima per definizione. */
  aPreventivo: number;
  /** Attive senza abbonamento Stripe: omaggio, prove interne, piani messi a mano. Non sono ricavo. */
  omaggio: number;
  /** Ricavo medio per attività pagante. */
  arpaCentesimi: number;
  perPiano: RicavoPerPiano[];
  /**
   * Quota del MRR che arriva dal singolo cliente più grande, fra 0 e 1.
   * Con pochi clienti è il rischio più concreto che esista: perderne uno
   * solo può voler dire perdere metà del fatturato.
   */
  concentrazione: number;
  /** MRR delle attività paganti che hanno almeno un segnale grave: soldi che si possono perdere. */
  aRischioCentesimi: number;
};

export function calcolaRicavi(righe: RigaAdmin[], adesso: Date = new Date()): Ricavi {
  let mrrCentesimi = 0;
  let baseCentesimi = 0;
  let operatoriCentesimi = 0;
  let paganti = 0;
  let inProva = 0;
  let aPreventivo = 0;
  let omaggio = 0;
  let aRischioCentesimi = 0;
  let massimoSingolo = 0;
  const perPiano = new Map<string, RicavoPerPiano>();

  for (const riga of righe) {
    const ricavo = dettaglioRicavo(riga);

    mrrCentesimi += ricavo.totaleCentesimi;
    baseCentesimi += ricavo.baseCentesimi;
    operatoriCentesimi += ricavo.operatoriCentesimi;

    if (ricavo.totaleCentesimi > 0) {
      paganti += 1;
      massimoSingolo = Math.max(massimoSingolo, ricavo.totaleCentesimi);

      const voce = perPiano.get(riga.piano) ?? { piano: riga.piano, paganti: 0, mrrCentesimi: 0 };
      voce.paganti += 1;
      voce.mrrCentesimi += ricavo.totaleCentesimi;
      perPiano.set(riga.piano, voce);

      if (segnaliAttivita(riga, adesso).some((s) => s.gravita === "alta")) {
        aRischioCentesimi += ricavo.totaleCentesimi;
      }
    }

    if (riga.statoAbbonamento === "trialing") inProva += 1;
    if (riga.piano === "enterprise") aPreventivo += 1;
    if (riga.statoAbbonamento === "attivo" && !riga.haAbbonamentoStripe) omaggio += 1;
  }

  return {
    mrrCentesimi,
    baseCentesimi,
    operatoriCentesimi,
    paganti,
    inProva,
    aPreventivo,
    omaggio,
    arpaCentesimi: paganti > 0 ? Math.round(mrrCentesimi / paganti) : 0,
    perPiano: [...perPiano.values()].sort((a, b) => b.mrrCentesimi - a.mrrCentesimi),
    concentrazione: mrrCentesimi > 0 ? massimoSingolo / mrrCentesimi : 0,
    aRischioCentesimi,
  };
}

/**
 * Cosa manca a un'attività per essere davvero operativa. Serve al supporto:
 * un salone che "non riceve prenotazioni" nove volte su dieci non ha un bug,
 * ha gli orari tutti chiusi o nessun servizio -- e da qui si vede in un
 * colpo d'occhio senza chiedergli niente.
 */
export function cosaMancaPerPartire(riga: RigaAdmin): string[] {
  const mancanze: string[] = [];
  if (!riga.orariConfigurati) mancanze.push("orari");
  if (riga.servizi === 0) mancanze.push("servizi");
  if (riga.operatori === 0) mancanze.push("operatori");
  return mancanze;
}

/** Un'attività è "pronta" quando ha orari aperti, almeno un servizio e almeno un operatore. */
export function attivitaConfigurata(riga: RigaAdmin): boolean {
  return cosaMancaPerPartire(riga).length === 0;
}

export type Segnale = { testo: string; gravita: "alta" | "media" };

/**
 * Segnali che meritano uno sguardo, in ordine di urgenza. Tutti calcolati su
 * numeri aggregati -- nessuno richiede di aprire i dati di un salone.
 */
export function segnaliAttivita(riga: RigaAdmin, adesso: Date = new Date()): Segnale[] {
  const segnali: Segnale[] = [];

  if (riga.sospesa) {
    segnali.push({ testo: "Sospesa: non accetta prenotazioni", gravita: "alta" });
  }

  if (riga.statoAbbonamento === "scaduto") {
    segnali.push({ testo: "Pagamento non riuscito", gravita: "alta" });
  }

  const mancanze = cosaMancaPerPartire(riga);
  if (mancanze.length > 0) {
    segnali.push({ testo: `Onboarding incompleto: manca ${mancanze.join(", ")}`, gravita: "alta" });
  }

  // Tetto del piano: si segnala all'80% e non al 100%, perché a limite
  // raggiunto il salone sta GIÀ perdendo prenotazioni -- e questo pannello
  // serve ad arrivarci prima, non a certificare il danno.
  const tetto = limiteMensilePrenotazioni(riga.piano);
  if (tetto !== Infinity && riga.prenotazioniMeseCorrente >= tetto * 0.8) {
    const oltre = riga.prenotazioniMeseCorrente >= tetto;
    segnali.push({
      testo: oltre
        ? `Tetto del piano raggiunto (${riga.prenotazioniMeseCorrente}/${tetto} prenotazioni questo mese)`
        : `Vicina al tetto del piano (${riga.prenotazioniMeseCorrente}/${tetto} prenotazioni questo mese)`,
      gravita: oltre ? "alta" : "media",
    });
  }

  const limiteOp = limiteOperatori(riga.piano);
  if (limiteOp !== Infinity && riga.operatori > limiteOp) {
    segnali.push({
      testo: `${riga.operatori} operatori su un piano che ne include ${limiteOp}`,
      gravita: "media",
    });
  }

  // Inattività: solo per attività già avviate, altrimenti si segnalerebbe
  // come "ferma" ogni iscritto di ieri che non ha ancora configurato niente
  // -- rumore che nasconde i casi veri.
  if (riga.appuntamenti > 0 && riga.ultimaAttivita) {
    const giorni = giorniFra(new Date(riga.ultimaAttivita), adesso);
    if (giorni >= 30) {
      segnali.push({ testo: `Nessuna prenotazione da ${giorni} giorni`, gravita: "alta" });
    } else if (giorni >= 14) {
      segnali.push({ testo: `Nessuna prenotazione da ${giorni} giorni`, gravita: "media" });
    }
  }

  // Un cliente che paga e di cui non abbiamo i dati per emettere la fattura
  // elettronica: non è urgente il giorno stesso, ma diventa urgentissimo il
  // giorno in cui bisogna emettere, ed è il tipo di cosa che si scopre tardi.
  if (riga.statoAbbonamento === "attivo" && riga.haAbbonamentoStripe && !riga.datiFatturaCompleti) {
    segnali.push({ testo: "Manca il codice destinatario o la PEC per la fattura", gravita: "media" });
  }

  if (riga.haAbbonamentoStripe && riga.verificaPartitaIva === "unverified") {
    segnali.push({ testo: "Partita IVA non trovata sul registro europeo", gravita: "media" });
  }

  // Un salone su un piano con l'AI che non ne ha mai preso una prenotazione
  // sta pagando per qualcosa che non usa: è il profilo che disdice al
  // rinnovo, e si vede con mesi di anticipo.
  if (
    (riga.piano === "growth" || riga.piano === "pro") &&
    riga.appuntamenti >= 10 &&
    riga.appuntamentiAi === 0
  ) {
    segnali.push({ testo: "Paga per l'AI ma non l'ha mai usata", gravita: "media" });
  }

  return segnali;
}

/** Giorni interi fra due istanti, mai negativi. */
export function giorniFra(prima: Date, dopo: Date): number {
  return Math.max(0, Math.floor((dopo.getTime() - prima.getTime()) / (24 * 60 * 60 * 1000)));
}

export function formatoEuroDaCentesimi(centesimi: number): string {
  return (centesimi / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

/** Percentuale leggibile da una frazione 0..1. Una cifra decimale solo sotto il 10%. */
export function formatoPercentuale(frazione: number): string {
  const percento = frazione * 100;
  return `${percento < 10 ? percento.toFixed(1) : Math.round(percento)}%`;
}
