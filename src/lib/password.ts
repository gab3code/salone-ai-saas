/**
 * Regole sulla password, in un posto solo.
 *
 * Supabase accetta di default 6 caratteri. Qui se ne chiedono 8, non per
 * gusto della severita' ma perche' dietro questa password c'e' l'agenda di
 * un'attivita' e i dati dei suoi clienti. Niente obbligo di maiuscole,
 * numeri e simboli: fa scegliere password piu' corte e piu' prevedibili,
 * non piu' sicure, e le fa scrivere sul post-it accanto alla cassa.
 *
 * Ritorna il messaggio da mostrare, oppure null se va bene. Il messaggio e'
 * gia' in italiano e gia' rivolto all'utente: chi chiama lo stampa e basta.
 */

export const LUNGHEZZA_MINIMA_PASSWORD = 8;

export function problemaPassword(password: string): string | null {
  if (typeof password !== "string" || password.trim() === "") {
    return "Scrivi una password.";
  }
  if (password.length < LUNGHEZZA_MINIMA_PASSWORD) {
    return `La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri.`;
  }
  return null;
}

/**
 * Le due password del form di reimpostazione. Separata da
 * `problemaPassword` perche' il controllo di uguaglianza ha senso solo
 * dove ci sono due campi.
 */
export function problemaPasswordRipetuta(password: string, ripetuta: string): string | null {
  const problema = problemaPassword(password);
  if (problema) return problema;
  if (password !== ripetuta) return "Le due password non coincidono.";
  return null;
}
