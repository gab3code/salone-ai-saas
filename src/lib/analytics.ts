/**
 * Andamento nel tempo (Fase 3, Analytics -- Growth in su, vedi
 * `pianoHaAnalytics` in `src/lib/piani.ts`): la promessa scritta sul sito e'
 * "Andamento prenotazioni e clienti nel tempo, non solo i numeri di oggi"
 * (`Funzionalita.tsx`).
 *
 * Aggiornamento 17/09/2026 -- la fase 3 si chiude qui. Fino a oggi questo
 * file sapeva fare una cosa sola: dodici settimane fisse. Su richiesta di
 * Gabriel ("vedi tu qual e' l'interfaccia migliore") la finestra e' ora
 * scelta dal titolare e la GRANULARITA' LA SEGUE -- giorni, settimane o
 * mesi -- perche' un bastoncino al giorno su dodici mesi e' illeggibile
 * tanto quanto un bastoncino al mese su quattro settimane. La retention,
 * che questo stesso commento lasciava aperta da settembre, adesso esiste e
 * vive in `src/lib/retention.ts`, separata apposta: e' un calcolo sulle
 * persone, non una serie temporale, e mescolarli avrebbe reso il file uno
 * di quei moduli "varie ed eventuali" che poi nessuno osa toccare.
 *
 * Logica pura, zero query, stesso principio di metriche.ts: riusa gli
 * stessi tipi di dato grezzo (appuntamenti/clienti), il layer di
 * collegamento (analytics.server.ts) carica solo i dati e delega qui il
 * calcolo. Tutte le date sono in pseudo-UTC: si leggono SEMPRE con i getter
 * UTC e si costruiscono con `Date.UTC`, mai con `new Date(anno, mese,
 * giorno)` -- vedi il test di indipendenza dal fuso orario.
 */

// `inizioSettimana` vive in `admin-metriche.ts` (17/09/2026): era definita
// due volte, qui con i getter UTC e là con quelli locali -- stesso intento,
// due risultati diversi fuori da un server in UTC. Una sola definizione.
import { inizioSettimana } from "./admin-metriche";

export interface AppuntamentoAndamento {
  inizio: Date;
  stato: string;
}

export interface ClienteAndamento {
  createdAt: Date;
}

/**
 * Quanto e' largo un bastoncino del grafico.
 *
 * Non e' una preferenza estetica: e' quello che rende il grafico leggibile
 * o inutile. Dodici settimane fisse (com'era fino al 17/09/2026) mostrano
 * troppo poco a un salone che vuole capire l'anno e troppa poca definizione
 * a uno che vuole capire il mese appena passato. Quindi la granularita'
 * segue il periodo scelto, invece di essere sempre la stessa: giorni per le
 * finestre corte -- dove un titolare riconosce il martedi' sempre vuoto --
 * settimane per il trimestre, mesi per il semestre e l'anno, dove un
 * bastoncino al giorno sarebbe solo rumore.
 */
export type Granularita = "giorno" | "settimana" | "mese";

export interface Periodo {
  chiave: string;
  etichetta: string;
  granularita: Granularita;
  /** Quanti bastoncini: la finestra e' questo numero per la granularita'. */
  punti: number;
}

/**
 * I quattro periodi offerti, e perche' proprio questi.
 *
 * Manca volutamente "ultima settimana": sette bastoncini per un salone che
 * fa qualche appuntamento al giorno non sono un andamento, sono rumore, e
 * quei numeri il titolare li ha gia' in dashboard sulle card di oggi.
 * Manca anche "da sempre": una finestra che si allunga da sola rende ogni
 * confronto nel tempo impossibile, e con due anni di storico i primi mesi
 * schiaccerebbero tutto il resto contro il fondo.
 */
export const PERIODI: readonly Periodo[] = [
  { chiave: "28g", etichetta: "4 settimane", granularita: "giorno", punti: 28 },
  { chiave: "3m", etichetta: "3 mesi", granularita: "settimana", punti: 13 },
  { chiave: "6m", etichetta: "6 mesi", granularita: "mese", punti: 6 },
  { chiave: "12m", etichetta: "12 mesi", granularita: "mese", punti: 12 },
];

export const PERIODO_PREDEFINITO = "3m";

/**
 * La chiave arriva dalla barra degli indirizzi, quindi puo' essere
 * qualunque cosa: un valore non riconosciuto ricade sul predefinito invece
 * di far esplodere la pagina o mostrarla vuota.
 */
export function trovaPeriodo(chiave: string | undefined | null): Periodo {
  return PERIODI.find((p) => p.chiave === chiave) ?? (PERIODI.find((p) => p.chiave === PERIODO_PREDEFINITO) as Periodo);
}

export interface PuntoAndamento {
  /** Inizio del bucket (UTC/pseudo-UTC, stessa convenzione di fuso-orario.ts). */
  inizio: Date;
  /** Gia' formattata qui: il grafico non deve sapere che granularita' e'. */
  etichetta: string;
  prenotazioniConfermate: number;
  nuoviClienti: number;
}

