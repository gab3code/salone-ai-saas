import { partitaIvaValida } from "./fiscale";

/**
 * I dati che servono per emettere la fattura elettronica a un'attività, e la
 * loro validazione -- pura, così la stessa identica regola vale nel modulo,
 * nella server action e (domani) nel punto in cui si compone l'XML.
 *
 * Perché sono tutti obbligatori: il blocco `CessionarioCommittente` della
 * fattura elettronica li vuole tutti. Un dato mancante non si scopre quando
 * lo si salva, si scopre quando lo SdI scarta il file -- giorni dopo, a
 * fattura già contata come emessa, e per rimediare serve una nota di
 * variazione. Chiederli prima del pagamento costa trenta secondi a chi li ha
 * sottomano perché li usa tutti i giorni.
 *
 * Il codice destinatario e la PEC sono l'uno alternativo all'altra: ne basta
 * uno, e "0000000" è un valore legittimo che significa "consegnamela nel
 * cassetto fiscale". Per questo la regola è "almeno uno dei due" e non due
 * campi obbligatori: nessuno ha entrambi.
 */
export type DatiFatturazione = {
  denominazione: string;
  partitaIva: string;
  via: string;
  cap: string;
  comune: string;
  provincia: string;
  codiceDestinatario: string;
  pec: string;
};

export type ErroriFatturazione = Partial<Record<keyof DatiFatturazione, string>>;

const PEC_PLAUSIBILE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizzaDatiFatturazione(dati: DatiFatturazione): DatiFatturazione {
  return {
    denominazione: dati.denominazione.trim(),
    // Il prefisso IT lo scrivono in tanti: si toglie invece di rifiutarlo.
    partitaIva: dati.partitaIva.replace(/\s/g, "").replace(/^IT/i, ""),
    via: dati.via.trim(),
    cap: dati.cap.replace(/\s/g, ""),
    comune: dati.comune.trim(),
    provincia: dati.provincia.trim().toUpperCase(),
    codiceDestinatario: dati.codiceDestinatario.replace(/\s/g, "").toUpperCase(),
    pec: dati.pec.trim().toLowerCase(),
  };
}

/**
 * Restituisce un errore per campo, non il primo che trova: un modulo che
 * segnala un problema alla volta si compila tre volte invece di una.
 */
export function validaDatiFatturazione(dati: DatiFatturazione): ErroriFatturazione {
  const errori: ErroriFatturazione = {};

  if (!dati.denominazione) {
    errori.denominazione = "Serve la ragione sociale, come risulta alla tua partita IVA.";
  }
  if (!dati.partitaIva) errori.partitaIva = "La partita IVA è obbligatoria.";
  else if (!partitaIvaValida(dati.partitaIva)) {
    errori.partitaIva = "Questa partita IVA non è valida: ricontrollala, una cifra non torna.";
  }

  if (!dati.via) errori.via = "Serve l'indirizzo, via e numero civico.";
  if (!/^\d{5}$/.test(dati.cap)) errori.cap = "Il CAP è di 5 cifre.";
  if (!dati.comune) errori.comune = "Serve il comune.";
  if (!/^[A-Z]{2}$/.test(dati.provincia)) {
    errori.provincia = "La provincia è la sigla di 2 lettere, es. BG.";
  }

  const haCodice = dati.codiceDestinatario.length > 0;
  const haPec = dati.pec.length > 0;
  if (!haCodice && !haPec) {
    errori.codiceDestinatario =
      "Serve il codice destinatario oppure la PEC. Se non li conosci scrivi 0000000: la fattura ti arriverà nel cassetto fiscale dell'Agenzia delle Entrate.";
  }
  if (haCodice && !/^[A-Z0-9]{6,7}$/.test(dati.codiceDestinatario)) {
    errori.codiceDestinatario = "Il codice destinatario è di 6 o 7 caratteri, solo lettere e numeri.";
  }
  if (haPec && !PEC_PLAUSIBILE.test(dati.pec)) {
    errori.pec = "Questa PEC non sembra un indirizzo valido.";
  }

  return errori;
}

export function datiFatturazioneCompleti(dati: DatiFatturazione): boolean {
  return Object.keys(validaDatiFatturazione(normalizzaDatiFatturazione(dati))).length === 0;
}

/** Dati vuoti, per il primo caricamento del modulo. */
export const DATI_FATTURAZIONE_VUOTI: DatiFatturazione = {
  denominazione: "",
  partitaIva: "",
  via: "",
  cap: "",
  comune: "",
  provincia: "",
  codiceDestinatario: "",
  pec: "",
};
