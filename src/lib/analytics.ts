/**
 * Andamento nel tempo (Fase 3, Analytics -- Growth in su, vedi
 * `pianoHaAnalytics` in `src/lib/piani.ts`): promessa reale del sito
 * ("Andamento prenotazioni e clienti nel tempo, non solo i numeri di oggi",
 * `Funzionalita.tsx`) non ancora mantenuta -- la dashboard mostra solo
 * finestre fisse (oggi, 30gg, 60gg), zero vista storica.
 *
 * Deliberatamente scoperto qui SOLO quello promesso -- un grafico
 * dell'andamento -- non anche retention, che non è una promessa scritta da
 * nessuna parte del sito e richiederebbe una definizione mai discussa con
 * Gabriel. Resta aperta in PIANO.md, non dimenticata.
 *
 * Aggiornamento 17/09/2026: questa nota metteva il no-show nella stessa
 * categoria ("serve una migrazione E una decisione su come lo staff lo
 * marca"). Non serve più niente dei due: il 16/09/2026 è arrivato il
 * pulsante in agenda e il dato ora esiste davvero. Quando si vorrà una serie
 * storica delle assenze, il materiale c'è -- quello che manca è solo
 * decidere se serve a un titolare o se il conteggio sulla scheda cliente
 * basta.
 *
 * Logica pura, zero query, stesso principio di metriche.ts: riusa gli
 * stessi tipi di dato grezzo (appuntamenti/clienti), il layer di
 * collegamento (analytics.server.ts) carica solo i dati e delega qui il
 * calcolo.
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

export interface PuntoAndamento {
  inizioSettimana: Date; // lunedì (UTC/pseudo-UTC, stessa convenzione di fuso-orario.ts)
  prenotazioniConfermate: number;
  nuoviClienti: number;
}

/**
 * Bucket settimanali (lunedì-domenica), dal più vecchio al più recente,
 * finestra terminante nella settimana di `adesso` inclusa. Settimanale (non
 * giornaliero/mensile): abbastanza fine da mostrare un vero andamento anche
 * per un'attività agli inizi con poche prenotazioni al giorno, abbastanza
 * ampio da restare leggibile su `numeroSettimane` colonne in un grafico.
 */
export function calcolaAndamentoSettimanale(
  appuntamenti: AppuntamentoAndamento[],
  clienti: ClienteAndamento[],
  adesso: Date,
  numeroSettimane: number = 12
): PuntoAndamento[] {
  const settimanaCorrente = inizioSettimana(adesso);
  const punti: PuntoAndamento[] = [];
  for (let i = numeroSettimane - 1; i >= 0; i--) {
    const inizio = new Date(settimanaCorrente.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const fine = new Date(inizio.getTime() + 7 * 24 * 60 * 60 * 1000);
    punti.push({
      inizioSettimana: inizio,
      prenotazioniConfermate: appuntamenti.filter(
        (a) => a.stato === "confermato" && a.inizio >= inizio && a.inizio < fine
      ).length,
      nuoviClienti: clienti.filter((c) => c.createdAt >= inizio && c.createdAt < fine).length,
    });
  }
  return punti;
}
