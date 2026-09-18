/**
 * Fase 3 di PIANO.md (onboarding AI-assisted, richiesta esplicita di Gabriel
 * 14-15/09/2026): parte pura, senza IO, che normalizza/valida l'output
 * grezzo del modello in una bozza sicura da mostrare al titolare per la
 * revisione -- stesso principio di booking-engine.ts vs
 * booking-engine.server.ts, testabile senza mock di rete/database.
 *
 * REGOLA FONDAMENTALE (stessa di CLAUDE.md punto 7, applicata qui
 * all'onboarding invece che alla chat cliente): l'AI non deve MAI inventare
 * un prezzo, una durata o un orario che il titolare non ha scritto o reso
 * inequivocabile nella sua descrizione. Questo modulo quindi non "ripara"
 * un valore mancante con un default plausibile -- lo lascia `null` così la
 * UI di revisione lo evidenzia come "da compilare" prima di poter applicare
 * quella riga, esattamente come un campo vuoto in un form normale.
 */

import type { StatoDesiderato } from "./onboarding-ai-diff";

export interface OrarioBozza {
  giornoSettimana: number; // 0=domenica .. 6=sabato, come Date.getUTCDay()
  chiuso: boolean;
  apertura: string | null; // "HH:MM"
  chiusura: string | null;
  pausaInizio: string | null;
  pausaFine: string | null;
}

export interface OperatoreBozza {
  /**
   * id della riga gia' esistente sul tenant, oppure null se e' nuova.
   * Aggiunto il 18/09/2026: senza, la bozza non poteva riferirsi a niente
   * di esistente e dire "siamo in due" a un salone con due operatori ne
   * creava altri due (vedi onboarding-ai-diff.ts).
   */
  id: string | null;
  nome: string;
  descrizione: string | null;
}

export interface ServizioBozza {
  id: string | null; // come OperatoreBozza.id
  nome: string;
  durataMinuti: number | null; // null = non specificato dal testo, l'owner lo compila in revisione
  prezzoEuro: number | null;
}

export interface AssociazioneBozza {
  operatore: string; // nome, non id -- risolto in id solo al momento di applicare la bozza
  servizio: string;
}

export interface InformazioniAttivitaBozza {
  descrizione: string | null;
  indirizzo: string | null;
  parcheggio: string | null;
  metodiPagamento: string | null;
}

export interface FaqBozza {
  domanda: string;
  risposta: string;
}

/** Come il salone riempie l'agenda (migrazione 0056). */
export interface RegoleAgendaBozza {
  passoMinuti: number | null;
  bufferMinuti: number | null;
  modalitaRiempimento: "griglia" | "attaccato" | null;
}

/** Gli orari settimanali di UNA persona (migrazione 0057). */
export interface OrariOperatoreBozza {
  /** Nome, risolto contro gli operatori della bozza stessa al momento di applicare. */
  operatore: string;
  orari: OrarioBozza[];
}

export interface ContattiBozza {
  telefono: string | null;
  telefonoWhatsapp: string | null;
}

export interface PromemoriaBozza {
  /** Quante ore prima avvisare il cliente. Piu' valori = piu' promemoria. */
  orePreavviso: number[];
}

export interface CaparraBozza {
  attiva: boolean;
  tipo: "percentuale" | "fisso" | null;
  valore: number | null; // percentuale, oppure euro se tipo = fisso
}

export interface ChiusuraBozza {
  dataInizio: string; // "YYYY-MM-DD"
  dataFine: string | null; // null = un giorno solo
  /** Nome dell'operatore, oppure null per tutto il salone. */
  operatore: string | null;
  giornoIntero: boolean;
  oraInizio: string | null;
  oraFine: string | null;
  motivo: string | null;
}

export interface BozzaOnboarding {
  orari: OrarioBozza[]; // sempre esattamente 7 elementi, uno per giorno
  operatori: OperatoreBozza[];
  servizi: ServizioBozza[];
  /**
   * null = il testo non parlava di chi fa cosa: NON si tocca niente di
   * quello che c'e'. Un elenco vuoto e' un'altra cosa e vuol dire il
   * contrario ("nessuno fa piu' niente"): e' l'unico campo della bozza dove
   * il silenzio e il vuoto non coincidono.
   */
  associazioni: AssociazioneBozza[] | null;
  informazioniAttivita: InformazioniAttivitaBozza | null;
  faq: FaqBozza[];
  oreMinimeCancellazione: number | null;
  regoleAgenda: RegoleAgendaBozza | null;
  orariOperatore: OrariOperatoreBozza[];
  contatti: ContattiBozza | null;
  promemoria: PromemoriaBozza | null;
  caparra: CaparraBozza | null;
  chiusure: ChiusuraBozza[];
}

