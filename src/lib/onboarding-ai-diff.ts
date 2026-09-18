/**
 * Dalla bozza dell'AI al DIFF con la configurazione che c'e' gia'.
 *
 * Perche' esiste questo file (18/09/2026, segnalazione di Gabriel): la prima
 * versione dell'onboarding AI sapeva solo AGGIUNGERE. Dire "siamo in due" a
 * un salone che aveva gia' due operatori ne creava altri due. Non era un
 * difetto del modello: la bozza non conteneva nessun riferimento a cio' che
 * esisteva, quindi non c'era proprio modo di riconoscere una riga gia' li'.
 *
 * La scelta di fondo, che vale la pena non dimenticare: il modello NON
 * decide le operazioni. Non gli si chiede "crea questo, aggiorna
 * quest'altro, cancella quello" -- gli si mostra lo stato attuale con gli id
 * e gli si chiede lo STATO FINALE che vuole il titolare. Il confronto fra
 * prima e dopo lo fa il codice qui sotto: puro, deterministico, coperto da
 * test. Un modello che sbaglia produce al massimo uno stato finale strano,
 * che si vede in revisione; non produce mai una DELETE che nessuno aveva
 * chiesto.
 *
 * Seconda regola, per lo stesso motivo: una riga che esiste e che il modello
 * non nomina NON e' una cancellazione. Diventa una proposta di rimozione,
 * che in revisione parte sempre non spuntata. Il silenzio non e' un ordine.
 */

export interface OperatoreAttuale {
  id: string;
  nome: string;
  descrizione: string | null;
  attivo: boolean;
}

export interface ServizioAttuale {
  id: string;
  nome: string;
  durataMinuti: number;
  prezzoEuro: number;
  attivo: boolean;
}

export interface AssociazioneAttuale {
  operatoreId: string;
  servizioId: string;
}

/**
 * Un giorno della settimana come sta nel database. Gli orari sono "HH:MM"
 * oppure null.
 */
export interface OrarioAttuale {
  giornoSettimana: number;
  chiuso: boolean;
  apertura: string | null;
  chiusura: string | null;
  pausaInizio: string | null;
  pausaFine: string | null;
}

export interface StatoSalone {
  operatori: OperatoreAttuale[];
  servizi: ServizioAttuale[];
  associazioni: AssociazioneAttuale[];
  /** Sempre sette righe, una per giorno: il trigger di registrazione le crea tutte. */
  orari: OrarioAttuale[];
}

/** Come il modello descrive un operatore nello stato finale desiderato. */
export interface OperatoreDesiderato {
  /** id di una riga esistente, oppure null se e' una persona nuova. */
  id: string | null;
  nome: string;
  descrizione: string | null;
}

export interface ServizioDesiderato {
  id: string | null;
  nome: string;
  durataMinuti: number | null;
  prezzoEuro: number | null;
}

export interface AssociazioneDesiderata {
  operatore: OperatoreDesiderato;
  servizio: ServizioDesiderato;
}

/** Un giorno come il modello lo propone. Stessa forma di quello attuale. */
export type OrarioDesiderato = OrarioAttuale;

/**
 * `associazioni` e' il campo dove "elenco vuoto" e "non ne ha parlato" sono
 * due cose diverse e opposte: il primo vuol dire "nessuno fa niente", il
 * secondo "lascia stare quello che c'e'". Per questo e' nullable e non si
 * accontenta di un array vuoto.
 *
 * `orari` funziona in un modo terzo, ed e' il campo che ci ha fatto piu'
 * danni (vedi diffOrari qui sotto): e' un elenco dei SOLI GIORNI NOMINATI.
 * Un giorno che non c'e' dentro non e' "chiuso", e' "non ne ha parlato", e
 * resta esattamente com'era.
 */
export interface StatoDesiderato {
  operatori: OperatoreDesiderato[];
  servizi: ServizioDesiderato[];
  associazioni: AssociazioneDesiderata[] | null;
  /** Solo i giorni che il modello ha davvero nominato: da zero a sette. */
  orari: OrarioDesiderato[];
}

export type TipoModifica = "crea" | "aggiorna" | "rimuovi";

export interface ModificaOperatore {
  tipo: TipoModifica;
  /** Valorizzato per aggiorna/rimuovi, null per crea. */
  id: string | null;
  prima: OperatoreAttuale | null;
  dopo: OperatoreDesiderato | null;
}

export interface ModificaServizio {
  tipo: TipoModifica;
  id: string | null;
  prima: ServizioAttuale | null;
  dopo: ServizioDesiderato | null;
}

