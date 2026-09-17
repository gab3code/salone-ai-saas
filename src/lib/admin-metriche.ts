import { attivitaConfigurata, giorniFra, type RigaAdmin } from "@/lib/admin";

/**
 * Metriche aggregate di piattaforma per il pannello admin (Fase 5,
 * ampliamento del 17/09/2026). Tutto puro e testabile: qui non si parla con
 * il database, si ricevono righe già lette e si restituiscono numeri.
 *
 * Due regole che valgono per ogni funzione di questo file.
 *
 * 1. Nessun dato personale. Si contano appuntamenti, conversazioni e
 *    recensioni; non si legge mai chi li ha fatti né cosa contengono. È la
 *    stessa linea di `admin.ts`, e vale anche per le metriche "di prodotto":
 *    sapere che il 12% delle conversazioni passa a un operatore è un dato
 *    sul prodotto, leggere quelle conversazioni sarebbe un dato sui clienti
 *    di un salone.
 *
 * 2. Mai una percentuale senza il suo denominatore. Con dieci saloni, "il
 *    33% è a rischio" significa "tre", e la percentuale da sola fa sembrare
 *    statistica quella che è aritmetica su numeri piccoli. Ogni struttura
 *    qui sotto porta con sé i valori assoluti da cui è calcolata, e la UI li
 *    mostra accanto.
 */

/** Riga di appuntamento ridotta al minimo che serve per contare. */
export type AppuntamentoAggregabile = {
  creatoIl: string;
  /** confermato | cancellato | completato | no_show */
  stato: string;
  /** manuale | ai */
  creatoDa: string;
};

export type PuntoSettimana = {
  /** ISO del lunedì di quella settimana. */
  inizio: string;
  /** Etichetta corta per l'asse, es. "8 set". */
  etichetta: string;
  ai: number;
  manuali: number;
  totale: number;
};

/**
 * Lunedì (00:00 UTC) della settimana in cui cade `data`.
 *
 * UTC e non ora locale (corretto il 17/09/2026). Esisteva una seconda
 * `inizioSettimana` in `analytics.ts`, identica nell'intento ma scritta con
 * i getter LOCALI qui e con quelli UTC là. Su Vercel, dove il fuso del
 * processo è UTC, le due coincidono e nessuno se ne accorge; su un computer
 * in Europa/Roma no -- e il risultato sarebbero due grafici che raccontano
 * settimane diverse per gli stessi appuntamenti, uno nella dashboard del
 * salone e uno nel pannello di piattaforma. La convenzione del progetto è
 * pseudo-UTC ovunque (vedi `lib/fuso-orario.ts`), quindi è questa a
 * cambiare, e `analytics.ts` ora importa da qui invece di riscriverla.
 */
export function inizioSettimana(data: Date): Date {
  // getUTCDay(): 0 = domenica. In Italia la settimana comincia di lunedì.
  const scarto = (data.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate() - scarto));
}

/**
 * Prenotazioni per settimana, divise fra quelle prese dall'assistente e
 * quelle inserite a mano.
 *
 * È la serie che risponde alla domanda che conta davvero sul prodotto: l'AI
 * sta prendendo prenotazioni vere, e la quota cresce? Le settimane senza
 * nessun appuntamento restano nella serie a zero -- toglierle
 * nasconderebbe esattamente i buchi che si vogliono vedere.
 */
export function serieSettimanale(
  appuntamenti: AppuntamentoAggregabile[],
  settimane = 12,
  adesso: Date = new Date()
): PuntoSettimana[] {
  const settimanaCorrente = inizioSettimana(adesso);
  const punti: PuntoSettimana[] = [];
  const indicePerChiave = new Map<string, number>();

  for (let i = settimane - 1; i >= 0; i -= 1) {
    const inizio = new Date(settimanaCorrente);
    inizio.setUTCDate(inizio.getUTCDate() - i * 7);
    indicePerChiave.set(chiaveGiorno(inizio), punti.length);
    punti.push({
      inizio: inizio.toISOString(),
      etichetta: inizio.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }),
      ai: 0,
      manuali: 0,
      totale: 0,
    });
  }

  for (const appuntamento of appuntamenti) {
    const quando = new Date(appuntamento.creatoIl);
    if (Number.isNaN(quando.getTime())) continue;
    const indice = indicePerChiave.get(chiaveGiorno(inizioSettimana(quando)));
    if (indice === undefined) continue;
    const punto = punti[indice];
    if (appuntamento.creatoDa === "ai") punto.ai += 1;
    else punto.manuali += 1;
    punto.totale += 1;
  }

  return punti;
}

function chiaveGiorno(data: Date): string {
  return `${data.getUTCFullYear()}-${data.getUTCMonth()}-${data.getUTCDate()}`;
}

export type UsoPiattaforma = {
  appuntamenti: number;
  presiDallAi: number;
  noShow: number;
  cancellati: number;
  conversazioni: number;
  /** Conversazioni in cui l'assistente ha passato la palla a una persona. */
  passateAOperatore: number;
  recensioni: number;
  /** Media delle stelle, `null` quando non ci sono ancora recensioni. */
  mediaValutazioni: number | null;
};

