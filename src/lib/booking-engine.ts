/**
 * Motore di disponibilità/prenotazione -- Fase 1 (punti 12, 13, 14 della spec).
 *
 * Regola architetturale non negoziabile: questo è l'UNICO posto dove si decide se
 * uno slot è libero o se una prenotazione è valida. Sia la dashboard (creazione
 * manuale) sia i tool dell'AI (via WhatsApp/chat) devono chiamare queste funzioni,
 * mai reimplementare la logica altrove -- altrimenti si rompe la garanzia "single
 * source of truth" del calendario (punto 14) e prima o poi calendario e AI vedranno
 * disponibilità diverse.
 *
 * Questo file contiene SOLO logica pura (nessuna query al database): riceve dati
 * già caricati ed elenca gli esiti. La parte che li legge da Supabase e li passa
 * qui vive altrove (src/lib/booking-engine.server.ts, quando avremo un progetto
 * Supabase reale collegato) -- così questa logica si può scrivere e testare subito,
 * senza aspettare le credenziali.
 */

export interface OrarioGiorno {
  giornoSettimana: number; // 0 = domenica ... 6 = sabato
  chiuso: boolean;
  apertura?: string; // "HH:MM"
  chiusura?: string; // "HH:MM"
  pausaInizio?: string; // "HH:MM"
  pausaFine?: string; // "HH:MM"
}

export interface Chiusura {
  operatoreId: string | null; // null = chiusura per tutto il salone (es. festività)
  data: string; // "YYYY-MM-DD"
  giornoIntero: boolean;
  oraInizio?: string; // "HH:MM", usato solo se giornoIntero = false
  oraFine?: string; // "HH:MM"
}

export interface AppuntamentoEsistente {
  operatoreId: string;
  inizio: Date;
  fine: Date;
  stato: "confermato" | "cancellato" | "completato" | "no_show";
}

export interface Operatore {
  id: string;
  attivo: boolean;
  servizioIds: string[]; // servizi che questo operatore può erogare
  /**
   * Orari settimanali PROPRI di questo operatore (part-time, chi fa solo le
   * mattine, chi il sabato non c'e'). L'assenza vuol sempre dire "segue gli
   * orari del salone", a ogni livello: nessun elemento = li segue tutti i
   * giorni, nessuna riga per un certo giorno = li segue quel giorno.
   *
   * La disponibilita' vera e' l'INTERSEZIONE con gli orari del salone, mai
   * l'unione: un operatore non puo' lavorare quando il salone e' chiuso, e
   * scrivere orari piu' larghi qui non deve poter riaprire il salone di
   * nascosto.
   */
  orari?: OrarioGiorno[];
}

export interface ParametriDisponibilita {
  data: Date; // giorno da controllare (l'ora viene ignorata)
  durataMinuti: number;
  servizioId: string | string[]; // più id = l'operatore deve saperli erogare tutti (servizi consecutivi)
  operatoreId?: string; // se assente: cerca su tutti gli operatori compatibili
  operatori: Operatore[];
  orari: OrarioGiorno[];
  chiusure: Chiusura[];
  appuntamentiEsistenti: AppuntamentoEsistente[];
  bufferMinuti?: number; // spazio minimo tra due appuntamenti dello stesso operatore
  passoMinuti?: number; // granularità degli slot proposti (default 15)
  /**
   * Come si riempie l'agenda dopo un impegno che finisce fuori griglia.
   *
   * - "griglia" (default): gli orari proposti restano allineati all'apertura
   *   del salone -- dopo un appuntamento che finisce alle 15:40 il primo slot
   *   e' le 15:45. Si perdono al massimo `passoMinuti - 1` minuti, in cambio
   *   di una lista di orari che un cliente sa leggere.
   * - "attaccato": il prossimo cliente attacca alla fine del precedente
   *   (15:40, 15:55, 16:10...). Non si perde un minuto di poltrona, ma gli
   *   orari proposti diventano quelli.
   *
   * Sono due modi legittimi di lavorare e la scelta e' del salone, non nostra.
   */
  modalitaRiempimento?: ModalitaRiempimento;
}

export type ModalitaRiempimento = "griglia" | "attaccato";

export interface SlotDisponibile {
  operatoreId: string;
  inizio: Date;
  fine: Date;
}

interface Intervallo {
  inizioMin: number; // minuti dalla mezzanotte
  fineMin: number;
}

const MINUTI_GIORNO = 24 * 60;

function orarioAMinuti(orario: string): number {
  const [h, m] = orario.split(":").map(Number);
  return h * 60 + m;
}

