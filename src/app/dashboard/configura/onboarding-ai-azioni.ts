"use server";

import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { pianoHaKnowledgeBaseAi } from "@/lib/piani";
import { generaBozzaOnboarding } from "@/lib/onboarding-ai.server";
import type { BozzaOnboarding } from "@/lib/onboarding-ai";
import {
  aggiornaOperatore,
  aggiornaServizio,
  creaOperatore,
  creaServizio,
  eliminaOperatore,
  eliminaServizio,
  impostaAssociazioneOperatoreServizio,
  salvaOrari,
} from "./azioni";
import { calcolaDiff, type DiffConfigurazione, type StatoSalone } from "@/lib/onboarding-ai-diff";
import { bozzaAStatoDesiderato } from "@/lib/onboarding-ai";
import { aggiornaInformazioniAttivita, aggiungiFaq } from "../impostazioni/informazioni-attivita/azioni";
import { aggiornaFinestraCancellazione } from "../impostazioni/cancellazione/azioni";
import { aggiornaContatti } from "../impostazioni/contatti/azioni";
import { aggiungiRegolaPromemoria } from "../impostazioni/promemoria/azioni";
import { aggiornaCaparra } from "../impostazioni/caparra/azioni";
import { aggiungiChiusura, salvaOrariOperatore, salvaRegoleAgenda } from "./azioni";
import { pianoHaPromemoria } from "@/lib/piani";
import { BOZZE_ONBOARDING_SENZA_PIANO, tettoBozzaOnboarding } from "@/lib/ai/limiti";
import { consumaUsoAiInterno } from "@/lib/ai/usi-interni.server";

/**
 * Fase 3 di PIANO.md: le due azioni server che collegano il modulo puro
 * `onboarding-ai.ts` e la parte IO `onboarding-ai.server.ts` al resto della
 * dashboard. Riusano SEMPRE le azioni granulari già esistenti e già in
 * produzione (creaOperatore, creaServizio, aggiornaInformazioniAttivita...)
 * invece di scrivere query dirette qui -- un solo posto dove vive ogni
 * regola di validazione/limite di piano, stesso principio già seguito in
 * tutto il resto del progetto (vedi es. booking-engine.ts riusato sia dalla
 * UI cliente che dallo strumento AI).
 */

/**
 * La configurazione che c'e' gia', nella forma che il modello e il diff
 * sanno leggere. E' la lettura che prima non esisteva: senza, la bozza non
 * poteva riferirsi a niente e sapeva solo aggiungere.
 */
async function caricaStatoSalone(
  supabase: Awaited<ReturnType<typeof creaClientServer>>,
  tenantId: string
): Promise<StatoSalone> {
  const [operatoriRes, serviziRes, associazioniRes, orariRes] = await Promise.all([
    supabase.from("operatori").select("id, nome, descrizione, attivo").eq("tenant_id", tenantId).order("nome"),
    supabase
      .from("servizi")
      .select("id, nome, durata_minuti, prezzo_centesimi, attivo")
      .eq("tenant_id", tenantId)
      .order("nome"),
    supabase.from("operatori_servizi").select("operatore_id, servizio_id"),
    supabase
      .from("orari_apertura")
      .select("giorno_settimana, chiuso, apertura, chiusura, pausa_inizio, pausa_fine")
      .eq("tenant_id", tenantId)
      .order("giorno_settimana"),
  ]);

  // "08:00:00" nel database, "08:00" ovunque nel prodotto: il confronto del
  // diff e il testo della revisione lavorano sulla seconda forma, e i secondi
  // farebbero risultare diverso un orario identico.
  const soloOreMinuti = (v: unknown): string | null =>
    typeof v === "string" && v.length >= 5 ? v.slice(0, 5) : null;

  return {
    operatori: (operatoriRes.data ?? []).map((o) => ({
      id: o.id as string,
      nome: o.nome as string,
      descrizione: (o.descrizione as string | null) ?? null,
      attivo: o.attivo as boolean,
    })),
    servizi: (serviziRes.data ?? []).map((s) => ({
      id: s.id as string,
      nome: s.nome as string,
      durataMinuti: s.durata_minuti as number,
      // Il modello e il titolare ragionano in euro; i centesimi restano un
      // dettaglio del database, come in tutto il resto del progetto.
      prezzoEuro: (s.prezzo_centesimi as number) / 100,
      attivo: s.attivo as boolean,
    })),
    associazioni: (associazioniRes.data ?? []).map((a) => ({
      operatoreId: a.operatore_id as string,
      servizioId: a.servizio_id as string,
    })),
    orari: (orariRes.data ?? []).map((o) => ({
      giornoSettimana: o.giorno_settimana as number,
      chiuso: o.chiuso as boolean,
      apertura: soloOreMinuti(o.apertura),
      chiusura: soloOreMinuti(o.chiusura),
      pausaInizio: soloOreMinuti(o.pausa_inizio),
      pausaFine: soloOreMinuti(o.pausa_fine),
    })),
  };
}

