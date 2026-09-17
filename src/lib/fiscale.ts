/**
 * Validazione di partita IVA e codice fiscale italiani -- pura, zero
 * dipendenze, testabile.
 *
 * Perché serve, anche se Stripe già controlla la partita IVA: Stripe ne
 * verifica il formato e, per le partite IVA europee, l'esistenza tramite
 * VIES. Quello che Stripe non conosce affatto è il **codice fiscale**, che è
 * l'unico identificativo di un cliente senza partita IVA -- e un cliente
 * senza partita IVA è perfettamente normale, anche se raro nel nostro caso
 * (un'associazione, qualcuno che compra a titolo personale).
 *
 * L'errore che queste due funzioni intercettano è il refuso, ed è il più
 * frequente. Un identificativo sbagliato non produce un problema fiscale
 * immediato: produce una fattura elettronica **scartata dallo SdI** o
 * recapitata a qualcun altro, e la si scopre giorni dopo, quando è già stata
 * contata come emessa. Controllarlo nel momento in cui viene digitato costa
 * niente; ricostruirlo dopo costa una nota di variazione.
 *
 * Nessuna delle due funzione garantisce che l'identificativo sia DI QUELLA
 * persona, né che esista: verificano solo che sia ben formato e che il
 * carattere di controllo torni. È il livello giusto per un campo di un
 * modulo -- l'esistenza la accerta lo SdI, e per le partite IVA europee
 * Stripe con VIES.
 */

/**
 * Partita IVA italiana: 11 cifre, ultima di controllo secondo l'algoritmo di
 * Luhn nella variante italiana (le cifre in posizione pari, contando da 1,
 * si raddoppiano e si sommano le cifre del risultato).
 */
export function partitaIvaValida(valore: string): boolean {
  const piva = valore.replace(/\s/g, "");
  if (!/^\d{11}$/.test(piva)) return false;

  let somma = 0;
  for (let i = 0; i < 10; i += 1) {
    const cifra = Number(piva[i]);
    if (i % 2 === 0) {
      somma += cifra;
    } else {
      const doppio = cifra * 2;
      somma += doppio > 9 ? doppio - 9 : doppio;
    }
  }
  const controllo = (10 - (somma % 10)) % 10;
  return controllo === Number(piva[10]);
}

// Tabelle del carattere di controllo del codice fiscale (DM 23/12/1976).
// Le posizioni si contano da 1: i caratteri in posizione DISPARI usano la
// tabella "dispari", quelli in posizione pari il valore ordinario.
const VALORI_DISPARI: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const VALORI_PARI: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
  N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const LETTERE_CONTROLLO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Codice fiscale di una persona fisica: 16 caratteri, con il sedicesimo che
 * è il carattere di controllo dei primi quindici.
 *
 * NON copre il codice fiscale numerico a 11 cifre di enti e società: quello
 * ha la stessa forma di una partita IVA e va validato con `partitaIvaValida`.
 */
export function codiceFiscaleValido(valore: string): boolean {
  const cf = valore.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(cf)) return false;

  let somma = 0;
  for (let i = 0; i < 15; i += 1) {
    const carattere = cf[i];
    // i è 0-based: le posizioni dispari (1ª, 3ª, ...) hanno i pari.
    const valoreCarattere = i % 2 === 0 ? VALORI_DISPARI[carattere] : VALORI_PARI[carattere];
    if (valoreCarattere === undefined) return false;
    somma += valoreCarattere;
  }
  return LETTERE_CONTROLLO[somma % 26] === cf[15];
}

/**
 * Accetta l'uno o l'altro: è quello che serve a un modulo che chiede "il tuo
 * identificativo fiscale" a chi può avere la partita IVA oppure no. Il
 * codice fiscale numerico degli enti passa dal ramo partita IVA, che ne
 * condivide formato e controllo.
 */
export function identificativoFiscaleValido(valore: string): boolean {
  return partitaIvaValida(valore) || codiceFiscaleValido(valore);
}