function dataYMD(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function combinaDataEMinuti(data: Date, minuti: number): Date {
  const risultato = new Date(
    Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate())
  );
  risultato.setUTCMinutes(minuti);
  return risultato;
}

/** Sottrae `da` (una lista di intervalli occupati) da `intervalli` (liberi). */
function sottraiIntervalli(intervalli: Intervallo[], da: Intervallo[]): Intervallo[] {
  let risultato = intervalli;
  for (const occupato of da) {
    const nuovo: Intervallo[] = [];
    for (const libero of risultato) {
      // Nessuna sovrapposizione: l'intervallo libero resta intatto.
      if (occupato.fineMin <= libero.inizioMin || occupato.inizioMin >= libero.fineMin) {
        nuovo.push(libero);
        continue;
      }
      // Sovrapposizione parziale/totale: tiene la parte prima e/o dopo l'occupato.
      if (occupato.inizioMin > libero.inizioMin) {
        nuovo.push({ inizioMin: libero.inizioMin, fineMin: occupato.inizioMin });
      }
      if (occupato.fineMin < libero.fineMin) {
        nuovo.push({ inizioMin: occupato.fineMin, fineMin: libero.fineMin });
      }
    }
    risultato = nuovo;
  }
  return risultato;
}

/** Gli intervalli presenti in ENTRAMBE le liste (orari salone ∩ orari operatore). */
function intersecaIntervalli(a: Intervallo[], b: Intervallo[]): Intervallo[] {
  const risultato: Intervallo[] = [];
  for (const x of a) {
    for (const y of b) {
      const inizioMin = Math.max(x.inizioMin, y.inizioMin);
      const fineMin = Math.min(x.fineMin, y.fineMin);
      if (fineMin > inizioMin) risultato.push({ inizioMin, fineMin });
    }
  }
  return risultato.sort((p, q) => p.inizioMin - q.inizioMin);
}

/** Gli intervalli aperti di un operatore in un giorno, prima di sottrarre appuntamenti. */
function intervalliApertura(orario: OrarioGiorno | undefined): Intervallo[] {
  if (!orario || orario.chiuso || !orario.apertura || !orario.chiusura) return [];
  const inizioMin = orarioAMinuti(orario.apertura);
  const fineMin = orarioAMinuti(orario.chiusura);
  if (fineMin <= inizioMin) return [];

  if (orario.pausaInizio && orario.pausaFine) {
    const pausaInizioMin = orarioAMinuti(orario.pausaInizio);
    const pausaFineMin = orarioAMinuti(orario.pausaFine);
    return sottraiIntervalli(
      [{ inizioMin, fineMin }],
      [{ inizioMin: pausaInizioMin, fineMin: pausaFineMin }]
    );
  }
  return [{ inizioMin, fineMin }];
}

/** Le chiusure (ferie/festività) che riguardano un operatore in una data, come intervalli. */
function intervalliChiusura(
  chiusure: Chiusura[],
  operatoreId: string,
  data: string
): Intervallo[] {
  const risultato: Intervallo[] = [];
  for (const c of chiusure) {
    if (c.data !== data) continue;
    if (c.operatoreId !== null && c.operatoreId !== operatoreId) continue; // riguarda un altro operatore
    if (c.giornoIntero) {
      risultato.push({ inizioMin: 0, fineMin: MINUTI_GIORNO });
    } else if (c.oraInizio && c.oraFine) {
      risultato.push({ inizioMin: orarioAMinuti(c.oraInizio), fineMin: orarioAMinuti(c.oraFine) });
    }
  }
  return risultato;
}

/** Gli appuntamenti confermati di un operatore in una data, come intervalli occupati (+ buffer). */
function intervalliOccupatiDaAppuntamenti(
  appuntamenti: AppuntamentoEsistente[],
  operatoreId: string,
  data: string,
  bufferMinuti: number
): Intervallo[] {
  return appuntamenti
    .filter((a) => a.operatoreId === operatoreId && a.stato === "confermato")
    .filter((a) => dataYMD(a.inizio) === data)
    .map((a) => {
      const inizioMin = a.inizio.getUTCHours() * 60 + a.inizio.getUTCMinutes();
      const fineMin = a.fine.getUTCHours() * 60 + a.fine.getUTCMinutes();
      return {
        inizioMin: Math.max(0, inizioMin - bufferMinuti),
        fineMin: Math.min(MINUTI_GIORNO, fineMin + bufferMinuti),
      };
    });
}

