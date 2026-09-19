import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { elencaClientiInattivi } from "@/lib/metriche";
import { PIANI_CON_PROMEMORIA, pianoHaFollowUpAi } from "@/lib/piani";
import { scriviFollowUpPersonalizzato } from "@/lib/follow-up-ai.server";
import {
  appuntamentiDaAvvisarePerRegola,
  clientiDaAvvisarePerInattivita,
  comporreMessaggioFollowUp,
  finestraRipetizioneGiorni,
  giorniInattivitaValidi,
  LARGHEZZA_FINESTRA_ORE,
  type AppuntamentoPerPromemoria,
  type ClientePerPromemoriaInattivita,
  type RegolaPromemoria,
} from "@/lib/promemoria";
import { inviaEmail } from "@/lib/email/mailjet.server";
import { escapeHtml, formattaOrario, urlBaseSito } from "@/lib/email/notifiche.server";
import { inviaSmsSeInclusoNelPiano } from "@/lib/sms/invio.server";
import { avvisaCompleanni, COLONNE_TENANT_COMPLEANNO, PIANI_PER_QUERY_COMPLEANNO } from "@/lib/compleanno.server";

type ClientAdmin = ReturnType<typeof creaClientAdmin>;

interface TenantConPromemoria {
  id: string;
  nome: string;
  slug: string;
  piano: string;
  fuso_orario: string;
  /** Colonne del Promemoria di compleanno (vedi compleanno.server.ts) --
   * vive sullo stesso oggetto tenant invece di una seconda query, stessa
   * riga già letta per gli altri due promemoria. */
  compleanno_attivo: boolean;
  compleanno_messaggio: string | null;
  /** Follow-up "ci manchi" (migrazione 0040, 17/09/2026). */
  follow_up_inattivi_attivo: boolean;
  follow_up_inattivi_giorni: number;
  follow_up_inattivi_messaggio: string | null;
}

