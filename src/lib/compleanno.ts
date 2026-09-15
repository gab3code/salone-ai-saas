import { pianoHaPromemoriaCompleanno, pianoHaSms } from "@/lib/piani";

/**
 * Logica pura del Promemoria di compleanno (Pro/Enterprise, vedi
 * `pianoHaPromemoriaCompleanno` in piani.ts). Costruita il 15/09/2026 dopo
 * che Gabriel ha approvato la funzione con la richiesta esplicita "rendi
 * tutto personalizzabile dallo staff": qui vivono SOLO le due decisioni
 * pure -- "il compleanno di questo cliente è oggi?" e "che testo gli
 * mando?" -- zero query, stesso principio di separazione già seguito da
 * promemoria.ts/booking-engine.ts. Il layer di connessione
 * (compleanno.server.ts) carica i dati grezzi, calcola la data civile
 * locale del tenant (fuso-orario.ts) e delega sempre qui la decisione.
 *
 * --- Perché "oggi" è calcolato nel fuso del tenant, non in UTC ---
 * Il cron gira una volta al giorno a un'ora fissa in UTC (stesso Vercel
 * Cron di promemoria.server.ts, vedi vercel.json). Se si confrontasse la
 * data di nascita con la data UTC del momento in cui gira il cron, un
 * tenant con fuso lontano da UTC (o anche solo vicino alla mezzanotte)
 * rischierebbe di ricevere l'augurio con un giorno di anticipo o ritardo
 * rispetto al calendario che il suo staff e i suoi clienti vedono
 * davvero. Il layer server passa quindi qui la data civile LOCALE del
 * tenant (già calcolata con `realeAPseudoUtc`, la stessa convenzione
 * "pseudo-UTC" usata in tutto il booking engine), non l'istante grezzo.
 */
export interface DataCivile {
  anno: number;
  mese: number; // 1-12
  giorno: number;
}

/** 29 febbraio esiste solo negli anni bisestili (regola gregoriana completa,
 * non solo "divisibile per 4": il 1900 non lo era, il 2000 sì). */
function eBisestile(anno: number): boolean {
  return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0;
}

/**
 * Un cliente nato il 29 febbraio non ha un compleanno vero e proprio negli
 * anni non bisestili. Scelta (non richiesta esplicitamente da Gabriel, presa
 * come default ragionevole e documentata qui invece di bloccare la
 * funzione su un edge case raro): l'augurio scatta il 28 febbraio in un
 * anno non bisestile, il 29 in un anno bisestile -- mai saltato del tutto,
 * mai spostato a marzo.
 */
function meseGiornoEffettivi(dataNascita: DataCivile, annoDiRiferimento: number): { mese: number; giorno: number } {
  if (dataNascita.mese === 2 && dataNascita.giorno === 29 && !eBisestile(annoDiRiferimento)) {
    return { mese: 2, giorno: 28 };
  }
  return { mese: dataNascita.mese, giorno: dataNascita.giorno };
}

/** Estrae anno/mese/giorno da una data in formato `YYYY-MM-DD` (colonna
 * `date` di Postgres) senza passare da `Date`/fusi orari: una data di
 * nascita non ha un'ora, e costruire un `Date` da una stringa del genere in
 * JavaScript la interpreta come UTC, con il rischio concreto di leggere il
 * giorno sbagliato una volta ri-convertita in un fuso diverso. Uno split di
 * stringa non ha questo problema. */
export function scomponiDataIso(dataIso: string): DataCivile {
  const [anno, mese, giorno] = dataIso.split("-").map(Number);
  return { anno, mese, giorno };
}

/** Il compleanno di `dataNascita` cade proprio nel giorno civile `oggi`? */
export function compleannoCadeOggi(dataNascita: DataCivile, oggi: DataCivile): boolean {
  const effettivo = meseGiornoEffettivi(dataNascita, oggi.anno);
  return effettivo.mese === oggi.mese && effettivo.giorno === oggi.giorno;
}

export interface ClientePerCompleanno {
  id: string;
  nome: string | null;
  email: string | null;
  /** Stesso fallback SMS del resto del modulo promemoria -- MAI usato in
   * aggiunta all'email, solo in sua sostituzione. */
  telefono: string | null;
  /** `YYYY-MM-DD` o null se il cliente non ha (ancora) lasciato la data di
   * nascita -- campo facoltativo, vedi migrazione 0023. */
  dataNascita: string | null;
  tenantPiano: string;
  /** Ultimo anno (calendario locale del tenant) in cui questo cliente ha già
   * ricevuto l'augurio -- claim-before-send annuale, vedi
   * compleanno.server.ts. */
  ultimoAnnoAvvisato: number | null;
}

export interface TenantPerCompleanno {
  piano: string;
  /** Interruttore per tenant, default spento -- vedi migrazione 0023. */
  compleannoAttivo: boolean;
}

/**
 * Clienti a cui augurare buon compleanno OGGI (data civile locale del
 * tenant): funzione attiva sul piano E accesa dallo staff, cliente con la
 * data di nascita compilata che cade oggi, un modo di contattarlo (email, o
 * telefono solo se il piano include l'SMS -- stesso principio del resto del
 * modulo promemoria), e non già avvisato quest'anno.
 */
export function clientiDaAvvisarePerCompleanno(
  clienti: ClientePerCompleanno[],
  tenant: TenantPerCompleanno,
  oggi: DataCivile
): ClientePerCompleanno[] {
  if (!pianoHaPromemoriaCompleanno(tenant.piano) || !tenant.compleannoAttivo) return [];

  return clienti.filter((c) => {
    if (!c.dataNascita) return false;
    if (c.ultimoAnnoAvvisato === oggi.anno) return false;
    if (!c.email && !(c.telefono && pianoHaSms(c.tenantPiano))) return false;
    return compleannoCadeOggi(scomponiDataIso(c.dataNascita), oggi);
  });
}

/** Messaggio predefinito quando il tenant non ne ha scritto uno proprio
 * (`tenants.compleanno_messaggio` null) -- staff che non personalizza nulla
 * ottiene comunque un augurio sensato, coerente con `tono_ai` (default
 * "professionale" anche senza nessuna configurazione). */
export const MESSAGGIO_COMPLEANNO_PREDEFINITO =
  "Tanti auguri di buon compleanno, {nome}! Da parte di tutto lo staff.";

/** Lunghezza massima del messaggio personalizzato (vedi check della
 * colonna `tenants.compleanno_messaggio` in migrazione 0023) -- validata
 * anche qui, non solo nel database, cosi' l'azione server puo' dare un
 * errore leggibile prima di arrivare al vincolo SQL. */
export const LUNGHEZZA_MASSIMA_MESSAGGIO_COMPLEANNO = 500;

/**
 * Sostituisce il segnaposto `{nome}` (case-insensitive, uguale se scritto
 * `{Nome}` o `{NOME}` per staff meno attenti alle maiuscole) con il nome
 * del cliente, o con un saluto generico se il cliente non ha un nome
 * salvato -- non lascia mai un `{nome}` letterale nel messaggio finale.
 */
export function comporreMessaggioCompleanno(template: string | null, nomeCliente: string | null): string {
  const base = template && template.trim() ? template : MESSAGGIO_COMPLEANNO_PREDEFINITO;
  const nome = nomeCliente && nomeCliente.trim() ? nomeCliente.trim() : "";
  return base.replace(/\{nome\}/gi, nome).replace(/\s{2,}/g, " ").trim();
}
