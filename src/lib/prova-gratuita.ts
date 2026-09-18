/**
 * La prova gratuita di Growth, quella che parte alla registrazione.
 *
 * Perche' esiste (18/09/2026). Una prova c'era gia', ma era una cosa
 * diversa: `giorniDiProva` in stripe/piani.ts sono i 10 giorni prima del
 * PRIMO ADDEBITO, e per averli bisogna arrivare al checkout e lasciare una
 * carta. Chi si registra e basta finiva su Free, cioe' senza l'assistente:
 * il prodotto si faceva giudicare senza far vedere la cosa per cui esiste.
 *
 * Questa e' la prova senza carta: `tenants.piano` vale davvero 'growth' per
 * i primi giorni, quindi TUTTI i controlli di piano del progetto -- e sono
 * un centinaio -- continuano a funzionare senza sapere niente della prova.
 * L'alternativa (un "piano effettivo" calcolato a ogni controllo) avrebbe
 * voluto dire toccare quel centinaio di posti e sbagliarne uno.
 *
 * Il prezzo di questa scelta e' che la prova va SPENTA da qualcuno quando
 * scade, altrimenti resta Growth per sempre: lo fa il cron giornaliero (vedi
 * prova-gratuita.server.ts). Un difetto di quel cron non e' una porta aperta
 * a un estraneo, e' un costo nostro -- per questo la funzione che decide chi
 * declassare e' qui, pura e testata, e non dentro il job.
 */

/** Quanto dura la prova di Growth alla registrazione. */
export const GIORNI_PROVA_GROWTH = 14;

/** Quanti giorni prima della fine si avvisa il titolare, una volta sola. */
export const GIORNI_PREAVVISO_FINE_PROVA = 3;

export function fineProvaDallaRegistrazione(adesso: Date): Date {
  return new Date(adesso.getTime() + GIORNI_PROVA_GROWTH * 24 * 60 * 60 * 1000);
}

export function provaAttiva(finoAl: string | Date | null, adesso: Date = new Date()): boolean {
  if (!finoAl) return false;
  const fine = finoAl instanceof Date ? finoAl : new Date(finoAl);
  if (Number.isNaN(fine.getTime())) return false;
  return fine.getTime() > adesso.getTime();
}

/**
 * Quanti giorni pieni mancano alla fine, arrotondati per eccesso: a poche ore
 * dalla scadenza si dice "1 giorno", non "0". Chi legge deve avere il tempo
 * di fare qualcosa, e "0 giorni" mentre la prova e' ancora attiva e' solo
 * una bugia precisa.
 */
export function giorniRimanentiProva(finoAl: string | Date | null, adesso: Date = new Date()): number {
  if (!provaAttiva(finoAl, adesso)) return 0;
  const fine = finoAl instanceof Date ? finoAl : new Date(finoAl!);
  return Math.max(1, Math.ceil((fine.getTime() - adesso.getTime()) / (24 * 60 * 60 * 1000)));
}

export interface TenantConProva {
  id: string;
  piano: string;
  provaGrowthFinoAl: string | null;
  /** Se ha un abbonamento vero, il piano lo decide Stripe, non noi. */
  stripeSubscriptionId: string | null;
}

/**
 * Chi va riportato su Free perche' la prova e' finita.
 *
 * Due esclusioni che contano piu' della regola stessa:
 *
 * - chi ha un abbonamento Stripe non si tocca MAI, qualunque cosa dica la
 *   data: se ha pagato, il piano lo decide il webhook. Declassare un cliente
 *   pagante e' il difetto peggiore che questo job possa avere, molto peggio
 *   che lasciare Growth qualche giorno di troppo a chi non paga;
 * - chi non e' piu' su 'growth' non si tocca: se un admin lo ha messo su Pro
 *   a mano, la prova scaduta non deve riportarlo indietro.
 */
export function daDeclassare(tenants: TenantConProva[], adesso: Date): string[] {
  return tenants
    .filter(
      (t) =>
        t.provaGrowthFinoAl !== null &&
        !provaAttiva(t.provaGrowthFinoAl, adesso) &&
        t.piano === "growth" &&
        !t.stripeSubscriptionId
    )
    .map((t) => t.id);
}

/** Chi va avvisato che la prova sta per finire, e non lo e' ancora stato. */
export function daAvvisare(
  tenants: (TenantConProva & { avvisoProvaInviato: boolean })[],
  adesso: Date
): string[] {
  return tenants
    .filter((t) => {
      if (t.avvisoProvaInviato) return false;
      if (!provaAttiva(t.provaGrowthFinoAl, adesso)) return false;
      if (t.stripeSubscriptionId) return false; // ha gia' deciso
      return giorniRimanentiProva(t.provaGrowthFinoAl, adesso) <= GIORNI_PREAVVISO_FINE_PROVA;
    })
    .map((t) => t.id);
}