/**
 * true se il salone è chiuso in questo giorno della settimana -- nessuna riga
 * di orario configurata per quel giorno, oppure orario esplicitamente
 * marcato `chiuso`, oppure apertura/chiusura mancanti o invertite. Dipende
 * SOLO dagli orari settimanali del salone, mai da operatori/appuntamenti
 * (`orari_apertura` non è per-operatore): serve a distinguere "il salone non
 * apre proprio questo giorno" da "il salone è aperto ma è pieno", i due casi
 * che `calcolaSlotDisponibili` collassa entrambi in un array vuoto. La UI del
 * flusso pubblico (src/app/s/[slug]/FlussoPrenotazione.tsx) deve mostrare un
 * messaggio diverso nei due casi: iscriversi alla lista d'attesa per un
 * giorno di chiusura non ha senso, nessuno slot si libererà mai lì (bug UX
 * segnalato da Gabriel il 14/09/2026).
 */
export function giornoChiuso(orari: OrarioGiorno[], data: Date): boolean {
  const orarioGiorno = orari.find((o) => o.giornoSettimana === data.getUTCDay());
  return intervalliApertura(orarioGiorno).length === 0;
}

/**
 * Perche' per questa combinazione di servizi non esiste NESSUN operatore che
 * possa farli -- quando e' cosi'.
 *
 * Nasce da un caso vero (18/09/2026): un servizio senza nessun operatore
 * abbinato non produceva slot, e il pannello rispondeva "nessuno slot libero
 * per questa combinazione, prova un'altra data o un altro operatore". Tutto
 * vero e tutto inutile: la data non c'entrava, l'operatore nemmeno. Venti
 * minuti persi a cercare dalla parte sbagliata.
 *
 * Tornare `null` significa "gli operatori non sono il problema": il giorno
 * puo' essere chiuso, o pieno, o la durata puo' non entrarci -- lo decidono
 * altri.
 */
export type MotivoOperatoriMancanti =
  | { tipo: "servizi_senza_operatore"; servizioIds: string[] }
  | { tipo: "nessuno_copre_tutta_la_catena" };

export function diagnosticaOperatori(
  operatori: Operatore[],
  servizioIds: string[],
  operatoreId?: string
): MotivoOperatoriMancanti | null {
  if (servizioIds.length === 0) return null;

  // Se lo staff ha scelto un operatore preciso, la domanda e' su quello solo:
  // dire "nessun operatore fa questo servizio" mentre un altro lo fa sarebbe
  // una bugia comoda.
  const candidati = operatori.filter((o) => o.attivo && (!operatoreId || o.id === operatoreId));

  const senzaNessuno = servizioIds.filter(
    (servizioId) => !candidati.some((o) => o.servizioIds.includes(servizioId))
  );
  if (senzaNessuno.length > 0) return { tipo: "servizi_senza_operatore", servizioIds: senzaNessuno };

  // Ogni servizio ha qualcuno, ma i servizi consecutivi vogliono lo STESSO
  // operatore per tutta la catena: puo' non esistere nessuno che li copra
  // tutti, ed e' un motivo diverso che merita una frase diversa.
  const copronoTutto = candidati.some((o) => servizioIds.every((id) => o.servizioIds.includes(id)));
  if (!copronoTutto) return { tipo: "nessuno_copre_tutta_la_catena" };

  return null;
}

/**
 * Calcola gli slot liberi per uno o più operatori compatibili con il servizio
 * richiesto, in un giorno specifico. Questa è la funzione che sia il calendario
 * manuale sia i tool dell'AI devono chiamare per sapere cosa proporre davvero.
 */
