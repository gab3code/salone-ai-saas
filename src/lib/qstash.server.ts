import "server-only";
import { Client, Receiver } from "@upstash/qstash";

/**
 * Client Upstash QStash lato server -- stesso pattern lazy-singleton già
 * usato per Stripe (src/lib/stripe/server.ts) e Mailjet
 * (src/lib/email/mailjet.server.ts): fail-open, mai lanciare se le
 * credenziali mancano (una richiesta di recensione persa non deve mai far
 * sembrare fallita una prenotazione vera, stesso principio di
 * inviaNotificheNuovoAppuntamento).
 *
 * Scelto QStash (non Vercel Cron) per programmare la richiesta di
 * recensione "2 ore dopo la fine dell'appuntamento" (deciso con Gabriel il
 * 16/09/2026): il piano Hobby di Vercel limita i cron job a una volta al
 * giorno (vedi vercel.json, già usato per /api/cron/promemoria) -- non
 * basta per un ritardo di poche ore calcolato per OGNI singolo
 * appuntamento. QStash pubblica un messaggio con un ritardo assoluto
 * (`notBefore`, timestamp Unix) verso un nostro webhook, gratis fino a
 * 1.000 messaggi/giorno -- ampiamente sufficiente al volume di
 * un'indie SaaS.
 */
let client: Client | null = null;

function creaClientQstash(): Client | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  if (!client) client = new Client({ token });
  return client;
}

/**
 * Programma la pubblicazione di `corpo` verso `url` non prima di
 * `nonPrimaDi` (istante reale, convertito internamente in timestamp Unix
 * per `notBefore` -- l'opzione assoluta, non `delay` relativo: più robusto
 * se questa funzione venisse mai chiamata con un ritardo di calcolo,
 * l'orario di consegna resta comunque quello vero indipendentemente da
 * quanto la nostra richiesta a QStash ha impiegato). Fail-open totale: un
 * problema qui (credenziali mancanti, QStash irraggiungibile) non deve MAI
 * far fallire la prenotazione appena scritta con successo -- semplicemente
 * quella richiesta di recensione non parte, loggato per non sparire nel
 * nulla in silenzio.
 */
/**
 * QStash chiama il nostro endpoint da fuori: un indirizzo che esiste solo
 * sulla macchina di chi sviluppa non e' raggiungibile, e non ha senso
 * provarci.
 */
function eIndirizzoLocale(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    // Un indirizzo che non si riesce nemmeno ad analizzare non e' locale:
    // lo si lascia passare e sara' QStash a rifiutarlo, dicendo perche'.
    return false;
  }
}

export async function programmaMessaggioQstash(
  url: string,
  corpo: Record<string, unknown>,
  nonPrimaDi: Date
): Promise<void> {
  // In locale l'indirizzo e' localhost, e QStash -- che e' un servizio
  // esterno -- non puo' raggiungerlo: risponde 400 "endpoint resolves to a
  // loopback address". Non e' un errore del prodotto, ma finiva nei log come
  // uno stack trace a OGNI appuntamento creato in sviluppo e nei test,
  // sporcando proprio il posto in cui si vanno a cercare i problemi veri.
  // Meglio non chiamare affatto e dirlo in una riga.
  if (eIndirizzoLocale(url)) {
    console.info("[qstash] indirizzo locale, richiesta non programmata (normale in sviluppo).", { url });
    return;
  }

  const c = creaClientQstash();
  if (!c) {
    console.error("[qstash] QSTASH_TOKEN mancante: richiesta non programmata.", { url });
    return;
  }
  try {
    await c.publishJSON({ url, body: corpo, notBefore: Math.floor(nonPrimaDi.getTime() / 1000) });
  } catch (errore) {
    console.error("[qstash] Errore programmando il messaggio:", url, errore);
  }
}

/**
 * Verifica la firma di una richiesta in arrivo dal webhook QStash (header
 * "upstash-signature") -- stesso principio di sicurezza di
 * `stripe.webhooks.constructEvent` nel webhook Stripe: mai fidarsi di una
 * richiesta HTTP arrivata su un endpoint pubblico senza prima verificare che
 * venga davvero dal servizio che dice di essere. `currentSigningKey`/
 * `nextSigningKey` passate esplicitamente (non lasciate inferire dalle env
 * var interne del pacchetto): stesso stile del resto del progetto, che non
 * si affida mai a convenzioni implicite di una libreria quando il valore è
 * già a disposizione. Ritorna `false` (mai lancia) se le chiavi non sono
 * configurate: il chiamante risponde 500, mai un tacito "verificato" senza
 * averlo davvero fatto.
 */
export async function verificaFirmaQstash(firma: string | null, corpoGrezzo: string): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!firma || !currentSigningKey || !nextSigningKey) return false;

  const receiver = new Receiver({ currentSigningKey, nextSigningKey });
  try {
    // Nessun `url` passato di proposito: vedi il commento nel webhook
    // chiamante (src/app/api/webhooks/qstash/richiedi-recensione/route.ts)
    // sul perché non verificare l'URL qui.
    return await receiver.verify({ signature: firma, body: corpoGrezzo });
  } catch (errore) {
    console.error("[qstash] Firma non valida sul webhook:", errore);
    return false;
  }
}
