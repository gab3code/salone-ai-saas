/**
 * Parte PURA del pannello admin (Fase 5): tipi e costanti condivisi fra il
 * caricamento dei dati (`admin.server.ts`, che usa il service_role e non può
 * finire in un bundle del browser) e l'interfaccia client.
 *
 * Esiste separata proprio per questo: `admin.server.ts` è marcato
 * "server-only", quindi un componente client non può importarne un valore,
 * solo un tipo.
 */

export const PIANI_ASSEGNABILI = ["free", "starter", "growth", "pro", "enterprise"] as const;
export type PianoAssegnabile = (typeof PIANI_ASSEGNABILI)[number];

/** Stati possibili di `tenants.stato_abbonamento` (migrazione 0001). */
export const STATI_ABBONAMENTO = ["trialing", "attivo", "scaduto", "cancellato"] as const;

export type RigaAdmin = {
  tenantId: string;
  nome: string;
  slug: string;
  piano: string;
  statoAbbonamento: string;
  /** true = piano deciso a mano, il webhook Stripe non lo tocca (migrazione 0028). */
  pianoManuale: boolean;
  creatoIl: string;
  haStripe: boolean;
  emailTitolari: string[];
  membri: number;
  operatori: number;
  clienti: number;
  appuntamenti: number;
  appuntamenti30Giorni: number;
};

export function pianoAssegnabileValido(piano: string): boolean {
  return (PIANI_ASSEGNABILI as readonly string[]).includes(piano);
}

export function statoAbbonamentoValido(stato: string): boolean {
  return (STATI_ABBONAMENTO as readonly string[]).includes(stato);
}