export type RisultatoBozzaConDiff =
  | {
      ok: true;
      bozza: BozzaOnboarding;
      diff: DiffConfigurazione;
      stato: StatoSalone;
      /** Quante configurazioni assistite restano dopo questa. */
      rimaste: number;
      /** true se quel numero e' un totale a vita, non un tetto mensile. */
      aVita: boolean;
    }
  | { ok: false; errore: string; esaurite?: boolean };

export async function generaBozzaOnboardingAction(descrizione: string): Promise<RisultatoBozzaConDiff> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { ok: false, errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const [{ data: tenant }, stato] = await Promise.all([
    supabase.from("tenants").select("piano").eq("id", tenantId).single(),
    caricaStatoSalone(supabase, tenantId),
  ]);
  const haKnowledgeBaseAi = pianoHaKnowledgeBaseAi(tenant?.piano ?? "");

  // La quota si consuma PRIMA di chiamare il modello. Fino al 18/09/2026
  // questa era l'unica strada del prodotto che chiamava Anthropic senza
  // contatore, senza tetto e senza gate: un tenant Free poteva chiamarla a
  // ripetizione -- anche come POST diretta della server action, senza mai
  // aprire la pagina -- e la bolletta era nostra.
  //
  // Il tetto e' la stessa quota mensile del salone, che per Free e Starter
  // (quota chat zero) vale un numero piccolo e fisso: chi si registra parte
  // su Free, e l'onboarding assistito e' il primo momento in cui il prodotto
  // dimostra di valere qualcosa. Chiuderlo dietro un piano a pagamento
  // vorrebbe dire far pagare prima di aver fatto vedere niente.
  const { count: numeroOperatori } = await supabase
    .from("operatori")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const tetto = tettoBozzaOnboarding(tenant?.piano ?? "", numeroOperatori ?? 1);
  const consumo = await consumaUsoAiInterno(tenantId, "onboarding", tetto);
  if (!consumo.ok) {
    if (consumo.motivo === "errore") {
      return { ok: false, errore: "Non riesco a verificare quante bozze puoi ancora usare. Riprova fra poco." };
    }
    return {
      ok: false,
      // Il messaggio dice cosa e' successo, cosa si puo' fare adesso, e
      // dove provare il resto senza pagare: un tetto raggiunto e' il
      // momento in cui la persona sta decidendo, non quello in cui la si
      // lascia davanti a una porta chiusa e basta.
      errore: tetto.daSempre
        ? `Hai usato tutte e ${BOZZE_ONBOARDING_SENZA_PIANO} le configurazioni assistite comprese nel tuo piano. Da qui in poi puoi configurare tutto a mano, oppure passare a Growth per continuare a farlo fare all'assistente.`
        : "Hai finito la quota AI di questo mese. Riparte il primo del mese prossimo.",
      esaurite: true,
    };
  }

  const esito = await generaBozzaOnboarding(descrizione, haKnowledgeBaseAi, stato, {
    haPromemoria: pianoHaPromemoria(tenant?.piano ?? ""),
  });
  if (!esito.ok) return esito;

  // Il diff lo calcola codice puro, non il modello: vedi il docblock di
  // onboarding-ai-diff.ts per il perche'.
  return {
    ok: true,
    bozza: esito.bozza,
    diff: calcolaDiff(stato, bozzaAStatoDesiderato(esito.bozza)),
    stato,
    rimaste: consumo.rimasti,
    aVita: tetto.daSempre,
  };
}

