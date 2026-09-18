/**
 * Cosa NON deve uscire da qui dentro.
 *
 * Sentry riceve gli errori di produzione, e un errore porta con se' il
 * contesto in cui e' successo: l'indirizzo della pagina, i parametri, a volte
 * il messaggio del database con dentro una riga vera. In un prodotto
 * qualunque sarebbe un fastidio; qui dentro ci sono i clienti dei saloni --
 * nomi, telefoni, email di persone che non hanno mai sentito parlare di noi.
 *
 * La nostra informativa privacy elenca uno per uno i fornitori a cui quei
 * dati possono arrivare. Sentry ci finisce come strumento di diagnostica, non
 * come posto dove i dati dei clienti vanno a vivere: la differenza la fa
 * questo file, non la buona volonta'.
 *
 * Il criterio, in una riga: si tiene tutto quello che serve a capire DOVE si
 * e' rotto, si toglie tutto quello che dice CHI c'era dentro. Un errore
 * ripulito e' ancora utile; un errore che ti dice che il telefono di Anna e'
 * il 333... non lo e' di piu', e' solo piu' pericoloso.
 *
 * Tutto puro e testato: un filtro di riservatezza che nessuno verifica e'
 * esattamente il tipo di cosa che smette di funzionare in silenzio.
 */

export const SOSTITUTO = "[rimosso]";

/**
 * Parametri il cui VALORE e' scritto da una persona e puo' essere il nome o
 * il contatto di un cliente. Gli id (uuid di servizi, operatori,
 * appuntamenti) restano: non dicono chi e' nessuno da soli, e senza quelli
 * un errore non si riesce a rincorrere.
 */
const PARAMETRI_DA_OSCURARE = new Set([
  "q",
  "nome",
  "email",
  "telefono",
  "cliente_nome",
  "cliente_telefono",
  "token",
  "code",
  "access_token",
  "refresh_token",
]);

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Numeri lunghi: telefoni italiani con o senza prefisso, scritti con spazi,
// punti o trattini. Sotto le otto cifre non si tocca, altrimenti sparirebbero
// gli orari, gli importi e i codici di errore -- cioe' le cose che servono.
const NUMERO_LUNGO = /(\+?\d[\d .-]{7,}\d)/g;
const DATA_ISO = /\d{4}-\d{2}-\d{2}/g;
const SEGNAPOSTO_DATA = (i: number) => `\u0000d${i}\u0000`;

/**
 * Maschera email e numeri lunghi dentro un testo libero.
 *
 * Le date in formato `2026-09-21` si mettono al riparo PRIMA: sono dieci
 * caratteri fatti di cifre e trattini, quindi la regola dei numeri lunghi se
 * le mangiava (trovato dal test, non dall'occhio). Una data non dice niente su
 * nessuno ed e' meta' del valore di un errore di calendario -- toglierla
 * avrebbe reso gli errori riservati e inutili insieme.
 */
export function ripulisciTesto(testo: string): string {
  const date: string[] = [];
  const alRiparo = testo.replace(DATA_ISO, (trovata) => {
    date.push(trovata);
    return SEGNAPOSTO_DATA(date.length - 1);
  });

  const ripulito = alRiparo.replace(EMAIL, SOSTITUTO).replace(NUMERO_LUNGO, SOSTITUTO);

  return ripulito.replace(/\u0000d(\d+)\u0000/g, (_, indice: string) => date[Number(indice)]);
}

/**
 * Tiene il percorso e i nomi dei parametri, toglie i valori scritti da una
 * persona. Il percorso e' quasi tutto quello che serve per capire dove
 * guardare, e non dice niente su nessuno.
 */
export function ripulisciUrl(url: string): string {
  const taglio = url.indexOf("?");
  if (taglio === -1) return ripulisciTesto(url);

  const percorso = url.slice(0, taglio);
  const parametri = new URLSearchParams(url.slice(taglio + 1));

  for (const chiave of [...parametri.keys()]) {
    if (PARAMETRI_DA_OSCURARE.has(chiave)) {
      const quanti = parametri.getAll(chiave).length;
      parametri.delete(chiave);
      for (let i = 0; i < quanti; i += 1) parametri.append(chiave, SOSTITUTO);
    }
  }

  const coda = parametri.toString();
  // `URLSearchParams` scappa le parentesi quadre del sostituto: rimesse a
  // posto, cosi' leggendo l'errore si vede "[rimosso]" e non "%5Brimosso%5D".
  const codaLeggibile = coda.replace(/%5Brimosso%5D/g, SOSTITUTO);
  return ripulisciTesto(coda ? `${percorso}?${codaLeggibile}` : percorso);
}

interface EventoMinimo {
  request?: {
    url?: string;
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
  };
  message?: string;
  exception?: { values?: { value?: string }[] };
  breadcrumbs?: { message?: string; data?: { url?: string; from?: string; to?: string } }[];
  user?: unknown;
}

/**
 * L'ultimo passaggio prima che un evento parta verso Sentry.
 *
 * Intestazioni e cookie spariscono per intero e non a scelta: il cookie di
 * sessione di Supabase e' un token valido, e uno che finisce nei log di un
 * fornitore esterno e' una chiave di casa lasciata sullo zerbino.
 */
export function ripulisciEvento<T extends EventoMinimo>(evento: T): T {
  if (evento.request) {
    delete evento.request.headers;
    delete evento.request.cookies;
    // Il corpo di una richiesta e' un form: nome, telefono, note. Mai.
    delete evento.request.data;
    if (evento.request.url) evento.request.url = ripulisciUrl(evento.request.url);
  }

  // L'utente: Sentry lo userebbe per raggruppare gli errori, ma a noi basta
  // sapere QUALE SALONE, e quello non passa da qui (vedi `tenant` nei tag).
  delete evento.user;

  if (evento.message) evento.message = ripulisciTesto(evento.message);

  for (const valore of evento.exception?.values ?? []) {
    if (valore.value) valore.value = ripulisciTesto(valore.value);
  }

  for (const briciola of evento.breadcrumbs ?? []) {
    if (briciola.message) briciola.message = ripulisciTesto(briciola.message);
    if (briciola.data?.url) briciola.data.url = ripulisciUrl(briciola.data.url);
    if (briciola.data?.from) briciola.data.from = ripulisciUrl(briciola.data.from);
    if (briciola.data?.to) briciola.data.to = ripulisciUrl(briciola.data.to);
  }

  return evento;
}

/**
 * Errori che non sono errori.
 *
 * `NEXT_REDIRECT` e `NEXT_NOT_FOUND` sono il modo in cui Next fa funzionare
 * `redirect()` e `notFound()`: un'eccezione usata come istruzione. Finirebbero
 * in Sentry a migliaia -- ogni utente non loggato che viene mandato ad
 * /accedi -- e sommergerebbero gli errori veri.
 *
 * "The destination stream closed early" e' il visitatore che chiude la pagina
 * mentre sta ancora arrivando. Capita, e non c'e' niente da sistemare.
 */
export const ERRORI_DA_IGNORARE = [
  "NEXT_REDIRECT",
  "NEXT_NOT_FOUND",
  "The destination stream closed early",
  // L'utente ha cambiato pagina mentre una richiesta era in volo.
  "AbortError",
  "The user aborted a request",
];
