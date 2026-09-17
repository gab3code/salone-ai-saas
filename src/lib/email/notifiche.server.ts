import "server-only";
import { headers } from "next/headers";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { inviaEmail } from "./mailjet.server";
import { inviaSmsSeInclusoNelPiano } from "@/lib/sms/invio.server";

/** Escape minimo per inserire testo libero (nome cliente, servizio, note) dentro l'HTML dell'email. */
export function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * URL base del sito, per costruire il link "gestisci la tua prenotazione"
 * (Fase 4 di PIANO.md) nell'email al cliente. `NEXT_PUBLIC_SITE_URL` non è
 * ancora definita in produzione (dominio vero non ancora impostato, vedi
 * docs/embedded-signup-whatsapp.md) -- fallback sugli header della richiesta
 * corrente, stesso pattern già usato in `avviaPagamentoCaparra`
 * (src/app/s/[slug]/azioni.ts). A differenza di lì, questa funzione viene
 * chiamata anche da contesti dove `headers()` potrebbe non essere
 * disponibile (nessuno oggi, ma es. un futuro job schedulato in background):
 * try/catch fail-open, nessun link piuttosto che un link rotto o un'email
 * che non parte affatto.
 *
 * Esportata: riusata anche da `promemoria.server.ts` (Fase 6, 14/09/2026) --
 * quel "futuro job schedulato" ipotizzato sopra è arrivato davvero. La
 * richiesta che Vercel Cron fa per invocare il job passa comunque da
 * `headers()` come qualunque altra richiesta HTTP, quindi funziona senza
 * modifiche.
 */
export async function urlBaseSito(): Promise<string | null> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  try {
    const intestazioni = await headers();
    const proto = intestazioni.get("x-forwarded-proto") ?? "https";
    const host = intestazioni.get("host");
    return host ? `${proto}://${host}` : null;
  } catch {
    return null;
  }
}

