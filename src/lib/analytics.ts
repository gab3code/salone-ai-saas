/**
 * Andamento nel tempo (Fase 3, Analytics -- Growth in su, vedi
 * `pianoHaAnalytics` in `src/lib/piani.ts`): promessa reale del sito
 * ("Andamento prenotazioni e clienti nel tempo, non solo i numeri di oggi",
 * `Funzionalita.tsx`) non ancora mantenuta -- la dashboard mostra solo
 * finestre fisse (oggi, 30gg, 60gg), zero vista storica.
 *
 * Deliberatamente scoperto qui SOLO quello promesso -- un grafico
 * dell'andamento -- non anche retention o no-show reale, che comparivano
 * come "da costruire" nella nota di PIANO.md ma NON sono promesse scritte da
 * nessuna parte del sito: costruirli oggi vorrebbe dire o inventare una
 * definizione di "retention" mai discussa con Gabriel, o cambiare il
 * significato di `appuntamenti.stato` (un vero cambio al booking engine,
 * serve una migrazione E una decisione su come lo staff marca un no-show
 * dall'interfaccia) -- entrambi lasciati esplicitamente aperti in PIANO.md,
 * non dimenticati.
 *
 * Logica pura, zero query, stesso principio di metriche.ts: riusa gli
 * stessi tipi di dato grezzo (appuntamenti/clienti), il layer di
 * collegamento (analytics.server.ts) carica solo i dati e delega qui il
 * calcolo.
 */

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

function inizioSettimana(data: Date): Date {
  const giorno = data.getUTCDay(); // 0 = domenica .. 6 = sabato
  const giorniDalLunedi = (giorno + 6) % 7;
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() - giorniDalLunedi));
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