/** Solo per i messaggi d'errore qui sotto: l'indice e' la codifica del database. */
const NOMI_GIORNI_APPLICA = [
  "Domenica",
  "Lunedi'",
  "Martedi'",
  "Mercoledi'",
  "Giovedi'",
  "Venerdi'",
  "Sabato",
];

export interface RisultatoApplicazioneBozza {
  orariSalvati: boolean;
  operatoriCreati: number;
  operatoriAggiornati: number;
  operatoriRimossi: number;
  serviziCreati: number;
  serviziAggiornati: number;
  serviziRimossi: number;
  associazioniCreate: number;
  associazioniRimosse: number;
  regoleAgendaSalvate: boolean;
  orariOperatoreSalvati: number;
  contattiSalvati: boolean;
  promemoriaCreati: number;
  caparraSalvata: boolean;
  chiusureCreate: number;
  informazioniSalvate: boolean;
  faqCreate: number;
  finestraCancellazioneSalvata: boolean;
  errori: string[];
}

/**
 * Applica una bozza GIÀ rivista/confermata dal titolare -- questa funzione
 * non fa altre scelte editoriali, la UI toglie prima le righe
 * deselezionate/incomplete (Fase 3, punto UI ancora da costruire). Non è
 * tutto-o-niente: ogni pezzo viene tentato indipendentemente e un
 * fallimento parziale (es. limite operatori del piano Free raggiunto a metà
 * bozza) viene riportato in `errori` invece di annullare il resto -- il
 * titolare vede subito cos'è andato a buon fine e cosa no, mai un
 * fallimento silenzioso.
 */
