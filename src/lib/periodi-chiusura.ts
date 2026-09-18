/**
 * Ferie e chiusure straordinarie: la parte pura.
 *
 * La tabella `chiusure` esiste dalla migrazione 0002 ed e' sempre stata letta
 * dal motore di disponibilita'. Non la scriveva nessuno: fino al 18/09/2026
 * un salone non poteva dire "chiudiamo dal 10 al 20 agosto" da nessuna
 * schermata del prodotto. Una funzionalita' a meta', cablata nel motore e mai
 * finita -- la stessa famiglia della colonna `attivo` e del parametro
 * `bufferMinuti` (vedi CLAUDE.md).
 *
 * Qui dentro c'e' solo il calcolo: un periodo si trasforma in un elenco di
 * giorni, perche' il motore ragiona per data e non per intervallo. Le query
 * stanno altrove.
 */

/** Una data in forma "YYYY-MM-DD", la stessa convenzione del resto del progetto. */
const FORMATO_DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function dataValida(valore: string): boolean {
  if (!FORMATO_DATA.test(valore)) return false;
  // Il formato non basta: il 2026-02-31 lo passa. Si ricostruisce la data e
  // si controlla che sia rimasta quella scritta (Date normalizza in silenzio).
  const [anno, mese, giorno] = valore.split("-").map(Number);
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  return (
    data.getUTCFullYear() === anno && data.getUTCMonth() === mese - 1 && data.getUTCDate() === giorno
  );
}

/** Quanti giorni al massimo puo' coprire un singolo periodo di chiusura. */
export const MAX_GIORNI_PERIODO = 366;

export type EsitoPeriodo = { ok: true; giorni: string[] } | { ok: false; errore: string };

/**
 * Espande un periodo in un elenco di giorni, estremi inclusi.
 *
 * `fine` assente o uguale a `inizio` vuol dire un giorno solo -- il caso piu'
 * comune ("il 15 siamo chiusi"), che non deve costringere a scrivere due
 * volte la stessa data.
 */
export function giorniDelPeriodo(inizio: string, fine?: string | null): EsitoPeriodo {
  if (!dataValida(inizio)) return { ok: false, errore: "La data di inizio non è valida." };
  const ultimo = fine && fine.trim() ? fine.trim() : inizio;
  if (!dataValida(ultimo)) return { ok: false, errore: "La data di fine non è valida." };
  if (ultimo < inizio) return { ok: false, errore: "La data di fine viene prima di quella di inizio." };

  const giorni: string[] = [];
  const corrente = new Date(`${inizio}T00:00:00Z`);
  const limite = new Date(`${ultimo}T00:00:00Z`);

  while (corrente.getTime() <= limite.getTime()) {
    giorni.push(corrente.toISOString().slice(0, 10));
    if (giorni.length > MAX_GIORNI_PERIODO) {
      return {
        ok: false,
        errore: `Un periodo di chiusura non può superare ${MAX_GIORNI_PERIODO} giorni. Per una chiusura definitiva conviene invece disattivare i servizi.`,
      };
    }
    corrente.setUTCDate(corrente.getUTCDate() + 1);
  }

  return { ok: true, giorni };
}

/** Orario "HH:MM" valido, per le chiusure di mezza giornata. */
export function orarioValido(valore: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valore);
}

export interface FasciaChiusura {
  giornoIntero: boolean;
  oraInizio: string | null;
  oraFine: string | null;
}

export type EsitoFascia = { ok: true; fascia: FasciaChiusura } | { ok: false; errore: string };

/**
 * Una chiusura e' di giorno intero, oppure ha DUE orari sensati. Mezza fascia
 * non e' un dato: il vincolo della 0002 la rifiuterebbe con un errore
 * tecnico che nessuno saprebbe leggere.
 */
export function leggiFascia(giornoIntero: boolean, oraInizio: string, oraFine: string): EsitoFascia {
  if (giornoIntero) return { ok: true, fascia: { giornoIntero: true, oraInizio: null, oraFine: null } };

  if (!orarioValido(oraInizio) || !orarioValido(oraFine)) {
    return { ok: false, errore: "Per una chiusura di poche ore servono l'ora di inizio e quella di fine." };
  }
  if (oraFine <= oraInizio) {
    return { ok: false, errore: "L'ora di fine deve venire dopo quella di inizio." };
  }
  return { ok: true, fascia: { giornoIntero: false, oraInizio, oraFine } };
}

/**
 * Raggruppa le chiusure salvate in periodi contigui, per mostrarle come le
 * ha pensate chi le ha scritte ("10-20 agosto") invece che come undici righe
 * separate. Stesso operatore, stessa fascia, stesso motivo e giorni
 * consecutivi: un periodo solo.
 */
export interface RigaChiusura {
  id: string;
  operatoreId: string | null;
  data: string;
  giornoIntero: boolean;
  oraInizio: string | null;
  oraFine: string | null;
  motivo: string | null;
}

export interface PeriodoChiusura {
  ids: string[];
  operatoreId: string | null;
  inizio: string;
  fine: string;
  giornoIntero: boolean;
  oraInizio: string | null;
  oraFine: string | null;
  motivo: string | null;
}

function giornoSuccessivo(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function raggruppaInPeriodi(righe: RigaChiusura[]): PeriodoChiusura[] {
  const ordinate = [...righe].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const periodi: PeriodoChiusura[] = [];

  for (const riga of ordinate) {
    const ultimo = periodi.find(
      (p) =>
        p.operatoreId === riga.operatoreId &&
        p.giornoIntero === riga.giornoIntero &&
        p.oraInizio === riga.oraInizio &&
        p.oraFine === riga.oraFine &&
        (p.motivo ?? "") === (riga.motivo ?? "") &&
        giornoSuccessivo(p.fine) === riga.data
    );
    if (ultimo) {
      ultimo.fine = riga.data;
      ultimo.ids.push(riga.id);
      continue;
    }
    periodi.push({
      ids: [riga.id],
      operatoreId: riga.operatoreId,
      inizio: riga.data,
      fine: riga.data,
      giornoIntero: riga.giornoIntero,
      oraInizio: riga.oraInizio,
      oraFine: riga.oraFine,
      motivo: riga.motivo,
    });
  }

  return periodi;
}
