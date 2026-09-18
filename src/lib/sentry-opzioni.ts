import type { BrowserOptions } from "@sentry/nextjs";
import { ERRORI_DA_IGNORARE, ripulisciEvento } from "@/lib/sentry-riservatezza";

/**
 * Le opzioni con cui Sentry parte, uguali sul server, sul browser e sull'edge
 * -- scritte una volta sola perche' una differenza fra i tre sarebbe
 * invisibile finche' non serve.
 *
 * Tre decisioni prese qui dentro, e il motivo di ognuna:
 *
 * 1. NIENTE Session Replay. E' l'opzione che la procedura guidata di Sentry
 *    accende da sola, e registra lo schermo dell'utente: su questo prodotto
 *    vuol dire la rubrica di un salone, con nomi e telefoni di persone che
 *    non hanno mai sentito parlare di noi. Non si aggiunge, e se un giorno
 *    qualcuno la volesse, e' una decisione da prendere con l'informativa
 *    privacy in mano, non una casella da spuntare.
 *
 * 2. Tracce di prestazione a zero. Il piano gratuito ha una quota, e le
 *    tracce la bruciano molto piu' in fretta degli errori: si finirebbe il
 *    mese senza piu' spazio proprio per la cosa per cui Sentry e' qui. Si
 *    puo' alzare con SENTRY_TRACCE_CAMPIONE quando servira' davvero.
 *
 * 3. `sendDefaultPii: false` piu' `beforeSend`. Il primo dice a Sentry di non
 *    aggiungere IP e intestazioni di suo; il secondo toglie quello che si e'
 *    infilato nell'errore per conto proprio. Servono tutti e due: il primo e'
 *    una preferenza, il secondo un filtro -- vedi sentry-riservatezza.ts.
 *
 * Senza DSN, Sentry non parte: in locale e sotto i test non si manda niente a
 * nessuno, e nessuno deve ricordarsi di spegnerlo.
 */
export function opzioniSentry(): BrowserOptions {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  return {
    dsn,
    enabled: Boolean(dsn),

    // "production" / "preview" le mette Vercel da solo: un errore di
    // un'anteprima non deve sembrare un errore di un salone vero.
    environment: process.env.VERCEL_ENV ?? "development",
    // Il commit esatto: e' quello che lega l'errore alla riga che l'ha
    // introdotto.
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    tracesSampleRate: Number(process.env.SENTRY_TRACCE_CAMPIONE ?? 0),

    sendDefaultPii: false,
    ignoreErrors: ERRORI_DA_IGNORARE,

    beforeSend: (evento) => ripulisciEvento(evento),
    beforeSendTransaction: (transazione) => ripulisciEvento(transazione),
  };
}