export async function applicaBozzaOnboarding(
  bozza: BozzaOnboarding,
  diff: DiffConfigurazione
): Promise<RisultatoApplicazioneBozza> {
  const risultato: RisultatoApplicazioneBozza = {
    orariSalvati: false,
    operatoriCreati: 0,
    operatoriAggiornati: 0,
    operatoriRimossi: 0,
    serviziCreati: 0,
    serviziAggiornati: 0,
    serviziRimossi: 0,
    associazioniCreate: 0,
    associazioniRimosse: 0,
    regoleAgendaSalvate: false,
    orariOperatoreSalvati: 0,
    contattiSalvati: false,
    promemoriaCreati: 0,
    caparraSalvata: false,
    chiusureCreate: 0,
    informazioniSalvate: false,
    faqCreate: 0,
    finestraCancellazioneSalvata: false,
    errori: [],
  };

  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) {
    risultato.errori.push(accesso.errore);
    return risultato;
  }
  const tenantId = accesso.tenantId;

  // Un'unica lettura per tutto quello che serve dopo: il piano (per il gate
  // knowledge base, ricontrollato qui esattamente come dentro
  // aggiornaInformazioniAttivita/aggiungiFaq -- la doppia verifica non è
  // ridondanza inutile, è la stessa difesa in profondità già in uso altrove
  // nel progetto) e i valori attuali di telefono/informazioni attività, per
  // non cancellarli quando la bozza non li menziona (vedi commenti sotto).
  const { data: tenant } = await supabase
    .from("tenants")
    .select(
      "piano, telefono, telefono_whatsapp, descrizione, indirizzo, parcheggio, metodi_pagamento, passo_slot_minuti, buffer_minuti, riempimento_agenda"
    )
    .eq("id", tenantId)
    .single();
  const haKnowledgeBaseAi = pianoHaKnowledgeBaseAi(tenant?.piano ?? "");

  // Gli orari che ci sono ADESSO, riletti qui e non passati dal client: fra
  // la revisione e la conferma possono essere cambiati in un'altra scheda, e
  // di questi si fida chi scrive, non chi ha guardato.
  const stato = await caricaStatoSalone(supabase, tenantId);

  // ORARI: si parte da quelli che ci sono e si sovrascrivono SOLO i giorni
  // che la bozza nomina.
  //
  // Prima questo blocco costruiva la settimana dalla sola bozza. Siccome
  // `salvaOrari` fa un upsert di tutti e sette i giorni (stessa azione del
  // form manuale, ed e' giusto che sia una sola), qualunque cosa dicesse la
  // bozza vinceva su tutta la settimana: chiedere "il sabato siamo aperti"
  // riportava gli altri sei giorni agli orari di default. Segnalato da
  // Gabriel il 18/09/2026.
  //
  // La riga che conta e' `partenza`: i giorni che il titolare non ha
  // nominato entrano nel form con i valori che hanno gia', quindi l'upsert
  // li riscrive identici a se stessi.
  if (bozza.orari.length > 0) {
    const partenza = new Map(stato.orari.map((o) => [o.giornoSettimana, o]));

    // UN GIORNO "APERTO" SENZA ORARI NON SI INVENTA (19/09/2026).
    //
    // Il caso vero, trovato sul database di produzione: "il sabato siamo
    // aperti" e' finito salvato come "sabato aperto dalle 00:00 alle 19:00",
    // e il calendario ha iniziato a proporre appuntamenti in piena notte.
    //
    // Due difese, in ordine:
    // 1. se il giorno aveva gia' i suoi orari, si ereditano -- "siamo aperti"
    //    su un giorno che era 09:00-19:00 vuol dire quello, non "da
    //    mezzanotte";
    // 2. se non ce ne sono da ereditare (il caso tipico: quel giorno era
    //    chiuso, quindi le colonne sono NULL), NON si tira a indovinare. Il
    //    giorno non viene toccato e lo si dice al titolare, che ci mette due
    //    secondi a scrivere gli orari e sa quali sono. Meglio una richiesta
    //    in piu' che un salone aperto alle tre di notte.
    for (const o of bozza.orari) {
      if (o.chiuso) {
        partenza.set(o.giornoSettimana, o);
        continue;
      }
      const precedente = partenza.get(o.giornoSettimana);
      const apertura = o.apertura ?? (precedente && !precedente.chiuso ? precedente.apertura : null);
      const chiusura = o.chiusura ?? (precedente && !precedente.chiuso ? precedente.chiusura : null);
      if (!apertura || !chiusura) {
        risultato.errori.push(
          `${NOMI_GIORNI_APPLICA[o.giornoSettimana]}: ho capito che siete aperti ma non con quali orari, quindi non l'ho toccato. Scrivili tu qui sotto.`
        );
        continue;
      }
      partenza.set(o.giornoSettimana, {
        ...o,
        apertura,
        chiusura,
        pausaInizio: o.pausaInizio ?? (precedente && !precedente.chiuso ? precedente.pausaInizio : null),
        pausaFine: o.pausaFine ?? (precedente && !precedente.chiuso ? precedente.pausaFine : null),
      });
    }

    const formOrari = new FormData();
    for (const o of partenza.values()) {
      if (o.chiuso) {
        formOrari.set(`chiuso_${o.giornoSettimana}`, "on");
        continue;
      }
      if (o.apertura) formOrari.set(`apertura_${o.giornoSettimana}`, o.apertura);
      if (o.chiusura) formOrari.set(`chiusura_${o.giornoSettimana}`, o.chiusura);
      if (o.pausaInizio) formOrari.set(`pausa_inizio_${o.giornoSettimana}`, o.pausaInizio);
      if (o.pausaFine) formOrari.set(`pausa_fine_${o.giornoSettimana}`, o.pausaFine);
    }
    const esito = await salvaOrari(formOrari);
    if (esito && "errore" in esito) risultato.errori.push(`Orari: ${esito.errore}`);
    else risultato.orariSalvati = true;
  }

  // Operatori e servizi: ogni modifica passa dalle azioni granulari gia' in
  // produzione, che portano con se' i limiti di piano, le validazioni e --
  // dal 18/09/2026 -- il rifiuto di cancellare qualcosa che e' stato usato
  // davvero (vedi @/lib/configura-sicurezza). Qui non si scrive nessuna
  // query: questo file decide l'ORDINE, non le regole.
  //
  // L'ordine conta: prima le creazioni e le modifiche, poi i collegamenti
  // (che hanno bisogno degli id appena creati), e le rimozioni per ultime,
  // cosi' un errore a meta' strada non lascia il salone senza operatori.
  const nomeOperatoreAId = new Map<string, string>();
  const nomeServizioAId = new Map<string, string>();

  for (const modifica of diff.operatori) {
    if (modifica.tipo === "crea" && modifica.dopo) {
      const fd = new FormData();
      fd.set("nome", modifica.dopo.nome);
      if (modifica.dopo.descrizione) fd.set("descrizione", modifica.dopo.descrizione);
      const esito = await creaOperatore(fd);
      if ("errore" in esito) {
        risultato.errori.push(`Operatore "${modifica.dopo.nome}": ${esito.errore}`);
        continue;
      }
      nomeOperatoreAId.set(modifica.dopo.nome, esito.id);
      risultato.operatoriCreati++;
    } else if (modifica.tipo === "aggiorna" && modifica.id && modifica.dopo) {
      const fd = new FormData();
      fd.set("nome", modifica.dopo.nome);
      if (modifica.dopo.descrizione) fd.set("descrizione", modifica.dopo.descrizione);
      const esito = await aggiornaOperatore(modifica.id, fd);
      if ("errore" in esito) risultato.errori.push(`Operatore "${modifica.dopo.nome}": ${esito.errore}`);
      else {
        nomeOperatoreAId.set(modifica.dopo.nome, modifica.id);
        risultato.operatoriAggiornati++;
      }
    }
  }

  for (const modifica of diff.servizi) {
    if (modifica.tipo === "crea" && modifica.dopo) {
      const fd = new FormData();
      fd.set("nome", modifica.dopo.nome);
      // Durata/prezzo mancanti (null): NON li stimiamo qui, li lasciamo
      // assenti dal form cosi' creaServizio applica la sua stessa
      // validazione e restituisce un errore chiaro invece che una riga con
      // un valore inventato -- regola fondamentale di onboarding-ai.ts.
      if (modifica.dopo.durataMinuti !== null) fd.set("durata_minuti", String(modifica.dopo.durataMinuti));
      if (modifica.dopo.prezzoEuro !== null) fd.set("prezzo_euro", String(modifica.dopo.prezzoEuro));
      const esito = await creaServizio(fd);
      if ("errore" in esito) {
        risultato.errori.push(`Servizio "${modifica.dopo.nome}": ${esito.errore}`);
        continue;
      }
      nomeServizioAId.set(modifica.dopo.nome, esito.id);
      risultato.serviziCreati++;
    } else if (modifica.tipo === "aggiorna" && modifica.id && modifica.dopo) {
      const fd = new FormData();
      fd.set("nome", modifica.dopo.nome);
      if (modifica.dopo.durataMinuti !== null) fd.set("durata_minuti", String(modifica.dopo.durataMinuti));
      if (modifica.dopo.prezzoEuro !== null) fd.set("prezzo_euro", String(modifica.dopo.prezzoEuro));
      const esito = await aggiornaServizio(modifica.id, fd);
      if ("errore" in esito) risultato.errori.push(`Servizio "${modifica.dopo.nome}": ${esito.errore}`);
      else {
        nomeServizioAId.set(modifica.dopo.nome, modifica.id);
        risultato.serviziAggiornati++;
      }
    }
  }

  // Chi fa cosa. Le coppie che riguardano righe appena create arrivano qui
  // senza id (non esistevano quando il diff e' stato calcolato): si
  // risolvono adesso, per nome, contro le righe create in questo stesso
  // giro -- nomi che vengono dalla bozza, non dal database.
  for (const coppia of diff.associazioni) {
    const operatoreId = coppia.operatoreId ?? nomeOperatoreAId.get(coppia.nomeOperatore);
    const servizioId = coppia.servizioId ?? nomeServizioAId.get(coppia.nomeServizio);
    if (!operatoreId || !servizioId) {
      risultato.errori.push(
        `"${coppia.nomeOperatore}" e "${coppia.nomeServizio}": collegamento non applicato, una delle due righe non e' stata creata.`
      );
      continue;
    }
    const esito = await impostaAssociazioneOperatoreServizio(operatoreId, servizioId, coppia.tipo === "crea");
    if (esito && "errore" in esito) risultato.errori.push(`Chi fa cosa: ${esito.errore}`);
    else if (coppia.tipo === "crea") risultato.associazioniCreate++;
    else risultato.associazioniRimosse++;
  }

  // Un operatore o un servizio appena creato senza nessun collegamento non
  // sarebbe prenotabile da nessuno: il default e' "tutti fanno tutto",
  // meglio uno slot di troppo che nessuno slot per nessuno. Vale solo per le
  // righe nuove, e solo quando il diff non ha gia' detto qualcosa su di loro.
  const coinvolte = new Set(diff.associazioni.map((a) => `${a.nomeOperatore}::${a.nomeServizio}`));
  for (const [nomeOperatore, operatoreId] of nomeOperatoreAId) {
    for (const [nomeServizio, servizioId] of nomeServizioAId) {
      if (coinvolte.has(`${nomeOperatore}::${nomeServizio}`)) continue;
      const esito = await impostaAssociazioneOperatoreServizio(operatoreId, servizioId, true);
      if (esito && "errore" in esito) risultato.errori.push(`Chi fa cosa: ${esito.errore}`);
      else risultato.associazioniCreate++;
    }
  }

  // Rimozioni per ultime, e solo quelle che il titolare ha spuntato: il
  // diff le propone, la revisione le conferma, e le azioni sottostanti
  // possono comunque rifiutarsi (un operatore con appuntamenti non si
  // cancella, si disattiva). Un rifiuto qui e' un messaggio da leggere, non
  // un fallimento della bozza.
  for (const modifica of diff.operatori) {
    if (modifica.tipo !== "rimuovi" || !modifica.id) continue;
    const esito = await eliminaOperatore(modifica.id);
    if (esito && "errore" in esito) risultato.errori.push(`${modifica.prima?.nome ?? "Operatore"}: ${esito.errore}`);
    else risultato.operatoriRimossi++;
  }
  for (const modifica of diff.servizi) {
    if (modifica.tipo !== "rimuovi" || !modifica.id) continue;
    const esito = await eliminaServizio(modifica.id);
    if (esito && "errore" in esito) risultato.errori.push(`${modifica.prima?.nome ?? "Servizio"}: ${esito.errore}`);
    else risultato.serviziRimossi++;
  }

  // Informazioni attività (knowledge base, solo Pro/Enterprise):
  // aggiornaInformazioniAttivita fa un UPDATE completo dei 4 campi, non un
  // merge -- per non cancellare un campo già compilato che questa bozza
  // semplicemente non menziona, si riparte SEMPRE dal valore attuale in DB
  // e si sovrascrive solo ciò che la bozza fornisce davvero.
  if (haKnowledgeBaseAi && bozza.informazioniAttivita) {
    const info = bozza.informazioniAttivita;
    const fd = new FormData();
    fd.set("descrizione", info.descrizione ?? tenant?.descrizione ?? "");
    fd.set("indirizzo", info.indirizzo ?? tenant?.indirizzo ?? "");
    fd.set("parcheggio", info.parcheggio ?? tenant?.parcheggio ?? "");
    fd.set("metodi_pagamento", info.metodiPagamento ?? tenant?.metodi_pagamento ?? "");
    const esito = await aggiornaInformazioniAttivita(fd);
    if (esito && "errore" in esito) risultato.errori.push(`Informazioni attività: ${esito.errore}`);
    else risultato.informazioniSalvate = true;
  }

  // FAQ: azione puramente additiva (insert), nessun rischio di cancellare
  // dati esistenti -- si può semplicemente scorrere la lista.
  if (haKnowledgeBaseAi) {
    for (const faq of bozza.faq) {
      const fd = new FormData();
      fd.set("domanda", faq.domanda);
      fd.set("risposta", faq.risposta);
      const esito = await aggiungiFaq(fd);
      if (esito && "errore" in esito) risultato.errori.push(`FAQ "${faq.domanda}": ${esito.errore}`);
      else risultato.faqCreate++;
    }
  }

  // Finestra di cancellazione: aggiornaFinestraCancellazione salva ANCHE
  // `telefono` nella stessa riga (vedi il suo stesso docblock) -- la bozza
  // di onboarding non tratta affatto il telefono, quindi va sempre
  // ripassato il valore già presente in DB, mai lasciato vuoto, altrimenti
  // applicare solo questo pezzo della bozza azzererebbe un numero di
  // telefono già configurato dal titolare.
  if (bozza.oreMinimeCancellazione !== null) {
    const fd = new FormData();
    fd.set("ore_minime_cancellazione", String(bozza.oreMinimeCancellazione));
    if (tenant?.telefono) fd.set("telefono", tenant.telefono);
    const esito = await aggiornaFinestraCancellazione(fd);
    if (esito && "errore" in esito) risultato.errori.push(`Finestra di cancellazione: ${esito.errore}`);
    else risultato.finestraCancellazioneSalvata = true;
  }

  // --- Regole dell'agenda (0056) ---------------------------------------
  // salvaRegoleAgenda fa un UPDATE dei tre campi insieme: quello che la
  // bozza non dice va ripassato com'e' adesso, altrimenti applicare "il
  // buffer e' 10 minuti" azzererebbe un passo gia' scelto dal titolare.
  if (bozza.regoleAgenda) {
    const fd = new FormData();
    fd.set("passo_slot_minuti", String(bozza.regoleAgenda.passoMinuti ?? tenant?.passo_slot_minuti ?? 15));
    fd.set("buffer_minuti", String(bozza.regoleAgenda.bufferMinuti ?? tenant?.buffer_minuti ?? 0));
    fd.set(
      "riempimento_agenda",
      bozza.regoleAgenda.modalitaRiempimento ?? tenant?.riempimento_agenda ?? "griglia"
    );
    const esito = await salvaRegoleAgenda(fd);
    if (esito && "errore" in esito) risultato.errori.push(`Regole dell'agenda: ${esito.errore}`);
    else risultato.regoleAgendaSalvate = true;
  }

  // --- Orari del singolo operatore (0057) ------------------------------
  // Il nome si risolve contro le righe toccate in questo giro; se non si
  // trova, si cerca fra quelle gia' esistenti sul tenant.
  if (bozza.orariOperatore.length > 0) {
    const { data: operatoriEsistenti } = await supabase
      .from("operatori")
      .select("id, nome")
      .eq("tenant_id", tenantId);
    const perNome = new Map<string, string>();
    for (const o of operatoriEsistenti ?? []) perNome.set(String(o.nome).trim().toLowerCase(), o.id as string);
    for (const [nome, id] of nomeOperatoreAId) perNome.set(nome.trim().toLowerCase(), id);

    for (const riga of bozza.orariOperatore) {
      const operatoreId = perNome.get(riga.operatore.trim().toLowerCase());
      if (!operatoreId) {
        risultato.errori.push(`Orari di "${riga.operatore}": persona non trovata fra gli operatori.`);
        continue;
      }
      const fd = new FormData();
      for (const o of riga.orari) {
        if (o.chiuso) {
          fd.set(`op_chiuso_${o.giornoSettimana}`, "on");
          continue;
        }
        if (o.apertura) fd.set(`op_apertura_${o.giornoSettimana}`, o.apertura);
        if (o.chiusura) fd.set(`op_chiusura_${o.giornoSettimana}`, o.chiusura);
        if (o.pausaInizio) fd.set(`op_pausa_inizio_${o.giornoSettimana}`, o.pausaInizio);
        if (o.pausaFine) fd.set(`op_pausa_fine_${o.giornoSettimana}`, o.pausaFine);
      }
      const esito = await salvaOrariOperatore(operatoreId, fd);
      if (esito && "errore" in esito) risultato.errori.push(`Orari di "${riga.operatore}": ${esito.errore}`);
      else risultato.orariOperatoreSalvati++;
    }
  }

  // --- Contatti --------------------------------------------------------
  // Anche qui l'azione scrive i due campi insieme: si riparte dai valori
  // attuali per non cancellare un numero gia' salvato.
  if (bozza.contatti) {
    const fd = new FormData();
    fd.set("telefono", bozza.contatti.telefono ?? tenant?.telefono ?? "");
    fd.set("telefono_whatsapp", bozza.contatti.telefonoWhatsapp ?? tenant?.telefono_whatsapp ?? "");
    const esito = await aggiornaContatti(fd);
    if (esito && "errore" in esito) risultato.errori.push(`Contatti: ${esito.errore}`);
    else risultato.contattiSalvati = true;
  }

  // --- Promemoria automatici -------------------------------------------
  // Azione additiva (una riga per preavviso), con il suo gate di piano
  // ricontrollato qui come per la knowledge base.
  if (bozza.promemoria && pianoHaPromemoria(tenant?.piano ?? "")) {
    for (const ore of bozza.promemoria.orePreavviso) {
      const fd = new FormData();
      fd.set("ore_preavviso", String(ore));
      const esito = await aggiungiRegolaPromemoria(fd);
      if (esito && "errore" in esito) risultato.errori.push(`Promemoria ${ore}h: ${esito.errore}`);
      else risultato.promemoriaCreati++;
    }
  }

  // --- Caparra ---------------------------------------------------------
  if (bozza.caparra && bozza.caparra.tipo && bozza.caparra.valore !== null) {
    const fd = new FormData();
    fd.set("attiva", "on");
    fd.set("tipo", bozza.caparra.tipo);
    fd.set("valore", String(bozza.caparra.valore));
    const esito = await aggiornaCaparra(fd);
    if (esito && "errore" in esito) risultato.errori.push(`Caparra: ${esito.errore}`);
    else risultato.caparraSalvata = true;
  }

  // --- Ferie e chiusure -------------------------------------------------
  for (const chiusura of bozza.chiusure) {
    const fd = new FormData();
    fd.set("data_inizio", chiusura.dataInizio);
    if (chiusura.dataFine) fd.set("data_fine", chiusura.dataFine);
    fd.set("motivo", chiusura.motivo ?? "");
    fd.set("giorno_intero", chiusura.giornoIntero ? "si" : "no");
    if (!chiusura.giornoIntero) {
      fd.set("ora_inizio", chiusura.oraInizio ?? "");
      fd.set("ora_fine", chiusura.oraFine ?? "");
    }
    if (chiusura.operatore) {
      const { data: operatore } = await supabase
        .from("operatori")
        .select("id")
        .eq("tenant_id", tenantId)
        .ilike("nome", chiusura.operatore)
        .maybeSingle();
      if (operatore) fd.set("operatore_id", operatore.id as string);
    }
    const esito = await aggiungiChiusura(fd);
    if (esito && "errore" in esito) risultato.errori.push(`Chiusura del ${chiusura.dataInizio}: ${esito.errore}`);
    else risultato.chiusureCreate++;
  }

  return risultato;
}
