import "server-only";
import { headers } from "next/headers";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { inviaEmail } from "./mailjet.server";
import { inviaSmsSeInclusoNelPiano } from "@/lib/sms/invio.server";
import {
  CANALE_CONFERMA_PREDEFINITO,
  canaleConfermaValido,
  inviiConferma,
} from "@/lib/notifiche-prenotazione";

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
        // Stringa unica e letterale, mai concatenata: Supabase deduce i tipi
        // del risultato dal testo del `select`, e una concatenazione glielo
        // rende opaco (il risultato diventa `GenericStringError`).
        .select("inizio, note, clienti(nome, email, telefono), servizi(nome), operatori(nome), tenants(nome, piano, notifica_titolare_nuova_prenotazione, conferma_cliente_canale)")
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
    const tenant = uno<{
      nome: string;
      piano: string;
      notifica_titolare_nuova_prenotazione: boolean | null;
      conferma_cliente_canale: string | null;
    }>(appuntamento.tenants);

    const nomeTenant = tenant?.nome ?? "Salone AI";
    const nomeServizio = servizio?.nome ?? "servizio";
    const nomeOperatore = operatore?.nome ?? null;
    const nomeCliente = cliente?.nome ?? "Cliente";
    const quando = formattaOrario(new Date(appuntamento.inizio), fusoOrario);

    const rigaOperatore = nomeOperatore ? `<p>Operatore: ${escapeHtml(nomeOperatore)}</p>` : "";

    // Il titolare può spegnere del tutto l'email a ogni prenotazione
    // (17/09/2026): chi guarda il calendario tutto il giorno la trova solo
    // rumore. `!== false` e non `=== true` di proposito -- se la colonna
    // fosse nulla per qualunque motivo, il comportamento resta quello
    // storico (si manda), invece di zittire un salone senza che l'abbia
    // chiesto.
    const avvisaTitolare = tenant?.notifica_titolare_nuova_prenotazione !== false;
    const emailTitolare = avvisaTitolare ? await trovaEmailTitolare(admin, tenantId) : null;
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

    // Cosa riceve il cliente, deciso dal salone (17/09/2026). La regola
    // sta tutta in `inviiConferma`, testata a parte senza database e senza
    // mandare niente a nessuno: qui si esegue soltanto.
    const canaleScelto =
      tenant?.conferma_cliente_canale && canaleConfermaValido(tenant.conferma_cliente_canale)
        ? tenant.conferma_cliente_canale
        : CANALE_CONFERMA_PREDEFINITO;
    const invii = inviiConferma(canaleScelto, tenant?.piano ?? "", {
      haEmail: !!cliente?.email,
      haTelefono: !!cliente?.telefono,
    });

    if (invii.email && cliente?.email) {
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
    }

    if (invii.sms && cliente?.telefono) {
      // SMS (Fase 5+SMS, 14/09/2026). `inviaSmsSeInclusoNelPiano`
      // ricontrolla comunque piano e quota: `inviiConferma` sopra evita solo
      // di fare la chiamata quando è già certamente inutile. Testo semplice:
      // niente link, un SMS non supporta HTML e un URL nudo aumenta il
      // rischio phishing.
      const rigaOperatoreSms = nomeOperatore ? ` con ${nomeOperatore}` : "";
      const messaggioSms = `${nomeTenant}: prenotazione confermata per ${nomeServizio}${rigaOperatoreSms}, ${quando}.`;
      await inviaSmsSeInclusoNelPiano(admin, tenantId, tenant?.piano ?? "", cliente.telefono, messaggioSms);
    }
  } catch (errore) {
    console.error("[email] Errore inviando le notifiche di nuovo appuntamento:", errore);
  }
}