const FORMATO_ORARIO = /^([01]\d|2[0-3]):[0-5]\d$/;
// Stessi limiti già applicati dalle azioni esistenti (creaServizio,
// creaOperatore, aggiungiFaq, aggiornaInformazioniAttivita,
// aggiornaFinestraCancellazione) -- ripetuti qui così una bozza "over
// budget" viene già tagliata in revisione invece di fallire silenziosamente
// al momento di applicarla.
const MAX_CARATTERI_DESCRIZIONE_OPERATORE = 500;
const MAX_CARATTERI_CAMPO_INFORMAZIONI = 2000;
const MAX_CARATTERI_FAQ_DOMANDA = 300;
const MAX_CARATTERI_FAQ_RISPOSTA = 1000;
const MAX_ORE_CANCELLAZIONE = 720;
const MAX_OPERATORI_BOZZA = 20;
const MAX_SERVIZI_BOZZA = 40;
const MAX_FAQ_BOZZA = 15; // una bozza generosa in FAQ ha comunque senso solo fino a un certo punto
const MAX_CHIUSURE_BOZZA = 20;

function orarioValido(v: unknown): string | null {
  return typeof v === "string" && FORMATO_ORARIO.test(v) ? v : null;
}

function testoONull(v: unknown, maxLunghezza: number): string | null {
  if (typeof v !== "string") return null;
  const pulito = v.trim().slice(0, maxLunghezza);
  return pulito || null;
}

/**
 * Un id e' utile solo se e' una stringa non vuota: qualunque altra cosa
 * (numero, oggetto, stringa vuota) vuol dire "il modello non stava indicando
 * una riga esistente", e diventa null cioe' "riga nuova". Non si prova a
 * indovinare: un id inventato viene poi segnalato dal diff.
 */
function idONull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function numeroPositivoONull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

/** Come numeroPositivoONull, ma 0 è un prezzo legittimo (es. una consulenza
 *  gratuita) e va distinto da "non specificato dal testo": solo un valore
 *  negativo o non numerico diventa null. */
function prezzoEuroONull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return v;
}

/**
 * Sempre 7 righe (una per giorno 0-6): un giorno assente nell'input grezzo
 * -- il modello a volte ne omette qualcuno invece di scriverlo chiuso --
 * diventa "chiuso" di default, mai un giorno con orari inventati.
 */
function normalizzaOrari(grezzi: unknown): OrarioBozza[] {
  const perGiorno = new Map<number, OrarioBozza>();
  if (Array.isArray(grezzi)) {
    for (const r of grezzi) {
      if (typeof r !== "object" || r === null) continue;
      const giorno = Number((r as Record<string, unknown>).giorno_settimana);
      if (!Number.isInteger(giorno) || giorno < 0 || giorno > 6) continue;
      const chiuso = (r as Record<string, unknown>).chiuso !== false; // fail-safe: chiuso di default se ambiguo
      perGiorno.set(giorno, {
        giornoSettimana: giorno,
        chiuso,
        apertura: chiuso ? null : orarioValido((r as Record<string, unknown>).apertura),
        chiusura: chiuso ? null : orarioValido((r as Record<string, unknown>).chiusura),
        pausaInizio: chiuso ? null : orarioValido((r as Record<string, unknown>).pausa_inizio),
        pausaFine: chiuso ? null : orarioValido((r as Record<string, unknown>).pausa_fine),
      });
    }
  }
  return Array.from({ length: 7 }, (_, giorno) => perGiorno.get(giorno) ?? {
    giornoSettimana: giorno,
    chiuso: true,
    apertura: null,
    chiusura: null,
    pausaInizio: null,
    pausaFine: null,
  });
}

function normalizzaOperatori(grezzi: unknown): OperatoreBozza[] {
  if (!Array.isArray(grezzi)) return [];
  const risultato: OperatoreBozza[] = [];
  for (const r of grezzi) {
    if (typeof r !== "object" || r === null) continue;
    const nome = testoONull((r as Record<string, unknown>).nome, 100);
    if (!nome) continue;
    risultato.push({
      id: idONull((r as Record<string, unknown>).id),
      nome,
      descrizione: testoONull((r as Record<string, unknown>).descrizione, MAX_CARATTERI_DESCRIZIONE_OPERATORE),
    });
    if (risultato.length >= MAX_OPERATORI_BOZZA) break;
  }
  return risultato;
}