const MS_GIORNO = 24 * 60 * 60 * 1000;

/** Inizio del bucket che contiene `data`, secondo la granularita'. */
function inizioBucket(data: Date, granularita: Granularita): Date {
  if (granularita === "mese") return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 1));
  if (granularita === "settimana") return inizioSettimana(data);
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
}

/** Il bucket `indietro` passi prima di `riferimento`. */
function bucketPrecedente(riferimento: Date, granularita: Granularita, indietro: number): Date {
  if (granularita === "mese") {
    return new Date(Date.UTC(riferimento.getUTCFullYear(), riferimento.getUTCMonth() - indietro, 1));
  }
  const passo = granularita === "settimana" ? 7 * MS_GIORNO : MS_GIORNO;
  return new Date(riferimento.getTime() - indietro * passo);
}

function etichettaBucket(inizio: Date, granularita: Granularita): string {
  if (granularita === "mese") {
    return inizio.toLocaleDateString("it-IT", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  return inizio.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Serie temporale di prenotazioni confermate e nuovi clienti, dal bucket
 * piu' vecchio al piu' recente, finestra terminante nel bucket di `adesso`
 * incluso.
 *
 * I bucket vuoti restano nella serie a zero: toglierli darebbe un grafico
 * che mente sull'andamento, facendo sembrare continuo un periodo in cui il
 * salone e' stato fermo.
 */
export function calcolaAndamento(
  appuntamenti: AppuntamentoAndamento[],
  clienti: ClienteAndamento[],
  adesso: Date,
  periodo: Periodo = trovaPeriodo(PERIODO_PREDEFINITO)
): PuntoAndamento[] {
  const bucketCorrente = inizioBucket(adesso, periodo.granularita);
  const punti: PuntoAndamento[] = [];

  for (let i = periodo.punti - 1; i >= 0; i--) {
    const inizio = bucketPrecedente(bucketCorrente, periodo.granularita, i);
    const fine = bucketPrecedente(bucketCorrente, periodo.granularita, i - 1);
    punti.push({
      inizio,
      etichetta: etichettaBucket(inizio, periodo.granularita),
      prenotazioniConfermate: appuntamenti.filter(
        (a) => a.stato === "confermato" && a.inizio >= inizio && a.inizio < fine
      ).length,
      nuoviClienti: clienti.filter((c) => c.createdAt >= inizio && c.createdAt < fine).length,
    });
  }
  return punti;
}

export interface TotaliPeriodo {
  prenotazioniConfermate: number;
  nuoviClienti: number;
}

export interface ConfrontoPeriodo {
  attuale: TotaliPeriodo;
  precedente: TotaliPeriodo;
  /** Variazione percentuale; null quando non c'e' un confronto onesto. */
  variazionePrenotazioni: number | null;
  variazioneNuoviClienti: number | null;
}

function variazione(attuale: number, precedente: number): number | null {
  // Da zero non esiste una variazione percentuale: "+100%" o "+infinito"
  // sarebbero entrambi inventati. Meglio non mostrare niente e dirlo.
  if (precedente === 0) return null;
  return Math.round(((attuale - precedente) / precedente) * 100);
}

function somma(punti: PuntoAndamento[]): TotaliPeriodo {
  return {
    prenotazioniConfermate: punti.reduce((s, p) => s + p.prenotazioniConfermate, 0),
    nuoviClienti: punti.reduce((s, p) => s + p.nuoviClienti, 0),
  };
}

/**
 * I totali del periodo scelto accanto a quelli del periodo precedente della
 * stessa lunghezza.
 *
 * Un totale da solo non dice niente a un titolare ("48 prenotazioni" e'
 * tanto o poco?); lo stesso totale confrontato con il trimestre prima e'
 * una risposta. E' il primo passo di ogni pannello analytics serio
 * (verificato sulla demo pubblica di Plausible il 17/09/2026, dove ogni
 * numero in cima porta la sua variazione), ed e' anche il motivo per cui il
 * periodo NON si allunga da solo: senza due finestre della stessa lunghezza
 * il confronto non esisterebbe.
 *
 * Il periodo corrente e' incompleto per costruzione -- oggi non e' ancora
 * finito, questo mese nemmeno -- quindi la variazione e' sempre un po'
 * pessimista verso la fine del bucket. E' scritto a schermo, non nascosto.
 */
export function confrontaConPeriodoPrecedente(
  appuntamenti: AppuntamentoAndamento[],
  clienti: ClienteAndamento[],
  adesso: Date,
  periodo: Periodo
): ConfrontoPeriodo {
  const doppio = calcolaAndamento(appuntamenti, clienti, adesso, { ...periodo, punti: periodo.punti * 2 });
  const precedente = somma(doppio.slice(0, periodo.punti));
  const attuale = somma(doppio.slice(periodo.punti));
  return {
    attuale,
    precedente,
    variazionePrenotazioni: variazione(attuale.prenotazioniConfermate, precedente.prenotazioniConfermate),
    variazioneNuoviClienti: variazione(attuale.nuoviClienti, precedente.nuoviClienti),
  };
}