export interface EsitoPromemoriaGiornalieri {
  tenantElaborati: number;
  reminderInviati: number;
  followUpInviati: number;
  compleanniInviati: number;
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
      "id, inizio, stato, clienti(nome, email, telefono), servizi(nome), promemoria_appuntamento_inviati(regola_id)"
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
    const cliente = uno<{ nome: string | null; email: string | null; telefono: string | null }>(r.clienti);
    const servizio = uno<{ nome: string }>(r.servizi);
    const righeInviate = (r.promemoria_appuntamento_inviati ?? []) as { regola_id: string }[];
    perId.set(r.id, {
      id: r.id,
      inizio: new Date(r.inizio),
      stato: r.stato,
      clienteEmail: cliente?.email ?? null,
      clienteTelefono: cliente?.telefono ?? null,
      clienteNome: cliente?.nome ?? null,
      servizioNome: servizio?.nome ?? null,
      tenantPiano: tenant.piano,
      regoleGiaInviate: new Set(righeInviate.map((x) => x.regola_id)),
    });
  }
  const tutti = [...perId.values()];

  const base = await urlBaseSito();

  let inviati = 0;
  for (const regola of regole) {
    const daAvvisare = appuntamentiDaAvvisarePerRegola(tutti, regola, adesso);
    for (const ridotto of daAvvisare) {
      const appuntamento = perId.get(ridotto.id)!;

      // "Prenota" PRIMA di mandare l'email, non dopo: l'unique
      // (appuntamento_id, regola_id) della tabella (migrazione 0017) fa da
      // lucchetto. Se un secondo giro del cron (Vercel Cron in ritardo che
      // sovrappone il successivo, un retry, un'esecuzione manuale mentre
      // quella schedulata è ancora in corso) arrivasse qui in parallelo,
      // solo uno dei due riesce a inserire la riga -- l'altro riceve un
      // conflitto (codice 23505) e salta l'invio invece di mandare la
      // stessa email due volte. Segnato comunque come "avvisato" anche se
      // l'invio vero e proprio dovesse poi fallire (stesso fail-open del
      // resto del modulo email): un problema di consegna non deve bloccare
      // gli invii successivi, e un nuovo tentativo domani non sarebbe
      // comunque più possibile per questa stessa regola (l'appuntamento
      // sarebbe uscito dalla sua finestra).
      const { error: erroreClaim } = await admin
        .from("promemoria_appuntamento_inviati")
        .insert({ appuntamento_id: appuntamento.id, regola_id: regola.id });
      if (erroreClaim) {
        if (erroreClaim.code !== "23505") {
          console.error(
            `[promemoria] Errore segnando l'invio per l'appuntamento ${appuntamento.id}/regola ${regola.id}:`,
            erroreClaim
          );
        }
        continue; // già preso in carico (da un altro giro) o errore reale -- non rischiare un doppio invio
      }
      appuntamento.regoleGiaInviate.add(regola.id);

      const quando = formattaOrario(appuntamento.inizio, tenant.fuso_orario);
      const rigaServizio = appuntamento.servizioNome ? ` per ${escapeHtml(appuntamento.servizioNome)}` : "";
      // Stesso link "gestisci/cancella" dell'email di conferma prenotazione
      // (notifiche.server.ts) -- un cliente che riceve il promemoria deve
      // poter cancellare da lì senza dover chiamare, non solo chi riceve la
      // conferma iniziale. La pagina applica comunque la finestra minima di
      // cancellazione del tenant (ore_minime_cancellazione): se il
      // promemoria arriva troppo a ridosso, mostra il numero da chiamare
      // invece del pulsante, non un errore.
      const rigaGestisci = base
        ? `<p><a href="${base}/gestisci/${appuntamento.id}">Gestisci o cancella la prenotazione</a></p>`
        : "";

      // Canale: email se il cliente l'ha lasciata, altrimenti SMS (SOLO se
      // il piano lo include -- inviaSmsSeInclusoNelPiano ricontrolla
      // comunque, ma a questo punto è già garantito da
      // appuntamentiDaAvvisarePerRegola, che non lascia passare un
      // appuntamento senza email E senza telefono+SMS). MAI entrambi i
      // canali sullo stesso cliente (deciso con Gabriel il 14/09/2026).
      let inviato: boolean;
      if (appuntamento.clienteEmail) {
        inviato = await inviaEmail({
          a: appuntamento.clienteEmail,
          oggetto: `Promemoria: il tuo appuntamento da ${tenant.nome}`,
          nomeMittente: tenant.nome,
          html: `
            <p>Ciao ${escapeHtml(appuntamento.clienteNome ?? "")},</p>
            <p>ti ricordiamo il tuo appuntamento da <strong>${escapeHtml(tenant.nome)}</strong>${rigaServizio}.</p>
            <p>Quando: ${quando}</p>
            ${rigaGestisci}
          `,
        });
      } else if (appuntamento.clienteTelefono) {
        // Testo semplice, niente link (un SMS non supporta HTML, e un URL
        // nudo in un SMS aumenta il rischio che venga scambiato per
        // phishing -- meglio restare essenziali).
        const rigaServizioSms = appuntamento.servizioNome ? ` per ${appuntamento.servizioNome}` : "";
        const messaggioSms = `${tenant.nome}: ti ricordiamo il tuo appuntamento${rigaServizioSms} il ${quando}.`;
        inviato = await inviaSmsSeInclusoNelPiano(
          admin,
          tenant.id,
          tenant.piano,
          appuntamento.clienteTelefono,
          messaggioSms
        );
      } else {
        inviato = false;
      }
      if (inviato) inviati += 1;
    }
  }
  return inviati;
}

/**
 * Follow-up "ci manchi" ai clienti inattivi (l'altra metà di "Promemoria
 * automatici"). Riusa `elencaClientiInattivi` (src/lib/metriche.ts) --
 * stessa identica regola già mostrata in dashboard, non ricalcolata qui --
 * poi la funzione pura decide chi non è già stato avvisato di recente.
 *
 * 17/09/2026: interruttore, soglia e testo arrivano dal salone (migrazione
 * 0040). Il controllo dell'interruttore sta in cima e prima di qualunque
 * query: un salone che l'ha spento non deve nemmeno farci leggere la sua
 * rubrica ogni notte.
 */