function normalizzaServizi(grezzi: unknown): ServizioBozza[] {
  if (!Array.isArray(grezzi)) return [];
  const risultato: ServizioBozza[] = [];
  for (const r of grezzi) {
    if (typeof r !== "object" || r === null) continue;
    const nome = testoONull((r as Record<string, unknown>).nome, 100);
    if (!nome) continue;
    const durataGrezza = (r as Record<string, unknown>).durata_minuti;
    risultato.push({
      id: idONull((r as Record<string, unknown>).id),
      nome,
      durataMinuti: typeof durataGrezza === "number" ? numeroPositivoONull(Math.round(durataGrezza)) : null,
      prezzoEuro: prezzoEuroONull((r as Record<string, unknown>).prezzo_euro),
    });
    if (risultato.length >= MAX_SERVIZI_BOZZA) break;
  }
  return risultato;
}

function normalizzaAssociazioni(grezzi: unknown): AssociazioneBozza[] | null {
  // Campo assente/null: il testo non ne parlava. Diverso da un array vuoto.
  if (!Array.isArray(grezzi)) return null;
  const risultato: AssociazioneBozza[] = [];
  for (const r of grezzi) {
    if (typeof r !== "object" || r === null) continue;
    const operatore = testoONull((r as Record<string, unknown>).operatore, 100);
    const servizio = testoONull((r as Record<string, unknown>).servizio, 100);
    if (operatore && servizio) risultato.push({ operatore, servizio });
  }
  return risultato;
}

function normalizzaInformazioniAttivita(grezzo: unknown): InformazioniAttivitaBozza | null {
  if (typeof grezzo !== "object" || grezzo === null) return null;
  const r = grezzo as Record<string, unknown>;
  const informazioni: InformazioniAttivitaBozza = {
    descrizione: testoONull(r.descrizione, MAX_CARATTERI_CAMPO_INFORMAZIONI),
    indirizzo: testoONull(r.indirizzo, MAX_CARATTERI_CAMPO_INFORMAZIONI),
    parcheggio: testoONull(r.parcheggio, MAX_CARATTERI_CAMPO_INFORMAZIONI),
    metodiPagamento: testoONull(r.metodi_pagamento, MAX_CARATTERI_CAMPO_INFORMAZIONI),
  };
  const tuttiVuoti = !informazioni.descrizione && !informazioni.indirizzo && !informazioni.parcheggio && !informazioni.metodiPagamento;
  return tuttiVuoti ? null : informazioni;
}

function normalizzaFaq(grezzi: unknown): FaqBozza[] {
  if (!Array.isArray(grezzi)) return [];
  const risultato: FaqBozza[] = [];
  for (const r of grezzi) {
    if (typeof r !== "object" || r === null) continue;
    const domanda = testoONull((r as Record<string, unknown>).domanda, MAX_CARATTERI_FAQ_DOMANDA);
    const risposta = testoONull((r as Record<string, unknown>).risposta, MAX_CARATTERI_FAQ_RISPOSTA);
    if (domanda && risposta) risultato.push({ domanda, risposta });
    if (risultato.length >= MAX_FAQ_BOZZA) break;
  }
  return risultato;
}

function normalizzaOreCancellazione(grezzo: unknown): number | null {
  if (typeof grezzo !== "number" || !Number.isFinite(grezzo) || !Number.isInteger(grezzo)) return null;
  if (grezzo < 0 || grezzo > MAX_ORE_CANCELLAZIONE) return null;
  return grezzo;
}

/**
 * Normalizza l'input grezzo (il JSON restituito dal tool-calling del
 * modello, non ancora fidato) in una BozzaOnboarding sicura. Fail-open su
 * ogni singolo campo malformato (lo scarta/lascia null) invece di lanciare
 * un'eccezione -- una bozza parziale ma utilizzabile è sempre meglio di
 * nessuna bozza.
 */
