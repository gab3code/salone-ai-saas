import type { SupabaseClient } from "@supabase/supabase-js";
import { creaClientAdminTest } from "./supabase-admin";

/**
 * Crea/ripulisce un tenant di prova completo per gli scenari E2E del punto 30
 * -- stessa disciplina di pulizia usata nelle verifiche dal vivo manuali
 * documentate in DECISIONS.md (mai lasciare dati di test in produzione).
 *
 * A differenza delle verifiche manuali fatte finora (un tenant alla volta,
 * ripulito a mano dopo), qui serve poter creare ED ELIMINARE decine di
 * tenant di prova senza intervento umano -- ogni funzione `test()` di
 * Playwright chiama `creaTenantDiProva()` all'inizio e `tenant.pulisci()` in
 * un blocco `finally`/`test.afterEach`, così un test che fallisce a metà non
 * lascia comunque tracce.
 *
 * Ogni riga creata da questo helper è marcata con un prefisso riconoscibile
 * (`E2E-` nel nome/slug) -- utile se mai serve un controllo manuale di "cose
 * rimaste indietro" dopo un run interrotto (es. Ctrl+C a metà suite).
 */

const PREFISSO_SLUG = "e2e-";

export interface ServizioDiProva {
  id: string;
  nome: string;
  durataMinuti: number;
  prezzoCentesimi: number;
}

export interface OperatoreDiProva {
  id: string;
  nome: string;
}

export interface TenantDiProva {
  id: string;
  slug: string;
  nome: string;
  utenteId: string;
  email: string;
  password: string;
  servizi: ServizioDiProva[];
  operatori: OperatoreDiProva[];
  supabase: SupabaseClient;
  /** Elimina TUTTO quello che questo helper ha creato per questo tenant, in ordine (figli prima dei genitori). */
  pulisci(): Promise<void>;
}

export interface OrarioGiorno {
  giornoSettimana: number; // 0 = domenica ... 6 = sabato (Date.getUTCDay(), stessa convenzione del resto del progetto)
  chiuso?: boolean;
  apertura?: string; // "HH:MM"
  chiusura?: string;
}

// Orario di default: aperto tutti i giorni tranne domenica, 9:00-19:00,
// nessuna pausa pranzo -- abbastanza ampio da non essere il vincolo che fa
// fallire uno scenario che non sta testando gli orari di apertura.
const ORARI_DEFAULT: OrarioGiorno[] = [0, 1, 2, 3, 4, 5, 6].map((g) => ({
  giornoSettimana: g,
  chiuso: g === 0,
  apertura: "09:00",
  chiusura: "19:00",
}));

export interface OpzioniTenantDiProva {
  nome?: string;
  piano?: "free" | "starter" | "growth" | "pro" | "enterprise";
  servizi?: { nome: string; durataMinuti: number; prezzoCentesimi: number }[];
  operatori?: { nome: string; servizi?: number[] /* indici nell'array servizi sopra, compatibilità operatore->servizio */ }[];
  orari?: OrarioGiorno[];
  caparraAttiva?: boolean;
  caparraValore?: number; // percentuale, coerente con tenants.caparra_tipo = 'percentuale' di default
  telefono?: string;
}

function generaSuffisso(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Crea un tenant di prova completo: utente auth (che fa scattare il trigger
 * `al_nuovo_utente` -- crea da solo tenant + `profiles` owner + 7 righe
 * `orari_apertura`, vedi commento più sotto), poi `servizi`, `operatori`
 * (con compatibilità in `operatori_servizi`) e gli orari voluti. Ritorna gli
 * id generati e una `pulisci()` che cancella tutto nell'ordine giusto (figli
 * prima dei genitori, per via delle foreign key).
 */
