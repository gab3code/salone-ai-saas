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

// Il codice fiscale non vive più qui (17/09/2026).
//
// `codiceFiscaleValido` e `identificativoFiscaleValido` erano state scritte
// la mattina del 17/09, quando l'idea era vendere anche a chi non ha partita
// IVA. Poche ore dopo la decisione è cambiata -- i piani a pagamento sono
// riservati a chi ha una partita IVA -- e da allora l'unico chiamante di
// entrambe era il loro file di test. Tolte insieme alla colonna
// `tenants.codice_fiscale` (migrazione 0036): git le conserva per intero, e
// il giorno in cui si vorrà davvero vendere ai privati serviranno comunque
// un checkout e un modulo diversi, non solo queste due funzioni.
