/**
 * Calcolo delle metriche della dashboard (punto 18 di CLAUDE.md: "deve
 * rispondere subito a COME STA ANDANDO LA MIA ATTIVITÀ?") -- logica pura,
 * zero query, stesso principio di separazione di booking-engine.ts: testabile
 * senza database, il layer di connessione (metriche.server.ts) carica solo i
 * dati grezzi e delega SEMPRE qui la decisione/il calcolo.
 *
 * Numeri onesti, non finti: se un dato non è ancora tracciato, la metrica
 * riflette quello che il database realmente contiene oggi, non un valore
 * inventato per riempire una card.
 *
 * Aggiornamento 17/09/2026: questa nota diceva che non esiste "un passaggio
 * esplicito completato/no_show nel prodotto". Per il no-show non è più vero
 * dal 16/09/2026 -- c'è il pulsante in agenda (`segnaNoShow`) e il conteggio
 * sulla scheda cliente. Resta vero per "completato", che nessuno scrive: la
 * scelta dichiarata è che si marca solo l'eccezione, non la normalità.
 */
import { inizioGiornoUTC, fineGiornoUTC } from "@/lib/fuso-orario";

export interface AppuntamentoMetrica {
  inizio: Date;
  fine: Date;
  stato: string; // confermato | cancellato | completato | no_show
  clienteId: string | null;
  operatoreId: string | null;
  servizioId: string | null;
}

export interface ClienteMetrica {
  id: string;
  createdAt: Date;
}

export interface OrarioOggi {
  chiuso: boolean;
  apertura?: string; // "HH:MM"
  chiusura?: string;
  pausaInizio?: string;
  pausaFine?: string;
}

export interface ParametriMetriche {
  adesso: Date;
  // Finestra ampia (consigliato: ultimi 90 giorni) -- basta una query sola,
  // il calcolo qui dentro filtra per la finestra che gli serve davvero.
  appuntamenti: AppuntamentoMetrica[];
  clienti: ClienteMetrica[];
  prezzoCentesimiPerServizio: Map<string, number>;
  orarioOggi: OrarioOggi;
}

export interface Metriche {
  appuntamentiOggi: number;
  valorePrenotazioniOggiCentesimi: number;
  clientiTotali: number;
  nuoviClientiUltimi30Giorni: number;
  cancellazioniUltimi30Giorni: number;
  noShowUltimi30Giorni: number;
  minutiApertiOggi: number;
  minutiOccupatiOggi: number;
  /** null se il salone è chiuso oggi (percentuale non ha senso su 0 minuti aperti). */
  percentualeOccupazioneOggi: number | null;
  /** Clienti con almeno una prenotazione confermata passata, ma nessuna negli ultimi 60 giorni. */
  clientiInattiviDa60Giorni: number;
  /**
   * "Incassi previsti" (Gruppo B-bis punto 4 di PIANO.md, richiesto da Gabriel il 13/09/2026):
   * proiezione, NON un incasso reale registrato -- somma del prezzo dei servizi degli
   * appuntamenti già CONFERMATI nei prossimi 7/30 giorni da adesso in poi. Zero pagamenti, zero
   * fiscalità: stessa natura di `valorePrenotazioniOggiCentesimi` sopra, solo che guarda avanti
   * invece che a oggi. Un appuntamento cancellato dopo il calcolo non viene sottratto qui --
   * questi due numeri fotografano la situazione al momento in cui la dashboard viene caricata,
   * non una previsione che si aggiorna da sola in tempo reale.
   */
  incassiPrevistiCentesimi7Giorni: number;
  incassiPrevistiCentesimi30Giorni: number;
}

