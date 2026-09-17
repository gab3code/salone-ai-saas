/**
 * Gli strumenti dell'assistente, per la demo: stessa forma, dati finti,
 * agenda che vive solo nella sessione di chi guarda.
 *
 * ----------------------------------------------------------------------
 * LA COSA CHE RENDE ONESTA QUESTA DEMO
 *
 * La disponibilita' NON e' ricalcolata qui. Si chiama
 * `calcolaSlotDisponibili` / `calcolaSlotServiziConsecutivi`, cioe' le
 * stesse identiche funzioni pure che usa il prodotto vero, con gli stessi
 * parametri costruiti nello stesso ordine (vedi `trovaSlotEContestoTenant`
 * in booking-engine.server.ts). Se la demo dicesse "martedi' alle 15 e'
 * libero" e il prodotto non lo direbbe, la demo sarebbe una bugia -- e una
 * bugia che si scopre il giorno dopo aver comprato.
 *
 * Il motore di prenotazione e' scritto come logica pura proprio per questo:
 * prende orari, operatori e appuntamenti come parametri e non sa niente del
 * database. Se quella logica fosse sepolta dentro le query, questa demo
 * sarebbe stata un secondo motore destinato a divergere, e sarebbe stato
 * meglio tenere i saloni finti veri (vedi docs/brief-demo-senza-rischi.md).
 *
 * ----------------------------------------------------------------------
 * COSA NON PUO' FARE, E PERCHE'
 *
 * - non scrive da nessuna parte fuori dall'oggetto che riceve;
 * - `cerca_prenotazioni_cliente` non esiste: qui non c'e' nessun archivio
 *   in cui cercare, e nella demo la gente il proprio numero vero lo scrive
 *   davvero;
 * - `modifica`/`cancella`/`lista_attesa` non ci sono: allungherebbero la
 *   demo senza aggiungere niente all'unica domanda che il visitatore si fa
 *   ("riesce a prendermi un appuntamento?").
 *
 * Le RISPOSTE hanno la stessa forma di quelle vere (`eseguiStrumento` in
 * tools.ts): stessi nomi di campo, stessi messaggi d'errore, stesse
 * validazioni sugli uuid. Un modello che riceve forme diverse si comporta
 * diversamente, e la demo smetterebbe di dimostrare il prodotto.
 */

import {
  calcolaSlotDisponibili,
  calcolaSlotServiziConsecutivi,
  giornoChiuso,
  verificaConflitto,
  type AppuntamentoEsistente,
} from "@/lib/booking-engine";
import {
  FAQ_DEMO,
  INDIRIZZO_SALONE_DEMO,
  METODI_PAGAMENTO_DEMO,
  ORARI_DEMO,
  ORE_MINIME_CANCELLAZIONE_DEMO,
  OPERATORI_DEMO,
  PARCHEGGIO_DEMO,
  SERVIZI_DEMO,
  DESCRIZIONE_SALONE_DEMO,
  operatoriPerIlMotore,
  servizioDemoPerId,
} from "./salone-finto";

/** Un appuntamento preso durante la demo. Vive solo nella sessione. */
export interface AppuntamentoDemo {
  id: string;
  servizioIds: string[];
  operatoreId: string;
  inizio: string; // ISO, pseudo-UTC (ora civile del salone)
  fine: string;
  clienteNome: string;
  clienteTelefono: string;
}

export interface StatoDemo {
  appuntamenti: AppuntamentoDemo[];
}