export function calcolaSlotDisponibili(params: ParametriDisponibilita): SlotDisponibile[] {
  const {
    data,
    durataMinuti,
    servizioId,
    operatoreId,
    operatori,
    orari,
    chiusure,
    appuntamentiEsistenti,
    bufferMinuti = 0,
    passoMinuti = 15,
    modalitaRiempimento = "griglia",
  } = params;

  if (durataMinuti <= 0) return [];
  if (passoMinuti <= 0) return [];

  const giornoSettimana = data.getUTCDay();
  const orarioGiorno = orari.find((o) => o.giornoSettimana === giornoSettimana);
  const dataStr = dataYMD(data);

  const servizioIds = Array.isArray(servizioId) ? servizioId : [servizioId];
  const operatoriDaControllare = operatori.filter(
    (o) =>
      o.attivo &&
      servizioIds.every((id) => o.servizioIds.includes(id)) &&
      (operatoreId === undefined || o.id === operatoreId)
  );

  const aperturaSalone = intervalliApertura(orarioGiorno);
  if (aperturaSalone.length === 0) return [];

  // La griglia degli orari proposti e' ancorata all'APERTURA DEL SALONE, non
  // all'inizio di ogni finestra libera. Senza ancoraggio, un appuntamento che
  // finisce a un minuto fuori griglia (es. 15:40) sfasava tutti gli slot
  // successivi -- 15:40, 15:55, 16:10... invece di 15:45, 16:00, 16:15.
  // Difetto reale segnalato il 18/09/2026.
  //
  // L'ancora e' del salone anche quando l'operatore ha orari propri: cosi' gli
  // orari proposti da operatori diversi restano allineati FRA LORO, e il
  // cliente vede una lista sola invece di due griglie sfasate.
  const ancoraMin = aperturaSalone[0].inizioMin;

  const slot: SlotDisponibile[] = [];

  for (const operatore of operatoriDaControllare) {
    let liberi = aperturaSalone;

    // Orari propri dell'operatore, se ne ha per QUESTO giorno: intersezione,
    // mai unione (vedi il commento sul campo `orari`).
    const suoOrario = operatore.orari?.find((o) => o.giornoSettimana === giornoSettimana);
    if (suoOrario) {
      liberi = intersecaIntervalli(liberi, intervalliApertura(suoOrario));
      if (liberi.length === 0) continue;
    }

    liberi = sottraiIntervalli(liberi, intervalliChiusura(chiusure, operatore.id, dataStr));
    liberi = sottraiIntervalli(
      liberi,
      intervalliOccupatiDaAppuntamenti(appuntamentiEsistenti, operatore.id, dataStr, bufferMinuti)
    );

    for (const intervallo of liberi) {
      // Primo punto della griglia >= inizio della finestra libera -- oppure
      // l'inizio stesso della finestra, se il salone preferisce riempire.
      const primoInizioMin =
        modalitaRiempimento === "attaccato"
          ? intervallo.inizioMin
          : ancoraMin + Math.ceil((intervallo.inizioMin - ancoraMin) / passoMinuti) * passoMinuti;

      for (
        let inizioMin = primoInizioMin;
        inizioMin + durataMinuti <= intervallo.fineMin;
        inizioMin += passoMinuti
      ) {
        slot.push({
          operatoreId: operatore.id,
          inizio: combinaDataEMinuti(data, inizioMin),
          fine: combinaDataEMinuti(data, inizioMin + durataMinuti),
        });
      }
    }
  }

  return slot.sort((a, b) => a.inizio.getTime() - b.inizio.getTime());
}

/**
 * Verifica se un nuovo appuntamento proposto si sovrappone a uno già confermato
 * dello stesso operatore. Difesa applicativa aggiuntiva rispetto al vincolo
 * `niente_sovrapposizioni` a livello di database (che resta la difesa reale contro
 * la concorrenza) -- questa serve per dare un messaggio d'errore chiaro PRIMA di
 * tentare la scrittura, non per sostituire il vincolo del database.
 */
export function verificaConflitto(
  nuovoInizio: Date,
  nuovoFine: Date,
  operatoreId: string,
  appuntamentiEsistenti: AppuntamentoEsistente[],
  bufferMinuti = 0
): boolean {
  const bufferMs = bufferMinuti * 60_000;
  return appuntamentiEsistenti.some((a) => {
    if (a.operatoreId !== operatoreId || a.stato !== "confermato") return false;
    const inizioA = a.inizio.getTime() - bufferMs;
    const fineA = a.fine.getTime() + bufferMs;
    return nuovoInizio.getTime() < fineA && nuovoFine.getTime() > inizioA;
  });
}

/**
 * Servizi consecutivi (es. "manicure e pedicure"): calcola gli slot in cui TUTTI
 * i servizi richiesti, in sequenza senza buchi, entrano nella disponibilità dello
 * stesso operatore -- che deve saper erogare OGNI servizio della lista, non solo
 * il primo (la catena resta con un unico operatore dall'inizio alla fine).
 */
export function calcolaSlotServiziConsecutivi(
  paramsBase: Omit<ParametriDisponibilita, "durataMinuti" | "servizioId">,
  servizi: { id: string; durataMinuti: number }[]
): SlotDisponibile[] {
  if (servizi.length === 0) return [];
  const durataTotale = servizi.reduce((somma, s) => somma + s.durataMinuti, 0);

  // Uno slot "candidato" è valido se dura almeno durataTotale con lo stesso
  // operatore libero ininterrottamente -- equivalente a cercare disponibilità
  // per un servizio fittizio con la durata complessiva, purché l'operatore sappia
  // erogare tutti i servizi richiesti.
  return calcolaSlotDisponibili({
    ...paramsBase,
    durataMinuti: durataTotale,
    servizioId: servizi.map((s) => s.id),
  }).map((s) => ({
    ...s,
    fine: new Date(s.inizio.getTime() + durataTotale * 60_000),
  }));
}
