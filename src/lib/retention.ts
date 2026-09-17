/**
 * Retention -- quanti clienti tornano (Fase 3, chiusa il 17/09/2026).
 *
 * Era l'ultimo punto aperto della fase: non mancava il codice, mancava la
 * DEFINIZIONE. Gabriel ne aveva proposte due ("% di clienti con almeno 2
 * prenotazioni confermate" e "% di clienti che tornano entro N giorni") e ha
 * chiesto di implementarle entrambe. Sono la stessa funzione con N
 * parametrico: la prima e' la seconda con N infinito.
 *
 * Cercando come le chiama il settore (Meevo, Simple Salon, Phorest,
 * 17/09/2026) viene fuori che saloni e spa ne usano due, non una, e sono
 * proprio le due di Gabriel viste da due lati:
 *   1. NUOVI CLIENTI CHE TORNANO -- dei clienti alla prima visita, quanti
 *      tornano per una seconda. La finestra convenzionale e' 90 giorni.
 *   2. CLIENTI ABITUALI -- di chi ha gia' fatto due visite, quanti
 *      continuano. E' la "% che torna entro N giorni dal precedente" di
 *      Gabriel, misurata nel punto in cui conta davvero.
 * I benchmark numerici che girano (45%, 60-70%, 75%...) NON sono scritti a
 * schermo di proposito: due fonti lette lo stesso giorno danno numeri
 * diversi e mescolano "retention complessiva" con "retention dei nuovi".
 * Un numero di confronto sbagliato e' peggio di nessun numero -- vedi
 * DECISIONS.md, 17/09/2026.
 *
 * ----------------------------------------------------------------------
 * LE TRE SCELTE CHE RENDONO IL NUMERO ONESTO
 *
 * 1. CHI NON HA ANCORA AVUTO IL TEMPO DI TORNARE NON ENTRA NEL
 *    DENOMINATORE. Un cliente venuto tre giorni fa non e' "non tornato
 *    entro 30 giorni": ha ancora 27 giorni di tempo. Contarlo fra i
 *    mancati ritorni fa PEGGIORARE la percentuale ogni volta che il salone
 *    acquisisce clienti nuovi, cioe' esattamente il contrario di quello che
 *    il numero deve dire. Ogni riga ha quindi il suo denominatore (chi e'
 *    arrivato da almeno N), ed e' scritto a schermo.
 *
 * 2. SOTTO `MINIMO_CLIENTI_PER_PERCENTUALE` NON SI MOSTRA UNA PERCENTUALE.
 *    Con 3 clienti valutabili, uno che torna fa "33%" e due fanno "67%":
 *    numeri veri e completamente privi di significato. Meglio dire che i
 *    dati non bastano ancora.
 *
 * 3. DUE APPUNTAMENTI NELLO STESSO GIORNO SONO UNA VISITA SOLA. Taglio e
 *    colore prenotati separatamente per lo stesso pomeriggio non sono un
 *    "ritorno": senza questo raggruppamento la retention di un salone che
 *    lavora cosi' sarebbe gonfiata e nessuno capirebbe perche'.
 *
 * ----------------------------------------------------------------------
 * COSA CONTA COME RITORNO (decisione di Gabriel, 17/09/2026: "tutti e due,
 * separati"). Due numeri sulla stessa coorte, mai due coorti diverse:
 *   - HA RIPRENOTATO: e' tornato a prendere un appuntamento, e quel giorno
 *     e' arrivato -- sia che si sia presentato (`confermato`) sia che non
 *     si sia presentato (`no_show`). Misura se il salone gli e' rimasto in
 *     testa.
 *   - SI E' PRESENTATO: solo `confermato`. Misura l'incasso vero.
 * La distanza fra i due e' essa stessa un'informazione: e' quanto costano
 * le assenze. `cancellato` non conta in nessuno dei due -- ha disdetto, non
 * e' tornato, e il salone non ha incassato niente.
 *
 * La coorte e' ancorata alla prima visita ONORATA in entrambe le serie:
 * misurare "chi torna" partendo da qualcuno che al primo appuntamento non
 * si e' mai presentato vorrebbe dire contare gente che nel salone non e'
 * mai entrata. Stesso ancoraggio = stesso denominatore = i due numeri sono
 * confrontabili, e `presentati <= riprenotati` sempre.
 *
 * Logica pura, zero query, stesso principio di metriche.ts/analytics.ts.
 * Tutte le date sono gia' in pseudo-UTC (src/lib/fuso-orario.ts): qui si fa
 * solo aritmetica sui millisecondi e si leggono i campi con i getter UTC,
 * mai con quelli locali.
 */

