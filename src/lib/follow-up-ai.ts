/**
 * Il messaggio di richiamo scritto dall'assistente (Pro), parte pura.
 *
 * Su Growth il messaggio ai clienti che non tornano e' uno fisso, uguale per
 * tutti: "e' un po' che non ci vediamo". Su Pro lo scrive l'assistente
 * leggendo la storia di QUEL cliente -- da quanto manca, cosa prendeva. Non
 * e' una funzione in piu', e' un risultato diverso: la differenza fra un
 * promemoria e un invito.
 *
 * Qui dentro c'e' la parte che conta di piu' e che non deve dipendere da
 * nessuna rete: cosa si chiede al modello e, soprattutto, COSA SI RIFIUTA
 * DI SPEDIRE. Questo messaggio parte a nome del salone, verso un cliente
 * vero, senza che nessuno lo rilegga prima. Un modello che si inventa "10%
 * di sconto" crea un impegno commerciale che il titolare non ha mai preso e
 * che scoprira' alla cassa.
 *
 * Regola: nel dubbio non si manda il messaggio dell'AI, si manda quello
 * fisso. Un richiamo generico e' un piccolo spreco; un richiamo che promette
 * qualcosa di inventato e' un danno.
 */

export const MAX_CARATTERI_FOLLOW_UP = 300;

export interface DatiFollowUp {
  nomeCliente: string | null;
  nomeSalone: string;
  giorniDaUltimaVisita: number;
  /** Il servizio dell'ultima volta, se lo sappiamo. */
  ultimoServizio: string | null;
}

export const SYSTEM_FOLLOW_UP = `Scrivi il messaggio con cui un salone richiama un cliente che non torna da un po'.

Regole, tutte non negoziabili:
- una o due frasi, mai piu' di ${MAX_CARATTERI_FOLLOW_UP} caratteri;
- in italiano, tono cordiale e diretto, come scriverebbe il titolare: nessuna formula da newsletter;
- NON inventare NIENTE che non ti venga detto: niente sconti, niente promozioni, niente prezzi, niente offerte a tempo, niente novita' del salone, nessun link;
- non promettere disponibilita' precise ("ti aspetto giovedi'"), perche' non sai se c'e';
- non fare colpevolizzare ("non ti fai piu' vedere"): la persona deve avere voglia di tornare, non sentirsi rimproverata;
- niente emoji;
- scrivi SOLO il messaggio, senza saluti finali con firma e senza virgolette.`;

export function promptFollowUp(dati: DatiFollowUp): string {
  const righe = [
    `Salone: ${dati.nomeSalone}`,
    `Cliente: ${dati.nomeCliente?.trim() || "(nome sconosciuto, non usarlo)"}`,
    `Non viene da: ${dati.giorniDaUltimaVisita} giorni`,
  ];
  if (dati.ultimoServizio) righe.push(`Ultima volta ha fatto: ${dati.ultimoServizio}`);
  return righe.join("\n");
}

/** Le parole che, da sole, rendono il messaggio un impegno commerciale. */
const PAROLE_VIETATE = [
  "sconto",
  "sconti",
  "scontato",
  "promozione",
  "promo",
  "offerta",
  "gratis",
  "gratuito",
  "omaggio",
  "regalo",
  "buono",
  "coupon",
];

/**
 * Restituisce il messaggio se e' spedibile, altrimenti null (e chi chiama
 * usa quello fisso). Nessuna "riparazione" del testo: un messaggio corretto
 * a meta' e' peggio di uno generico scritto bene.
 */
export function messaggioFollowUpAccettabile(grezzo: unknown): string | null {
  if (typeof grezzo !== "string") return null;
  const testo = grezzo.trim().replace(/^["“”']|["“”']$/g, "").trim();

  if (testo.length < 15) return null;
  if (testo.length > MAX_CARATTERI_FOLLOW_UP) return null;

  // Link: il link per prenotare lo mettiamo noi, sempre lo stesso, e deve
  // restare l'unico.
  if (/https?:\/\/|www\.|\.it\b|\.com\b/i.test(testo)) return null;

  // Prezzi e percentuali: qualunque cifra con euro o % e' un impegno.
  if (/\d\s*(€|euro|%)/i.test(testo)) return null;

  const minuscolo = testo.toLowerCase();
  if (PAROLE_VIETATE.some((parola) => new RegExp(`\\b${parola}\\b`).test(minuscolo))) return null;

  return testo;
}
