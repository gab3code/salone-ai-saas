/**
 * "Origine" di un cliente (bug trovato 13/09/2026 durante il test dal vivo,
 * PIANO.md: "Colonna 'Origine' in /dashboard/clienti mostra 'pubblico' come
 * 'Manuale'"). La colonna riassuntiva di /dashboard/clienti e l'intestazione
 * della scheda cliente leggevano `clienti.creato_da_ai` -- un booleano a due
 * soli stati (vero da quando esisteva solo "manuale"/"ai", prima che il
 * canale "pubblico" fosse introdotto lo stesso giorno) -- quindi un cliente
 * che prenota da sé dal sito risultava etichettato come se lo avesse
 * inserito lo staff. Il dato giusto (`appuntamenti.creato_da`, tre stati)
 * esiste già per ogni riga ed è già mostrato correttamente nello storico
 * per-appuntamento della scheda cliente -- qui lo si aggrega per cliente
 * invece di leggere il campo sbagliato. NESSUNA migrazione di schema: a
 * differenza di quanto PIANO.md ipotizzava inizialmente (migrare
 * `clienti.creato_da_ai` da booleano a testo, rimandato per il rischio su
 * dati reali), questa è una correzione puramente applicativa.
 *
 * "Origine" = il canale del PRIMO appuntamento mai creato per quel cliente
 * (created_at più vecchio, non `inizio`): riflette "come/quando è entrato
 * nel sistema", non "quando ha il prossimo appuntamento in calendario" -- un
 * cliente inserito oggi può avere il primo appuntamento schedulato fra un
 * mese.
 */

export interface AppuntamentoOrigine {
  creatoDa: string; // manuale | ai | pubblico
  createdAt: Date;
}

export interface AppuntamentoOrigineConCliente extends AppuntamentoOrigine {
  clienteId: string | null;
}

export const ETICHETTA_ORIGINE: Record<string, string> = {
  ai: "AI",
  pubblico: "Pagina pubblica",
  manuale: "Manuale",
};

/** null se la lista è vuota (nessun appuntamento -> nessuna origine da appuntamenti). */
export function origineDalPrimoAppuntamento(appuntamenti: AppuntamentoOrigine[]): string | null {
  if (appuntamenti.length === 0) return null;
  const primo = appuntamenti.reduce((piuVecchio, a) => (a.createdAt < piuVecchio.createdAt ? a : piuVecchio));
  return ETICHETTA_ORIGINE[primo.creatoDa] ?? "Manuale";
}

/** Mappa clienteId -> etichetta origine, per popolare una tabella con più clienti in una volta sola. */
export function originePerCliente(appuntamenti: AppuntamentoOrigineConCliente[]): Map<string, string> {
  const perCliente = new Map<string, AppuntamentoOrigine[]>();
  for (const a of appuntamenti) {
    if (!a.clienteId) continue;
    const lista = perCliente.get(a.clienteId) ?? [];
    lista.push(a);
    perCliente.set(a.clienteId, lista);
  }
  const risultato = new Map<string, string>();
  for (const [clienteId, lista] of perCliente) {
    const etichetta = origineDalPrimoAppuntamento(lista);
    if (etichetta) risultato.set(clienteId, etichetta);
  }
  return risultato;
}
