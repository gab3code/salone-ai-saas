/**
 * Tabella deterministica giorno-della-settimana -> date, pensata per essere
 * iniettata nel system prompt dell'AI (vedi agente.ts, costruisciSystemPrompt).
 *
 * Trovato dal vivo il 15/09/2026 (vedi DECISIONS.md): con solo "oggi è
 * martedì 15 settembre 2026" nel contesto, Haiku 4.5 ha comunque sbagliato a
 * calcolare a mente che "sabato" cadesse il 19 (ha risposto "il 20",
 * sbagliato). Rafforzare l'istruzione da sola non basta -- il problema non è
 * che il modello non sappia che oggi è martedì, è che il CALCOLO "quale
 * sabato è il 19 rispetto al 15" è un'operazione aritmetica che un modello
 * linguistico può sbagliare anche con la premessa corretta in mano. Stessa
 * filosofia già seguita in verifica-numeri.ts per prezzi/durate: un modello
 * è molto più affidabile nel COPIARE un dato già calcolato che nel
 * CALCOLARLO da solo, quindi diamogli la tabella già pronta invece di
 * chiedergli di fare i conti.
 *
 * Funzione pura, senza IO: testabile senza mock di rete/orologio (riceve
 * `adesso` da chi chiama, stesso pattern di costruisciSystemPrompt).
 */

const GIORNI_SETTIMANA_IT = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"] as const;

// Ordine di lettura naturale (lunedì -> domenica) per la tabella nel system
// prompt -- l'indice interno segue comunque la convenzione JS (0 = domenica)
// usata da Date.prototype.getUTCDay().
const ORDINE_LETTURA_LUN_DOM = [1, 2, 3, 4, 5, 6, 0];

/**
 * Nome del giorno della settimana (in italiano) per una data, secondo lo
 * stesso calcolo deterministico usato ovunque in questo file (getUTCDay --
 * la data è sempre trattata come UTC, stessa semplificazione di fuso orario
 * già usata altrove per il contesto dell'AI).
 *
 * Aggiunta il 15/09/2026 (vedi DECISIONS.md) dopo aver trovato dal vivo un
 * buco nella rete di sicurezza esistente sopra: `trovaIncongruenzaGiornoSettimana`
 * controlla solo che il TESTO finale sia internamente coerente ("domenica 20"
 * è una coppia valida), ma non che il modello abbia interrogato
 * `verifica_disponibilita` con la data GIUSTA per il giorno di cui sta
 * parlando -- un modello può calcolare male "quale data è domenica prossima",
 * chiamare lo strumento con la data sbagliata (es. sabato, chiuso), e poi
 * scrivere una frase testualmente coerente ("chiusi domenica 20") ma falsa
 * rispetto agli orari reali del tenant. Il tool stesso ora restituisce questo
 * nome così il modello ha un dato pronto da copiare invece di doverlo
 * ricalcolare una seconda volta (vedi verifica_disponibilita in tools.ts).
 */
export function nomeGiornoSettimana(data: Date): string {
  return GIORNI_SETTIMANA_IT[data.getUTCDay()];
}

function dataIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Costruisce, per ciascun giorno della settimana, l'elenco delle prossime
 * date (oggi incluso) per `settimane` settimane a partire da `adesso` --
 * pronta per essere incollata nel system prompt così com'è. `adesso` è
 * sempre trattato come UTC, stessa semplificazione di fuso orario già usata
 * altrove per il contesto dell'AI (vedi costruisciSystemPrompt in agente.ts).
 *
 * `settimane` di default a 8 (56 giorni, ~2 mesi): copre la quasi totalità
 * delle richieste di prenotazione reali senza gonfiare troppo il system
 * prompt di ogni singolo turno di chat (7 righe comunque, non 56 -- una per
 * giorno della settimana, con l'elenco delle sue date sulla stessa riga).
 */
export function tabellaGiorniSettimana(adesso: Date, settimane: number = 8): string {
  const oggiUtc = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), adesso.getUTCDate()));
  const perGiorno: string[][] = GIORNI_SETTIMANA_IT.map(() => []);

  const totaleGiorni = settimane * 7;
  for (let i = 0; i < totaleGiorni; i++) {
    const giorno = new Date(oggiUtc.getTime() + i * 86_400_000);
    perGiorno[giorno.getUTCDay()].push(dataIso(giorno));
  }

  return ORDINE_LETTURA_LUN_DOM.map((indice) => `${GIORNI_SETTIMANA_IT[indice]}: ${perGiorno[indice].join(", ")}`).join(
    "\n"
  );
}

