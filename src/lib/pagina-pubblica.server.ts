import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pianoHaAccessoAIChatWeb } from "@/lib/ai/limiti";
import { pianoHaKnowledgeBaseAi } from "@/lib/piani";
import type { ConfigCaparra, TipoCaparra } from "@/lib/stripe/caparra";

/**
 * Loader del profilo pubblico del salone (Fase 4, punto 15 di CLAUDE.md) --
 * letto da un VISITATORE ANONIMO del sito, mai un utente Supabase autenticato
 * dietro. Stesso pattern di sicurezza già usato da `/api/chat/[slug]` e da
 * `risolviTenantIdDaSlug` (src/lib/ai/tools.ts): il chiamante passa un client
 * ADMIN/service_role (bypassa RLS, che qui comunque non avrebbe nessuna
 * policy per l'accesso anonimo -- vedi migrazione 0001, `isolamento_tabella`
 * scopa solo `auth_tenant_id()`) e la sicurezza sta nel CODICE stesso: si
 * selezionano esplicitamente e SOLO le colonne pensate per essere pubbliche
 * (mai `select("*")`). Se domani si aggiunge una colonna sensibile a
 * "tenants" (es. stripe_customer_id, whatsapp_phone_number_id -- entrambe già
 * presenti in schema e volutamente ESCLUSE qui sotto), questo file non la
 * espone automaticamente: va aggiunta di proposito alla select.
 *
 * ATTENZIONE bypass RLS su "operatori_servizi": quella tabella non ha una
 * colonna tenant_id diretta (isolata solo tramite l'operatore collegato, che
 * RLS verifica per un client normale). Con un client ADMIN quel filtro RLS
 * non esiste più: la query qui sotto filtra esplicitamente per gli ID degli
 * operatori GIÀ risolti per questo tenant, altrimenti si leggerebbero le
 * associazioni servizio<->operatore di TUTTI i saloni sulla piattaforma.
 */

export interface ServizioPubblico {
  id: string;
  nome: string;
  descrizione: string | null;
  categoria: string | null;
  durataMinuti: number;
  prezzoCentesimi: number;
  immagineUrl: string | null;
}

export interface OperatorePubblico {
  id: string;
  nome: string;
  fotoUrl: string | null;
  ruolo: string | null;
  servizioIds: string[];
}

export interface ProfiloPubblico {
  tenantId: string;
  slug: string;
  nome: string;
  descrizione: string | null;
  indirizzo: string | null;
  telefono: string | null;
  /** Numero WhatsApp da mostrare (17/09/2026). Nulla a che vedere con le colonne whatsapp_* dell'API Meta. */
  telefonoWhatsapp: string | null;
  email: string | null;
  sitoWeb: string | null;
  social: Record<string, string>;
  logoUrl: string | null;
  coverUrl: string | null;
  // Se il piano del tenant include la chat AI web (vedi src/lib/ai/limiti.ts)
  // -- il widget chat lato pagina pubblica si mostra SOLO se true, coerente
  // col gate già applicato server-side da /api/chat/[slug].
  chatAiAttiva: boolean;
  /** true sul salone dimostrativo: la pagina aggiunge la barra che lo dichiara. */
  eDemo: boolean;
  /** Lega i cloni Growth e Pro dello stesso visitatore, per l'interruttore in barra. */
  demoGruppo: string | null;
  // Se il tenant ha anche la knowledge base dell'AI receptionist (Fase 2,
  // Pro/Enterprise, vedi pianoHaKnowledgeBaseAi in piani.ts) -- usato dal
  // widget SOLO per calibrare il messaggio di suggerimento iniziale (punto
  // 15/09/2026, richiesta di Gabriel di far notare all'utente cosa può
  // chiedere): non promettere "chiedimi qualsiasi cosa sull'attività" a un
  // cliente il cui tenant non ha configurato quelle informazioni.
  haInformazioniAttivita: boolean;
  // Deposito/caparra anti-no-show (Fase 6): letta qui insieme al resto del
  // profilo pubblico, così FlussoPrenotazione.tsx può calcolare e mostrare
  // l'importo PRIMA di far scegliere al cliente se pagare -- niente
  // richiesta separata solo per questo.
  caparra: ConfigCaparra;
  servizi: ServizioPubblico[];
  operatori: OperatorePubblico[];
}

