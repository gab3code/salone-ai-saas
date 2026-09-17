import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientStripe } from "@/lib/stripe/server";
import { BUCKET_MEDIA_TENANT } from "@/lib/storage/media-tenant";
import { statoAbbonamentoDaStripe } from "@/lib/stripe/abbonamento.server";
import {
  allineaPianoSuStripe,
  anteprimaCambioPiano,
  type AnteprimaCambioPiano,
  type AzioneStripe,
} from "@/lib/stripe/cambio-piano.server";
import { pianoAssegnabileValido, statoAbbonamentoValido, type RigaAdmin } from "@/lib/admin";
import {
  coortiPerMese,
  imbutoAttivazione,
  medianaGiorniAllaPrimaPrenotazione,
  serieSettimanale,
  usoPiattaforma,
  type AppuntamentoAggregabile,
  type MetrichePiattaforma,
} from "@/lib/admin-metriche";

/**
 * Dati e operazioni del pannello admin di piattaforma (Fase 5): l'elenco di
 * TUTTE le attività, e i pochi interventi manuali che Gabriel può fare su di
 * esse. È l'unico posto del progetto che guarda oltre il confine di un
 * singolo tenant, e per farlo usa il service_role (RLS mostrerebbe solo
 * l'attività attiva di chi guarda).
 *
 * Chi può usarlo viene deciso altrove e SEMPRE prima di chiamare queste
 * funzioni: `eAdminPiattaforma(profiles.ruolo)`, verificato nel layout di
 * /admin e di nuovo in ogni server action (src/app/admin/azioni.ts).
 *
 * Nessuna funzione qui dentro legge un dato personale di un cliente finale:
 * solo conteggi. Vedi la nota in testa a `src/lib/admin.ts` per il perché
 * quella linea non è un dettaglio ma il motivo per cui questo pannello può
 * esistere.
 *
 * Limite noto e accettato: i conteggi vengono fatti in JavaScript su righe
 * lette per intero (solo le colonne che servono), non con un GROUP BY sul
 * database. È la scelta giusta finché le attività sono poche decine e gli
 * appuntamenti qualche decina di migliaia -- oltre, questa pagina va
 * spostata su una vista SQL o una RPC.
 */

type ClientAdmin = ReturnType<typeof creaClientAdmin>;

export type Intervento = {
  id: string;
  adminEmail: string | null;
  tenantNome: string | null;
  tenantSlug: string | null;
  azione: string;
  dettaglio: Record<string, unknown>;
  quando: string;
};

export type AutoreIntervento = { userId: string; email: string | null };

/**
 * Scrive nel registro (migrazione 0029). Non lancia mai: un problema nello
 * scrivere la traccia non deve impedire l'intervento che l'ha generata --
 * ma viene loggato, perché un registro con buchi silenziosi è peggio di
 * nessun registro.
 */
async function registraIntervento(
  admin: ClientAdmin,
  autore: AutoreIntervento,
  tenant: { id: string; nome: string | null; slug: string | null },
  azione: string,
  dettaglio: Record<string, unknown>
): Promise<void> {
  const { error } = await admin.from("interventi_admin").insert({
    admin_user_id: autore.userId,
    admin_email: autore.email,
    tenant_id: tenant.id,
    tenant_nome: tenant.nome,
    tenant_slug: tenant.slug,
    azione,
    dettaglio,
  });
  if (error) {
    console.error("[admin] Registro interventi: scrittura fallita", { azione, errore: error.message });
  }
}

/** Conteggio semplice di righe per tenant: quante ne ha ciascuno. */
async function conteggiPerTenant(admin: ClientAdmin, tabella: string): Promise<Map<string, number>> {
  const { data } = await admin.from(tabella).select("tenant_id");
  const totali = new Map<string, number>();
  for (const riga of (data ?? []) as unknown as Record<string, string>[]) {
    if (!riga.tenant_id) continue;
    totali.set(riga.tenant_id, (totali.get(riga.tenant_id) ?? 0) + 1);
  }
  return totali;
}