export interface ModificaAssociazione {
  tipo: "crea" | "rimuovi";
  /** null per un operatore/servizio che non esiste ancora: si risolve dopo averlo creato. */
  operatoreId: string | null;
  servizioId: string | null;
  /** Sempre valorizzati, anche per le righe nuove: servono a disegnare la matrice in revisione. */
  nomeOperatore: string;
  nomeServizio: string;
}

/** Un giorno che cambia davvero. I giorni identici non entrano nel diff. */
export interface ModificaOrario {
  giornoSettimana: number;
  prima: OrarioAttuale;
  dopo: OrarioDesiderato;
}

export interface DiffConfigurazione {
  operatori: ModificaOperatore[];
  servizi: ModificaServizio[];
  associazioni: ModificaAssociazione[];
  orari: ModificaOrario[];
  /** Righe dello stato desiderato che citavano un id inesistente: trattate come nuove. */
  idSconosciuti: string[];
}

const SEPARATORE = "::";

function chiaveCoppia(operatoreId: string, servizioId: string): string {
  return `${operatoreId}${SEPARATORE}${servizioId}`;
}

function testoUguale(a: string | null, b: string | null): boolean {
  return (a ?? "").trim() === (b ?? "").trim();
}

/**
 * Confronta stato attuale e stato desiderato. Non scrive niente e non decide
 * niente di irreversibile: produce l'elenco delle differenze, che qualcun
 * altro mostrera' e, solo dopo conferma esplicita, applichera'.
 */
export function calcolaDiff(attuale: StatoSalone, desiderato: StatoDesiderato): DiffConfigurazione {
  const idSconosciuti: string[] = [];

  const operatoriPerId = new Map(attuale.operatori.map((o) => [o.id, o]));
  const serviziPerId = new Map(attuale.servizi.map((s) => [s.id, s]));

  const operatori: ModificaOperatore[] = [];
  const operatoriToccati = new Set<string>();

  for (const desid of desiderato.operatori) {
    const esistente = desid.id ? operatoriPerId.get(desid.id) : undefined;
    if (desid.id && !esistente) idSconosciuti.push(desid.id);

    if (!esistente) {
      operatori.push({ tipo: "crea", id: null, prima: null, dopo: { ...desid, id: null } });
      continue;
    }
    operatoriToccati.add(esistente.id);
    const cambiato =
      !testoUguale(esistente.nome, desid.nome) ||
      !testoUguale(esistente.descrizione, desid.descrizione);
    if (cambiato) {
      operatori.push({ tipo: "aggiorna", id: esistente.id, prima: esistente, dopo: desid });
    }
  }

  for (const esistente of attuale.operatori) {
    if (!operatoriToccati.has(esistente.id)) {
      operatori.push({ tipo: "rimuovi", id: esistente.id, prima: esistente, dopo: null });
    }
  }

  const servizi: ModificaServizio[] = [];
  const serviziToccati = new Set<string>();

  for (const desid of desiderato.servizi) {
    const esistente = desid.id ? serviziPerId.get(desid.id) : undefined;
    if (desid.id && !esistente) idSconosciuti.push(desid.id);

    if (!esistente) {
      servizi.push({ tipo: "crea", id: null, prima: null, dopo: { ...desid, id: null } });
      continue;
    }
    serviziToccati.add(esistente.id);
    // Un valore lasciato a null dal modello vuol dire "non ne ha parlato",
    // mai "azzeralo": la durata e il prezzo di un servizio gia' configurato
    // non si perdono perche' il titolare non li ha ripetuti a voce.
    const nuovaDurata = desid.durataMinuti ?? esistente.durataMinuti;
    const nuovoPrezzo = desid.prezzoEuro ?? esistente.prezzoEuro;
    const cambiato =
      !testoUguale(esistente.nome, desid.nome) ||
      nuovaDurata !== esistente.durataMinuti ||
      nuovoPrezzo !== esistente.prezzoEuro;
    if (cambiato) {
      servizi.push({
        tipo: "aggiorna",
        id: esistente.id,
        prima: esistente,
        dopo: { ...desid, durataMinuti: nuovaDurata, prezzoEuro: nuovoPrezzo },
      });
    }
  }

  for (const esistente of attuale.servizi) {
    if (!serviziToccati.has(esistente.id)) {
      servizi.push({ tipo: "rimuovi", id: esistente.id, prima: esistente, dopo: null });
    }
  }

  return {
    operatori,
    servizi,
    associazioni: diffAssociazioni(attuale, desiderato, operatoriPerId, serviziPerId),
    orari: diffOrari(attuale.orari, desiderato.orari),
    idSconosciuti,
  };
}

