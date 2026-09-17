/**
 * Client Supabase finto per testare i livelli "*.server.ts" (query +
 * conversione, vedi booking-engine.server.ts) senza un database vero.
 *
 * Filosofia: non reimplementa il query builder di Supabase (non serve
 * verificare CHE FILTRI vengano applicati -- quello lo fa Postgres/RLS in
 * produzione), serve solo un modo controllato di dire "quando il codice
 * interroga la tabella X con l'operazione Y, rispondi con questo" e di
 * catturare cosa viene scritto (insert/update) per verificare le conversioni
 * (es. fuso orario) applicate PRIMA di scrivere.
 *
 * Ogni tabella ha tre code FIFO indipendenti (select/insert/update): il
 * codice sotto test consuma le risposte nello stesso ordine in cui le
 * interroga davvero -- se una tabella viene interrogata più volte in
 * sequenza con operazioni diverse (es. "appuntamenti" selezionata per il
 * conteggio del tetto mensile e poi per il controllo conflitti), basta
 * mettere le risposte in coda nell'ordine giusto.
 */

export interface RispostaFinta {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

interface OperazioniTabella {
  select?: RispostaFinta[];
  insert?: RispostaFinta[];
  update?: RispostaFinta[];
  delete?: RispostaFinta[];
}

export interface ChiamataScrittura {
  tabella: string;
  payload: unknown;
}

export interface ChiamataCancellazione {
  tabella: string;
}

export interface RegistroChiamate {
  insert: ChiamataScrittura[];
  update: ChiamataScrittura[];
  delete: ChiamataCancellazione[];
}

const RISPOSTA_VUOTA: RispostaFinta = { data: null, error: null };

export function creaSupabaseFinto(tabelle: Record<string, OperazioniTabella>) {
  // Copia le code così ogni test parte da uno stato pulito anche se
  // `tabelle` viene riutilizzato tra i test (shift() muta l'array).
  const code: Record<
    string,
    { select: RispostaFinta[]; insert: RispostaFinta[]; update: RispostaFinta[]; delete: RispostaFinta[] }
  > = {};
  for (const [nome, ops] of Object.entries(tabelle)) {
    code[nome] = {
      select: [...(ops.select ?? [])],
      insert: [...(ops.insert ?? [])],
      update: [...(ops.update ?? [])],
      delete: [...(ops.delete ?? [RISPOSTA_VUOTA])],
    };
  }

  const registro: RegistroChiamate = { insert: [], update: [], delete: [] };

  function costruisciChain(tabella: string, operazione: "select" | "insert" | "update" | "delete", payload?: unknown) {
    const chain = {
      select() {
        return chain;
      },
      eq() {
        return chain;
      },
      gte() {
        return chain;
      },
      lte() {
        return chain;
      },
      lt() {
        return chain;
      },
      gt() {
        return chain;
      },
      not() {
        return chain;
      },
      in() {
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      single() {
        return chain;
      },
      maybeSingle() {
        return chain;
      },
      then(risolvi: (v: RispostaFinta) => void, rifiuta?: (e: unknown) => void) {
        try {
          if (operazione === "insert") registro.insert.push({ tabella, payload });
          if (operazione === "update") registro.update.push({ tabella, payload });
          if (operazione === "delete") registro.delete.push({ tabella });
          const coda = code[tabella]?.[operazione];
          if (!coda) {
            throw new Error(
              `Nessuna risposta configurata per supabase.from("${tabella}").${operazione}(...) -- aggiungila al fixture del test.`
            );
          }
          const risposta = coda.shift();
          if (!risposta) {
            throw new Error(
              `Coda "${operazione}" esaurita per la tabella "${tabella}" -- il codice sotto test l'ha interrogata più volte di quante risposte configurate nel test.`
            );
          }
          risolvi(risposta);
        } catch (errore) {
          if (rifiuta) rifiuta(errore);
          else throw errore;
        }
      },
    };
    return chain;
  }

  return {
    from(tabella: string) {
      return {
        select: () => costruisciChain(tabella, "select"),
        insert: (payload: unknown) => costruisciChain(tabella, "insert", payload),
        update: (payload: unknown) => costruisciChain(tabella, "update", payload),
        delete: () => costruisciChain(tabella, "delete"),
      };
    },
    registro,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

export const RISPOSTA_VUOTA_DEFAULT = RISPOSTA_VUOTA;