type RiepilogoAppuntamenti = {
  totali: Map<string, number>;
  ultimi30: Map<string, number>;
  meseCorrente: Map<string, number>;
  presiDallAi: Map<string, number>;
  noShow: Map<string, number>;
  piuRecente: Map<string, string>;
  piuVecchio: Map<string, string>;
};

/**
 * Gli appuntamenti si leggono UNA volta sola e da quella sola lettura
 * escono sia i conteggi per attività sia le serie di piattaforma. È la
 * tabella più grande del database: rileggerla una seconda volta per le
 * metriche raddoppierebbe il costo della pagina senza aggiungere niente.
 */
function riepilogaAppuntamenti(
  righe: AppuntamentoLetto[],
  adesso: Date
): RiepilogoAppuntamenti {
  const totali = new Map<string, number>();
  const ultimi30 = new Map<string, number>();
  const meseCorrente = new Map<string, number>();
  const presiDallAi = new Map<string, number>();
  const noShow = new Map<string, number>();
  const piuRecente = new Map<string, string>();
  const piuVecchio = new Map<string, string>();

  const trentaGiorniFa = adesso.getTime() - 30 * 24 * 60 * 60 * 1000;
  // Stesso criterio di `limiteMensilePrenotazioni`: il tetto del piano conta
  // le prenotazioni CREATE nel mese solare corrente.
  const inizioMese = new Date(adesso.getFullYear(), adesso.getMonth(), 1).getTime();

  const piuUno = (mappa: Map<string, number>, chiave: string) =>
    mappa.set(chiave, (mappa.get(chiave) ?? 0) + 1);

  for (const riga of righe) {
    const tenantId = riga.tenant_id;
    if (!tenantId) continue;
    piuUno(totali, tenantId);
    if (riga.creato_da === "ai") piuUno(presiDallAi, tenantId);
    if (riga.stato === "no_show") piuUno(noShow, tenantId);

    const valore = riga.created_at;
    if (!valore) continue;
    const quando = new Date(valore).getTime();
    if (Number.isNaN(quando)) continue;

    if (quando >= trentaGiorniFa) piuUno(ultimi30, tenantId);
    if (quando >= inizioMese) piuUno(meseCorrente, tenantId);

    const recente = piuRecente.get(tenantId);
    if (!recente || quando > new Date(recente).getTime()) piuRecente.set(tenantId, valore);
    const vecchio = piuVecchio.get(tenantId);
    if (!vecchio || quando < new Date(vecchio).getTime()) piuVecchio.set(tenantId, valore);
  }

  return { totali, ultimi30, meseCorrente, presiDallAi, noShow, piuRecente, piuVecchio };
}

type AppuntamentoLetto = {
  tenant_id: string;
  created_at: string;
  stato: string;
  creato_da: string;
};

/**
 * Tutto quello che il pannello mostra, in un giro solo di letture.
 *
 * Le righe per attività e le metriche aggregate nascono dagli stessi dati:
 * separarle in due funzioni pubbliche significherebbe leggere due volte le
 * stesse tabelle a ogni apertura della pagina.
 */
