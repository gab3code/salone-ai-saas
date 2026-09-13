import "server-only";
import Mailjet, { SendEmailV3_1 } from "node-mailjet";

let istanza: ReturnType<typeof Mailjet.apiConnect> | null = null;

/**
 * Client Mailjet lato server -- stesso pattern del client Stripe
 * (src/lib/stripe/server.ts): un'istanza cache, mai esposta al browser
 * ("server-only" fa fallire la build se questo file finisse in un bundle
 * client, prima linea di difesa).
 *
 * Scelto Mailjet al posto di Resend (13/09/2026, ripensamento nello stesso
 * giorno): Gabriel aveva già un account Mailjet con una subaccount API key
 * dedicata a questo progetto, e a parità di piano gratuito Mailjet è più
 * generoso (6.000 email/mese, 200/giorno, contro 3.000/100 di Resend) --
 * confronto e fonti in DECISIONS.md. Stesso principio di fail-open già
 * applicato prima: senza le due chiavi, `creaClientMailjet` ritorna `null`
 * invece di lanciare -- le notifiche email restano una funzione accessoria,
 * mai il cuore del prodotto.
 */
function creaClientMailjet(): ReturnType<typeof Mailjet.apiConnect> | null {
  const chiave = process.env.MJ_APIKEY_PUBLIC;
  const segreta = process.env.MJ_APIKEY_PRIVATE;
  if (!chiave || !segreta) return null;
  if (!istanza) istanza = Mailjet.apiConnect(chiave, segreta);
  return istanza;
}

export interface ParametriEmail {
  a: string;
  oggetto: string;
  html: string;
  /**
   * Nome visualizzato come mittente (es. "Estetica Bianchi" invece del nome
   * della piattaforma) -- il cliente che riceve la conferma di un
   * appuntamento deve vedere il nome del salone con cui ha prenotato, non
   * "Salone AI" (bug reale trovato il 13/09/2026: `nomeTenant` veniva già
   * usato nell'oggetto/corpo dell'email in notifiche.server.ts, ma non nel
   * mittente). Facoltativo: le email che non riguardano un tenant specifico
   * (nessuna esiste ancora oggi, ma es. una futura email di sistema)
   * ricadono sul nome della piattaforma.
   */
  nomeMittente?: string;
}

/**
 * Invia un'email, fail-open per design: se mancano le chiavi Mailjet o
 * `MAILJET_FROM_EMAIL`, se l'API risponde con un errore (per-messaggio o di
 * rete), o per qualunque eccezione inattesa, questa funzione NON lancia mai
 * -- logga e ritorna `false`. Chi la chiama (le notifiche di prenotazione in
 * notifiche.server.ts) è a sua volta invocato dentro `creaAppuntamentoTenant`,
 * l'unica funzione di scrittura degli appuntamenti (punto 9 di CLAUDE.md): un
 * problema di invio email non deve MAI far sembrare fallita una prenotazione
 * che sul database è già andata a buon fine.
 *
 * NOTA importante (a differenza di Resend): Mailjet richiede un mittente
 * validato PRIMA di poter inviare qualunque email -- nessun indirizzo di
 * test universale disponibile senza configurazione. `MAILJET_FROM_EMAIL`
 * deve essere un indirizzo confermato dal pannello Mailjet (Account ->
 * Sender addresses & domains -> Add a sender address, un solo click di
 * conferma via email). Un mittente non validato fa fallire l'invio con un
 * errore "Unauthorized sender" -- gestito comunque qui sotto come un
 * semplice `false`, mai un'eccezione che risale al chiamante.
 */
export async function inviaEmail({ a, oggetto, html, nomeMittente }: ParametriEmail): Promise<boolean> {
  const client = creaClientMailjet();
  if (!client) {
    console.warn(`[email] MJ_APIKEY_PUBLIC/MJ_APIKEY_PRIVATE non configurate: email a ${a} non inviata.`);
    return false;
  }

  const mittente = process.env.MAILJET_FROM_EMAIL;
  if (!mittente) {
    console.warn(`[email] MAILJET_FROM_EMAIL non configurata: email a ${a} non inviata.`);
    return false;
  }

  try {
    const { body } = await client.post("send", { version: "v3.1" }).request<SendEmailV3_1.Response>({
      Messages: [
        {
          From: { Email: mittente, Name: nomeMittente ?? "Salone AI" },
          To: [{ Email: a }],
          Subject: oggetto,
          HTMLPart: html,
        },
      ],
    } satisfies SendEmailV3_1.Body);

    const esito = body.Messages[0];
    // Confrontato con la stringa letterale "success" (il valore JSON reale
    // che l'API di Mailjet restituisce), non con l'enum `SendEmailV3_1.
    // ResponseStatus.Success`: in produzione (build Next.js/Turbopack su
    // Vercel) quel namespace risultava `undefined` a runtime -- pur
    // esistendo regolarmente sotto `vitest` in locale/CI, che risolve il
    // modulo in modo diverso da come lo bundlizza Turbopack. Il risultato
    // era un'eccezione ad ogni singolo invio ("Cannot read properties of
    // undefined (reading 'ResponseStatus')"), scoperta il 13/09/2026 solo
    // grazie ai log runtime di Vercel durante un test dal vivo -- nessuna
    // email è mai partita finché questo confronto è rimasto sull'enum.
    // `SendEmailV3_1` resta importato solo per i tipi (`.Response`,
    // `.Body` sopra), che si cancellano a compile-time e non soffrono di
    // questo problema.
    if (esito?.Status !== "success") {
      console.error(`[email] Mailjet ha rifiutato l'invio a ${a}:`, JSON.stringify(esito?.Errors));
      return false;
    }
    return true;
  } catch (erroreInatteso) {
    console.error(`[email] Eccezione inattesa inviando l'email a ${a}:`, erroreInatteso);
    return false;
  }
}