export async function creaTenantDiProva(opzioni: OpzioniTenantDiProva = {}): Promise<TenantDiProva> {
  const supabase = creaClientAdminTest();
  const suffisso = generaSuffisso();
  const slug = `${PREFISSO_SLUG}${suffisso}`;
  const nome = opzioni.nome ?? `Salone Test E2E ${suffisso}`;
  const email = `e2e-${suffisso}@example.com`;
  const password = `TestE2E-${suffisso}!`;

  // La migrazione 0004 (provisioning_automatico) installa un trigger
  // (`al_nuovo_utente`) che scatta DA SOLO non appena viene creato un utente
  // in `auth.users`: crea GIÀ un tenant, la riga `profiles` (stesso id
  // dell'utente) e le 7 righe `orari_apertura` (tutte chiuse), esattamente
  // come fa il vero `/registrati`. La prima versione di questo helper
  // creava un tenant a parte PRIMA dell'utente e poi provava a inserire
  // anche lei una riga `profiles` con lo stesso id -- violazione della
  // chiave primaria, scoperta lanciando i test per la prima volta il
  // 16/09/2026 (vedi DECISIONS.md). Corretto: si lascia fare al trigger
  // (passandogli il nome voluto nei metadata, come fa il form di
  // registrazione vero) e poi si AGGIORNA il tenant che ha creato lui con le
  // impostazioni del test, invece di inserirne uno concorrente.
  const { data: utenteCreato, error: erroreUtente } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome_salone: nome, nome_persona: "Titolare Test E2E" },
  });
  if (erroreUtente || !utenteCreato?.user) {
    throw new Error(`Impossibile creare l'utente di prova: ${erroreUtente?.message}`);
  }
  const utenteId = utenteCreato.user.id;

  const { data: profiloDelTrigger, error: erroreProfiloTrigger } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", utenteId)
    .single();
  if (erroreProfiloTrigger || !profiloDelTrigger) {
    await supabase.auth.admin.deleteUser(utenteId);
    throw new Error(
      `Il trigger al_nuovo_utente non ha creato il profilo atteso per l'utente di prova: ${erroreProfiloTrigger?.message}`
    );
  }
  const tenantId = profiloDelTrigger.tenant_id;

  /**
   * Abbandona la creazione riportando il database com'era.
   *
   * Serve perché da qui in avanti esistono GIÀ due cose in produzione (un
   * utente auth e il tenant che il trigger gli ha creato), e prima del
   * 16/09/2026 i punti di uscita qui sotto lanciavano e basta: il tenant
   * restava lì per sempre, senza profilo e senza membri, invisibile a
   * chiunque. Sei tenant orfani "Il mio salone" trovati in produzione dal
   * pannello admin appena costruito, tutti creati alle 02:18 dello stesso
   * giorno durante il debug della prima versione di questo helper.
   * Cancellare il tenant porta via a cascata orari, regole promemoria e
   * tutto il resto (foreign key `on delete cascade`, migrazione 0001).
   */
  async function abbandona(messaggio: string): Promise<never> {
    await supabase.from("tenants").delete().eq("id", tenantId);
    await supabase.auth.admin.deleteUser(utenteId);
    throw new Error(messaggio);
  }

  const { data: tenantAggiornato, error: erroreTenant } = await supabase
    .from("tenants")
    .update({
      slug,
      piano: opzioni.piano ?? "growth",
      // La prova gratuita che il trigger di registrazione assegna a
      // chiunque si iscriva (migrazione 0061/0064) qui va tolta: un tenant
      // di prova nasce gia' sul piano che lo scenario ha chiesto, e
      // lasciare la data di fine prova vorrebbe dire far comparire il
      // riquadro "la prova scade fra N giorni" su una dashboard di prova
      // che, per lo scenario, sta pagando. Chi vuole provare LA PROVA la
      // riscrive da se' (vedi prova-gratuita.server.test.ts).
      prova_growth_fino_al: null,
      caparra_attiva: opzioni.caparraAttiva ?? false,
      caparra_valore: opzioni.caparraValore ?? 20,
      telefono: opzioni.telefono ?? "0219999999",
    })
    .eq("id", tenantId)
    .select("id, slug, nome")
    .single();
  if (erroreTenant || !tenantAggiornato) {
    return abbandona(`Impossibile aggiornare il tenant creato dal trigger per il test: ${erroreTenant?.message}`);
  }
  // Copiati in variabili proprie (mai `tenantAggiornato.slug` dentro
  // `pulisci()` sotto): il narrowing di TypeScript sul controllo
  // `!tenantAggiornato` qui sopra non si propaga dentro una funzione
  // annidata come `pulisci`, che verrebbe altrimenti considerata "potrebbe
  // essere null" da tsc.
  const tenantSlug = tenantAggiornato.slug;
  const tenantNome = tenantAggiornato.nome;

  // `servizi`/`operatori` a `[]` (esplicito, non assente) serve allo
  // Scenario 13 per simulare un tenant appena registrato, ancora vuoto --
  // un `.insert([])` non è mai stato esercitato prima da questo helper, e
  // il comportamento di PostgREST su un array vuoto non è garantito da
  // verificare qui: si salta del tutto la insert quando non c'è nulla da
  // inserire, invece di scoprirlo in un run reale di Gabriel.
  const specServizi = opzioni.servizi ?? [{ nome: "Taglio", durataMinuti: 30, prezzoCentesimi: 2500 }];
  let servizi: ServizioDiProva[] = [];
  if (specServizi.length > 0) {
    const { data: serviziCreati, error: erroreServizi } = await supabase
      .from("servizi")
      .insert(specServizi.map((s) => ({ tenant_id: tenantId, nome: s.nome, durata_minuti: s.durataMinuti, prezzo_centesimi: s.prezzoCentesimi })))
      .select("id, nome, durata_minuti, prezzo_centesimi");
    if (erroreServizi || !serviziCreati) {
      return abbandona(`Impossibile creare i servizi di prova: ${erroreServizi?.message}`);
    }
    servizi = serviziCreati.map((s) => ({
      id: s.id,
      nome: s.nome,
      durataMinuti: s.durata_minuti,
      prezzoCentesimi: s.prezzo_centesimi,
    }));
  }

  const specOperatori = opzioni.operatori ?? [{ nome: "Operatore Test", servizi: servizi.map((_, i) => i) }];
  let operatori: OperatoreDiProva[] = [];
  if (specOperatori.length > 0) {
    const { data: operatoriCreati, error: erroreOperatori } = await supabase
      .from("operatori")
      .insert(specOperatori.map((o) => ({ tenant_id: tenantId, nome: o.nome })))
      .select("id, nome");
    if (erroreOperatori || !operatoriCreati) {
      return abbandona(`Impossibile creare gli operatori di prova: ${erroreOperatori?.message}`);
    }
    operatori = operatoriCreati.map((o) => ({ id: o.id, nome: o.nome }));
  }

  const righeCompatibilita = specOperatori.flatMap((spec, indiceOperatore) =>
    (spec.servizi ?? servizi.map((_, i) => i)).map((indiceServizio) => ({
      operatore_id: operatori[indiceOperatore].id,
      servizio_id: servizi[indiceServizio].id,
    }))
  );
  if (righeCompatibilita.length > 0) {
    const { error: erroreCompat } = await supabase.from("operatori_servizi").insert(righeCompatibilita);
    if (erroreCompat) return abbandona(`Impossibile collegare operatori/servizi di prova: ${erroreCompat.message}`);
  }

  // Il trigger ha già creato le 7 righe (tutte chiuse, vedi commento sopra)
  // -- un `insert` qui violerebbe lo stesso vincolo unique
  // (tenant_id, giorno_settimana) che usa l'upsert in azioni.ts, quindi si
  // aggiorna con lo stesso `upsert`/`onConflict` invece di inserire di nuovo.
  const orari = opzioni.orari ?? ORARI_DEFAULT;
  const { error: erroreOrari } = await supabase.from("orari_apertura").upsert(
    orari.map((o) => ({
      tenant_id: tenantId,
      giorno_settimana: o.giornoSettimana,
      chiuso: o.chiuso ?? false,
      apertura: o.chiuso ? null : (o.apertura ?? "09:00"),
      chiusura: o.chiuso ? null : (o.chiusura ?? "19:00"),
    })),
    { onConflict: "tenant_id,giorno_settimana" }
  );
  if (erroreOrari) return abbandona(`Impossibile aggiornare gli orari di prova: ${erroreOrari.message}`);

  async function pulisci() {
    const idOperatori = operatori.map((o) => o.id);
    const idServizi = servizi.map((s) => s.id);
    // Figli prima dei genitori -- stesso ordine usato nelle pulizie manuali
    // documentate in DECISIONS.md (galleria foto, servizi consecutivi).
    await supabase.from("messaggi").delete().in(
      "conversazione_id",
      (await supabase.from("conversazioni").select("id").eq("tenant_id", tenantId)).data?.map((c) => c.id) ?? []
    );
    await supabase.from("conversazioni").delete().eq("tenant_id", tenantId);
    await supabase.from("lista_attesa").delete().eq("tenant_id", tenantId);
    await supabase.from("appuntamenti").delete().eq("tenant_id", tenantId);
    await supabase.from("clienti").delete().eq("tenant_id", tenantId);
    if (idOperatori.length > 0) await supabase.from("operatori_servizi").delete().in("operatore_id", idOperatori);
    await supabase.from("chiusure").delete().eq("tenant_id", tenantId);
    await supabase.from("orari_apertura").delete().eq("tenant_id", tenantId);
    await supabase.from("operatori").delete().eq("tenant_id", tenantId);
    await supabase.from("servizi").delete().eq("tenant_id", tenantId);
    await supabase.from("profiles").delete().eq("tenant_id", tenantId);
    await supabase.from("tenants").delete().eq("id", tenantId);
    await supabase.auth.admin.deleteUser(utenteId);
    void idServizi; // tenuto per leggibilità del blocco sopra, non serve altrove
  }

  return { id: tenantId, slug: tenantSlug, nome: tenantNome, utenteId, email, password, servizi, operatori, supabase, pulisci };
}
