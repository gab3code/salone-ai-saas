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

export interface StatoSalone {
  operatori: OperatoreAttuale[];
  servizi: ServizioAttuale[];
  associazioni: AssociazioneAttuale[];
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

/**
 * `associazioni` e' l'unico campo dove "elenco vuoto" e "non ne ha parlato"
 * sono due cose diverse e opposte: il primo vuol dire "nessuno fa niente",
 * il secondo "lascia stare quello che c'e'". Per questo e' nullable e non si
 * accontenta di un array vuoto.
 */
export interface StatoDesiderato {
  operatori: OperatoreDesiderato[];
  servizi: ServizioDesiderato[];
  associazioni: AssociazioneDesiderata[] | null;
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

export interface DiffConfigurazione {
  operatori: ModificaOperatore[];
  servizi: ModificaServizio[];
  associazioni: ModificaAssociazione[];
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
    idSconosciuti,
  };
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
  return diff.operatori.length === 0 && diff.servizi.length === 0 && diff.associazioni.length === 0;
}