export function statoDemoVuoto(): StatoDemo {
  return { appuntamenti: [] };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function eUuidValido(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
function nomeGiornoSettimana(d: Date): string {
  return GIORNI[d.getUTCDay()];
}

/** Gli appuntamenti della sessione, nella forma che il motore si aspetta. */
function agendaPerIlMotore(stato: StatoDemo): AppuntamentoEsistente[] {
  return stato.appuntamenti.map((a) => ({
    operatoreId: a.operatoreId,
    inizio: new Date(a.inizio),
    fine: new Date(a.fine),
    stato: "confermato" as const,
  }));
}

export interface EsitoStrumentoDemo {
  risultato: Record<string, unknown>;
  /** Presente solo quando lo strumento ha cambiato l'agenda della sessione. */
  stato?: StatoDemo;
}

/**
 * `haInformazioniAttivita` e' il gate di piano: su Growth lo strumento
 * `info_attivita` non viene nemmeno offerto al modello (lo filtra
 * `rispondiConversazione`), ma il controllo si ripete qui perche' un gate
 * che esiste in un posto solo prima o poi viene aggirato da un cambio
 * altrove.
 */
export function eseguiStrumentoDemo(
  nome: string,
  input: Record<string, unknown>,
  stato: StatoDemo,
  opzioni: { haInformazioniAttivita: boolean }
): EsitoStrumentoDemo {
  switch (nome) {
    case "elenca_servizi":
      return {
        risultato: {
          servizi: SERVIZI_DEMO.map((s) => ({
            id: s.id,
            nome: s.nome,
            descrizione: s.descrizione,
            categoria: s.categoria,
            durata_minuti: s.durataMinuti,
            prezzo_euro: s.prezzoCentesimi / 100,
          })),
        },
      };

    case "elenca_operatori":
      return {
        risultato: {
          operatori: OPERATORI_DEMO.map((o) => ({
            id: o.id,
            nome: o.nome,
            ruolo: o.ruolo,
            descrizione: null,
          })),
        },
      };

    case "info_orari":
      return {
        risultato: {
          orari: ORARI_DEMO.map((o) => ({
            giorno_settimana: o.giornoSettimana,
            chiuso: o.chiuso,
            apertura: o.apertura ?? null,
            chiusura: o.chiusura ?? null,
            pausa_inizio: o.pausaInizio ?? null,
            pausa_fine: o.pausaFine ?? null,
          })),
        },
      };

    case "info_attivita": {
      if (!opzioni.haInformazioniAttivita) {
        return { risultato: { errore: "Informazioni non disponibili." } };
      }
      return {
        risultato: {
          descrizione: DESCRIZIONE_SALONE_DEMO,
          indirizzo: INDIRIZZO_SALONE_DEMO,
          parcheggio: PARCHEGGIO_DEMO,
          metodi_pagamento: METODI_PAGAMENTO_DEMO,
          ore_minime_cancellazione: ORE_MINIME_CANCELLAZIONE_DEMO,
          telefono: null,
          faq: FAQ_DEMO.map((f) => ({ domanda: f.domanda, risposta: f.risposta })),
        },
      };
    }

    case "verifica_disponibilita": {
      const servizioIds = input.servizio_ids;
      const dataStr = input.data;
      if (!Array.isArray(servizioIds) || servizioIds.length === 0 || typeof dataStr !== "string") {
        return { risultato: { errore: "servizio_ids e data sono obbligatori." } };
      }
      if (!servizioIds.every(eUuidValido)) {
        return {
          risultato: {
            errore:
              "servizio_ids deve contenere gli id esatti (uuid) restituiti da elenca_servizi, non i nomi dei servizi. Chiama prima elenca_servizi se non li hai già.",
          },
        };
      }
      if (input.operatore_id !== undefined && !eUuidValido(input.operatore_id)) {
        return { risultato: { errore: "operatore_id deve essere l'id esatto (uuid) restituito da elenca_operatori." } };
      }
      const data = new Date(`${dataStr}T00:00:00Z`);
      if (Number.isNaN(data.getTime())) {
        return { risultato: { errore: "Data non valida, usa il formato YYYY-MM-DD." } };
      }

      const chiuso = giornoChiuso([...ORARI_DEMO], data);
      const servizi = (servizioIds as string[]).map(servizioDemoPerId);
      if (servizi.some((s) => !s)) {
        // Stessa resa del prodotto: un id inesistente non e' un errore
        // parlante, e' semplicemente nessuno slot.
        return { risultato: { slot: [], giorno_chiuso: chiuso, giorno_settimana_richiesto: nomeGiornoSettimana(data) } };
      }

      const paramsBase = {
        data,
        operatoreId: typeof input.operatore_id === "string" ? input.operatore_id : undefined,
        operatori: operatoriPerIlMotore(),
        orari: [...ORARI_DEMO],
        chiusure: [],
        appuntamentiEsistenti: agendaPerIlMotore(stato),
      };
      const definiti = servizi as NonNullable<(typeof servizi)[number]>[];
      const slot =
        definiti.length === 1
          ? calcolaSlotDisponibili({ ...paramsBase, durataMinuti: definiti[0].durataMinuti, servizioId: definiti[0].id })
          : calcolaSlotServiziConsecutivi(paramsBase, definiti.map((s) => ({ id: s.id, durataMinuti: s.durataMinuti })));

      return {
        risultato: {
          slot: slot.map((s) => ({
            inizio: s.inizio.toISOString(),
            fine: s.fine.toISOString(),
            operatore_id: s.operatoreId,
          })),
          giorno_chiuso: chiuso,
          giorno_settimana_richiesto: nomeGiornoSettimana(data),
        },
      };
    }

    case "crea_prenotazione": {
      const { servizio_ids, operatore_id, inizio, cliente_nome, cliente_telefono } = input as Record<string, unknown>;
      if (!Array.isArray(servizio_ids) || servizio_ids.length === 0 || typeof operatore_id !== "string" ||
          typeof inizio !== "string" || typeof cliente_telefono !== "string") {
        return { risultato: { errore: "servizio_ids, operatore_id, inizio e cliente_telefono sono obbligatori." } };
      }
      if (typeof cliente_nome !== "string" || cliente_nome.trim() === "") {
        return { risultato: { errore: "cliente_nome è obbligatorio: chiedi il nome del cliente prima di procedere." } };
      }
      if (!servizio_ids.every(eUuidValido) || !eUuidValido(operatore_id)) {
        return {
          risultato: {
            errore:
              "servizio_ids e operatore_id devono essere gli id esatti (uuid) restituiti da elenca_servizi/elenca_operatori, non i loro nomi.",
          },
        };
      }
      const inizioData = new Date(inizio.length <= 16 ? `${inizio}:00Z` : inizio.endsWith("Z") ? inizio : `${inizio}Z`);
      if (Number.isNaN(inizioData.getTime())) {
        return { risultato: { errore: "inizio non valido, usa il formato YYYY-MM-DDTHH:MM." } };
      }

      const servizi = (servizio_ids as string[]).map(servizioDemoPerId);
      if (servizi.some((s) => !s)) return { risultato: { errore: "Servizio non trovato." } };
      const durataTotale = (servizi as NonNullable<(typeof servizi)[number]>[]).reduce((t, s) => t + s.durataMinuti, 0);
      const fineData = new Date(inizioData.getTime() + durataTotale * 60_000);

      const operatore = OPERATORI_DEMO.find((o) => o.id === operatore_id);
      if (!operatore) return { risultato: { errore: "Operatore non trovato." } };
      if (!(servizio_ids as string[]).every((id) => operatore.servizioIds.includes(id))) {
        return { risultato: { errore: "Questo operatore non esegue uno dei servizi richiesti." } };
      }

      // Stessa difesa del prodotto: nel prodotto vero il vincolo di database
      // e' l'ultima parola, qui non c'e' un database -- quindi questo
      // controllo E' l'ultima parola, ed e' per questo che non si salta.
      const inConflitto = verificaConflitto(inizioData, fineData, operatore_id, agendaPerIlMotore(stato));
      if (inConflitto) {
        return { risultato: { errore: "Quell'orario non è più libero: verifica di nuovo la disponibilità." } };
      }

      const nuovo: AppuntamentoDemo = {
        id: `demo-${inizioData.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        servizioIds: servizio_ids as string[],
        operatoreId: operatore_id,
        inizio: inizioData.toISOString(),
        fine: fineData.toISOString(),
        clienteNome: cliente_nome.trim(),
        clienteTelefono: cliente_telefono.trim(),
      };

      return {
        risultato: { creato: true, appuntamento_id: nuovo.id },
        stato: { appuntamenti: [...stato.appuntamenti, nuovo] },
      };
    }

    case "trasferisci_a_operatore":
      return { risultato: { trasferito: true } };

    default:
      // Qualunque altro strumento non e' offerto al modello, ma se ci
      // arrivasse comunque si risponde come farebbe il prodotto con uno
      // strumento che fallisce: un errore leggibile, non un'eccezione.
      return { risultato: { errore: "Questo strumento non è disponibile nella demo." } };
  }
}
