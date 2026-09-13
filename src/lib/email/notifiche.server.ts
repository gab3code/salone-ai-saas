import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { inviaEmail } from "./mailjet.server";

/** Escape minimo per inserire testo libero (nome cliente, servizio, note) dentro l'HTML dell'email. */
function escapeHtml(testo: string): string {
  return testo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formattaOrario(inizioReale: Date, fusoOrario: string): string {
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
 * Notifiche email per un appuntamento appena creato (Fase 6, Gruppo B-bis
 * #1 di PIANO.md: "nessuna notifica email, né per il titolare né per il
 * cliente... priorità alta, manca qualcosa che ogni concorrente verificato
 * ha"). Due email indipendenti:
 *  - al titolare: SEMPRE, per ogni prenotazione (è l'unico che deve sapere
 *    che è arrivata, a prescindere dal canale).
 *  - al cliente: SOLO se ha lasciato un'email (oggi raccolta solo nel
 *    flusso pubblico, vedi FlussoPrenotazione.tsx).
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
  // Se Gabriel non ha ancora configurato Mailjet, non ha senso interrogare
  // il database per niente -- niente latenza aggiunta alla prenotazione.
  if (!process.env.MJ_APIKEY_PUBLIC || !process.env.MJ_APIKEY_PRIVATE) return;

  try {
    const admin = creaClientAdmin();

    const [{ data: appuntamento }, fusoOrario] = await Promise.all([
      admin
        .from("appuntamenti")
        .select("inizio, note, clienti(nome, email), servizi(nome), operatori(nome), tenants(nome)")
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
    const cliente = uno<{ nome: string | null; email: string | null }>(appuntamento.clienti);
    const servizio = uno<{ nome: string }>(appuntamento.servizi);
    const operatore = uno<{ nome: string }>(appuntamento.operatori);
    const tenant = uno<{ nome: string }>(appuntamento.tenants);

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
        `,
      });
    }
  } catch (errore) {
    console.error("[email] Errore inviando le notifiche di nuovo appuntamento:", errore);
  }
}