/**
 * Restituisce `null` se lo slug non corrisponde a nessun tenant -- il
 * chiamante (la pagina) risponde con `notFound()`, mai con un profilo vuoto
 * fabbricato.
 */
export async function caricaProfiloPubblico(
  supabase: SupabaseClient,
  slug: string
): Promise<ProfiloPubblico | null> {
  const { data: tenant, error: erroreTenant } = await supabase
    .from("tenants")
    .select(
      "id, slug, nome, descrizione, indirizzo, telefono, telefono_whatsapp, email, sito_web, social, logo_url, cover_url, piano, caparra_attiva, caparra_tipo, caparra_valore, e_demo, demo_gruppo"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (erroreTenant) {
    // Non silenziare un errore reale (es. service_role key mancante/errata)
    // dietro un fuorviante "salone non trovato": logghiamo per capire cosa è
    // successo davvero (stesso principio di risolviTenantIdDaSlug).
    console.error("Errore caricando il tenant per la pagina pubblica:", slug, erroreTenant);
  }
  if (!tenant) return null;

  const [serviziRes, operatoriRes] = await Promise.all([
    supabase
      .from("servizi")
      .select("id, nome, descrizione, categoria, durata_minuti, prezzo_centesimi, immagine_url")
      .eq("tenant_id", tenant.id)
      .eq("attivo", true)
      .order("categoria", { ascending: true, nullsFirst: false })
      .order("nome", { ascending: true }),
    supabase
      .from("operatori")
      .select("id, nome, foto_url, ruolo")
      .eq("tenant_id", tenant.id)
      .eq("attivo", true)
      .order("nome", { ascending: true }),
  ]);

  if (serviziRes.error) console.error("Errore caricando i servizi pubblici:", slug, serviziRes.error);
  if (operatoriRes.error) console.error("Errore caricando gli operatori pubblici:", slug, operatoriRes.error);

  const operatoriIds = (operatoriRes.data ?? []).map((o) => o.id);

  // Filtrata per operatoriIds (vedi commento in testa al file): senza questo
  // `.in(...)` un client admin leggerebbe le associazioni di OGNI tenant.
  const opServiziRes =
    operatoriIds.length > 0
      ? await supabase.from("operatori_servizi").select("operatore_id, servizio_id").in("operatore_id", operatoriIds)
      : { data: [] as { operatore_id: string; servizio_id: string }[], error: null };

  if (opServiziRes.error) {
    console.error("Errore caricando le associazioni operatore-servizio pubbliche:", slug, opServiziRes.error);
  }

  const servizioIdsPerOperatore = new Map<string, string[]>();
  for (const riga of opServiziRes.data ?? []) {
    const lista = servizioIdsPerOperatore.get(riga.operatore_id) ?? [];
    lista.push(riga.servizio_id);
    servizioIdsPerOperatore.set(riga.operatore_id, lista);
  }

  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    nome: tenant.nome,
    descrizione: tenant.descrizione,
    indirizzo: tenant.indirizzo,
    telefono: tenant.telefono,
    telefonoWhatsapp: tenant.telefono_whatsapp,
    email: tenant.email,
    sitoWeb: tenant.sito_web,
    social: (tenant.social as Record<string, string> | null) ?? {},
    logoUrl: tenant.logo_url,
    coverUrl: tenant.cover_url,
    chatAiAttiva: pianoHaAccessoAIChatWeb(tenant.piano),
    eDemo: tenant.e_demo === true,
    demoGruppo: (tenant.demo_gruppo as string | null) ?? null,
    haInformazioniAttivita: pianoHaKnowledgeBaseAi(tenant.piano),
    caparra: {
      attiva: tenant.caparra_attiva,
      tipo: tenant.caparra_tipo as TipoCaparra,
      valore: tenant.caparra_valore,
    },
    servizi: (serviziRes.data ?? []).map((s) => ({
      id: s.id,
      nome: s.nome,
      descrizione: s.descrizione,
      categoria: s.categoria,
      durataMinuti: s.durata_minuti,
      prezzoCentesimi: s.prezzo_centesimi,
      immagineUrl: s.immagine_url,
    })),
    operatori: (operatoriRes.data ?? []).map((o) => ({
      id: o.id,
      nome: o.nome,
      fotoUrl: o.foto_url,
      ruolo: o.ruolo,
      servizioIds: servizioIdsPerOperatore.get(o.id) ?? [],
    })),
  };
}
