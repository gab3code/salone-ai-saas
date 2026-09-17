/**
 * Il salone della demo: una COSTANTE, non delle righe nel database.
 *
 * E' la terza forma della demo in un giorno, e le prime due sono state
 * buttate per lo stesso motivo -- erano tenant veri. Un tenant demo e'
 * indistinguibile da un salone vero per il resto del sistema (va escluso a
 * mano da ogni metrica e da ogni job, per sempre) e il suo link pubblico si
 * puo' dare in giro, con clienti che prenotano davvero e si presentano a un
 * appuntamento che la pulizia ha cancellato. Vedi
 * `docs/brief-demo-senza-rischi.md` per il ragionamento intero.
 *
 * Qui non si scrive niente da nessuna parte. Il salone vive nel codice,
 * l'agenda vive nella sessione di chi sta guardando, e quando la scheda si
 * chiude non resta niente. Nessun tenant, nessun appuntamento, nessun
 * cliente, nessuna conversazione, nessuna pulizia da programmare, nessuna
 * esclusione da ricordarsi in ogni funzione futura.
 *
 * Quello che NON si perde: l'assistente resta vero. Risponde col modello, e
 * la disponibilita' la calcola `calcolaSlotDisponibili` -- la stessa identica
 * funzione pura del motore di prenotazione, non una copia che le somiglia.
 * E' il dettaglio che rende questa scelta onesta: se quella logica fosse
 * sepolta dentro le query, una demo a dati finti sarebbe un secondo motore
 * destinato a divergere.
 *
 * GLI ID SONO UUID VERI, e non e' un dettaglio estetico: gli strumenti
 * dell'assistente validano il formato (`eUuidValido` in tools.ts) e
 * rifiutano un id che non lo sia. Con id finti tipo "servizio-1" la demo si
 * comporterebbe diversamente dal prodotto proprio nel punto piu' delicato.
 *
 * I dati sono verosimili ma inventati: nomi di battesimo senza cognome, una
 * via che non esiste, e NESSUN NUMERO DI TELEFONO -- un numero inventato
 * appartiene quasi sempre a qualcuno.
 */

import type { OrarioGiorno, Operatore } from "@/lib/booking-engine";

export interface ServizioFinto {
  id: string;
  nome: string;
  descrizione: string;
  categoria: string;
  durataMinuti: number;
  prezzoCentesimi: number;
}

export interface OperatoreFinto {
  id: string;
  nome: string;
  ruolo: string;
  servizioIds: string[];
}

export const NOME_SALONE_DEMO = "Atelier Camelia";
export const INDIRIZZO_SALONE_DEMO = "Via delle Camelie 7, Milano";
export const DESCRIZIONE_SALONE_DEMO =
  "Parrucchiere e centro estetico nel cuore del quartiere. Taglio, colore e trattamenti su misura, senza fretta.";
export const FUSO_ORARIO_DEMO = "Europe/Rome";

const S = {
  taglioDonna: "e8ebe49e-e911-4036-b741-60095af88b9c",
  piega: "1feaad58-7dfc-4748-96bd-054226d6b758",
  colore: "58e797c8-8235-4a80-8ac9-b1f130b3e0b9",
  taglioUomo: "51a17cc5-713f-40cd-a1fb-2d0c4dda9ae8",
  barba: "e8178ca8-4bb6-4ac7-972c-9db3d925dca4",
  manicure: "54b66875-0801-4880-8295-ad1586688e2f",
} as const;

export const SERVIZI_DEMO: readonly ServizioFinto[] = [
  { id: S.barba, nome: "Barba", descrizione: "Rifinitura barba con panno caldo.", categoria: "Barba", durataMinuti: 20, prezzoCentesimi: 1500 },
  { id: S.colore, nome: "Colore", descrizione: "Colorazione completa con trattamento finale.", categoria: "Capelli", durataMinuti: 90, prezzoCentesimi: 6500 },
  { id: S.manicure, nome: "Manicure", descrizione: "Limatura, cura delle cuticole e smalto.", categoria: "Mani", durataMinuti: 45, prezzoCentesimi: 2500 },
  { id: S.piega, nome: "Piega", descrizione: "Lavaggio e messa in piega.", categoria: "Capelli", durataMinuti: 30, prezzoCentesimi: 2000 },
  { id: S.taglioDonna, nome: "Taglio donna", descrizione: "Consulenza, lavaggio, taglio e piega.", categoria: "Capelli", durataMinuti: 45, prezzoCentesimi: 3500 },
  { id: S.taglioUomo, nome: "Taglio uomo", descrizione: "Taglio e sistemazione, lavaggio incluso.", categoria: "Capelli", durataMinuti: 30, prezzoCentesimi: 2000 },
];

