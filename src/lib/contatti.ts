/**
 * I recapiti dell'attività, e come si scrivono in un messaggio.
 *
 * Nasce il 17/09/2026 con una decisione precisa di Gabriel: quando
 * l'assistente AI non sa risolvere qualcosa, non promette una richiamata e
 * non manda un'email a nessuno -- dà al cliente il modo di farsi sentire
 * subito, sul canale dove il salone lavora già. Telefono sempre, WhatsApp
 * quando c'è (per molte attività è lo stesso numero, per altre no).
 *
 * Logica pura, zero query e zero dipendenze da Supabase: la usano il
 * costruttore del prompt AI, il modulo delle impostazioni e il widget di
 * chat, che girano in tre posti diversi (server, server action, browser).
 */

/** Cosa sa l'attività di sé stessa in fatto di recapiti. */
export type RecapitiAttivita = {
  telefono: string | null;
  telefonoWhatsapp: string | null;
};

/**
 * Prefisso telefonico usato quando il numero non ne porta uno.
 *
 * Il prodotto è venduto in Italia e i dati di fatturazione sono riservati a
 * chi ha una partita IVA italiana, quindi assumere +39 su un numero scritto
 * "3331234567" è corretto qui e sarebbe sbagliato altrove. Chi ha un numero
 * estero scrive il suo prefisso e viene rispettato.
 */
const PREFISSO_PREDEFINITO = "39";

/**
 * Ripulisce un numero per mostrarlo: toglie gli spazi doppi e i caratteri
 * che non sono cifre, `+`, spazio, punto, trattino o parentesi. NON
 * riscrive il numero in un formato canonico -- un titolare che scrive
 * "02 1234 5678" deve continuare a vederlo così nelle impostazioni.
 */
export function normalizzaTelefonoVisibile(valore: string): string {
  return valore.replace(/[^\d+\s.\-()]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Un numero è plausibile se, tolto tutto tranne le cifre, ne restano fra 6 e
 * 15 (E.164 ne ammette al massimo 15, prefisso incluso).
 *
 * Volutamente permissivo: questo campo non alimenta nessun invio automatico,
 * serve a comporre un link e a essere letto da una persona. Rifiutare un
 * numero valido perché scritto in un formato che non avevamo previsto costa
 * molto più che accettarne uno un po' strano.
 */
export function telefonoPlausibile(valore: string): boolean {
  const cifre = valore.replace(/\D/g, "");
  return cifre.length >= 6 && cifre.length <= 15;
}

/**
 * Il numero nella forma che vuole `wa.me`: sole cifre, prefisso
 * internazionale incluso, nessun `+`.
 *
 * `null` quando il numero non è utilizzabile -- meglio nessun link che un
 * link che apre WhatsApp su una conversazione con nessuno.
 */
export function numeroPerWhatsapp(valore: string | null): string | null {
  if (!valore) return null;
  const grezzo = valore.trim();
  if (!telefonoPlausibile(grezzo)) return null;

  let cifre = grezzo.replace(/\D/g, "");

  // "+39...", "0039..." e "39..." arrivano tutti e tre: il primo perde il
  // `+` con la riga sopra, il secondo va sbucciato, il terzo è già a posto.
  if (grezzo.startsWith("00")) cifre = cifre.slice(2);

  // Nessun prefisso internazionale riconoscibile: numero italiano scritto
  // come lo scrive un italiano. Il controllo è sulla forma originale (un `+`
  // davanti) e non sulle cifre, perché "39" può benissimo essere l'inizio di
  // un numero di cellulare italiano senza prefisso (393...).
  const haPrefisso = grezzo.startsWith("+") || grezzo.startsWith("00");
  if (!haPrefisso) cifre = PREFISSO_PREDEFINITO + cifre;

  return cifre.length >= 8 && cifre.length <= 15 ? cifre : null;
}

/** Link diretto alla chat WhatsApp dell'attività, o `null`. */
export function linkWhatsapp(valore: string | null): string | null {
  const numero = numeroPerWhatsapp(valore);
  return numero ? `https://wa.me/${numero}` : null;
}

/**
 * La frase che l'assistente può usare per scaricare la palla su una
 * persona, costruita sui recapiti che l'attività ha davvero configurato.
 *
 * Restituisce `null` quando non c'è nessun recapito: in quel caso chi
 * costruisce il prompt deve ripiegare su "contatta l'attività direttamente",
 * che è vago ma non falso. Non inventiamo un numero, e non promettiamo un
 * canale che il salone non ha.
 *
 * Il numero WhatsApp viene nominato solo se è DIVERSO dal telefono: dire
 * "chiama il 333... o scrivici su WhatsApp al 333..." con lo stesso numero
 * ripetuto due volte fa sembrare l'assistente rotto. Quando coincidono la
 * frase diventa "chiama o scrivi su WhatsApp al 333...", che è anche come
 * lo direbbe una persona.
 */
export function istruzioniContatto(recapiti: RecapitiAttivita): string | null {
  const telefono = recapiti.telefono?.trim() || null;
  const whatsapp = recapiti.telefonoWhatsapp?.trim() || null;

  const stessoNumero =
    telefono && whatsapp && numeroPerWhatsapp(telefono) === numeroPerWhatsapp(whatsapp);

  if (telefono && whatsapp && stessoNumero) {
    return `chiamare o scrivere su WhatsApp al ${telefono}`;
  }
  if (telefono && whatsapp) {
    return `chiamare il ${telefono} oppure scrivere su WhatsApp al ${whatsapp}`;
  }
  if (whatsapp) {
    return `scrivere su WhatsApp al ${whatsapp}`;
  }
  if (telefono) {
    return `chiamare il ${telefono}`;
  }
  return null;
}
