import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { pianoAssegnabileValido, statoAbbonamentoValido, type RigaAdmin } from "@/lib/admin";

/**
 * Dati del pannello admin di piattaforma (Fase 5): l'elenco di TUTTE le
 * attività con piano, stato e utilizzo reale. È l'unico posto del progetto
 * che guarda oltre il confine di un singolo tenant, e per farlo usa il
 * service_role (RLS mostrerebbe solo l'attività attiva di chi guarda).
 *
 * Chi può aprirlo viene deciso altrove e SEMPRE prima di chiamare queste
 * funzioni: `eAdminPiattaforma(profiles.ruolo)`, verificato nel layout di
 * /admin e di nuovo in ogni server action (src/app/admin/azioni.ts).
 *
 * Limite noto e accettato: i conteggi vengono fatti in JavaScript su righe
 * lette per intero (solo la colonna `tenant_id`), non con un GROUP BY sul
 * database. È la scelta giusta finché le attività sono poche decine e gli
 * appuntamenti qualche decina di migliaia -- oltre, questa pagina va
 * spostata su una vista SQL o una RPC. Meglio una query semplice da leggere
 * adesso che una vista da mantenere per un volume che non esiste ancora.
 */


async function conteggiPerTenant(
  admin: ReturnType<typeof creaClientAdmin>,
  tabella: string,
  colonnaData?: string
): Promise<{ totali: Map<string, number>; recenti: Map<string, number> }> {
  const colonne = colonnaData ? `tenant_id, ${colonnaData}` : "tenant_id";
  const { data } = await admin.from(tabella).select(colonne);

  const totali = new Map<string, number>();
  const recenti = new Map<string, number>();
  const trentaGiorniFa = Date.now() - 30 * 24 * 60 * 60 * 1000;

  for (const riga of (data ?? []) as unknown as Record<string, string>[]) {
    const tenantId = riga.tenant_id;
    if (!tenantId) continue;
    totali.set(tenantId, (totali.get(tenantId) ?? 0) + 1);

    if (colonnaData && riga[colonnaData]) {
      if (new Date(riga[colonnaData]).getTime() >= trentaGiorniFa) {
        recenti.set(tenantId, (recenti.get(tenantId) ?? 0) + 1);
      }
    }
  }

  return { totali, recenti };
}

export async function caricaAttivitaPiattaforma(): Promise<RigaAdmin[]> {
  const admin = creaClientAdmin();

  const [tenantsRes, membriRes, utentiRes, operatori, clienti, appuntamenti] = await Promise.all([
    admin
      .from("tenants")
      .select("id, nome, slug, piano, stato_abbonamento, piano_manuale, created_at, stripe_customer_id")
      .order("created_at", { ascending: false }),
    admin.from("membri_tenant").select("tenant_id, user_id, ruolo"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    conteggiPerTenant(admin, "operatori"),
    conteggiPerTenant(admin, "clienti"),
    conteggiPerTenant(admin, "appuntamenti", "created_at"),
  ]);

  const emailPerUtente = new Map<string, string>();
  for (const utente of utentiRes.data?.users ?? []) {
    if (utente.email) emailPerUtente.set(utente.id, utente.email);
  }

  const membriPerTenant = new Map<string, { totale: number; emailTitolari: string[] }>();
  for (const riga of membriRes.data ?? []) {
    const tenantId = riga.tenant_id as string;
    const voce = membriPerTenant.get(tenantId) ?? { totale: 0, emailTitolari: [] };
    voce.totale += 1;
    if (riga.ruolo === "owner") {
      const email = emailPerUtente.get(riga.user_id as string);
      if (email) voce.emailTitolari.push(email);
    }
    membriPerTenant.set(tenantId, voce);
  }

  return (tenantsRes.data ?? []).map((tenant) => {
    const id = tenant.id as string;
    const membri = membriPerTenant.get(id);
    return {
      tenantId: id,
      nome: tenant.nome as string,
      slug: tenant.slug as string,
      piano: (tenant.piano as string) ?? "free",
      statoAbbonamento: (tenant.stato_abbonamento as string) ?? "--",
      pianoManuale: Boolean(tenant.piano_manuale),
      creatoIl: tenant.created_at as string,
      haStripe: Boolean(tenant.stripe_customer_id),
      emailTitolari: membri?.emailTitolari ?? [],
      membri: membri?.totale ?? 0,
      operatori: operatori.totali.get(id) ?? 0,
      clienti: clienti.totali.get(id) ?? 0,
      appuntamenti: appuntamenti.totali.get(id) ?? 0,
      appuntamenti30Giorni: appuntamenti.recenti.get(id) ?? 0,
    };
  });
}

/**
 * Cambia il piano di un'attività a mano. Accende sempre `piano_manuale`
 * (migrazione 0028): da questo momento il webhook Stripe non tocca più
 * piano/stato di quel tenant, altrimenti la modifica durerebbe fino al primo
 * evento e sparirebbe senza che nessuno se ne accorga.
 */
export async function impostaPianoManuale(
  tenantId: string,
  piano: string,
  statoAbbonamento: string
): Promise<{ ok: true } | { errore: string }> {
  if (!pianoAssegnabileValido(piano)) return { errore: "Piano non valido." };
  if (!statoAbbonamentoValido(statoAbbonamento)) return { errore: "Stato abbonamento non valido." };

  const admin = creaClientAdmin();
  const { error } = await admin
    .from("tenants")
    .update({ piano, stato_abbonamento: statoAbbonamento, piano_manuale: true })
    .eq("id", tenantId);

  if (error) return { errore: `Errore cambiando piano: ${error.message}` };
  return { ok: true };
}

/**
 * Restituisce il tenant al controllo di Stripe. Non tocca il piano attuale:
 * resterà quello finché il prossimo evento Stripe non dirà altro -- se non
 * c'è nessun abbonamento, resta com'è, che è il comportamento giusto per un
 * tenant Free.
 */
export async function riportaPianoSuStripe(
  tenantId: string
): Promise<{ ok: true } | { errore: string }> {
  const admin = creaClientAdmin();
  const { error } = await admin
    .from("tenants")
    .update({ piano_manuale: false })
    .eq("id", tenantId);

  if (error) return { errore: `Errore ripristinando la gestione Stripe: ${error.message}` };
  return { ok: true };
}