async function avvisaClientiInattivi(admin: ClientAdmin, tenant: TenantConPromemoria, adesso: Date): Promise<number> {
  if (!tenant.follow_up_inattivi_attivo) return 0;
  const giorniInattivita = giorniInattivitaValidi(tenant.follow_up_inattivi_giorni);

  const [{ data: clientiGrezzi }, { data: righeAppuntamenti }] = await Promise.all([
    admin
      .from("clienti")
      .select("id, nome, email, telefono, promemoria_inattivita_inviato_at")
      .eq("tenant_id", tenant.id)
      // "Torna a trovarci" e' marketing: solo a chi ha detto si' (migrazione
      // 0070, stessa regola degli auguri di compleanno).
      .eq("consenso_marketing", true)
      // Un modo di contattarlo, dei due: email O telefono (il fallback SMS
      // viene ri-gated da clientiDaAvvisarePerInattivita in base al piano,
      // vedi pianoHaSms -- qui si filtra solo per non caricare clienti
      // senza NESSUN recapito, che comunque non riceverebbero mai nulla).
      .or("email.not.is.null,telefono.not.is.null"),
    admin
      .from("appuntamenti")
      .select("cliente_id, inizio, stato, servizi(nome)")
      .eq("tenant_id", tenant.id)
      .not("cliente_id", "is", null),
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
    giorniInattivita
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
      telefono: c.telefono,
      tenantPiano: tenant.piano,
      promemoriaInattivitaInviatoAt: c.promemoria_inattivita_inviato_at
        ? new Date(c.promemoria_inattivita_inviato_at)
        : null,
    });
  }

  const daAvvisare = clientiDaAvvisarePerInattivita([...perId.values()], inattivi, adesso, giorniInattivita);
  if (daAvvisare.length === 0) return 0;

  // L'ultima cosa che ha fatto ogni cliente, per il richiamo scritto
  // dall'assistente (Pro). Si ricava dalle righe gia' caricate qui sopra:
  // nessuna query in piu', e su Growth non serve nemmeno.
  const ultimaVisita = new Map<string, { quando: Date; servizio: string | null }>();
  if (pianoHaFollowUpAi(tenant.piano)) {
    for (const r of righeAppuntamenti ?? []) {
      const clienteId = r.cliente_id as string | null;
      if (!clienteId || r.stato === "cancellato") continue;
      const quando = new Date(r.inizio as string);
      const precedente = ultimaVisita.get(clienteId);
      if (precedente && precedente.quando >= quando) continue;
      const servizio = Array.isArray(r.servizi) ? r.servizi[0] : r.servizi;
      ultimaVisita.set(clienteId, {
        quando,
        servizio: (servizio as { nome?: string } | null)?.nome ?? null,
      });
    }
  }

  const numeroOperatoriTenant = pianoHaFollowUpAi(tenant.piano)
    ? ((await admin.from("operatori").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id)).count ?? 1)
    : 1;

  const base = await urlBaseSito();
  const rigaPrenota = base
    ? `<p><a href="${base}/s/${tenant.slug}">Prenota il tuo prossimo appuntamento</a></p>`
    : "";

  // Stessa finestra usata dalla funzione pura (`finestraRipetizioneGiorni`)
  // per vincolare l'update qui sotto -- unica fonte del numero di giorni,
  // solo ricalcolata come data.
  const sogliaRipetizioneIso = new Date(
    adesso.getTime() - finestraRipetizioneGiorni(giorniInattivita) * 24 * 60 * 60 * 1000
  ).toISOString();

  let inviati = 0;
  for (const ridotto of daAvvisare) {
    const cliente = perId.get(ridotto.id)!;

    // "Prenota" PRIMA di mandare l'email, con lo stesso principio
    // dell'insert-lucchetto del reminder pre-appuntamento sopra: l'update è
    // vincolato dallo stesso `where` che decide l'idoneità (mai avvisato, o
    // avvisato più di N giorni fa). Se una seconda esecuzione concorrente
    // avesse già aggiornato questo cliente nel frattempo, l'update qui
    // sotto non tocca nessuna riga (`data` torna vuoto) e si salta l'invio
    // invece di mandare due email quasi in contemporanea.
    const { data: aggiornato } = await admin
      .from("clienti")
      .update({ promemoria_inattivita_inviato_at: adesso.toISOString() })
      .eq("id", cliente.id)
      .or(`promemoria_inattivita_inviato_at.is.null,promemoria_inattivita_inviato_at.lt.${sogliaRipetizioneIso}`)
      .select("id")
      .maybeSingle();
    if (!aggiornato) continue;

    // Stesso principio email-o-SMS del reminder pre-appuntamento sopra:
    // MAI entrambi, SMS solo se il piano lo include (già garantito da
    // clientiDaAvvisarePerInattivita, ricontrollato comunque da
    // inviaSmsSeInclusoNelPiano).
    // Testo del salone, o quello predefinito. Uno solo per entrambi i
    // canali: un cliente che riceve l'SMS e uno che riceve l'email devono
    // leggere la stessa cosa, e chi scrive il messaggio non deve doverlo
    // scrivere due volte.
    // Su Pro prova a farlo scrivere all'assistente; in qualunque caso di
    // problema (quota finita, modello lento, testo rifiutato dai controlli)
    // si torna al messaggio fisso. Il richiamo parte comunque: saltarlo per
    // un guasto nostro farebbe perdere al salone un cliente vero.
    let testo = comporreMessaggioFollowUp(tenant.follow_up_inattivi_messaggio, cliente.nome);
    if (pianoHaFollowUpAi(tenant.piano)) {
      const storia = ultimaVisita.get(cliente.id);
      const scritto = storia
        ? await scriviFollowUpPersonalizzato(tenant.id, tenant.piano, numeroOperatoriTenant, {
            nomeCliente: cliente.nome,
            nomeSalone: tenant.nome,
            giorniDaUltimaVisita: Math.max(
              1,
              Math.round((adesso.getTime() - storia.quando.getTime()) / (24 * 60 * 60 * 1000))
            ),
            ultimoServizio: storia.servizio,
          })
        : null;
      if (scritto) testo = scritto;
    }

    let inviato: boolean;
    if (cliente.email) {
      inviato = await inviaEmail({
        a: cliente.email,
        oggetto: `Ti aspettiamo da ${tenant.nome}`,
        nomeMittente: tenant.nome,
        html: `
          <p>${escapeHtml(testo)}</p>
          ${rigaPrenota}
        `,
      });
    } else if (cliente.telefono) {
      inviato = await inviaSmsSeInclusoNelPiano(
        admin,
        tenant.id,
        tenant.piano,
        cliente.telefono,
        `${tenant.nome}: ${testo}`
      );
    } else {
      inviato = false;
    }
    if (inviato) inviati += 1;
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
  const esito: EsitoPromemoriaGiornalieri = {
    tenantElaborati: 0,
    reminderInviati: 0,
    followUpInviati: 0,
    compleanniInviati: 0,
  };

  // Unione dei due gate di piano (PIANI_CON_PROMEMORIA e
  // PIANI_CON_PROMEMORIA_COMPLEANNO -- OGGI il secondo è un sottoinsieme
  // del primo, ma sono Set indipendenti apposta: costruire l'unione invece
  // di assumere il sottoinsieme regge anche se in futuro divergono, es. un
  // piano col compleanno ma senza gli altri due promemoria).
  const pianiRilevanti = [...new Set([...PIANI_CON_PROMEMORIA, ...PIANI_PER_QUERY_COMPLEANNO])];

  const { data: tenants } = await admin
    .from("tenants")
    .select(
      `id, nome, slug, piano, fuso_orario, ${COLONNE_TENANT_COMPLEANNO}, follow_up_inattivi_attivo, follow_up_inattivi_giorni, follow_up_inattivi_messaggio`
    )
    .in("piano", pianiRilevanti);


  for (const tenant of tenants ?? []) {
    try {
      esito.reminderInviati += await avvisaAppuntamentiImminenti(admin, tenant, adesso);
      esito.followUpInviati += await avvisaClientiInattivi(admin, tenant, adesso);
      esito.compleanniInviati += await avvisaCompleanni(admin, tenant, adesso);
      esito.tenantElaborati += 1;
    } catch (errore) {
      console.error(`[promemoria] Errore elaborando il tenant ${tenant.id}:`, errore);
    }
  }

  return esito;
}
