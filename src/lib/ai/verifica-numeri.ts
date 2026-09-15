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