export async function caricaPannelloPiattaforma(
  adesso: Date = new Date()
): Promise<{ righe: RigaAdmin[]; metriche: MetrichePiattaforma }> {
  const admin = creaClientAdmin();

  const [
    tenantsRes,
    membriRes,
    utentiRes,
    orariRes,
    appuntamentiRes,
    conversazioniRes,
    recensioniRes,
    operatori,
    servizi,
    clienti,
  ] = await Promise.all([
    admin
      .from("tenants")
      .select(
        "id, nome, slug, piano, stato_abbonamento, piano_manuale, sospesa, sospesa_motivo, created_at, stripe_customer_id, stripe_subscription_id, codice_destinatario, pec_fatturazione"
      )
      .order("created_at", { ascending: false }),
    admin.from("membri_tenant").select("tenant_id, user_id, ruolo"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("orari_apertura").select("tenant_id, chiuso"),
    admin.from("appuntamenti").select("tenant_id, created_at, stato, creato_da"),
    // Solo lo stato della conversazione: quante ce ne sono e quante l'AI ha
    // passato a una persona. Mai il contenuto dei messaggi -- quello è un
    // dato dei clienti del salone, non nostro (vedi la nota in admin.ts).
    admin.from("conversazioni").select("stato"),
    admin.from("recensioni").select("valutazione"),
    conteggiPerTenant(admin, "operatori"),
    conteggiPerTenant(admin, "servizi"),
    conteggiPerTenant(admin, "clienti"),
  ]);

  const appuntamentiLetti = (appuntamentiRes.data ?? []) as unknown as AppuntamentoLetto[];
  const appuntamenti = riepilogaAppuntamenti(appuntamentiLetti, adesso);

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

  // "Orari configurati" = almeno un giorno aperto. Il trigger di
  // registrazione crea 7 righe tutte chiuse, quindi la semplice presenza
  // delle righe non dice nulla.
  const haGiorniAperti = new Set<string>();
  for (const riga of orariRes.data ?? []) {
    if (riga.chiuso === false) haGiorniAperti.add(riga.tenant_id as string);
  }

  const righe: RigaAdmin[] = (tenantsRes.data ?? []).map((tenant) => {
    const id = tenant.id as string;
    const membri = membriPerTenant.get(id);
    return {
      tenantId: id,
      nome: tenant.nome as string,
      slug: tenant.slug as string,
      piano: (tenant.piano as string) ?? "free",
      statoAbbonamento: (tenant.stato_abbonamento as string) ?? "--",
      pianoManuale: Boolean(tenant.piano_manuale),
      sospesa: Boolean(tenant.sospesa),
      sospesaMotivo: (tenant.sospesa_motivo as string) ?? null,
      creatoIl: tenant.created_at as string,
      haStripe: Boolean(tenant.stripe_customer_id),
      haAbbonamentoStripe: Boolean(tenant.stripe_subscription_id),
      datiFatturaCompleti: Boolean(tenant.codice_destinatario || tenant.pec_fatturazione),
      emailTitolari: membri?.emailTitolari ?? [],
      membri: membri?.totale ?? 0,
      operatori: operatori.get(id) ?? 0,
      servizi: servizi.get(id) ?? 0,
      orariConfigurati: haGiorniAperti.has(id),
      clienti: clienti.get(id) ?? 0,
      appuntamenti: appuntamenti.totali.get(id) ?? 0,
      appuntamenti30Giorni: appuntamenti.ultimi30.get(id) ?? 0,
      prenotazioniMeseCorrente: appuntamenti.meseCorrente.get(id) ?? 0,
      appuntamentiAi: appuntamenti.presiDallAi.get(id) ?? 0,
      noShow: appuntamenti.noShow.get(id) ?? 0,
      primaAttivita: appuntamenti.piuVecchio.get(id) ?? null,
      ultimaAttivita: appuntamenti.piuRecente.get(id) ?? null,
    };
  });

  const aggregabili: AppuntamentoAggregabile[] = appuntamentiLetti.map((a) => ({
    creatoIl: a.created_at,
    stato: a.stato,
    creatoDa: a.creato_da,
  }));

  const metriche: MetrichePiattaforma = {
    serie: serieSettimanale(aggregabili, 12, adesso),
    uso: usoPiattaforma(
      aggregabili,
      (conversazioniRes.data ?? []) as unknown as { stato: string }[],
      (recensioniRes.data ?? []) as unknown as { valutazione: number }[]
    ),
    coorti: coortiPerMese(righe, adesso),
    imbuto: imbutoAttivazione(righe),
    medianaGiorniPrimaPrenotazione: medianaGiorniAllaPrimaPrenotazione(righe),
  };

  return { righe, metriche };
}

/** Solo l'elenco delle attività, senza le metriche aggregate. */
export async function caricaAttivitaPiattaforma(): Promise<RigaAdmin[]> {
  const { righe } = await caricaPannelloPiattaforma();
  return righe;
}

export async function elencaInterventi(limite = 50): Promise<Intervento[]> {
  const admin = creaClientAdmin();
  const { data } = await admin
    .from("interventi_admin")
    .select("id, admin_email, tenant_nome, tenant_slug, azione, dettaglio, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);

  return (data ?? []).map((riga) => ({
    id: riga.id as string,
    adminEmail: (riga.admin_email as string) ?? null,
    tenantNome: (riga.tenant_nome as string) ?? null,
    tenantSlug: (riga.tenant_slug as string) ?? null,
    azione: riga.azione as string,
    dettaglio: (riga.dettaglio as Record<string, unknown>) ?? {},
    quando: riga.created_at as string,
  }));
}

async function leggiTenant(admin: ClientAdmin, tenantId: string) {
  const { data } = await admin
    .from("tenants")
    .select("id, nome, slug, piano, stato_abbonamento, stripe_subscription_id, sospesa")
    .eq("id", tenantId)
    .maybeSingle();
  return data;
}

/**
 * Cambia il piano di un'attività a mano. Accende sempre `piano_manuale`
 * (migrazione 0028): da questo momento il webhook Stripe non tocca più
 * piano/stato di quel tenant, altrimenti la modifica durerebbe fino al primo
 * evento e sparirebbe senza che nessuno se ne accorga.
 */
export async function impostaPianoManuale(
  autore: AutoreIntervento,
  tenantId: string,
  piano: string,
  statoAbbonamento: string
): Promise<{ ok: true } | { errore: string }> {
  if (!pianoAssegnabileValido(piano)) return { errore: "Piano non valido." };
  if (!statoAbbonamentoValido(statoAbbonamento)) return { errore: "Stato abbonamento non valido." };

  const admin = creaClientAdmin();
  const prima = await leggiTenant(admin, tenantId);
  if (!prima) return { errore: "Attività non trovata." };

  const { error } = await admin
    .from("tenants")
    .update({ piano, stato_abbonamento: statoAbbonamento, piano_manuale: true })
    .eq("id", tenantId);

  if (error) return { errore: `Errore cambiando piano: ${error.message}` };

  await registraIntervento(admin, autore, prima, "piano_manuale", {
    piano_prima: prima.piano,
    piano_dopo: piano,
    stato_prima: prima.stato_abbonamento,
    stato_dopo: statoAbbonamento,
  });

  return { ok: true };
}

/**
 * Restituisce il tenant al controllo di Stripe. Non tocca il piano attuale:
 * resterà quello finché il prossimo evento Stripe non dirà altro.
 */
export async function riportaPianoSuStripe(
  autore: AutoreIntervento,
  tenantId: string
): Promise<{ ok: true } | { errore: string }> {
  const admin = creaClientAdmin();
  const prima = await leggiTenant(admin, tenantId);
  if (!prima) return { errore: "Attività non trovata." };

  const { error } = await admin.from("tenants").update({ piano_manuale: false }).eq("id", tenantId);
  if (error) return { errore: `Errore ripristinando la gestione Stripe: ${error.message}` };

  await registraIntervento(admin, autore, prima, "ripristino_stripe", { piano_al_momento: prima.piano });
  return { ok: true };
}

/**
 * Anteprima di sola lettura: cosa cambierebbe su Stripe portando questa
 * attività al piano indicato. Non scrive niente da nessuna parte.
 */
export async function anteprimaCambioPianoAdmin(
  tenantId: string,
  piano: string
): Promise<AnteprimaCambioPiano | { errore: string }> {
  if (!pianoAssegnabileValido(piano)) return { errore: "Piano non valido." };
  return anteprimaCambioPiano(creaClientAdmin(), tenantId, piano);
}

/**
 * Cambio piano dal pannello, con o senza Stripe.
 *
 * `azioneStripe = "nessuna"` è il comportamento storico: si scrive solo sul
 * nostro database e si accende `piano_manuale`, perché da quel momento il
 * database dice una cosa che Stripe non sa -- senza quel flag il primo
 * webhook riporterebbe tutto com'era.
 *
 * Con "subito" o "prossimo_rinnovo" succede il contrario: si modifica prima
 * l'abbonamento su Stripe e solo dopo il database, `piano_manuale` viene
 * SPENTO (i due sistemi ora concordano, non serve più proteggere la modifica
 * dai webhook) e lo stato non è quello scelto nel menu ma quello che Stripe
 * riporta dopo la modifica: su un abbonamento vero la verità è la sua, e
 * scriverne un'altra accanto servirebbe solo a doverla correggere dopo.
 *
 * Se Stripe rifiuta, il database non viene toccato: meglio un cambio piano
 * che non è avvenuto di due sistemi che non si parlano sul numero che il
 * cliente paga.
 */
export async function cambiaPianoAttivita(
  autore: AutoreIntervento,
  tenantId: string,
  piano: string,
  statoAbbonamento: string,
  azioneStripe: AzioneStripe
): Promise<{ ok: true; messaggio: string } | { errore: string }> {
  if (azioneStripe === "nessuna") {
    const esito = await impostaPianoManuale(autore, tenantId, piano, statoAbbonamento);
    if ("errore" in esito) return esito;
    return {
      ok: true,
      messaggio: "Piano cambiato solo qui. Stripe non è stato toccato e i webhook non aggiorneranno più questa attività.",
    };
  }

  if (!pianoAssegnabileValido(piano)) return { errore: "Piano non valido." };

  const admin = creaClientAdmin();
  const prima = await leggiTenant(admin, tenantId);
  if (!prima) return { errore: "Attività non trovata." };

  const esitoStripe = await allineaPianoSuStripe(admin, tenantId, piano, azioneStripe);
  if ("errore" in esitoStripe) return esitoStripe;

  const statoDaStripe = statoAbbonamentoDaStripe(
    esitoStripe.statoStripe as Parameters<typeof statoAbbonamentoDaStripe>[0]
  );

  // `piano_manuale` si spegne solo quando i due sistemi concordano DAVVERO.
  //
  // Nel ramo "chiudi l'abbonamento" non concordano: Stripe continua a
  // fatturare il piano vecchio fino alla fine del periodo già pagato
  // (`cancel_at_period_end`), mentre qui il tenant è appena passato a Free o
  // a Enterprise. Spegnere il flag lì significherebbe che il primo webhook
  // utile -- e ne basta uno qualsiasi, anche l'aggiunta di un operatore --
  // ricava il piano dai price ancora presenti e riscrive quello vecchio: il
  // cambio piano si annullerebbe da solo, senza che nessuno abbia toccato
  // niente. Finché la chiusura non è effettiva, la decisione dell'admin va
  // protetta.
  const restaManuale = esitoStripe.chiusoAFinePeriodo;

  const { error } = await admin
    .from("tenants")
    .update({ piano, stato_abbonamento: statoDaStripe, piano_manuale: restaManuale })
    .eq("id", tenantId);

  if (error) {
    // Stripe è già stato modificato: dirlo esplicitamente, perché ritentare
    // l'azione dall'inizio non è la stessa cosa che sistemare solo questa
    // riga.
    return {
      errore: `Stripe è stato aggiornato ma il database no (${error.message}). Riapri il pannello e ricontrolla il piano di questa attività.`,
    };
  }

  await registraIntervento(admin, autore, prima, "piano_con_stripe", {
    piano_prima: prima.piano,
    piano_dopo: piano,
    stato_prima: prima.stato_abbonamento,
    stato_dopo: statoDaStripe,
    conguaglio: azioneStripe,
    piano_manuale_dopo: restaManuale,
    totale_prima_centesimi: esitoStripe.totalePrimaCentesimi,
    totale_dopo_centesimi: esitoStripe.totaleDopoCentesimi,
    chiuso_a_fine_periodo: esitoStripe.chiusoAFinePeriodo,
  });

  return { ok: true, messaggio: esitoStripe.descrizione };
}

/**
 * Sospende un'attività: la pagina pubblica smette di accettare prenotazioni,
 * la dashboard resta accessibile al titolare (vedi il commento nella
 * migrazione 0029 per il perché di questa asimmetria).
 */
export async function sospendiAttivita(
  autore: AutoreIntervento,
  tenantId: string,
  motivo: string
): Promise<{ ok: true } | { errore: string }> {
  const motivoPulito = motivo.trim();
  if (!motivoPulito) {
    // Obbligatorio di proposito: fra sei mesi, davanti a un'attività
    // sospesa, "perché" è l'unica domanda che conterà.
    return { errore: "Scrivi il motivo della sospensione." };
  }

  const admin = creaClientAdmin();
  const prima = await leggiTenant(admin, tenantId);
  if (!prima) return { errore: "Attività non trovata." };

  const { error } = await admin
    .from("tenants")
    .update({ sospesa: true, sospesa_motivo: motivoPulito, sospesa_il: new Date().toISOString() })
    .eq("id", tenantId);

  if (error) return { errore: `Errore sospendendo l'attività: ${error.message}` };

  await registraIntervento(admin, autore, prima, "sospensione", { motivo: motivoPulito });
  return { ok: true };
}

export async function riattivaAttivita(
  autore: AutoreIntervento,
  tenantId: string
): Promise<{ ok: true } | { errore: string }> {
  const admin = creaClientAdmin();
  const prima = await leggiTenant(admin, tenantId);
  if (!prima) return { errore: "Attività non trovata." };

  const { error } = await admin
    .from("tenants")
    .update({ sospesa: false, sospesa_motivo: null, sospesa_il: null })
    .eq("id", tenantId);

  if (error) return { errore: `Errore riattivando l'attività: ${error.message}` };

  await registraIntervento(admin, autore, prima, "riattivazione", {});
  return { ok: true };
}

export type RiepilogoCancellazione = {
  nome: string;
  slug: string;
  clienti: number;
  appuntamenti: number;
  recensioni: number;
  membri: number;
  /** Account che resterebbero senza NESSUNA attività, e quindi verranno cancellati. */
  accountDaCancellare: string[];
  abbonamentoAttivo: boolean;
};

/**
 * Cosa sta per sparire. Mostrato prima di chiedere conferma: una
 * cancellazione che non si annulla va guardata in faccia con i numeri
 * davanti, non accettata al buio.
 */
export async function riepilogoCancellazione(
  tenantId: string
): Promise<RiepilogoCancellazione | { errore: string }> {
  const admin = creaClientAdmin();
  const tenant = await leggiTenant(admin, tenantId);
  if (!tenant) return { errore: "Attività non trovata." };

  const conta = async (tabella: string) => {
    const { count } = await admin
      .from(tabella)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    return count ?? 0;
  };

  const [clienti, appuntamenti, recensioni] = await Promise.all([
    conta("clienti"),
    conta("appuntamenti"),
    conta("recensioni"),
  ]);

  const { membri, orfani } = await analizzaMembri(admin, tenantId);

  return {
    nome: tenant.nome as string,
    slug: tenant.slug as string,
    clienti,
    appuntamenti,
    recensioni,
    membri: membri.length,
    accountDaCancellare: orfani.map((o) => o.email ?? o.userId),
    abbonamentoAttivo: Boolean(tenant.stripe_subscription_id),
  };
}

/**
 * Chi lavora in questa attività, e chi di loro non farebbe parte di nient'altro
 * una volta cancellata -- cioè chi va cancellato davvero e chi no.
 */
async function analizzaMembri(admin: ClientAdmin, tenantId: string) {
  const { data: membriQui } = await admin
    .from("membri_tenant")
    .select("user_id")
    .eq("tenant_id", tenantId);

  const membri = (membriQui ?? []).map((m) => m.user_id as string);
  if (membri.length === 0) return { membri, orfani: [] as { userId: string; email: string | null }[] };

  const { data: altreAppartenenze } = await admin
    .from("membri_tenant")
    .select("user_id, tenant_id")
    .in("user_id", membri);

  const haAltro = new Set(
    (altreAppartenenze ?? [])
      .filter((r) => r.tenant_id !== tenantId)
      .map((r) => r.user_id as string)
  );

  const { data: utenti } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailPerUtente = new Map<string, string | null>();
  for (const u of utenti?.users ?? []) emailPerUtente.set(u.id, u.email ?? null);

  const orfani = membri
    .filter((userId) => !haAltro.has(userId))
    .map((userId) => ({ userId, email: emailPerUtente.get(userId) ?? null }));

  return { membri, orfani };
}

/**
 * Cancella un'attività e tutto ciò che la riguarda. Irreversibile.
 *
 * Esiste prima di tutto per una ragione legale: quando il contratto con un
 * salone finisce, o quando chiede la cancellazione, i suoi dati E quelli dei
 * suoi clienti devono poter sparire davvero. Finché questa funzione non
 * esisteva l'unico modo era una query SQL a mano, che con clienti veri non è
 * una procedura, è un incidente che aspetta di succedere.
 *
 * Ordine, e il perché di ogni passo:
 *  1. registro PRIMA di toccare qualunque cosa -- se qualcosa va storto a
 *     metà, deve restare traccia che ci si è provati e quando;
 *  2. abbonamento Stripe cancellato PRIMA dei dati: continuare ad addebitare
 *     un cliente di cui hai appena cancellato tutto è il peggior esito
 *     possibile, quindi se questo passo fallisce ci si ferma qui e non si
 *     cancella niente;
 *  3. file dello storage: non hanno una foreign key, non spariscono da soli;
 *  4. la riga `tenants`, che porta via a cascata tutte e 20 le tabelle
 *     figlie (verificato sul database reale, non assunto);
 *  5. gli account di chi non fa più parte di nessuna attività. Chi invece ha
 *     un altro salone resta, e si ritrova solo senza sede attiva (da qui il
 *     passaggio della foreign key a `set null` nella migrazione 0029).
 */
export async function cancellaAttivita(
  autore: AutoreIntervento,
  tenantId: string
): Promise<{ ok: true; accountCancellati: number } | { errore: string }> {
  const admin = creaClientAdmin();
  const tenant = await leggiTenant(admin, tenantId);
  if (!tenant) return { errore: "Attività non trovata." };

  const riepilogo = await riepilogoCancellazione(tenantId);
  if ("errore" in riepilogo) return riepilogo;

  await registraIntervento(admin, autore, tenant, "cancellazione_attivita", {
    clienti: riepilogo.clienti,
    appuntamenti: riepilogo.appuntamenti,
    recensioni: riepilogo.recensioni,
    membri: riepilogo.membri,
    account_cancellati: riepilogo.accountDaCancellare,
    piano_al_momento: tenant.piano,
  });

  if (tenant.stripe_subscription_id) {
    try {
      await creaClientStripe().subscriptions.cancel(tenant.stripe_subscription_id as string);
    } catch (errore) {
      const messaggio = (errore as Error).message;
      // Se l'abbonamento è già stato cancellato su Stripe va benissimo
      // proseguire; qualunque altro errore no.
      if (!/No such subscription|already canceled|resource_missing/i.test(messaggio)) {
        return {
          errore: `Abbonamento Stripe non cancellato (${messaggio}). Nessun dato è stato toccato: risolvi su Stripe e riprova, per non lasciare un cliente addebitato dopo la cancellazione.`,
        };
      }
    }
  }

  const { data: file } = await admin.storage.from(BUCKET_MEDIA_TENANT).list(tenantId);
  if (file && file.length > 0) {
    await admin.storage.from(BUCKET_MEDIA_TENANT).remove(file.map((f) => `${tenantId}/${f.name}`));
  }

  const { orfani } = await analizzaMembri(admin, tenantId);

  const { error } = await admin.from("tenants").delete().eq("id", tenantId);
  if (error) return { errore: `Errore cancellando l'attività: ${error.message}` };

  for (const orfano of orfani) {
    await admin.auth.admin.deleteUser(orfano.userId);
  }

  return { ok: true, accountCancellati: orfani.length };
}
