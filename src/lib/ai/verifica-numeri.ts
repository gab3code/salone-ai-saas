/**
 * Rete di sicurezza deterministica contro prezzi/durate inventati dal modello
 * su un follow-up secco tra due servizi simili (trovato dal vivo il
 * 15/09/2026, vedi DECISIONS.md: "e la manicure?" subito dopo aver parlato
 * della pedicure ha fatto dichiarare a Haiku 4.5 un prezzo o una durata
 * sbagliati, anche con il dato corretto di ENTRAMBI i servizi già nel
 * contesto). Rafforzare il system prompt (stessa data) ha ridotto ma non
 * eliminato il problema -- Gabriel ha chiesto esplicitamente una verifica a
 * livello di codice, non solo un'istruzione al modello, perché su un prezzo
 * anche un errore ogni tanto è inaccettabile.
 *
 * Funzioni pure, senza IO: testabili senza mock del database o del client
 * Anthropic (stesso principio di booking-engine.ts vs booking-engine.server.ts).
 */

export interface ServizioReale {
  nome: string;
  durataMinuti: number;
  prezzoEuro: number;
}

function escapeRegExp(testo: string): string {
  return testo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Un servizio è "univocamente menzionato" solo se il suo nome compare
 * esattamente una volta tra tutti i servizi reali -- se la risposta parla di
 * più servizi insieme (es. "ti interessa prenotare una di queste due?") non
 * proviamo a validare: meglio non controllare che attribuire un numero al
 * servizio sbagliato per un falso positivo.
 */
function trovaServizioUnicoMenzionato(testo: string, servizi: ServizioReale[]): ServizioReale | null {
  const menzionati = servizi.filter((s) => new RegExp(`\\b${escapeRegExp(s.nome)}\\b`, "i").test(testo));
  return menzionati.length === 1 ? menzionati[0] : null;
}

function numeroDaTesto(testo: string): number {
  return Number(testo.replace(",", "."));
}

/**
 * Cerca nel testo finale dell'AI un prezzo o una durata dichiarati per un
 * servizio riconoscibile e univoco, e li confronta con i valori reali.
 * Restituisce una stringa che descrive l'incongruenza trovata (pensata per
 * essere iniettata come correzione nella conversazione), o null se non c'è
 * nulla da correggere -- compreso il caso in cui il testo non menzioni
 * chiaramente un singolo servizio (fail-open: non blocchiamo/alteriamo una
 * risposta che non siamo in grado di verificare con sicurezza).
 */
export function trovaIncongruenzaPrezzoDurata(testo: string, servizi: ServizioReale[]): string | null {
  if (servizi.length === 0) return null;
  const servizio = trovaServizioUnicoMenzionato(testo, servizi);
  if (!servizio) return null;

  const matchEuro = testo.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)/i);
  const matchMinuti = testo.match(/(\d+)\s*min(?:uti)?\b/i);

  const problemi: string[] = [];
  if (matchEuro) {
    const dichiarato = numeroDaTesto(matchEuro[1]);
    if (Math.abs(dichiarato - servizio.prezzoEuro) > 0.001) {
      problemi.push(`il prezzo dichiarato è ${dichiarato}€, quello reale è ${servizio.prezzoEuro}€`);
    }
  }
  if (matchMinuti) {
    const dichiarato = Number(matchMinuti[1]);
    if (dichiarato !== servizio.durataMinuti) {
      problemi.push(`la durata dichiarata è ${dichiarato} minuti, quella reale è ${servizio.durataMinuti} minuti`);
    }
  }
  if (problemi.length === 0) return null;

  return `Il messaggio che stavi per mandare contiene un errore sul servizio "${servizio.nome}": ${problemi.join(
    " e "
  )}. Riscrivi la risposta correggendo SOLO questo valore, mantenendo lo stesso tono e la stessa lingua, senza menzionare che stai correggendo qualcosa.`;
}

/**
 * Stessa filosofia di trovaIncongruenzaPrezzoDurata, ma per l'importo della
 * caparra dichiarato al cliente subito dopo aver chiamato crea_prenotazione
 * (trovato dal vivo il 15/09/2026, vedi DECISIONS.md: l'AI ha scritto "una
 * caparra di 25 euro" quando l'importo vero restituito dallo strumento era
 * 5 -- lo strumento calcola l'importo giusto, il modello lo ha solo
 * riportato male nel testo).
 */
interface ImportoTrovato {
  indice: number;
  lunghezza: number;
  valore: number;
}

/** Ogni "N euro"/"N€"/"€N" nel testo, con la sua posizione -- senza doppio
 *  conteggio quando entrambi i pattern potrebbero far matchare lo stesso punto. */
