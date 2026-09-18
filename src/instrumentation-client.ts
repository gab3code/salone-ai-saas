import * as Sentry from "@sentry/nextjs";
import { opzioniSentry } from "@/lib/sentry-opzioni";

// Errori che succedono nel browser dell'utente. Stesse opzioni del server --
// in particolare NIENTE Session Replay, vedi sentry-opzioni.ts.
Sentry.init(opzioniSentry());

// Serve a Sentry per legare fra loro le navigazioni lato client (quelle che
// da stanotte fa `Link` invece di ricaricare la pagina).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