export function validaBozzaGrezza(
  grezza: unknown,
  haKnowledgeBaseAi: boolean,
  haPromemoria = false
): BozzaOnboarding {
  const r = typeof grezza === "object" && grezza !== null ? (grezza as Record<string, unknown>) : {};
  return {
    orari: normalizzaOrari(r.orari),
    operatori: normalizzaOperatori(r.operatori),
    servizi: normalizzaServizi(r.servizi),
    associazioni: normalizzaAssociazioni(r.associazioni),
    // I campi di knowledge base non si possono comunque salvare su un piano
    // senza questa funzionalità (aggiornaInformazioniAttivita/aggiungiFaq li
    // rifiuterebbero) -- meglio non proporli affatto in revisione che
    // mostrare un suggerimento che poi fallisce silenziosamente all'apply.
    informazioniAttivita: haKnowledgeBaseAi ? normalizzaInformazioniAttivita(r.informazioni_attivita) : null,
    faq: haKnowledgeBaseAi ? normalizzaFaq(r.faq) : [],
    oreMinimeCancellazione: normalizzaOreCancellazione(r.ore_minime_cancellazione),
    regoleAgenda: normalizzaRegoleAgenda(r.regole_agenda),
    orariOperatore: normalizzaOrariOperatore(r.orari_operatore),
    contatti: normalizzaContatti(r.contatti),
    // I promemoria automatici esistono solo dai piani con quella
    // funzionalita': proporli a chi non li ha vuol dire mostrare un
    // suggerimento che poi fallisce al salvataggio.
    promemoria: haPromemoria ? normalizzaPromemoria(r.promemoria) : null,
    caparra: normalizzaCaparra(r.caparra),
    chiusure: normalizzaChiusure(r.chiusure),
  };
}

/**
 * Le regole d'agenda hanno limiti veri (i `check` della 0056): un valore
 * fuori scala non viene "corretto" a un default plausibile, viene scartato,
 * cosi' la revisione mostra il campo vuoto invece di un numero inventato.
 */
function normalizzaRegoleAgenda(grezzo: unknown): RegoleAgendaBozza | null {
  if (typeof grezzo !== "object" || grezzo === null) return null;
  const r = grezzo as Record<string, unknown>;

  const passo =
    typeof r.passo_minuti === "number" && Number.isInteger(r.passo_minuti) && r.passo_minuti >= 5 && r.passo_minuti <= 240
      ? r.passo_minuti
      : null;
  const buffer =
    typeof r.buffer_minuti === "number" && Number.isInteger(r.buffer_minuti) && r.buffer_minuti >= 0 && r.buffer_minuti <= 240
      ? r.buffer_minuti
      : null;
  const modalita =
    r.modalita_riempimento === "griglia" || r.modalita_riempimento === "attaccato"
      ? r.modalita_riempimento
      : null;

  if (passo === null && buffer === null && modalita === null) return null;
  return { passoMinuti: passo, bufferMinuti: buffer, modalitaRiempimento: modalita };
}

function normalizzaOrariOperatore(grezzi: unknown): OrariOperatoreBozza[] {
  if (!Array.isArray(grezzi)) return [];
  const risultato: OrariOperatoreBozza[] = [];
  for (const r of grezzi) {
    if (typeof r !== "object" || r === null) continue;
    const operatore = testoONull((r as Record<string, unknown>).operatore, 100);
    if (!operatore) continue;
    const orari = normalizzaOrari((r as Record<string, unknown>).orari);
    // Sette giorni tutti chiusi vorrebbe dire "questa persona non lavora
    // mai": quasi sempre e' invece il modello che non aveva niente da dire.
    if (orari.every((o) => o.chiuso)) continue;
    risultato.push({ operatore, orari });
    if (risultato.length >= MAX_OPERATORI_BOZZA) break;
  }
  return risultato;
}

function normalizzaContatti(grezzo: unknown): ContattiBozza | null {
  if (typeof grezzo !== "object" || grezzo === null) return null;
  const r = grezzo as Record<string, unknown>;
  const telefono = testoONull(r.telefono, 40);
  const telefonoWhatsapp = testoONull(r.telefono_whatsapp, 40);
  if (!telefono && !telefonoWhatsapp) return null;
  return { telefono, telefonoWhatsapp };
}

function normalizzaPromemoria(grezzo: unknown): PromemoriaBozza | null {
  if (typeof grezzo !== "object" || grezzo === null) return null;
  const ore = (grezzo as Record<string, unknown>).ore_preavviso;
  if (!Array.isArray(ore)) return null;
  const valide = [
    ...new Set(
      ore.filter(
        (o): o is number => typeof o === "number" && Number.isInteger(o) && o >= 1 && o <= MAX_ORE_CANCELLAZIONE
      )
    ),
  ].sort((a, b) => b - a);
  return valide.length > 0 ? { orePreavviso: valide } : null;
}

