/**
 * L'import della rubrica clienti: parte pura.
 *
 * PERCHE' QUESTA E' LA FUNZIONE PIU' IMPORTANTE CHE MANCAVA (PIANO.md, Fase
 * 6ter). Il motivo per cui un salone NON cambia gestionale non e' il prezzo:
 * e' che ha trecento clienti su un quaderno, in un Excel fatto male o dentro
 * la cronologia di WhatsApp, e spostarli a mano e' una serata di lavoro che
 * nessuno fara' mai. Finche' quella serata resta in mezzo, tutto il resto
 * del prodotto non viene nemmeno provato.
 *
 * ------------------------------------------------------------------
 * PRIMA SI PROVA SENZA MODELLO, E QUASI SEMPRE BASTA.
 *
 * Un incolla da Excel e' testo separato da tabulazioni. Un export di un
 * altro gestionale e' un CSV con un'intestazione. Una lista scritta a mano
 * e' "nome, numero" una per riga. Sono i tre casi piu' comuni e si leggono
 * con del codice: gratis, istantaneo, esatto, e soprattutto RIPETIBILE --
 * lo stesso incolla da' sempre lo stesso risultato, cosa che un modello non
 * garantisce. Il modello serve per quello che resta (un incolla sporco, una
 * foto dell'agenda) e vive altrove: qui dentro non c'e' ne' rete ne' AI.
 *
 * ------------------------------------------------------------------
 * IL TELEFONO E' LA CHIAVE, E OGGI NON LO E' ABBASTANZA.
 *
 * `trovaClientePerTelefono` confronta le stringhe cosi' come sono: per il
 * database "333 123 4567", "+393331234567" e "3331234567" sono tre clienti
 * diversi. Su una prenotazione alla volta non si vede; su un import di
 * trecento righe diventa il difetto principale -- il salone si ritrova la
 * rubrica doppia e smette di fidarsi.
 *
 * Qui il confronto si fa su una forma canonica (`telefonoCanonico`) calcolata
 * a memoria su entrambi i lati, senza toccare il database ne' il formato in
 * cui i numeri sono scritti: il titolare continua a vedere i suoi numeri come
 * li ha scritti lui.
 */

export interface ClienteImportato {
  nome: string | null;
  telefono: string;
  email: string | null;
  note: string | null;
  /**
   * Da dove viene, quando l'ha letto il modello: la riga non capita, o la
   * trascrizione della voce nella foto. Si mostra accanto alla proposta,
   * cosi' il titolare confronta con i suoi occhi prima di spuntare.
   */
  rigaOriginale?: string;
}

export interface ClienteEsistente {
  id: string;
  nome: string | null;
  /** Puo' essere null: in rubrica esistono schede senza numero. */
  telefono: string | null;
  email: string | null;
}

/** Numero massimo di righe per import: oltre, meglio due giri che un timeout. */
export const MAX_RIGHE_IMPORT = 500;

/**
 * La forma con cui due numeri si confrontano: solo cifre, senza prefisso
 * internazionale italiano.
 *
 * Perche' si toglie il 39 e non lo si aggiunge: il salone scrive i numeri
 * dei suoi clienti in tutti i modi, e il denominatore comune e' il numero
 * nazionale. Aggiungere un prefisso vorrebbe dire indovinare il paese di chi
 * non l'ha scritto; toglierlo quando c'e' non indovina niente.
 *
 * Il 39 si toglie solo se quello che resta ha una lunghezza plausibile per
 * un numero italiano (9-11 cifre): cosi' un numero che comincia per 39 per
 * conto suo non viene mutilato.
 */
export function telefonoCanonico(valore: string | null | undefined): string {
  const cifre = (valore ?? "").replace(/\D/g, "");
  if (cifre.length === 0) return "";
  if (cifre.startsWith("0039")) return tagliaPrefisso(cifre.slice(4));
  if (cifre.startsWith("39")) return tagliaPrefisso(cifre.slice(2), cifre);
  return cifre;
}

function tagliaPrefisso(senzaPrefisso: string, originale?: string): string {
  if (senzaPrefisso.length >= 9 && senzaPrefisso.length <= 11) return senzaPrefisso;
  return originale ?? senzaPrefisso;
}