/**
 * I giorni che cambiano davvero, uno per uno.
 *
 * QUESTA FUNZIONE ESISTE PER UN BUG VERO (18/09/2026, trovato da Gabriel):
 * "il sabato ora siamo aperti" apriva il sabato e nello stesso momento
 * riscriveva gli altri sei giorni, riportandoli agli orari di default. Il
 * salone perdeva gli orari veri senza che nessuno l'avesse chiesto.
 *
 * La causa non era il modello: era che gli orari erano l'UNICO campo che non
 * passava di qui. Operatori, servizi e associazioni si confrontavano gia'
 * con quello che c'era; gli orari venivano riscritti in blocco, tutti e
 * sette, presi dalla bozza.
 *
 * Il rimedio e' la regola che vale gia' per tutto il resto: si confronta, e
 * quello che non cambia non entra nel diff. Un giorno assente dallo stato
 * desiderato significa "non ne ha parlato" e non viene nemmeno guardato.
 *
 * Gli orari di un giorno CHIUSO non si confrontano: nel database sono null
 * per definizione, e un modello che propone "chiuso, 09:00-19:00" non sta
 * proponendo un cambio di orario.
 */
export function diffOrari(attuali: OrarioAttuale[], desiderati: OrarioDesiderato[]): ModificaOrario[] {
  const perGiorno = new Map(attuali.map((o) => [o.giornoSettimana, o]));
  const modifiche: ModificaOrario[] = [];

  for (const desid of desiderati) {
    const prima = perGiorno.get(desid.giornoSettimana);
    if (!prima) continue;
    if (orariUguali(prima, desid)) continue;
    modifiche.push({ giornoSettimana: desid.giornoSettimana, prima, dopo: desid });
  }

  return modifiche.sort((a, b) => a.giornoSettimana - b.giornoSettimana);
}

function orariUguali(a: OrarioAttuale, b: OrarioDesiderato): boolean {
  if (a.chiuso !== b.chiuso) return false;
  if (a.chiuso) return true;
  return (
    testoUguale(a.apertura, b.apertura) &&
    testoUguale(a.chiusura, b.chiusura) &&
    testoUguale(a.pausaInizio, b.pausaInizio) &&
    testoUguale(a.pausaFine, b.pausaFine)
  );
}

function diffAssociazioni(
  attuale: StatoSalone,
  desiderato: StatoDesiderato,
  operatoriPerId: Map<string, OperatoreAttuale>,
  serviziPerId: Map<string, ServizioAttuale>
): ModificaAssociazione[] {
  // Il modello non ha parlato di chi fa cosa: non si tocca niente di quello
  // che esiste. Le righe nuove le assocera' chi applica, col default "tutti
  // fanno tutto" -- meglio uno slot di troppo che nessuno slot per nessuno.
  if (desiderato.associazioni === null) return [];

  const attuali = new Set(attuale.associazioni.map((a) => chiaveCoppia(a.operatoreId, a.servizioId)));
  const modifiche: ModificaAssociazione[] = [];
  const desiderate = new Set<string>();

  for (const coppia of desiderato.associazioni) {
    const operatoreId = coppia.operatore.id;
    const servizioId = coppia.servizio.id;
    const nomeOperatore = (operatoreId && operatoriPerId.get(operatoreId)?.nome) || coppia.operatore.nome;
    const nomeServizio = (servizioId && serviziPerId.get(servizioId)?.nome) || coppia.servizio.nome;

    if (operatoreId && servizioId) {
      const chiave = chiaveCoppia(operatoreId, servizioId);
      desiderate.add(chiave);
      if (attuali.has(chiave)) continue; // gia' cosi': niente da fare
    }
    modifiche.push({ tipo: "crea", operatoreId, servizioId, nomeOperatore, nomeServizio });
  }

  for (const a of attuale.associazioni) {
    if (desiderate.has(chiaveCoppia(a.operatoreId, a.servizioId))) continue;
    // Una coppia esistente che riguarda righe che il modello non ha nemmeno
    // nominato non e' una rimozione: e' fuori dal discorso. Si tocca solo
    // cio' che il modello ha davvero messo sul tavolo.
    const operatoreNominato = desiderato.operatori.some((o) => o.id === a.operatoreId);
    const servizioNominato = desiderato.servizi.some((s) => s.id === a.servizioId);
    if (!operatoreNominato || !servizioNominato) continue;

    modifiche.push({
      tipo: "rimuovi",
      operatoreId: a.operatoreId,
      servizioId: a.servizioId,
      nomeOperatore: operatoriPerId.get(a.operatoreId)?.nome ?? "",
      nomeServizio: serviziPerId.get(a.servizioId)?.nome ?? "",
    });
  }

  return modifiche;
}

/** true se il diff non propone assolutamente niente. */
export function diffVuoto(diff: DiffConfigurazione): boolean {
  return (
    diff.operatori.length === 0 &&
    diff.servizi.length === 0 &&
    diff.associazioni.length === 0 &&
    diff.orari.length === 0
  );
}
