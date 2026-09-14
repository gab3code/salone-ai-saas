import "server-only";

const BASE_URL = "https://api.skebby.it/API/v1.0/REST";

/**
 * Token persistente Skebby (a differenza del session token di `GET /login`,
 * che scade dopo 5 minuti -- documentazione Skebby, confrontata il
 * 14/09/2026): tenuto in memoria di processo, non nel database, stesso
 * livello di "cache di un client esterno" già usato per Mailjet/Stripe
 * (istanza cache in server.ts). Si perde a ogni riavvio/nuova istanza
 * serverless -- accettabile, il costo di richiederne uno nuovo è
 * trascurabile e non c'è nessuno stato condiviso da sincronizzare tra
 * istanze.
 */
let tokenCache: string | null = null;

function credenzialiConfigurate(): boolean {
  return !!(process.env.SKEBBY_EMAIL && process.env.SKEBBY_PASSWORD);
}

async function ottieniToken(forzaRinnovo = false): Promise<string | null> {
  if (tokenCache && !forzaRinnovo) return tokenCache;

  const email = process.env.SKEBBY_EMAIL;
  const password = process.env.SKEBBY_PASSWORD;
  if (!email || !password) return null;

  try {
    const risposta = await fetch(`${BASE_URL}/token`, {
      headers: { Authorization: "Basic " + Buffer.from(`${email}:${password}`).toString("base64") },
    });
    if (!risposta.ok) {
      console.error("[sms] Skebby ha rifiutato l'autenticazione:", risposta.status, await risposta.text());
      return null;
    }
    // Risposta: "USER_KEY;ACCESS_TOKEN" (testo semplice, non JSON --
    // documentazione Skebby REST API v1.0, confrontata il 14/09/2026).
    const testo = (await risposta.text()).trim();
    if (!testo.includes(";")) {
      console.error("[sms] Risposta di GET /token in un formato inatteso:", testo);
      return null;
    }
    tokenCache = testo;
    return testo;
  } catch (errore) {
    console.error("[sms] Eccezione autenticandosi su Skebby:", errore);
    return null;
  }
}

/**
 * Normalizza un numero per l'invio SMS: `clienti.telefono` è testo libero
 * raccolto dal flusso di prenotazione pubblico (FORMATO_TELEFONO in
 * s/[slug]/azioni.ts non impone un prefisso internazionale), ma Skebby
 * richiede il formato internazionale con "+". Prodotto italiano-only oggi
 * (nessun tenant non italiano, vedi PIANO.md) -- un numero senza prefisso
 * viene assunto italiano. Da rivedere il giorno in cui il prodotto smette
 * di essere solo per l'Italia.
 */
function normalizzaNumeroPerSms(numero: string): string {
  const pulito = numero.replace(/[\s()\-]/g, "");
  if (pulito.startsWith("+")) return pulito;
  if (pulito.startsWith("00")) return "+" + pulito.slice(2);
  return "+39" + pulito;
}

/**
 * Invia un SMS via Skebby, fail-open per design come `inviaEmail` in
 * mailjet.server.ts: se mancano le credenziali, se l'autenticazione o
 * l'invio falliscono, o per qualunque eccezione inattesa, questa funzione
 * NON lancia mai -- logga e ritorna `false`. Non gestisce piano/quota (vedi
 * `inviaSmsSeInclusoNelPiano` in sms/invio.server.ts, il punto di ingresso
 * che TUTTI i chiamanti reali devono usare): questa funzione parla solo con
 * l'API di Skebby.
 */
export async function inviaSms(numero: string, messaggio: string): Promise<boolean> {
  if (!credenzialiConfigurate()) {
    console.warn("[sms] SKEBBY_EMAIL/SKEBBY_PASSWORD non configurate: SMS non inviato.");
    return false;
  }

  const destinatario = normalizzaNumeroPerSms(numero);

  const tentaInvio = async (token: string) => {
    const [userKey, accessToken] = token.split(";");
    return fetch(`${BASE_URL}/sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        user_key: userKey,
        Access_token: accessToken,
      },
      body: JSON.stringify({ message: messaggio, message_type: "GP", recipient: [destinatario] }),
    });
  };

  try {
    let token = await ottieniToken();
    if (!token) return false;

    let risposta = await tentaInvio(token);
    if (risposta.status === 401) {
      // Il token in cache potrebbe essere stato invalidato lato Skebby (es.
      // password cambiata) -- un solo retry con un token fresco, mai un
      // loop (stesso limite di prudenza già in agente.ts/tools.ts).
      token = await ottieniToken(true);
      if (!token) return false;
      risposta = await tentaInvio(token);
    }

    if (risposta.status !== 201) {
      console.error("[sms] Skebby ha rifiutato l'invio:", risposta.status, await risposta.text());
      return false;
    }
    return true;
  } catch (errore) {
    console.error("[sms] Eccezione inviando l'SMS a", destinatario, ":", errore);
    return false;
  }
}
