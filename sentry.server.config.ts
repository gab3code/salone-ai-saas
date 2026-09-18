import * as Sentry from "@sentry/nextjs";
import { opzioniSentry } from "@/lib/sentry-opzioni";

// Errori del codice che gira sul server (Server Component, server action,
// route handler, webhook). Vedi sentry-opzioni.ts per le scelte.
Sentry.init(opzioniSentry());