/**
 * Seconda rete di sicurezza, dopo la tabella sopra (che riduce ma non
 * azzera il problema, verificato dal vivo il 15/09/2026: su 6 chiamate reali
 * a Haiku 4.5 con la tabella già nel prompt, 5 hanno abbinato correttamente
 * giorno/data, 1 ha comunque scritto "domenica 19 settembre" quando il 19 è
 * sabato) -- stessa filosofia "prevenzione + correzione deterministica" già
 * applicata a prezzo/durata e caparra in verifica-numeri.ts: quando la sola
 * istruzione nel prompt non basta su un dato verificabile, il codice
 * ricontrolla il testo finale invece di fidarsi.
 */
const MESI_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function senzaAccenti(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const GIORNI_NORM = GIORNI_SETTIMANA_IT.map((g) => senzaAccenti(g).toLowerCase());

// Gap tra il nome del giorno e la data (in entrambi gli ordini): breve,
// senza cifre (per non scavalcare un'altra data/orario di mezzo) e senza
// punteggiatura di fine frase (frasi diverse non contano come collegate,
// stesso principio già usato in verifica-numeri.ts per la caparra).
const GAP = `[^.!?\\d]{0,20}?`;
const NOMI_GIORNI_PATTERN = GIORNI_SETTIMANA_IT.join("|");
const NOMI_MESI_PATTERN = MESI_IT.join("|");
const REGEX_GIORNO_PRIMA = new RegExp(
  `\\b(${NOMI_GIORNI_PATTERN})\\b${GAP}\\b(\\d{1,2})\\s+(${NOMI_MESI_PATTERN})\\b(?:\\s+(\\d{4}))?`,
  "gi"
);
const REGEX_DATA_PRIMA = new RegExp(
  `\\b(\\d{1,2})\\s+(${NOMI_MESI_PATTERN})\\b(?:\\s+(\\d{4}))?${GAP}\\b(${NOMI_GIORNI_PATTERN})\\b`,
  "gi"
);

export interface MenzioneGiornoData {
  indice: number; // posizione nel testo dell'intero match (per un'eventuale sostituzione mirata)
  lunghezza: number;
  giornoDichiarato: string; // esattamente come scritto nel testo (per la sostituzione)
  giorno: number;
  mese: number; // 0-based, come Date.getUTCMonth()
  anno?: number;
}

/** Tutte le combinazioni "giorno della settimana + data" trovate nel testo, in entrambi gli ordini. */
function trovaMenzioniGiornoData(testo: string): MenzioneGiornoData[] {
  const risultati: MenzioneGiornoData[] = [];
  for (const m of testo.matchAll(REGEX_GIORNO_PRIMA)) {
    risultati.push({
      indice: m.index ?? 0,
      lunghezza: m[0].length,
      giornoDichiarato: m[1],
      giorno: Number(m[2]),
      mese: MESI_IT.indexOf(senzaAccenti(m[3]).toLowerCase()),
      anno: m[4] ? Number(m[4]) : undefined,
    });
  }
  for (const m of testo.matchAll(REGEX_DATA_PRIMA)) {
    risultati.push({
      indice: m.index ?? 0,
      lunghezza: m[0].length,
      giornoDichiarato: m[4],
      giorno: Number(m[1]),
      mese: MESI_IT.indexOf(senzaAccenti(m[2]).toLowerCase()),
      anno: m[3] ? Number(m[3]) : undefined,
    });
  }
  return risultati;
}

/**
 * Indice (0=domenica..6=sabato) del vero giorno della settimana per
 * giorno/mese[/anno]. Se l'anno non è specificato nel testo, prova prima
 * l'anno di `adesso`: se la data risultante è già passata da più di ~90
 * giorni (quindi il cliente sta quasi certamente parlando dell'anno
 * prossimo, non di una data passata), prova l'anno successivo. Ritorna null
 * se giorno/mese non formano una data valida (es. 31 aprile).
 */
function giornoSettimanaReale(adesso: Date, giorno: number, mese: number, anno?: number): number | null {
  if (mese < 0 || giorno < 1 || giorno > 31) return null;
  const anniDaProvare = anno !== undefined ? [anno] : [adesso.getUTCFullYear(), adesso.getUTCFullYear() + 1];
  for (const annoProva of anniDaProvare) {
    const data = new Date(Date.UTC(annoProva, mese, giorno));
    if (data.getUTCMonth() !== mese) continue; // giorno invalido per quel mese
    if (anno !== undefined) return data.getUTCDay();
    const differenzaGiorni = (data.getTime() - adesso.getTime()) / 86_400_000;
    if (differenzaGiorni > -90) return data.getUTCDay();
  }
  return null; // nessuna data valida trovata in nessuno dei due anni (giorno/mese non valido)
}

/**
 * Restituisce l'istruzione di correzione per la PRIMA combinazione
 * giorno-della-settimana/data incongruente trovata nel testo (una alla
 * volta, come trovaIncongruenzaPrezzoDurata: se ce n'è più di una, il primo
 * giro di correzione le risolve tutte insieme perché il modello riscrive
 * l'intera risposta), o null se non c'è nulla da correggere.
 */
export function trovaIncongruenzaGiornoSettimana(testo: string, adesso: Date): string | null {
  for (const menzione of trovaMenzioniGiornoData(testo)) {
    const reale = giornoSettimanaReale(adesso, menzione.giorno, menzione.mese, menzione.anno);
    if (reale === null) continue;
    const dichiaratoNorm = senzaAccenti(menzione.giornoDichiarato).toLowerCase();
    if (GIORNI_NORM[reale] === dichiaratoNorm) continue;
    const dataLeggibile = `${menzione.giorno} ${MESI_IT[menzione.mese]}`;
    return `Il messaggio che stavi per mandare contiene un errore: hai scritto "${menzione.giornoDichiarato} ${dataLeggibile}", ma il ${dataLeggibile} è ${GIORNI_SETTIMANA_IT[reale]}, non ${dichiaratoNorm}. Riscrivi la risposta correggendo SOLO il giorno della settimana citato per questa data, mantenendo lo stesso tono e la stessa lingua, senza menzionare che stai correggendo qualcosa.`;
  }
  return null;
}

/**
 * Fallback deterministico se anche il secondo giro del modello sbaglia:
 * sostituisce SOLO la prima parola del giorno della settimana incongruente
 * trovata, mantenendo il resto del messaggio intatto -- stesso principio di
 * correggiImportoCaparraNelTesto in verifica-numeri.ts (un dato verificabile
 * vince sempre sulla naturalezza del testo).
 */
export function correggiGiornoSettimanaNelTesto(testo: string, adesso: Date): string {
  for (const menzione of trovaMenzioniGiornoData(testo)) {
    const reale = giornoSettimanaReale(adesso, menzione.giorno, menzione.mese, menzione.anno);
    if (reale === null) continue;
    const dichiaratoNorm = senzaAccenti(menzione.giornoDichiarato).toLowerCase();
    if (GIORNI_NORM[reale] === dichiaratoNorm) continue;

    // Sostituisce solo la porzione "nome del giorno" dentro il match intero,
    // preservando maiuscola iniziale se il testo originale la aveva.
    const inizioMaiuscola = menzione.giornoDichiarato[0] === menzione.giornoDichiarato[0].toUpperCase();
    const sostituto = inizioMaiuscola
      ? GIORNI_SETTIMANA_IT[reale][0].toUpperCase() + GIORNI_SETTIMANA_IT[reale].slice(1)
      : GIORNI_SETTIMANA_IT[reale];
    const primaDelGiorno = testo.slice(0, menzione.indice);
    const dopoIlGiorno = testo.slice(menzione.indice + menzione.lunghezza);
    const matchIntero = testo.slice(menzione.indice, menzione.indice + menzione.lunghezza);
    const matchCorretto = matchIntero.replace(new RegExp(`\\b${menzione.giornoDichiarato}\\b`, "i"), sostituto);
    return primaDelGiorno + matchCorretto + dopoIlGiorno;
  }
  return testo;
}