/**
 * Chi fa cosa. Non sanno fare tutti tutto di proposito: se lo sapessero, la
 * capacita' dell'assistente di proporre l'operatore GIUSTO resterebbe
 * invisibile, e quella e' una delle cose che vogliamo far vedere.
 */
export const OPERATORI_DEMO: readonly OperatoreFinto[] = [
  { id: "deb7b62a-3d5b-44bd-80b8-7a9cebad51ed", nome: "Giulia", ruolo: "Colorista", servizioIds: [S.taglioDonna, S.piega, S.colore, S.manicure] },
  { id: "13883f2b-29a8-42cd-8b5d-f897dec4f670", nome: "Luca", ruolo: "Barbiere", servizioIds: [S.taglioUomo, S.barba] },
  { id: "1b848c27-5c29-4f3b-9de0-b7cae69d5be6", nome: "Marta", ruolo: "Parrucchiera", servizioIds: [S.taglioDonna, S.piega, S.colore, S.manicure] },
];

/** Chiuso domenica e lunedi', 09:00-19:00 con pausa 13:00-14:00. 0 = domenica. */
export const ORARI_DEMO: readonly OrarioGiorno[] = [0, 1, 2, 3, 4, 5, 6].map((giorno) => ({
  giornoSettimana: giorno,
  chiuso: giorno === 0 || giorno === 1,
  apertura: giorno === 0 || giorno === 1 ? undefined : "09:00",
  chiusura: giorno === 0 || giorno === 1 ? undefined : "19:00",
  pausaInizio: giorno === 0 || giorno === 1 ? undefined : "13:00",
  pausaFine: giorno === 0 || giorno === 1 ? undefined : "14:00",
}));

export const ORE_MINIME_CANCELLAZIONE_DEMO = 24;

/** Le informazioni che solo il piano Pro permette all'assistente di usare. */
export const PARCHEGGIO_DEMO =
  "Parcheggio libero in Via delle Camelie e posteggio a pagamento in piazza, a due minuti a piedi.";
export const METODI_PAGAMENTO_DEMO = "Carte, bancomat, contanti e satispay.";

export const FAQ_DEMO: readonly { domanda: string; risposta: string }[] = [
  {
    domanda: "Fate il colore vegetale?",
    risposta:
      "Sì, lavoriamo con una linea di colore senza ammoniaca a base vegetale. Va prenotato come Colore: la durata è la stessa, il prezzo è di 10 euro in più.",
  },
  {
    domanda: "Posso venire con un bambino?",
    risposta:
      "Certo. Abbiamo un seggiolone rialzato per il taglio dei più piccoli e nessun supplemento sotto i dieci anni.",
  },
  {
    domanda: "Siete accessibili con la carrozzina?",
    risposta: "Sì, l'ingresso è a livello strada e il salone è tutto su un piano.",
  },
  {
    domanda: "Cosa succede se devo disdire?",
    risposta:
      "Basta disdire almeno 24 ore prima, dal link che ricevi nella conferma. Sotto le 24 ore ti chiediamo di chiamarci.",
  },
];

/** Gli operatori nella forma che il motore di prenotazione si aspetta. */
export function operatoriPerIlMotore(): Operatore[] {
  return OPERATORI_DEMO.map((o) => ({ id: o.id, attivo: true, servizioIds: [...o.servizioIds] }));
}

export function servizioDemoPerId(id: string): ServizioFinto | undefined {
  return SERVIZI_DEMO.find((s) => s.id === id);
}

export function operatoreDemoPerId(id: string): OperatoreFinto | undefined {
  return OPERATORI_DEMO.find((o) => o.id === id);
}