const MS_PER_GIORNO = 24 * 60 * 60 * 1000;

/** Sotto questa soglia di clienti valutabili si scrive "dati insufficienti". */
export const MINIMO_CLIENTI_PER_PERCENTUALE = 5;

/**
 * Per "prima o poi" (nessun limite di tempo) serve comunque un pavimento di
 * maturazione, altrimenti nessuno avrebbe mai "finito il tempo" e nel
 * denominatore finirebbe anche chi e' arrivato ieri. Un anno: stessa coorte
 * della riga "entro 1 anno", cosi' le due righe sono confrontabili fra loro
 * e la differenza dice una cosa precisa -- questi sono tornati, ma dopo
 * piu' di un anno.
 */
export const GIORNI_MATURAZIONE_SENZA_LIMITE = 365;

export interface FinestraRitorno {
  chiave: string;
  /** null = nessun limite di tempo ("prima o poi"). */
  giorni: number | null;
  etichetta: string;
}

/**
 * Le finestre chieste da Gabriel (settimana, mese, 3 mesi, 6 mesi, anno)
 * piu' "prima o poi", che e' la sua prima definizione -- "almeno 2
 * prenotazioni confermate" -- espressa nella stessa scala delle altre.
 *
 * Si mostrano TUTTE INSIEME, non una per volta dietro a un menu a tendina:
 * la curva completa e' la risposta, non una delle sue righe. Un titolare
 * che legge 12% / 41% / 63% / 71% vede da solo dove i clienti si perdono,
 * mentre con un selettore dovrebbe aprirlo cinque volte e tenere a mente i
 * numeri per farci lo stesso ragionamento.
 */
export const FINESTRE_RITORNO: readonly FinestraRitorno[] = [
  { chiave: "7", giorni: 7, etichetta: "entro 1 settimana" },
  { chiave: "30", giorni: 30, etichetta: "entro 1 mese" },
  { chiave: "90", giorni: 90, etichetta: "entro 3 mesi" },
  { chiave: "180", giorni: 180, etichetta: "entro 6 mesi" },
  { chiave: "365", giorni: 365, etichetta: "entro 1 anno" },
  { chiave: "sempre", giorni: null, etichetta: "prima o poi" },
];

/** La finestra di riferimento del settore, usata per il numero in evidenza. */
export const FINESTRA_PREDEFINITA = "90";

export interface VisitaRetention {
  clienteId: string;
  inizio: Date;
  /** confermato | cancellato | completato | no_show */
  stato: string;
}

export interface RigaRetention {
  chiave: string;
  etichetta: string;
  giorni: number | null;
  /** Denominatore: i clienti che hanno avuto il tempo di tornare. */
  clientiValutabili: number;
  riprenotati: number;
  presentati: number;
  /** null quando i clienti valutabili sono sotto la soglia minima. */
  percentualeRiprenotati: number | null;
  percentualePresentati: number | null;
}

export interface Retention {
  /** Dei clienti alla prima visita, quanti sono tornati per una seconda. */
  nuoviClienti: RigaRetention[];
  /** Di chi ha gia' fatto due visite, quanti ne hanno fatta una terza. */
  abituali: RigaRetention[];
}

