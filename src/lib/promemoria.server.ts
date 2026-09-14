import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { elencaClientiInattivi } from "@/lib/metriche";
import { PIANI_CON_PROMEMORIA } from "@/lib/piani";
import {
  appuntamentiDaAvvisare,
  clientiDaAvvisarePerInattivita,
  FINESTRA_PROMEMORIA_ORE_MAX,
  type AppuntamentoPerPromemoria,
  type ClientePerPromemoriaInattivita,
} from "@/lib/promemoria";
import { inviaEmail } from "@/lib/email/mailjet.server";
import { escapeHtml, formattaOrario, urlBaseSito } from "@/lib/email/notifiche.server";

type ClientAdmin = ReturnType<typeof creaClientAdmin>;

interface TenantConPromemoria {
  id: string;
  nome: string;
  slug: string;
  piano: string;
  fuso_orario: string;
}

export interface EsitoPromemoriaGiornalieri {
  tenantElaborati: number;
  reminderInviati: number;
  followUpInviati: number;
}

/** Le relazioni annidate di Supabase tornano oggetto singolo o array a seconda della cardinalità
 * dedotta -- stesso normalizzatore già usato in notifiche.server.ts, qui duplicato perché è tre
 * righe e non vale la pena esportarlo per questo solo altro chiamante. */
function uno<T>(v: unknown): T | null {
  return Array.isArray(v) ? ((v[0] as T) ?? null) : (v as T | null);
}

/**
 * Reminder pre-appuntamento (metà di "Promemoria automatici", vedi
 * src/lib/promemoria.ts per il perché della finestra 24-48h). Interroga con
 * un margine più ampio della finestra vera (il filtro esatto è nella
 * funzione pura) per non dover ricalcolare la stessa query se le costanti
 * cambiano.
 */
async function avvisaAppuntamentiImminenti(admin: ClientAdmin, tenant: TenantConPromemoria, adesso: Date): Promise<number> {
  const margineQuery = new Date(adesso.getTime() + (FINESTRA_PROMEMORIA_ORE_MAX + 24) * 60 * 60 * 1000);

  const { data: righe } = await admin
    .from("appuntamenti")
    .select("id, inizio, stato, promemoria_inviato_at, clienti(nome, email), servizi(nome)")
    .eq("tenant_id", tenant.id)
    .eq("stato", "confermato")
    .is("promemoria_inviato_at", null)
    .gte("inizio", adesso.toISOString())
    .lt("inizio", margineQuery.toISOString());

  if (!righe || righe.length === 0) return 0;

  interface RigaEstesa extends AppuntamentoPerPromemoria {
    clienteNome: string | null;
    servizioNome: string | null;
  }
  const perId = new Map<string, RigaEstesa>();
  for (const r of righe) {
    const cliente = uno<{ nome: string | null; email: string | null }>(r.clienti);
    const servizio = uno<{ nome: string }>(r.servizi);
    perId.set(r.id, {
      id: r.id,
      inizio: new Date(r.inizio),
      stato: r.stato,
      promemoriaInviatoAt: r.promemoria_inviato_at ? new Date(r.promemoria_inviato_at) : null,
      clienteEmail: cliente?.email ?? null,
      clienteNome: cliente?.nome ?? null,
      servizioNome: servizio?.nome ?? null,
      tenantPiano: tenant.piano,
    });
  }

  const daAvvisare = appuntamentiDaAvvisare([...perId.values()], adesso);

  let inviati = 0;
  for (const ridotto of daAvvisare) {
    const appuntamento = perId.get(ridotto.id)!;
    const quando = formattaOrario(appuntamento.inizio, tenant.fuso_orario);
    const rigaServizio = appuntamento.servizioNome ? ` per ${escapeHtml(appuntamento.servizioNome)}` : "";

    const inviato = await inviaEmail({
      a: appuntamento.clienteEmail!,
      oggetto: `Promemoria: il tuo appuntamento da ${tenant.nome}`,
      nomeMittente: tenant.nome,
      html: `
        <p>Ciao ${escapeHtml(appuntamento.clienteNome ?? "")},</p>
        <p>ti ricordiamo il tuo appuntamento da <strong>${escapeHtml(tenant.nome)}</strong>${rigaServizio}.</p>
        <p>Quando: ${quando}</p>
      `,
    });
    if (inviato) inviati += 1;

    // Segnato come "avvisato" a prescindere dall'esito dell'invio -- stesso
    // fail-open del resto del modulo email: un problema di consegna non deve
    // bloccare gli invii successivi, e comunque un nuovo tentativo domani non
    // sarebbe più possibile (l'appuntamento sarebbe uscito dalla finestra
    // 24-48h, quindi non ritentato in nessun caso).
    await admin.from("appuntamenti").update({ promemoria_inviato_at: adesso.toISOString() }).eq("id", appuntamento.id);
  }
  return inviati;
}

