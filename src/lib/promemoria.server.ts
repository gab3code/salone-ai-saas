import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { elencaClientiInattivi } from "@/lib/metriche";
import { PIANI_CON_PROMEMORIA } from "@/lib/piani";
import {
  appuntamentiDaAvvisarePerRegola,
  clientiDaAvvisarePerInattivita,
  LARGHEZZA_FINESTRA_ORE,
  type AppuntamentoPerPromemoria,
  type ClientePerPromemoriaInattivita,
  type RegolaPromemoria,
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
 * src/lib/promemoria.ts per il perché della finestra di 24 ore per ogni
 * regola). Un tenant può avere più regole attive (es. 72h E 24h prima --
 * `regole_promemoria`, configurabili da `/dashboard/impostazioni/promemoria`);
 * ogni regola viene valutata indipendentemente sullo stesso elenco di
 * appuntamenti, e ciascuna tiene il proprio tracciamento invii
 * (`promemoria_appuntamento_inviati`, una riga per coppia appuntamento+regola)
 * -- così due regole diverse possono scattare entrambe per lo stesso
 * appuntamento, in momenti diversi.
 */
async function avvisaAppuntamentiImminenti(admin: ClientAdmin, tenant: TenantConPromemoria, adesso: Date): Promise<number> {
  const { data: regoleGrezze } = await admin
    .from("regole_promemoria")
    .select("id, ore_preavviso")
    .eq("tenant_id", tenant.id);
  const regole: RegolaPromemoria[] = (regoleGrezze ?? []).map((r) => ({ id: r.id, orePreavviso: r.ore_preavviso }));
  if (regole.length === 0) return 0;

  // Margine di query oltre la regola più lontana: la finestra vera di ciascuna regola (larga
  // LARGHEZZA_FINESTRA_ORE) è filtrata dopo, in memoria, dalla funzione pura -- qui prendiamo
  // tutto quello che potrebbe servire a QUALUNQUE regola in un colpo solo.
  const oreMassimeAvanti = Math.max(...regole.map((r) => r.orePreavviso)) + LARGHEZZA_FINESTRA_ORE;
  const finoA = new Date(adesso.getTime() + oreMassimeAvanti * 60 * 60 * 1000);

  const { data: righe } = await admin
    .from("appuntamenti")
    .select(
      "id, inizio, stato, clienti(nome, email), servizi(nome), promemoria_appuntamento_inviati(regola_id)"
    )
    .eq("tenant_id", tenant.id)
    .eq("stato", "confermato")
    .gte("inizio", adesso.toISOString())
    .lt("inizio", finoA.toISOString());

  if (!righe || righe.length === 0) return 0;

  interface RigaEstesa extends AppuntamentoPerPromemoria {
    clienteNome: string | null;
    servizioNome: string | null;
  }
  const perId = new Map<string, RigaEstesa>();
  for (const r of righe) {
    const cliente = uno<{ nome: string | null; email: string | null }>(r.clienti);
    const servizio = uno<{ nome: string }>(r.servizi);
    const righeInviate = (r.promemoria_appuntamento_inviati ?? []) as { regola_id: string }[];
    perId.set(r.id, {
      id: r.id,
      inizio: new Date(r.inizio),
      stato: r.stato,
      clienteEmail: cliente?.email ?? null,
      clienteNome: cliente?.nome ?? null,
      servizioNome: servizio?.nome ?? null,
      tenantPiano: tenant.piano,
      regoleGiaInviate: new Set(righeInviate.map((x) => x.regola_id)),
    });
  }
  const tutti = [...perId.values()];

  let inviati = 0;
  for (const regola of regole) {
    const daAvvisare = appuntamentiDaAvvisarePerRegola(tutti, regola, adesso);
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

      // Segnato come "avvisato" per QUESTA regola a prescindere dall'esito
      // dell'invio -- stesso fail-open del resto del modulo email: un
      // problema di consegna non deve bloccare gli invii successivi (né di
      // altri appuntamenti, né delle altre regole), e un nuovo tentativo
      // domani non sarebbe comunque più possibile per questa stessa regola
      // (l'appuntamento sarebbe uscito dalla sua finestra).
      await admin
        .from("promemoria_appuntamento_inviati")
        .insert({ appuntamento_id: appuntamento.id, regola_id: regola.id });
      // Anche in memoria, per non farlo rientrare se un'altra regola con
      // finestra sovrapposta lo rivalutasse più avanti in questo stesso giro.
      appuntamento.regoleGiaInviate.add(regola.id);
    }
  }
  return inviati;
}

/**
 * Follow-up "ci manchi" ai clienti inattivi (l'altra metà di "Promemoria
 * automatici", invariato -- non fa parte di questa richiesta di
 * configurabilità). Riusa `elencaClientiInattivi` (src/lib/metriche.ts) --
 * stessa identica regola già mostrata in dashboard, non ricalcolata qui --
 * poi la funzione pura decide chi non è già stato avvisato di recente.
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