/** Due numeri sono la stessa persona? */
export function stessoTelefono(a: string | null, b: string | null): boolean {
  const ca = telefonoCanonico(a);
  const cb = telefonoCanonico(b);
  return ca !== "" && ca === cb;
}

/**
 * Un numero e' utilizzabile per l'import se, ridotto a cifre, ne restano fra
 * 6 e 15. Stessa soglia permissiva di `telefonoPlausibile` in contatti.ts, e
 * per lo stesso motivo: rifiutare un numero valido perche' scritto in un
 * formato che non avevamo previsto costa piu' che accettarne uno strano.
 */
export function telefonoUtilizzabile(valore: string | null | undefined): boolean {
  const cifre = (valore ?? "").replace(/\D/g, "");
  return cifre.length >= 6 && cifre.length <= 15;
}

/**
 * Un campo che CONTIENE un numero non e' un numero (19/09/2026, trovato da
 * Gabriel al primo incolla vero: "Maria la bionda del martedi' 333 123 4568"
 * era diventato un cliente senza nome con tutta la riga come telefono, e non
 * era mai arrivato all'assistente perche' il lettore l'aveva "capito").
 *
 * Qui si estrae il numero dal campo e si guarda cosa resta:
 *  - niente: il campo era il numero;
 *  - fino a tre parole ("Maria Rossi"): e' il nome, si tiene;
 *  - di piu': la riga e' sporca, non si indovina -- torna null e finisce fra
 *    le non capite, dove il modello puo' leggerla e proporre.
 *
 * Fra piu' sequenze di cifre si prende quella con piu' cifre: in "Maria 12
 * Rossi 333 1234567" il numero e' il secondo.
 */
export function estraiTelefonoDaCampo(campo: string): { telefono: string; resto: string } | null {
  const candidati = [...campo.matchAll(/\+?\d[\d\s.\-()\/]*\d/g)]
    .map((m) => m[0])
    .filter((c) => telefonoUtilizzabile(c));
  if (candidati.length === 0) return null;
  const telefono = candidati.sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length)[0];
  const resto = campo.replace(telefono, " ").replace(/\s+/g, " ").trim();
  const parole = resto === "" ? 0 : resto.split(" ").length;
  if (parole > 3) return null;
  return { telefono: telefono.trim(), resto };
}

const INTESTAZIONI_NOME = ["nome", "cliente", "nominativo", "name", "nome e cognome", "cognome e nome"];
const INTESTAZIONI_TELEFONO = ["telefono", "cellulare", "tel", "cell", "phone", "numero", "mobile"];
const INTESTAZIONI_EMAIL = ["email", "e-mail", "mail", "posta"];
const INTESTAZIONI_NOTE = ["note", "nota", "appunti", "commento", "notes"];

function indiceColonna(intestazioni: string[], candidati: string[]): number {
  return intestazioni.findIndex((h) => candidati.includes(h.trim().toLowerCase()));
}

/**
 * Divide una riga su virgola, punto e virgola o tabulazione -- quale dei tre
 * lo decide la riga stessa, contando quale separatore compare di piu'. Un
 * incolla da Excel usa le tabulazioni, un CSV italiano spesso il punto e
 * virgola (perche' la virgola e' il separatore decimale), un export inglese
 * la virgola.
 *
 * Le virgolette si rispettano: "Rossi, Maria";333... e' due campi, non tre.
 */
export function dividiRiga(riga: string): string[] {
  const separatore = scegliSeparatore(riga);
  const campi: string[] = [];
  let corrente = "";
  let dentroVirgolette = false;

  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (c === '"') {
      // Due virgolette di fila dentro un campo valgono una virgoletta.
      if (dentroVirgolette && riga[i + 1] === '"') {
        corrente += '"';
        i++;
        continue;
      }
      dentroVirgolette = !dentroVirgolette;
      continue;
    }
    if (c === separatore && !dentroVirgolette) {
      campi.push(corrente.trim());
      corrente = "";
      continue;
    }
    corrente += c;
  }
  campi.push(corrente.trim());
  return campi;
}

