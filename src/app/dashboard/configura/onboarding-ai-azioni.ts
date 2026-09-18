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
  const [operatoriRes, serviziRes, associazioniRes] = await Promise.all([
    supabase.from("operatori").select("id, nome, descrizione, attivo").eq("tenant_id", tenantId).order("nome"),
    supabase
      .from("servizi")
      .select("id, nome, durata_minuti, prezzo_centesimi, attivo")
      .eq("tenant_id", tenantId)
      .order("nome"),
    supabase.from("operatori_servizi").select("operatore_id, servizio_id"),
  ]);

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
  };
}

export type RisultatoBozzaConDiff =
  | { ok: true; bozza: BozzaOnboarding; diff: DiffConfigurazione; stato: StatoSalone }
  | { ok: false; errore: string };

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

  const esito = await generaBozzaOnboarding(descrizione, haKnowledgeBaseAi, stato);
  if (!esito.ok) return esito;

  // Il diff lo calcola codice puro, non il modello: vedi il docblock di
  // onboarding-ai-diff.ts per il perche'.
  return { ok: true, bozza: esito.bozza, diff: calcolaDiff(stato, bozzaAStatoDesiderato(esito.bozza)), stato };
}

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
    .select("piano, telefono, descrizione, indirizzo, parcheggio, metodi_pagamento")
    .eq("id", tenantId)
    .single();
  const haKnowledgeBaseAi = pianoHaKnowledgeBaseAi(tenant?.piano ?? "");

  // Orari: solo se la bozza dice davvero qualcosa (almeno un giorno
  // aperto). Una bozza "tutto chiuso" significa quasi sempre "il testo non
  // parlava affatto di orari" (vedi normalizzaOrari in onboarding-ai.ts),
  // non "chiudi ogni giorno": applicarla alla lettera su un tenant che ha
  // già orari configurati li cancellerebbe senza che il titolare l'abbia
  // mai chiesto.
  if (bozza.orari.some((o) => !o.chiuso)) {
    const formOrari = new FormData();
    for (const o of bozza.orari) {
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

  return risultato;
}