function giorniFa(adesso: Date, giorni: number): Date {
  return new Date(adesso.getTime() - giorni * 24 * 60 * 60 * 1000);
}
function giorniAvanti(adesso: Date, giorni: number): Date {
  return new Date(adesso.getTime() + giorni * 24 * 60 * 60 * 1000);
}
function minutiOraTesto(valore: string): number {
  const [h, m] = valore.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Cliente "inattivo da N giorni": ha prenotato in passato (altrimenti è solo
 * un cliente nuovo/mai tornato, non "inattivo" nel senso di CLAUDE.md punto
 * 18 -- "non prenotano da oltre 60 giorni" implica un'abitudine interrotta,
 * non l'assenza di una prima prenotazione), ma l'ultima prenotazione
 * confermata è più vecchia della soglia. Esportata a parte (non solo dentro
 * calcolaMetriche) perché serve anche per l'azione "contatta questi
 * clienti" -- l'elenco vero, non solo il conteggio della card dashboard.
 */
export function elencaClientiInattivi(
  appuntamenti: AppuntamentoMetrica[],
  adesso: Date,
  giorniSoglia: number
): Set<string> {
  const sogliaData = giorniFa(adesso, giorniSoglia);
  const ultimaPrenotazionePerCliente = new Map<string, Date>();
  for (const a of appuntamenti) {
    if (a.stato !== "confermato" || !a.clienteId) continue;
    const attuale = ultimaPrenotazionePerCliente.get(a.clienteId);
    if (!attuale || a.inizio > attuale) ultimaPrenotazionePerCliente.set(a.clienteId, a.inizio);
  }
  const inattivi = new Set<string>();
  for (const [clienteId, ultima] of ultimaPrenotazionePerCliente) {
    if (ultima < sogliaData) inattivi.add(clienteId);
  }
  return inattivi;
}

export function calcolaMetriche(p: ParametriMetriche): Metriche {
  const inizioOggi = inizioGiornoUTC(p.adesso);
  const fineOggi = fineGiornoUTC(p.adesso);
  const dataMeno30 = giorniFa(p.adesso, 30);

  const appuntamentiOggiConfermati = p.appuntamenti.filter(
    (a) => a.stato === "confermato" && a.inizio >= inizioOggi && a.inizio <= fineOggi
  );

  const valorePrenotazioniOggiCentesimi = appuntamentiOggiConfermati.reduce((somma, a) => {
    const prezzo = a.servizioId ? p.prezzoCentesimiPerServizio.get(a.servizioId) : undefined;
    return somma + (prezzo ?? 0);
  }, 0);

  const cancellazioniUltimi30Giorni = p.appuntamenti.filter(
    (a) => a.stato === "cancellato" && a.inizio >= dataMeno30
  ).length;

  const noShowUltimi30Giorni = p.appuntamenti.filter(
    (a) => a.stato === "no_show" && a.inizio >= dataMeno30
  ).length;

  const nuoviClientiUltimi30Giorni = p.clienti.filter((c) => c.createdAt >= dataMeno30).length;

  // Occupazione di oggi: minuti aperti (orario meno pausa) contro minuti
  // realmente occupati da appuntamenti confermati con un operatore assegnato
  // (un appuntamento senza operatore non consuma capacità di nessuno).
  let minutiApertiOggi = 0;
  if (!p.orarioOggi.chiuso && p.orarioOggi.apertura && p.orarioOggi.chiusura) {
    minutiApertiOggi = minutiOraTesto(p.orarioOggi.chiusura) - minutiOraTesto(p.orarioOggi.apertura);
    if (p.orarioOggi.pausaInizio && p.orarioOggi.pausaFine) {
      minutiApertiOggi -= minutiOraTesto(p.orarioOggi.pausaFine) - minutiOraTesto(p.orarioOggi.pausaInizio);
    }
    minutiApertiOggi = Math.max(0, minutiApertiOggi);
  }

  const minutiOccupatiOggi = appuntamentiOggiConfermati
    .filter((a) => a.operatoreId)
    .reduce((somma, a) => somma + (a.fine.getTime() - a.inizio.getTime()) / 60_000, 0);

  const percentualeOccupazioneOggi =
    minutiApertiOggi > 0 ? Math.round((minutiOccupatiOggi / minutiApertiOggi) * 100) : null;

  const clientiInattiviDa60Giorni = elencaClientiInattivi(p.appuntamenti, p.adesso, 60).size;

  // Incassi previsti: guarda AVANTI da "adesso" (incluso il resto della
  // giornata odierna), non solo dal giorno successivo -- un appuntamento tra
  // un'ora conta comunque nella finestra dei prossimi 7 giorni.
  const dataPiu7Giorni = giorniAvanti(p.adesso, 7);
  const dataPiu30Giorni = giorniAvanti(p.adesso, 30);
  function sommaIncassiPrevisti(finoA: Date): number {
    return p.appuntamenti
      .filter((a) => a.stato === "confermato" && a.inizio >= p.adesso && a.inizio < finoA)
      .reduce((somma, a) => {
        const prezzo = a.servizioId ? p.prezzoCentesimiPerServizio.get(a.servizioId) : undefined;
        return somma + (prezzo ?? 0);
      }, 0);
  }
  const incassiPrevistiCentesimi7Giorni = sommaIncassiPrevisti(dataPiu7Giorni);
  const incassiPrevistiCentesimi30Giorni = sommaIncassiPrevisti(dataPiu30Giorni);

  return {
    appuntamentiOggi: appuntamentiOggiConfermati.length,
    valorePrenotazioniOggiCentesimi,
    clientiTotali: p.clienti.length,
    nuoviClientiUltimi30Giorni,
    cancellazioniUltimi30Giorni,
    noShowUltimi30Giorni,
    minutiApertiOggi,
    minutiOccupatiOggi,
    percentualeOccupazioneOggi,
    clientiInattiviDa60Giorni,
    incassiPrevistiCentesimi7Giorni,
    incassiPrevistiCentesimi30Giorni,
  };
}