function normalizzaCaparra(grezzo: unknown): CaparraBozza | null {
  if (typeof grezzo !== "object" || grezzo === null) return null;
  const r = grezzo as Record<string, unknown>;
  if (r.attiva !== true) return null;

  const tipo = r.tipo === "percentuale" || r.tipo === "fisso" ? r.tipo : null;
  const valore = numeroPositivoONull(r.valore);
  // Una caparra senza tipo o senza valore non e' applicabile: meglio non
  // proporla affatto che proporre "attiva" e poi fallire al salvataggio.
  if (!tipo || valore === null) return null;
  if (tipo === "percentuale" && valore > 100) return null;

  return { attiva: true, tipo, valore };
}

function normalizzaChiusure(grezzi: unknown): ChiusuraBozza[] {
  if (!Array.isArray(grezzi)) return [];
  const risultato: ChiusuraBozza[] = [];
  for (const r of grezzi) {
    if (typeof r !== "object" || r === null) continue;
    const riga = r as Record<string, unknown>;
    const dataInizio = testoONull(riga.data_inizio, 10);
    // Una data che non si capisce e' la cosa piu' pericolosa che il modello
    // possa produrre qui: chiuderebbe il salone in un giorno a caso. Si
    // scarta e basta -- il formato lo verifica `dataValida` al momento di
    // applicare, ma senza data non c'e' nemmeno niente da mostrare.
    if (!dataInizio || !/^\d{4}-\d{2}-\d{2}$/.test(dataInizio)) continue;
    const dataFine = testoONull(riga.data_fine, 10);
    const giornoIntero = riga.giorno_intero !== false;
    risultato.push({
      dataInizio,
      dataFine: dataFine && /^\d{4}-\d{2}-\d{2}$/.test(dataFine) ? dataFine : null,
      operatore: testoONull(riga.operatore, 100),
      giornoIntero,
      oraInizio: giornoIntero ? null : orarioValido(riga.ora_inizio),
      oraFine: giornoIntero ? null : orarioValido(riga.ora_fine),
      motivo: testoONull(riga.motivo, 200),
    });
    if (risultato.length >= MAX_CHIUSURE_BOZZA) break;
  }
  return risultato;
}

/**
 * Dalla bozza (nomi, come li scrive il modello) allo stato desiderato che
 * `calcolaDiff` sa confrontare (oggetti). Le associazioni arrivano per NOME
 * e vengono risolte QUI, contro gli operatori e i servizi della bozza
 * stessa: nomi che il modello ha appena scritto, quindi coerenti fra loro.
 * Una coppia che cita un nome non presente nella bozza viene scartata --
 * meglio un'associazione in meno che una riga collegata a caso.
 */
export function bozzaAStatoDesiderato(bozza: BozzaOnboarding): StatoDesiderato {
  const perNome = <T extends { nome: string }>(righe: T[]) => {
    const mappa = new Map<string, T>();
    for (const riga of righe) mappa.set(riga.nome.trim().toLowerCase(), riga);
    return mappa;
  };
  const operatoriPerNome = perNome(bozza.operatori);
  const serviziPerNome = perNome(bozza.servizi);

  return {
    operatori: bozza.operatori,
    servizi: bozza.servizi,
    associazioni:
      bozza.associazioni === null
        ? null
        : bozza.associazioni.flatMap((a) => {
            const operatore = operatoriPerNome.get(a.operatore.trim().toLowerCase());
            const servizio = serviziPerNome.get(a.servizio.trim().toLowerCase());
            return operatore && servizio ? [{ operatore, servizio }] : [];
          }),
  };
}

/** true se la bozza non contiene assolutamente nulla di utilizzabile (testo troppo vago/fuori tema). */
export function bozzaVuota(bozza: BozzaOnboarding): boolean {
  return (
    bozza.operatori.length === 0 &&
    bozza.servizi.length === 0 &&
    bozza.orari.every((o) => o.chiuso) &&
    !bozza.informazioniAttivita &&
    bozza.faq.length === 0 &&
    bozza.oreMinimeCancellazione === null &&
    !bozza.regoleAgenda &&
    bozza.orariOperatore.length === 0 &&
    !bozza.contatti &&
    !bozza.promemoria &&
    !bozza.caparra &&
    bozza.chiusure.length === 0
  );
}
