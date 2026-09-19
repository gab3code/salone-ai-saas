import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /**
   * Il limite predefinito del corpo di una server action e' 1 MB: basta a
   * tutto tranne alla foto dell'agenda nell'import clienti, che arriva in
   * base64 gia' ridotta dal browser (1568 px, JPEG) ma puo' passare il
   * megabyte. 4 MB e' lo stesso tetto che l'azione ricontrolla lato server
   * (MAX_BYTE_FOTO_IMPORT).
   */
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
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
 *
 * Qui NON ci sono `disableLogger` ne' `automaticVercelMonitors`, e non e' una
 * dimenticanza: entrambe sono opzioni del builder webpack, e questo progetto
 * compila con Turbopack, dove non fanno niente. Le avevo messe al primo giro
 * con un commento che spiegava cosa facevano -- il build le ha segnalate come
 * deprecate e "not supported with Turbopack", cioe' il commento descriveva un
 * effetto che non c'era. Meglio due righe in meno che due righe che mentono.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  sentryUrl: process.env.SENTRY_URL,

  silent: !process.env.CI,
  widenClientFileUpload: true,
});