function scegliSeparatore(riga: string): string {
  const conteggi: [string, number][] = [
    ["\t", (riga.match(/\t/g) ?? []).length],
    [";", (riga.match(/;/g) ?? []).length],
    [",", (riga.match(/,/g) ?? []).length],
  ];
  conteggi.sort((a, b) => b[1] - a[1]);
  return conteggi[0][1] > 0 ? conteggi[0][0] : "\t";
}

export interface EsitoLettura {
  clienti: ClienteImportato[];
  /** Righe che contenevano qualcosa ma nessun numero utilizzabile. */
  scartate: string[];
}

/**
 * Legge un incolla senza modello. Restituisce anche le righe SCARTATE: chi
 * importa deve poter vedere cosa non e' entrato, se no "180 su 200" e' un
 * numero che non si puo' controllare.
 */
export function leggiIncolla(testo: string): EsitoLettura {
  const righe = (testo ?? "")
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r !== "");
  if (righe.length === 0) return { clienti: [], scartate: [] };

  const intestazioni = dividiRiga(righe[0]);
  const iNome = indiceColonna(intestazioni, INTESTAZIONI_NOME);
  const iTel = indiceColonna(intestazioni, INTESTAZIONI_TELEFONO);
  const conIntestazione = iTel !== -1 || (iNome !== -1 && intestazioni.length > 1);

  const iEmail = conIntestazione ? indiceColonna(intestazioni, INTESTAZIONI_EMAIL) : -1;
  const iNote = conIntestazione ? indiceColonna(intestazioni, INTESTAZIONI_NOTE) : -1;
  const corpo = conIntestazione ? righe.slice(1) : righe;

  const clienti: ClienteImportato[] = [];
  const scartate: string[] = [];
  const visti = new Set<string>();

  for (const riga of corpo) {
    const campi = dividiRiga(riga);
    const letto = conIntestazione
      ? leggiConIntestazione(campi, iNome, iTel, iEmail, iNote)
      : leggiSenzaIntestazione(campi);

    if (!letto) {
      scartate.push(riga);
      continue;
    }
    // Un doppione DENTRO lo stesso incolla non e' un errore da segnalare:
    // le rubriche esportate a mano ne sono piene. Si tiene il primo.
    const chiave = telefonoCanonico(letto.telefono);
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    clienti.push(letto);
    if (clienti.length >= MAX_RIGHE_IMPORT) break;
  }

  return { clienti, scartate };
}

function leggiConIntestazione(
  campi: string[],
  iNome: number,
  iTel: number,
  iEmail: number,
  iNote: number
): ClienteImportato | null {
  const campoTelefono = iTel !== -1 ? campi[iTel] : campi.find((c) => estraiTelefonoDaCampo(c) !== null);
  const estratto = campoTelefono !== undefined ? estraiTelefonoDaCampo(campoTelefono) : null;
  if (!estratto) return null;
  return {
    nome: pulisci(iNome !== -1 ? campi[iNome] : estratto.resto || null),
    telefono: estratto.telefono,
    email: pulisciEmail(iEmail !== -1 ? campi[iEmail] : null),
    note: pulisci(iNote !== -1 ? campi[iNote] : null),
  };
}

/**
 * Senza intestazione si va a naso, ma con una regola sola: il campo che
 * sembra un numero e' il telefono, quello che ha una chiocciola e' l'email,
 * il piu' lungo fra i restanti e' il nome. Nessuna magia, e nessun campo
 * indovinato: quello che non si capisce resta fuori e si vede in revisione.
 */
function leggiSenzaIntestazione(campi: string[]): ClienteImportato | null {
  const campoTelefono = campi.find((c) => estraiTelefonoDaCampo(c) !== null);
  if (campoTelefono === undefined) return null;
  const estratto = estraiTelefonoDaCampo(campoTelefono)!;
  const email = campi.find((c) => c.includes("@"));
  const nomeDaAltriCampi = campi
    .filter((c) => c !== campoTelefono && c !== email && estraiTelefonoDaCampo(c) === null)
    .sort((a, b) => b.length - a.length)[0];
  // Il nome sta in un altro campo se c'e'; altrimenti e' quello che restava
  // accanto al numero ("Maria Rossi 333 1234567" senza separatori).
  return {
    nome: pulisci(nomeDaAltriCampi ?? estratto.resto ?? null),
    telefono: estratto.telefono,
    email: pulisciEmail(email ?? null),
    note: null,
  };
}