/**
 * Follow-up "ci manchi" ai clienti inattivi (l'altra metà di "Promemoria
 * automatici"). Riusa `elencaClientiInattivi` (src/lib/metriche.ts) --
 * stessa identica regola già mostrata in dashboard, non una seconda scritta
 * qui -- poi la funzione pura decide chi non è già stato avvisato di
 * recente (`GIORNI_RIPETIZIONE_PROMEMORIA_INATTIVITA`).
 */
async function avvisaClientiInattivi(admin: ClientAdmin, tenant: TenantConPromemoria, adesso: Date): Promise<number> {
  const [{ data: clientiGrezzi }, { data: righeAppuntamenti }] = await Promise.all([
    admin
      .from("clienti")
      .select("id, nome, email, promemoria_inattivita_inviato_at")
      .eq("tenant_id", tenant.id)
      .not("email", "is", null),
    admin.from("appuntamenti").select("cliente_id, inizio, stato").eq("tenant_id", tenant.id).not("cliente_id", "is", null),
  ]);

  if (!clientiGrezzi || clientiGrezzi.length === 0) return 0;

  const inattivi = elencaClientiInattivi(
    (righeAppuntamenti ?? []).map((r) => ({
      inizio: new Date(r.inizio),
      fine: new Date(r.inizio),
      stato: r.stato,
      clienteId: r.cliente_id,
      operatoreId: null,
      servizioId: null,
    })),
    adesso,
    60
  );

  interface ClienteEsteso extends ClientePerPromemoriaInattivita {
    nome: string | null;
  }
  const perId = new Map<string, ClienteEsteso>();
  for (const c of clientiGrezzi) {
    perId.set(c.id, {
      id: c.id,
      nome: c.nome,
      email: c.email,
      tenantPiano: tenant.piano,
      promemoriaInattivitaInviatoAt: c.promemoria_inattivita_inviato_at
        ? new Date(c.promemoria_inattivita_inviato_at)
        : null,
    });
  }

  const daAvvisare = clientiDaAvvisarePerInattivita([...perId.values()], inattivi, adesso);
  if (daAvvisare.length === 0) return 0;

  const base = await urlBaseSito();
  const rigaPrenota = base
    ? `<p><a href="${base}/s/${tenant.slug}">Prenota il tuo prossimo appuntamento</a></p>`
    : "";

  let inviati = 0;
  for (const ridotto of daAvvisare) {
    const cliente = perId.get(ridotto.id)!;
    const inviato = await inviaEmail({
      a: cliente.email!,
      oggetto: `Ti aspettiamo da ${tenant.nome}`,
      nomeMittente: tenant.nome,
      html: `
        <p>Ciao ${escapeHtml(cliente.nome ?? "")},</p>
        <p>è passato un po' dal tuo ultimo appuntamento da <strong>${escapeHtml(tenant.nome)}</strong> -- ti aspettiamo!</p>
        ${rigaPrenota}
      `,
    });
    if (inviato) inviati += 1;

    await admin
      .from("clienti")
      .update({ promemoria_inattivita_inviato_at: adesso.toISOString() })
      .eq("id", cliente.id);
  }
  return inviati;
}

/**
 * Punto di ingresso del job schedulato (chiamato da
 * `/api/cron/promemoria`, una volta al giorno via Vercel Cron -- vedi
 * vercel.json). Un tenant alla volta con try/catch dedicato: un problema sui
 * dati di un singolo salone non deve bloccare i promemoria di tutti gli
 * altri. Volumi da indie SaaS (pochi tenant Growth+ oggi): un ciclo semplice
 * batte una query "tutti i tenant insieme" per chiarezza del codice.
 */
export async function eseguiPromemoriaGiornalieri(admin: ClientAdmin, adesso: Date): Promise<EsitoPromemoriaGiornalieri> {
  const esito: EsitoPromemoriaGiornalieri = { tenantElaborati: 0, reminderInviati: 0, followUpInviati: 0 };

  const { data: tenants } = await admin
    .from("tenants")
    .select("id, nome, slug, piano, fuso_orario")
    .in("piano", [...PIANI_CON_PROMEMORIA]);

  for (const tenant of tenants ?? []) {
    try {
      esito.reminderInviati += await avvisaAppuntamentiImminenti(admin, tenant, adesso);
      esito.followUpInviati += await avvisaClientiInattivi(admin, tenant, adesso);
      esito.tenantElaborati += 1;
    } catch (errore) {
      console.error(`[promemoria] Errore elaborando il tenant ${tenant.id}:`, errore);
    }
  }

  return esito;
}