export function usoPiattaforma(
  appuntamenti: AppuntamentoAggregabile[],
  conversazioni: { stato: string }[],
  recensioni: { valutazione: number }[]
): UsoPiattaforma {
  let presiDallAi = 0;
  let noShow = 0;
  let cancellati = 0;
  for (const appuntamento of appuntamenti) {
    if (appuntamento.creatoDa === "ai") presiDallAi += 1;
    if (appuntamento.stato === "no_show") noShow += 1;
    if (appuntamento.stato === "cancellato") cancellati += 1;
  }

  const sommaStelle = recensioni.reduce((somma, r) => somma + r.valutazione, 0);

  return {
    appuntamenti: appuntamenti.length,
    presiDallAi,
    noShow,
    cancellati,
    conversazioni: conversazioni.length,
    passateAOperatore: conversazioni.filter((c) => c.stato === "passata_a_operatore").length,
    recensioni: recensioni.length,
    mediaValutazioni: recensioni.length > 0 ? sommaStelle / recensioni.length : null,
  };
}

export type GradinoImbuto = {
  etichetta: string;
  quante: number;
  /** Cosa vuol dire esattamente essere arrivati a questo gradino. */
  spiegazione: string;
};

/**
 * Dove si fermano le attività che si iscrivono. Quattro gradini, ognuno
 * sottoinsieme del precedente -- così la differenza fra due righe è sempre
 * "quante si sono perse qui", senza bisogno di interpretare.
 *
 * È la metrica più utile all'inizio: con pochi clienti il MRR dice poco, ma
 * "otto iscritte, sei configurate, due con una prenotazione vera" dice
 * esattamente dove è rotto il prodotto.
 */
export function imbutoAttivazione(righe: RigaAdmin[]): GradinoImbuto[] {
  const configurate = righe.filter(attivitaConfigurata);
  const conPrenotazioni = configurate.filter((r) => r.appuntamenti > 0);
  const paganti = righe.filter((r) => r.statoAbbonamento === "attivo" && r.haAbbonamentoStripe);

  return [
    { etichetta: "Iscritte", quante: righe.length, spiegazione: "hanno creato un account" },
    {
      etichetta: "Configurate",
      quante: configurate.length,
      spiegazione: "orari aperti, almeno un servizio e un operatore",
    },
    {
      etichetta: "Con prenotazioni",
      quante: conPrenotazioni.length,
      spiegazione: "hanno ricevuto almeno una prenotazione vera",
    },
    { etichetta: "Paganti", quante: paganti.length, spiegazione: "abbonamento Stripe attivo" },
  ];
}

/**
 * Giorni fra l'iscrizione e la prima prenotazione ricevuta, per le attività
 * che ci sono arrivate. Restituisce la mediana e non la media: con pochi
 * dati un singolo salone che ci ha messo tre mesi sposterebbe la media di
 * settimane e racconterebbe una cosa falsa su tutti gli altri.
 */
export function medianaGiorniAllaPrimaPrenotazione(righe: RigaAdmin[]): number | null {
  const giorni = righe
    .filter((r) => r.primaAttivita)
    .map((r) => giorniFra(new Date(r.creatoIl), new Date(r.primaAttivita as string)))
    .sort((a, b) => a - b);

  if (giorni.length === 0) return null;
  const mezzo = Math.floor(giorni.length / 2);
  return giorni.length % 2 === 1 ? giorni[mezzo] : Math.round((giorni[mezzo - 1] + giorni[mezzo]) / 2);
}

export type Coorte = {
  /** "2026-09" */
  mese: string;
  etichetta: string;
  iscritte: number;
  configurate: number;
  /** Con almeno una prenotazione negli ultimi 30 giorni: vive, non solo registrate. */
  vive: number;
  paganti: number;
};

/**
 * Le attività raggruppate per mese di iscrizione, e quante di quelle sono
 * ancora vive oggi.
 *
 * Serve a rispondere alla sola domanda che conta sulla retention senza
 * inventarsi un tasso di churn su dieci clienti: "di quelle entrate a
 * giugno, quante stanno ancora prenotando?". Se la risposta peggiora di mese
 * in mese, il problema non è l'acquisizione.
 */
export function coortiPerMese(righe: RigaAdmin[], adesso: Date = new Date(), mesi = 6): Coorte[] {
  const perMese = new Map<string, RigaAdmin[]>();

  for (const riga of righe) {
    const data = new Date(riga.creatoIl);
    if (Number.isNaN(data.getTime())) continue;
    const mese = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    const gruppo = perMese.get(mese) ?? [];
    gruppo.push(riga);
    perMese.set(mese, gruppo);
  }

  return [...perMese.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, mesi)
    .map(([mese, gruppo]) => ({
      mese,
      etichetta: etichettaMese(mese),
      iscritte: gruppo.length,
      configurate: gruppo.filter(attivitaConfigurata).length,
      vive: gruppo.filter(
        (r) => r.ultimaAttivita && giorniFra(new Date(r.ultimaAttivita), adesso) <= 30
      ).length,
      paganti: gruppo.filter((r) => r.statoAbbonamento === "attivo" && r.haAbbonamentoStripe).length,
    }));
}

function etichettaMese(mese: string): string {
  const [anno, numeroMese] = mese.split("-").map(Number);
  return new Date(anno, numeroMese - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
}

export type MetrichePiattaforma = {
  serie: PuntoSettimana[];
  uso: UsoPiattaforma;
  coorti: Coorte[];
  imbuto: GradinoImbuto[];
  medianaGiorniPrimaPrenotazione: number | null;
};
