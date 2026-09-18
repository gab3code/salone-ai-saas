import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

/**
 * `withSentryConfig` serve a una cosa sola: caricare le source map al build,
 * cosi' uno stack trace di produzione indica una riga del nostro codice
 * invece di una colonna di un file minimizzato.
 *
 * Senza `SENTRY_AUTH_TOKEN` non carica niente e il build procede lo stesso --
 * voluto: chi clona il repo deve poter compilare senza avere un account
 * Sentry.
 *
 * `sentryUrl`: con l'organizzazione nella regione europea il caricamento va a
 * de.sentry.io, non al predefinito americano. Si imposta con SENTRY_URL.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sentryUrl: process.env.SENTRY_URL,

  silent: !process.env.CI,
  widenClientFileUpload: true,
  // Toglie dal bundle i messaggi di debug di Sentry: sono peso inutile nel
  // browser di ogni visitatore.
  disableLogger: true,
  // Vercel propone dei "cron monitor" automatici: qui i job schedulati non
  // passano da Vercel Cron, quindi sarebbero monitor vuoti.
  automaticVercelMonitors: false,
});
