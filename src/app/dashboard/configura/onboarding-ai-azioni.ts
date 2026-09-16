"use server";

import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { pianoHaKnowledgeBaseAi } from "@/lib/piani";
import { generaBozzaOnboarding, type RisultatoGenerazioneBozza } from "@/lib/onboarding-ai.server";
import type { BozzaOnboarding } from "@/lib/onboarding-ai";
import { creaOperatore, creaServizio, impostaAssociazioneOperatoreServizio, salvaOrari } from "./azioni";
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

export async function generaBozzaOnboardingAction(descrizione: string): Promise<RisultatoGenerazioneBozza> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { ok: false, errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  const haKnowledgeBaseAi = pianoHaKnowledgeBaseAi(tenant?.piano ?? "");

  return generaBozzaOnboarding(descrizione, haKnowledgeBaseAi);
}

export interface RisultatoApplicazioneBozza {
  orariSalvati: boolean;
  operatoriCreati: number;
  serviziCreati: number;
  associazioniCreate: number;
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
export async function applicaBozzaOnboarding(bozza: BozzaOnboarding): Promise<RisultatoApplicazioneBozza> {
  const risultato: RisultatoApplicazioneBozza = {
    orariSalvati: false,
    operatoriCreati: 0,
    serviziCreati: 0,
    associazioniCreate: 0,
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

  // Operatori e servizi: creati uno alla volta con le azioni esistenti (che
  // applicano già i limiti di piano), tenendo una mappa nome->id appena
  // creato per risolvere le associazioni subito dopo -- una bozza può solo
  // riferirsi a operatori/servizi che lei stessa propone, mai a righe già
  // esistenti sul tenant (limite onesto della v1, non un tentativo di fare
  // fuzzy-matching sui nomi già in database).
  const nomeOperatoreAId = new Map<string, string>();
  for (const operatore of bozza.operatori) {
    const fd = new FormData();
    fd.set("nome", operatore.nome);
    if (operatore.descrizione) fd.set("descrizione", operatore.descrizione);
    const esito = await creaOperatore(fd);
    if ("errore" in esito) {
      risultato.errori.push(`Operatore "${operatore.nome}": ${esito.errore}`);
      continue;
    }
    nomeOperatoreAId.set(operatore.nome, esito.id);
    risultato.operatoriCreati++;
  }

  const nomeServizioAId = new Map<string, string>();
  for (const servizio of bozza.servizi) {
    const fd = new FormData();
    fd.set("nome", servizio.nome);
    // Durata/prezzo mancanti (null): NON li stimiamo qui, li lasciamo
    // assenti dal form così creaServizio applica la sua stessa validazione
    // ("maggiore di zero") e restituisce un errore chiaro invece che una
    // riga con un valore inventato -- coerente con la regola fondamentale
    // di onboarding-ai.ts (mai inventare un numero che il titolare non ha
    // scritto).
    if (servizio.durataMinuti !== null) fd.set("durata_minuti", String(servizio.durataMinuti));
    if (servizio.prezzoEuro !== null) fd.set("prezzo_euro", String(servizio.prezzoEuro));
    const esito = await creaServizio(fd);
    if ("errore" in esito) {
      risultato.errori.push(`Servizio "${servizio.nome}": ${esito.errore}`);
      continue;
    }
    nomeServizioAId.set(servizio.nome, esito.id);
    risultato.serviziCreati++;
  }

  // Associazioni operatore/servizio: se la bozza non ne specifica nessuna
  // (il testo non chiariva chi fa cosa), il default ragionevole è "ogni
  // operatore appena creato fa ogni servizio appena creato" -- meglio uno
  // slot disponibile di troppo che nessuno slot disponibile per nessun
  // servizio (calcolaSlotDisponibili non propone comunque mai un operatore
  // non qualificato una volta che il titolare corregge l'associazione a
  // mano da /dashboard/configura).
  const paia: Array<{ operatoreId: string; servizioId: string }> = [];
  if (bozza.associazioni.length > 0) {
    for (const assoc of bozza.associazioni) {
      const operatoreId = nomeOperatoreAId.get(assoc.operatore);
      const servizioId = nomeServizioAId.get(assoc.servizio);
      if (!operatoreId || !servizioId) {
        risultato.errori.push(
          `Associazione "${assoc.operatore}" → "${assoc.servizio}" non applicata (nome non tra quelli appena creati).`
        );
        continue;
      }
      paia.push({ operatoreId, servizioId });
    }
  } else if (nomeOperatoreAId.size > 0 && nomeServizioAId.size > 0) {
    for (const operatoreId of nomeOperatoreAId.values()) {
      for (const servizioId of nomeServizioAId.values()) paia.push({ operatoreId, servizioId });
    }
  }
  for (const { operatoreId, servizioId } of paia) {
    const esito = await impostaAssociazioneOperatoreServizio(operatoreId, servizioId, true);
    if (esito && "errore" in esito) risultato.errori.push(`Associazione: ${esito.errore}`);
    else risultato.associazioniCreate++;
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
