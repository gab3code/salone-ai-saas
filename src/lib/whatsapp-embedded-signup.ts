/**
 * WhatsApp Embedded Signup -- lato server (punto 18 della spec).
 *
 * NON UTILIZZABILE finché non esiste un'app Meta di tipo Business con business
 * verification e App Review completati (accesso avanzato a
 * whatsapp_business_management + whatsapp_business_messaging) -- vedi
 * docs/embedded-signup-whatsapp.md per il percorso completo e la checklist di
 * cosa deve fare Gabriel (una tantum, a livello di piattaforma, non per ogni
 * cliente). Il codice qui sotto implementa le chiamate documentate da Meta,
 * pronto per essere collegato il giorno in cui APP_ID/APP_SECRET sono reali.
 *
 * Riferimenti (verificati al momento della scrittura, ricontrollare se sono
 * passati mesi -- le API di Meta cambiano versione periodicamente):
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/
 */

const GRAPH_API_VERSION = "v23.0"; // aggiornare quando si configura l'app reale
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function credenzialiApp() {
  const appId = process.env.WHATSAPP_APP_ID;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "WHATSAPP_APP_ID / WHATSAPP_APP_SECRET non configurati: l'app Meta non è ancora pronta " +
        "(serve business verification + App Review, vedi docs/embedded-signup-whatsapp.md)."
    );
  }
  return { appId, appSecret };
}

export interface TokenScambiato {
  accessToken: string;
  scadeIl?: Date; // assente per i token "a lunga scadenza" senza exp esplicita
}

/**
 * Step 1 dopo che il cliente completa il flusso Embedded Signup nel browser:
 * il codice ricevuto da FB.login (response.authResponse.code, valido 30 secondi)
 * va scambiato QUI, lato server, con un vero access token -- non deve mai
 * passare per un secondo giro dal browser.
 */
export async function scambiaCodicePerToken(code: string): Promise<TokenScambiato> {
  const { appId, appSecret } = credenzialiApp();
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const risposta = await fetch(url.toString());
  if (!risposta.ok) {
    throw new Error(`Scambio codice->token fallito: ${risposta.status} ${await risposta.text()}`);
  }
  const dati = (await risposta.json()) as { access_token: string; expires_in?: number };
  return {
    accessToken: dati.access_token,
    scadeIl: dati.expires_in ? new Date(Date.now() + dati.expires_in * 1000) : undefined,
  };
}

/**
 * Step 2: iscrive la NOSTRA app agli eventi (messaggi, stati di consegna) della
 * WABA appena collegata dal cliente. Senza questa chiamata non riceviamo nulla
 * per quel salone, anche se il collegamento sembra riuscito.
 */
export async function sottoscriviAppAllaWaba(wabaId: string, accessToken: string): Promise<void> {
  const risposta = await fetch(`${GRAPH_BASE}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!risposta.ok) {
    throw new Error(`Sottoscrizione webhook fallita: ${risposta.status} ${await risposta.text()}`);
  }
}

/**
 * Step 3 (solo se il numero del salone arriva dall'app WhatsApp Business
 * mobile, es. il caso "uso il telefono personale anche per il negozio" già
 * discusso): avvia la sincronizzazione di contatti/cronologia verso la Cloud
 * API. Per un numero nuovo di zecca questo passaggio non serve.
 */
export async function avviaSincronizzazioneStorico(
  phoneNumberId: string,
  accessToken: string
): Promise<void> {
  const chiamata = (syncType: "smb_app_state_sync" | "history") =>
    fetch(`${GRAPH_BASE}/${phoneNumberId}/smb_app_data`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", sync_type: syncType }),
    });

  const [contatti, storico] = await Promise.all([
    chiamata("smb_app_state_sync"),
    chiamata("history"),
  ]);
  if (!contatti.ok || !storico.ok) {
    throw new Error("Sincronizzazione contatti/storico WhatsApp fallita (verificare i log Meta).");
  }
}

/**
 * Orchestrazione completa dei tre step sopra, da chiamare dalla route che
 * riceve il risultato di Embedded Signup dal browser (vedi
 * src/app/api/whatsapp/embedded-signup/callback/route.ts). Il salvataggio su
 * Supabase (tabella whatsapp_credenziali + aggiornamento tenants) resta fuori
 * da questa funzione di proposito: qui c'è solo la parte che parla con Meta,
 * cosi' si può testare senza un Supabase reale collegato.
 */
export async function completaCollegamentoWhatsapp(params: {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  numeroMigratoDaAppMobile?: boolean;
}): Promise<TokenScambiato> {
  const token = await scambiaCodicePerToken(params.code);
  await sottoscriviAppAllaWaba(params.wabaId, token.accessToken);
  if (params.numeroMigratoDaAppMobile) {
    await avviaSincronizzazioneStorico(params.phoneNumberId, token.accessToken);
  }
  return token;
}
