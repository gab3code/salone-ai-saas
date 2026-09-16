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
  /** ISO dell'ultimo appuntamento creato, per capire se un'attività è ferma. */
  ultimaAttivita: string | null;
};

/**
 * Ricavo mensile stimato di una singola attività: prezzo base del piano più
 * la quota per ogni operatore oltre il primo.
 *
 * Conta solo gli abbonamenti ATTIVI. Un trial non è ancora un ricavo e un
 * abbonamento scaduto o cancellato non lo è più: sommarli gonfierebbe il
 * totale proprio nel momento in cui serve leggerlo con onestà.
 */
export function ricavoMensileStimatoCentesimi(riga: {
  piano: string;
  statoAbbonamento: string;
  operatori: number;
}): number {
  if (riga.statoAbbonamento !== "attivo") return 0;

  const base = PREZZO_BASE_CENTESIMI[riga.piano];
  if (base === undefined) return 0; // enterprise, o un piano non riconosciuto

  const quotaOperatore = PREZZO_OPERATORE_EXTRA_CENTESIMI[riga.piano] ?? 0;
  const operatoriExtra = Math.max(0, riga.operatori - 1);
  return base + quotaOperatore * operatoriExtra;
}

export type Ricavi = {
  mrrCentesimi: number;
  paganti: number;
  inProva: number;
  /** Attività su Enterprise: a preventivo, fuori dalla stima per definizione. */
  aPreventivo: number;
};

export function calcolaRicavi(righe: RigaAdmin[]): Ricavi {
  return righe.reduce<Ricavi>(
    (acc, riga) => ({
      mrrCentesimi: acc.mrrCentesimi + ricavoMensileStimatoCentesimi(riga),
      paganti: acc.paganti + (ricavoMensileStimatoCentesimi(riga) > 0 ? 1 : 0),
      inProva: acc.inProva + (riga.statoAbbonamento === "trialing" ? 1 : 0),
      aPreventivo: acc.aPreventivo + (riga.piano === "enterprise" ? 1 : 0),
    }),
    { mrrCentesimi: 0, paganti: 0, inProva: 0, aPreventivo: 0 }
  );
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
    const giorni = Math.floor(
      (adesso.getTime() - new Date(riga.ultimaAttivita).getTime()) / (24 * 60 * 60 * 1000)
    );
    if (giorni >= 30) {
      segnali.push({ testo: `Nessuna prenotazione da ${giorni} giorni`, gravita: "alta" });
    } else if (giorni >= 14) {
      segnali.push({ testo: `Nessuna prenotazione da ${giorni} giorni`, gravita: "media" });
    }
  }

  return segnali;
}

export function formatoEuroDaCentesimi(centesimi: number): string {
  return (centesimi / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