export function formattaOrario(inizioReale: Date, fusoOrario: string): string {
  const pseudo = realeAPseudoUtc(inizioReale, fusoOrario);
  const data = pseudo.toLocaleDateString("it-IT", { timeZone: "UTC" });
  const ora = pseudo.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${data} alle ${ora}`;
}

/**
 * Risolve l'email del titolare del tenant: `tenants.email` esiste come
 * colonna ma non viene mai popolata (né dal provisioning automatico né da
 * nessun'altra parte del codice, vedi 0004_provisioning_automatico.sql) --
 * l'unica email vera è quella con cui si è registrato su Supabase Auth,
 * raggiungibile solo con `auth.admin.getUserById`, che richiede la
 * service_role key (da qui l'uso di `creaClientAdmin()` invece del client
 * passato da chi ci ha chiamato).
 */
async function trovaEmailTitolare(
  admin: ReturnType<typeof creaClientAdmin>,
  tenantId: string
): Promise<string | null> {
  const { data: profilo } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("ruolo", "owner")
    .limit(1)
    .maybeSingle();
  if (!profilo) return null;

  const { data, error } = await admin.auth.admin.getUserById(profilo.id);
  if (error || !data.user) return null;
  return data.user.email ?? null;
}

/**
 * Notifiche di un appuntamento appena creato (Fase 6, Gruppo B-bis #1 di
 * PIANO.md: "nessuna notifica email, né per il titolare né per il
 * cliente... priorità alta, manca qualcosa che ogni concorrente verificato
 * ha"; canale SMS aggiunto in Fase 5+SMS, 14/09/2026). Due notifiche
 * indipendenti:
 *  - al titolare: SEMPRE via email, per ogni prenotazione (è l'unico che
 *    deve sapere che è arrivata, a prescindere dal canale; ha sempre
 *    un'email, essendo il suo account Supabase Auth -- nessun fallback SMS
 *    necessario qui).
 *  - al cliente: via email se l'ha lasciata (oggi raccolta solo nel flusso
 *    pubblico, vedi FlussoPrenotazione.tsx); altrimenti via SMS SE il piano
 *    del tenant lo include (Pro/Enterprise, vedi pianoHaSms in piani.ts) --
 *    MAI entrambi i canali allo stesso cliente.
 *
 * Chiamata da dentro `creaAppuntamentoTenant`, l'unica funzione che crea
 * appuntamenti per tutti e quattro i canali (dashboard, AI, pubblico
 * diretto, caparra/Stripe) -- coprirli tutti qui evita di duplicare questa
 * logica in ciascun chiamante (punto 9 di CLAUDE.md).
 *
 * Fail-open totale e non ricorsivo: ogni passo che tocca il database o la
 * rete è dentro un unico try/catch, non lancia mai. Un problema qui non
 * deve MAI far sembrare fallita una prenotazione già scritta con successo.
 */
export async function inviaNotificheNuovoAppuntamento(tenantId: string, appuntamentoId: string): Promise<void> {
  // Se Gabriel non ha configurato NÉ Mailjet NÉ Skebby, non ha senso
  // interrogare il database per niente -- niente latenza aggiunta alla
  // prenotazione. Basta uno dei due canali per proseguire: l'email al
  // titolare potrebbe comunque fallire più sotto (mai bloccante), e il
  // cliente potrebbe finire sull'uno o sull'altro canale a seconda che
  // abbia lasciato un'email.
  const emailConfigurata = !!(process.env.MJ_APIKEY_PUBLIC && process.env.MJ_APIKEY_PRIVATE);
  const smsConfigurata = !!(process.env.SKEBBY_EMAIL && process.env.SKEBBY_PASSWORD);
  if (!emailConfigurata && !smsConfigurata) return;

  try {
    const admin = creaClientAdmin();

    const [{ data: appuntamento }, fusoOrario] = await Promise.all([
      admin
        .from("appuntamenti")
        .select("inizio, note, clienti(nome, email, telefono), servizi(nome), operatori(nome), tenants(nome, piano)")
        .eq("id", appuntamentoId)
        .eq("tenant_id", tenantId)
        .single(),
      caricaFusoOrarioTenant(admin, tenantId),
    ]);
    if (!appuntamento) return;

    // Le relazioni annidate di Supabase possono tornare come oggetto singolo
    // o array a seconda della cardinalità dedotta -- qui sono tutte 1:1
    // (foreign key su appuntamenti), normalizziamo per sicurezza.
    const uno = <T>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : (v as T | null));
    const cliente = uno<{ nome: string | null; email: string | null; telefono: string | null }>(appuntamento.clienti);
    const servizio = uno<{ nome: string }>(appuntamento.servizi);
    const operatore = uno<{ nome: string }>(appuntamento.operatori);
    const tenant = uno<{ nome: string; piano: string }>(appuntamento.tenants);

    const nomeTenant = tenant?.nome ?? "Salone AI";
    const nomeServizio = servizio?.nome ?? "servizio";
    const nomeOperatore = operatore?.nome ?? null;
    const nomeCliente = cliente?.nome ?? "Cliente";
    const quando = formattaOrario(new Date(appuntamento.inizio), fusoOrario);

    const rigaOperatore = nomeOperatore ? `<p>Operatore: ${escapeHtml(nomeOperatore)}</p>` : "";

    const emailTitolare = await trovaEmailTitolare(admin, tenantId);
    if (emailTitolare) {
      await inviaEmail({
        a: emailTitolare,
        oggetto: `Nuova prenotazione: ${nomeCliente} - ${quando}`,
        nomeMittente: nomeTenant,
        html: `
          <p>Nuovo appuntamento su <strong>${escapeHtml(nomeTenant)}</strong>.</p>
          <p>Cliente: ${escapeHtml(nomeCliente)}</p>
          <p>Servizio: ${escapeHtml(nomeServizio)}</p>
          ${rigaOperatore}
          <p>Quando: ${quando}</p>
        `,
      });
    }

    if (cliente?.email) {
      // Link "gestisci la tua prenotazione" (Fase 4 di PIANO.md): solo
      // cancellazione per ora (vedi src/app/gestisci/[id]/page.tsx per il
      // perché "sposta" non è ancora incluso). Omesso del tutto se l'URL
      // base non è determinabile -- mai un link rotto in un'email vera.
      const base = await urlBaseSito();
      const rigaGestisci = base
        ? `<p><a href="${base}/gestisci/${appuntamentoId}">Gestisci o cancella la prenotazione</a></p>`
        : "";

      await inviaEmail({
        a: cliente.email,
        oggetto: `Prenotazione confermata - ${nomeTenant}`,
        nomeMittente: nomeTenant,
        html: `
          <p>Ciao ${escapeHtml(nomeCliente)},</p>
          <p>la tua prenotazione da <strong>${escapeHtml(nomeTenant)}</strong> è confermata.</p>
          <p>Servizio: ${escapeHtml(nomeServizio)}</p>
          ${rigaOperatore}
          <p>Quando: ${quando}</p>
          ${rigaGestisci}
        `,
      });
    } else if (cliente?.telefono) {
      // Fallback SMS (Fase 5+SMS, 14/09/2026): SOLO quando il cliente non
      // ha lasciato un'email -- `inviaSmsSeInclusoNelPiano` ricontrolla
      // comunque il piano e la quota, questo `else if` è solo per non fare
      // la chiamata quando è già certamente inutile (piano senza SMS, testo
      // semplice: niente link, un SMS non supporta HTML e un URL nudo
      // aumenta il rischio phishing).
      const rigaOperatoreSms = nomeOperatore ? ` con ${nomeOperatore}` : "";
      const messaggioSms = `${nomeTenant}: prenotazione confermata per ${nomeServizio}${rigaOperatoreSms}, ${quando}.`;
      await inviaSmsSeInclusoNelPiano(admin, tenantId, tenant?.piano ?? "", cliente.telefono, messaggioSms);
    }
  } catch (errore) {
    console.error("[email] Errore inviando le notifiche di nuovo appuntamento:", errore);
  }
}

/**
 * Avvisa il titolare quando l'assistente AI passa la mano a una persona
 * (17/09/2026, controllo notturno chiesto da Gabriel).
 *
 * PERCHÉ ESISTE. Il sito promette in quattro punti diversi (`Funzionalita.tsx`,
 * `Vetrina.tsx`, `PercheNoi.tsx`, `Faq.tsx`) che l'AI "passa la mano a te con
 * tutto il contesto della conversazione". Nel codice il passaggio scriveva
 * solo `conversazioni.stato = 'passata_a_operatore'` e finiva lì: nessuno
 * veniva avvisato, e nella dashboard non esiste una pagina conversazioni dove
 * accorgersene. Il codice lo sapeva -- `api/chat/[slug]/route.ts` ha un
 * commento del 15/09/2026 che dice "mai promettere un passaggio a un operatore
 * che oggi non avvisa davvero nessuno" -- ma la promessa sul sito era rimasta.
 * Questa funzione chiude il buco dal lato giusto: rende vera la promessa
 * invece di ammorbidirla.
 *
 * "Tutto il contesto" è letterale: l'email contiene la trascrizione completa
 * della conversazione, così il titolare può rispondere senza dover chiedere al
 * cliente di ripetere -- che è esattamente la differenza tra un passaggio di
 * consegne e un "ti richiamo io".
 *
 * Fail-open come ogni altra notifica di questo file: un problema qui non deve
 * mai far fallire la risposta al cliente, che è già stata salvata.
 */
export async function inviaNotificaPassaggioAOperatore(
  tenantId: string,
  conversazioneId: string
): Promise<void> {
  if (!(process.env.MJ_APIKEY_PUBLIC && process.env.MJ_APIKEY_PRIVATE)) return;

  try {
    const admin = creaClientAdmin();

    const [{ data: conversazione }, { data: messaggi }, emailTitolare] = await Promise.all([
      admin
        .from("conversazioni")
        .select("canale, clienti(nome, telefono, email), tenants(nome)")
        .eq("id", conversazioneId)
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      admin
        .from("messaggi")
        .select("ruolo, contenuto, created_at")
        .eq("conversazione_id", conversazioneId)
        .order("created_at", { ascending: true }),
      trovaEmailTitolare(admin, tenantId),
    ]);
    if (!emailTitolare) return;

    const uno = <T>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : (v as T | null));
    const tenant = uno<{ nome: string }>(conversazione?.tenants);
    const cliente = uno<{ nome: string | null; telefono: string | null; email: string | null }>(
      conversazione?.clienti
    );
    const nomeTenant = tenant?.nome ?? "la tua attività";

    // Chi è, per quel poco che si sa: la chat pubblica non chiede
    // un'identità, quindi molto spesso è tutto nullo -- e va detto, invece
    // di lasciare una riga vuota che sembra un errore dell'email.
    const righeContatto = [
      cliente?.nome ? `Nome: ${escapeHtml(cliente.nome)}` : null,
      cliente?.telefono ? `Telefono: ${escapeHtml(cliente.telefono)}` : null,
      cliente?.email ? `Email: ${escapeHtml(cliente.email)}` : null,
    ].filter((r): r is string => r !== null);
    const contatto =
      righeContatto.length > 0
        ? `<p>${righeContatto.join("<br />")}</p>`
        : "<p>Chi ha scritto non ha lasciato un recapito: la risposta va data nella stessa chat.</p>";

    // `messaggi` include anche i ruoli "sistema"/"operatore", che invece
    // `caricaMessaggi` esclude perché non servono al prompt del modello.
    // Qui servono tutti: il destinatario è una persona che deve capire cosa
    // è successo, non il modello.
    const trascrizione = (messaggi ?? [])
      .map((m) => {
        const chi =
          m.ruolo === "cliente" ? "Cliente" : m.ruolo === "assistente" ? "Assistente" : "Sistema";
        return `<p style="margin:0 0 8px"><strong>${chi}:</strong> ${escapeHtml(m.contenuto)}</p>`;
      })
      .join("");

    await inviaEmail({
      a: emailTitolare,
      oggetto: `[${nomeTenant}] Una conversazione aspetta una tua risposta`,
      nomeMittente: nomeTenant,
      html: `
        <p>L'assistente ha passato a te una conversazione sulla chat della pagina pubblica.</p>
        ${contatto}
        <p><strong>Conversazione completa</strong></p>
        ${trascrizione}
      `,
    });
  } catch (errore) {
    console.error("[email] Errore inviando la notifica di passaggio a operatore:", errore);
  }
}