function trovaTuttiGliImporti(testo: string): ImportoTrovato[] {
  const risultati: ImportoTrovato[] = [];
  const indiciGiaTrovati = new Set<number>();
  for (const m of testo.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro)/gi)) {
    const indice = m.index ?? 0;
    risultati.push({ indice, lunghezza: m[0].length, valore: numeroDaTesto(m[1]) });
    indiciGiaTrovati.add(indice);
  }
  for (const m of testo.matchAll(/(?:€|euro)\s*(\d+(?:[.,]\d{1,2})?)/gi)) {
    const indice = m.index ?? 0;
    if (!indiciGiaTrovati.has(indice)) {
      risultati.push({ indice, lunghezza: m[0].length, valore: numeroDaTesto(m[1]) });
    }
  }
  return risultati;
}

/**
 * L'importo in euro PIÙ VICINO (per distanza in caratteri, non per ordine
 * di apparizione) alla parola chiave, entro una finestra massima -- così un
 * prezzo pieno menzionato altrove nella stessa frase (es. "la manicure
 * costa 25 euro... la caparra è di 5 euro") non viene scambiato per
 * l'importo della caparra solo perché appare prima nel testo. Un importo
 * separato dalla parola chiave da un punto/punto esclamativo/punto
 * interrogativo (cioè in una frase diversa) non conta MAI come "vicino",
 * anche se la distanza in caratteri sarebbe entro la finestra -- altrimenti
 * un prezzo pieno menzionato nella frase immediatamente precedente (distanza
 * breve, frase diversa) batterebbe per vicinanza l'importo vero della
 * caparra nella frase successiva, solo perché più corto in caratteri.
 */
function trovaImportoPiuVicinoA(testo: string, parolaChiave: string, finestra: number): ImportoTrovato | null {
  const indiceChiave = testo.search(new RegExp(parolaChiave, "i"));
  if (indiceChiave === -1) return null;
  const fineChiave = indiceChiave + parolaChiave.length;

  let migliore: ImportoTrovato | null = null;
  let distanzaMigliore = Infinity;
  for (const importo of trovaTuttiGliImporti(testo)) {
    const fineImporto = importo.indice + importo.lunghezza;
    let distanza: number;
    let testoIntermedio: string;
    if (fineImporto <= indiceChiave) {
      distanza = indiceChiave - fineImporto;
      testoIntermedio = testo.slice(fineImporto, indiceChiave);
    } else if (importo.indice >= fineChiave) {
      distanza = importo.indice - fineChiave;
      testoIntermedio = testo.slice(fineChiave, importo.indice);
    } else {
      distanza = 0;
      testoIntermedio = ""; // sovrapposto alla parola chiave stessa, non dovrebbe succedere
    }
    if (distanza > finestra) continue;
    if (/[.!?]/.test(testoIntermedio)) continue; // frase diversa: non conta come "vicino"
    if (distanza < distanzaMigliore) {
      migliore = importo;
      distanzaMigliore = distanza;
    }
  }
  return migliore;
}

/**
 * Restituisce l'istruzione di correzione se il messaggio menziona un
 * importo di caparra diverso da quello reale restituito dallo strumento, o
 * null se non c'è nulla da correggere -- compreso il caso in cui il testo
 * non nomini affatto "caparra" vicino a una cifra (fail-open, stesso
 * principio di trovaIncongruenzaPrezzoDurata).
 */
export function trovaIncongruenzaCaparra(testo: string, importoRealeEuro: number, finestra = 40): string | null {
  const trovato = trovaImportoPiuVicinoA(testo, "caparra", finestra);
  if (!trovato) return null;
  if (Math.abs(trovato.valore - importoRealeEuro) < 0.001) return null;
  return `Il messaggio che stavi per mandare contiene un errore sull'importo della caparra: hai scritto ${trovato.valore}€, ma l'importo corretto (quello davvero restituito da crea_prenotazione, lo stesso della pagina di pagamento Stripe) è ${importoRealeEuro}€. Riscrivi la risposta correggendo SOLO questo valore, mantenendo lo stesso tono e la stessa lingua, senza menzionare che stai correggendo qualcosa.`;
}

/**
 * Fallback deterministico se anche il secondo giro del modello sbaglia
 * l'importo della caparra: sostituisce SOLO la cifra sbagliata più vicina a
 * "caparra" nel testo esistente (non ricostruisce l'intera frase, a
 * differenza del fallback prezzo/durata) -- preserva il link di pagamento e
 * il resto del messaggio così com'è, cambia solo il numero sbagliato. Su un
 * importo di pagamento la correttezza vince sempre sulla naturalezza del
 * testo.
 */
export function correggiImportoCaparraNelTesto(testo: string, importoRealeEuro: number, finestra = 40): string {
  const trovato = trovaImportoPiuVicinoA(testo, "caparra", finestra);
  if (!trovato) return testo;

  const formattato = Number.isInteger(importoRealeEuro) ? `${importoRealeEuro}` : importoRealeEuro.toFixed(2).replace(".", ",");
  const testoImporto = testo.slice(trovato.indice, trovato.indice + trovato.lunghezza);
  const sostituito = testoImporto.replace(/\d+(?:[.,]\d{1,2})?/, formattato);
  return testo.slice(0, trovato.indice) + sostituito + testo.slice(trovato.indice + trovato.lunghezza);
}