/** Giorno civile di una data gia' in pseudo-UTC, come numero ordinabile. */
function giornoUtc(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

interface VisiteCliente {
  /** Giorni distinti in cui il cliente si e' presentato davvero. */
  onorate: number[];
  /** Giorni distinti in cui aveva un appuntamento, presentato o no. */
  prenotate: number[];
}

/**
 * Raggruppa le visite per cliente, tenendo solo quelle GIA' PASSATE e
 * collassando gli appuntamenti dello stesso giorno in una visita sola
 * (scelta 3 in testa al file). Un appuntamento futuro non e' ne' un
 * ritorno ne' una prova che il ritorno non c'e' stato: e' ancora da
 * succedere, e va ignorato in entrambe le direzioni.
 */
function raggruppaPerCliente(visite: VisitaRetention[], adesso: Date): Map<string, VisiteCliente> {
  const oggi = giornoUtc(adesso);
  const perCliente = new Map<string, { onorate: Set<number>; prenotate: Set<number> }>();

  for (const v of visite) {
    if (!v.clienteId) continue;
    const giorno = giornoUtc(v.inizio);
    // `> oggi` e non `>= oggi`: un appuntamento di stamattina gia' finito e'
    // una visita a tutti gli effetti, e scartare l'intera giornata di oggi
    // renderebbe il numero piu' vecchio di quello che il titolare vede in
    // agenda.
    if (giorno > oggi) continue;
    if (v.inizio.getTime() > adesso.getTime()) continue;

    const onorato = v.stato === "confermato";
    const arrivato = onorato || v.stato === "no_show";
    if (!arrivato) continue;

    let riga = perCliente.get(v.clienteId);
    if (!riga) {
      riga = { onorate: new Set(), prenotate: new Set() };
      perCliente.set(v.clienteId, riga);
    }
    riga.prenotate.add(giorno);
    if (onorato) riga.onorate.add(giorno);
  }

  const risultato = new Map<string, VisiteCliente>();
  for (const [clienteId, riga] of perCliente) {
    risultato.set(clienteId, {
      onorate: [...riga.onorate].sort((a, b) => a - b),
      prenotate: [...riga.prenotate].sort((a, b) => a - b),
    });
  }
  return risultato;
}

/**
 * Una riga della curva.
 *
 * `visiteDaSaltare` sposta l'ancora: 0 = la prima visita (retention dei
 * clienti nuovi), 1 = la seconda (retention degli abituali). E' l'unica
 * differenza fra le due metriche, quindi e' un parametro e non una seconda
 * funzione copiata.
 */
function calcolaRiga(
  perCliente: Map<string, VisiteCliente>,
  finestra: FinestraRitorno,
  adesso: Date,
  visiteDaSaltare: number
): RigaRetention {
  const giorniMaturazione = finestra.giorni ?? GIORNI_MATURAZIONE_SENZA_LIMITE;
  const sogliaAncora = giornoUtc(adesso) - giorniMaturazione * MS_PER_GIORNO;

  let clientiValutabili = 0;
  let riprenotati = 0;
  let presentati = 0;

  for (const visite of perCliente.values()) {
    const ancora = visite.onorate[visiteDaSaltare];
    if (ancora === undefined) continue;
    if (ancora > sogliaAncora) continue; // non ha ancora avuto il tempo

    clientiValutabili += 1;
    const limite = finestra.giorni === null ? Infinity : ancora + finestra.giorni * MS_PER_GIORNO;

    if (visite.prenotate.some((g) => g > ancora && g <= limite)) riprenotati += 1;
    if (visite.onorate.some((g) => g > ancora && g <= limite)) presentati += 1;
  }

  const abbastanza = clientiValutabili >= MINIMO_CLIENTI_PER_PERCENTUALE;
  return {
    chiave: finestra.chiave,
    etichetta: finestra.etichetta,
    giorni: finestra.giorni,
    clientiValutabili,
    riprenotati,
    presentati,
    percentualeRiprenotati: abbastanza ? Math.round((riprenotati / clientiValutabili) * 100) : null,
    percentualePresentati: abbastanza ? Math.round((presentati / clientiValutabili) * 100) : null,
  };
}

export function calcolaRetention(visite: VisitaRetention[], adesso: Date): Retention {
  const perCliente = raggruppaPerCliente(visite, adesso);
  return {
    nuoviClienti: FINESTRE_RITORNO.map((f) => calcolaRiga(perCliente, f, adesso, 0)),
    abituali: FINESTRE_RITORNO.map((f) => calcolaRiga(perCliente, f, adesso, 1)),
  };
}

/**
 * La finestra piu' vicina alla soglia di follow-up configurata dal salone.
 *
 * Serve a cucire insieme due schermate che parlano della stessa cosa: in
 * Impostazioni il titolare decide dopo quanti giorni un cliente e'
 * "sparito", qui vede quanti tornano entro quel tempo. Senza questo
 * collegamento sono due numeri scollegati in due pagine diverse, e il
 * secondo non aiuta a scegliere il primo.
 */
export function finestraPiuVicinaA(giorni: number): FinestraRitorno {
  const conLimite = FINESTRE_RITORNO.filter((f) => f.giorni !== null);
  // `<=` e non `<`: a parita' di distanza vince la finestra PIU' AMPIA (60
  // giorni sta esattamente in mezzo fra 30 e 90). E' la piu' utile delle
  // due per decidere la soglia: chi torna fra il 60esimo e il 90esimo
  // giorno e' esattamente la gente che il follow-up va a recuperare, e con
  // la finestra stretta sparirebbe dal conto.
  return conLimite.reduce((migliore, f) =>
    Math.abs((f.giorni as number) - giorni) <= Math.abs((migliore.giorni as number) - giorni) ? f : migliore
  );
}
