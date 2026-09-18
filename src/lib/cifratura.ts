import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Cifratura a riposo dei segreti che non sono nostri.
 *
 * Nella tabella `collegamenti_calendario_esterni` ci sono due cose che non
 * appartengono a Salone AI: la password specifica per app del calendario
 * iCloud di un'operatrice, e il refresh token Google del suo account
 * personale. Non sono dati del prodotto -- sono le chiavi di casa di una
 * persona, lasciate in custodia.
 *
 * Fino a oggi stavano in chiaro, e la nota nella migrazione 0008 lo diceva
 * ("da risolvere entro la revisione di Fase 6"). In chiaro vuol dire che
 * chiunque possa leggere quella riga -- un collega della stessa attivita'
 * attraverso PostgREST, un backup finito nel posto sbagliato, chiunque
 * metta le mani sul database -- si porta via l'accesso al calendario
 * personale di qualcun altro. Non a un dato del salone: all'agenda privata
 * di una persona, con dentro i suoi appuntamenti dal medico.
 *
 * Cifrare NON e' una difesa contro chi ha la service_role key: quella legge
 * anche la chiave di cifratura. E' una difesa contro tutti gli altri modi in
 * cui una riga di database finisce dove non dovrebbe -- che sono la maggior
 * parte.
 *
 * AES-256-GCM: cifra e autentica insieme, quindi una riga modificata non si
 * decifra in silenzio, fallisce. La chiave sta in `SALONE_CHIAVE_CIFRATURA`,
 * mai nel repo.
 *
 * ----------------------------------------------------------------------
 * LA SCELTA CHE RENDE SICURO IL PASSAGGIO: `decifra` accetta anche il testo
 * in chiaro.
 *
 * Nel database ci sono gia' righe non cifrate. Se `decifra` pretendesse il
 * formato nuovo, nel momento del deploy tutti i calendari gia' collegati
 * smetterebbero di sincronizzare insieme -- e un'operatrice si troverebbe
 * l'agenda che non vede piu' i suoi impegni, senza capire perche'. Invece un
 * valore che non ha il nostro prefisso torna com'e': quelle righe continuano
 * a funzionare e si cifrano da sole alla prima riscrittura. Nessun giorno
 * zero, nessuna finestra in cui il prodotto e' rotto.
 *
 * Il prezzo, detto chiaramente: finche' esistono righe vecchie, restano in
 * chiaro. `npm run cifra-credenziali` le converte tutte in una volta -- e
 * finche' non e' stato lanciato, il lavoro e' fatto a meta'.
 *
 * ----------------------------------------------------------------------
 * Perche' qui NON c'e' `import "server-only"`, a differenza degli altri file
 * che toccano segreti: questo modulo lo usano anche gli script da riga di
 * comando (`npm run cifra-credenziali`), che girano in Node puro e non
 * dentro il bundler di Next -- li' `server-only` lancia sempre.
 *
 * La protezione resta, per due motivi indipendenti: `node:crypto` non si
 * risolve in un bundle browser, quindi un import lato client fallisce subito
 * e rumorosamente; e la chiave sta in una variabile SENZA il prefisso
 * `NEXT_PUBLIC_`, quindi Next non la incorpora mai nel codice che arriva al
 * browser. Chi aggiunge qui una funzione che non usa `node:crypto` si
 * ricordi che il primo dei due motivi smette di valere.
 */

/**
 * Solo quello che serve leggere, non `NodeJS.ProcessEnv`: cosi' i test
 * passano un ambiente finto senza doverne inventare tutti i campi. Stessa
 * scelta di `risolviDatabaseDiProva`.
 */
type Ambiente = Record<string, string | undefined>;

const PREFISSO = "v1";
const ALGORITMO = "aes-256-gcm";
const BYTE_CHIAVE = 32;
const BYTE_IV = 12;

export const NOME_VARIABILE_CHIAVE = "SALONE_CHIAVE_CIFRATURA";

export class ChiaveMancante extends Error {
  constructor() {
    super(
      `${NOME_VARIABILE_CHIAVE} non configurata: senza non si possono salvare le credenziali dei calendari. ` +
        `Generane una con: openssl rand -base64 32`
    );
    this.name = "ChiaveMancante";
  }
}

/** La chiave, letta e validata. Lancia se manca o se non e' lunga giusta. */
export function chiaveCifratura(env: Ambiente = process.env): Buffer {
  const grezza = env[NOME_VARIABILE_CHIAVE];
  if (!grezza) throw new ChiaveMancante();

  const chiave = Buffer.from(grezza, "base64");
  if (chiave.length !== BYTE_CHIAVE) {
    throw new Error(
      `${NOME_VARIABILE_CHIAVE} deve essere 32 byte in base64 (ne ho letti ${chiave.length}). ` +
        `Generane una con: openssl rand -base64 32`
    );
  }
  return chiave;
}

/** true se il valore e' gia' nel nostro formato cifrato. */
export function eCifrato(valore: string | null | undefined): boolean {
  return typeof valore === "string" && valore.startsWith(`${PREFISSO}.`) && valore.split(".").length === 4;
}

export function cifra(testo: string | null | undefined, env: Ambiente = process.env): string | null {
  if (testo === null || testo === undefined || testo === "") return null;
  // Gia' cifrato: non si cifra due volte, si sprecherebbe solo spazio e si
  // renderebbe il valore indecifrabile con un giro solo.
  if (eCifrato(testo)) return testo;

  const chiave = chiaveCifratura(env);
  const iv = randomBytes(BYTE_IV);
  const cifratore = createCipheriv(ALGORITMO, chiave, iv);
  const cifrato = Buffer.concat([cifratore.update(testo, "utf8"), cifratore.final()]);
  const tag = cifratore.getAuthTag();

  return [PREFISSO, iv.toString("base64"), tag.toString("base64"), cifrato.toString("base64")].join(".");
}

/**
 * Riporta in chiaro. Un valore che NON e' nel nostro formato torna
 * identico: sono le righe scritte prima della cifratura, e devono continuare
 * a funzionare (vedi la nota lunga in cima).
 */
export function decifra(valore: string | null | undefined, env: Ambiente = process.env): string | null {
  if (valore === null || valore === undefined || valore === "") return null;
  if (!eCifrato(valore)) return valore;

  const [, ivB64, tagB64, cifratoB64] = valore.split(".");
  const chiave = chiaveCifratura(env);
  const decifratore = createDecipheriv(ALGORITMO, chiave, Buffer.from(ivB64, "base64"));
  decifratore.setAuthTag(Buffer.from(tagB64, "base64"));

  // Se la riga e' stata manomessa o la chiave e' un'altra, `final()` lancia:
  // e' il punto di GCM, e va lasciato lanciare invece che ingoiato.
  return Buffer.concat([decifratore.update(Buffer.from(cifratoB64, "base64")), decifratore.final()]).toString(
    "utf8"
  );
}

/**
 * Confronto a tempo costante fra due segreti. Non serve alla cifratura: serve
 * dove si confronta un token ricevuto con uno salvato, perche' un `===` su
 * stringhe esce al primo carattere diverso e quel tempo si misura.
 */
export function segretiUguali(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
