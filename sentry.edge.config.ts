import * as Sentry from "@sentry/nextjs";
import { opzioniSentry } from "@/lib/sentry-opzioni";

// Il middleware gira sull'edge runtime, che e' un ambiente a se': senza
// questo file i suoi errori non li vedrebbe nessuno.
Sentry.init(opzioniSentry());
