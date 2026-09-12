import { notFound } from "next/navigation";

/**
 * Ex banco di prova manuale per la chat AI (Task #66), usato durante lo
 * sviluppo della Fase 2 per verificare dal vivo il loop MESSAGGIO -> AI ->
 * strumenti -> database -> risposta prima che esistesse la pagina pubblica
 * definitiva. Sostituito a tutti gli effetti da `/s/[slug]` (Fase 4,
 * `ChatWidgetPubblico.tsx`), che copre lo stesso scenario con branding,
 * galleria e il resto dell'esperienza cliente vera.
 *
 * Controllo approfondito pre-pubblicazione (12/09/2026, richiesta di
 * Gabriel): questa pagina era ancora raggiungibile in produzione con
 * qualunque slug (`/prova-chat/qualsiasi-cosa`) -- niente branding, niente
 * stile, esplicitamente etichettata "pagina di TEST" nel proprio markup.
 * Un visitatore o un cliente che ci fosse capitato per caso avrebbe visto
 * un prototipo interno spacciato per il prodotto. Il file resta (la cronologia
 * git non si tocca per un cambio così), ma la route ora restituisce 404 --
 * stesso trattamento di qualunque altra pagina inesistente, niente di
 * "in costruzione" mostrato a chi non deve vederlo.
 */
export default function PaginaProvaChatRimossa(): never {
  notFound();
}
