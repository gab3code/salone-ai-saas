import * as Sentry from "@sentry/nextjs";

/**
 * Il punto in cui Next lascia avviare qualcosa PRIMA dell'applicazione.
 *
 * Due ambienti diversi, due configurazioni: il runtime Node e quello edge non
 * condividono niente, e un solo file coprirebbe meta' degli errori.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Gli errori che Next incontra servendo una richiesta -- quelli che finiscono
 * nella pagina di errore. Senza questa riga arriverebbero solo quelli lanciati
 * dentro codice nostro, non quelli che Next intercetta per conto suo.
 */
export const onRequestError = Sentry.captureRequestError;