function pulisci(valore: string | null | undefined): string | null {
  const v = (valore ?? "").trim();
  return v === "" ? null : v.slice(0, 200);
}

function pulisciEmail(valore: string | null | undefined): string | null {
  const v = (valore ?? "").trim().toLowerCase();
  if (!v.includes("@") || v.length < 5) return null;
  return v.slice(0, 200);
}

export interface RigaImport extends ClienteImportato {
  /** Id del cliente gia' presente con lo stesso numero, se c'e'. */
  esistenteId: string | null;
  /** Come si chiama oggi nel prodotto: serve a mostrare cosa cambierebbe. */
  nomeEsistente: string | null;
  emailEsistente: string | null;
  /**
   * Cosa l'import AGGIUNGEREBBE a un cliente gia' presente, campo per campo:
   * solo dove nel prodotto quel campo e' vuoto e nel file c'e'. Mai una
   * sovrascrittura -- un nome corretto a mano dal salone non si tocca con uno
   * preso da un file vecchio (19/09/2026, la meta' "aggiorna chi c'e' gia'"
   * dell'import).
   */
  completabile: { nome: boolean; email: boolean };
  /** La riga e' stata ricostruita dal modello a partire da una riga non capita: si vede, e parte non spuntata. */
  propostoDallAi?: boolean;
}

export interface DiffImport {
  nuovi: RigaImport[];
  giaPresenti: RigaImport[];
  scartate: string[];
}

/**
 * Confronta quello che si vuole importare con quello che c'e' gia'.
 *
 * Non decide niente: separa. Chi e' gia' in rubrica finisce in una lista a
 * parte e in revisione parte NON spuntato, perche' reimportare un cliente
 * esistente vuol dire sovrascrivere un nome che magari il salone ha gia'
 * corretto a mano. Stessa regola del diff dell'onboarding: il silenzio non
 * e' un ordine, e nemmeno un elenco incollato lo e'.
 */
export function calcolaDiffImport(
  esistenti: ClienteEsistente[],
  esito: EsitoLettura
): DiffImport {
  const perTelefono = new Map<string, ClienteEsistente>();
  for (const c of esistenti) {
    const chiave = telefonoCanonico(c.telefono);
    if (chiave !== "" && !perTelefono.has(chiave)) perTelefono.set(chiave, c);
  }

  const nuovi: RigaImport[] = [];
  const giaPresenti: RigaImport[] = [];

  for (const cliente of esito.clienti) {
    const esistente = perTelefono.get(telefonoCanonico(cliente.telefono));
    const riga: RigaImport = {
      ...cliente,
      esistenteId: esistente?.id ?? null,
      nomeEsistente: esistente?.nome ?? null,
      emailEsistente: esistente?.email ?? null,
      completabile: {
        nome: !!esistente && vuoto(esistente.nome) && !vuoto(cliente.nome),
        email: !!esistente && vuoto(esistente.email) && !vuoto(cliente.email),
      },
    };
    if (esistente) giaPresenti.push(riga);
    else nuovi.push(riga);
  }

  return { nuovi, giaPresenti, scartate: esito.scartate };
}

function vuoto(valore: string | null | undefined): boolean {
  return !valore || valore.trim() === "";
}

/** true se per questo cliente gia' presente c'e' almeno un campo da riempire. */
export function haQualcosaDaCompletare(riga: RigaImport): boolean {
  return riga.completabile.nome || riga.completabile.email;
}

/**
 * I soli campi da scrivere su un cliente esistente: quelli vuoti nel
 * prodotto e presenti nel file. Il server li ricalcola e non si fida di
 * `completabile` cosi' com'e' arrivato dal browser -- ma il filtro finale
 * (`nome is null`) lo mette la query, vedi clienti.server.ts.
 */
export function campiDaCompletare(riga: RigaImport): { nome?: string; email?: string } {
  const campi: { nome?: string; email?: string } = {};
  if (riga.completabile.nome && !vuoto(riga.nome)) campi.nome = riga.nome!.trim();
  if (riga.completabile.email && !vuoto(riga.email)) campi.email = riga.email!.trim();
  return campi;
}
