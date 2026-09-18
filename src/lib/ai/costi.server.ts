import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";
import {
  LISTINO_HAIKU_4_5,
  costoMicroDollari,
  leggiUso,
  type CanaleUsoApi,
  type ListinoModello,
} from "./costi";

/**
 * Scrive una riga di costo per ogni chiamata al modello (migrazione 0068).
 *
 * ----------------------------------------------------------------------
 * LA REGOLA CHE GOVERNA TUTTO QUESTO FILE: misurare non deve mai poter
 * rompere quello che misura.
 *
 * Questa funzione sta nel percorso di ogni risposta dell'assistente a un
 * cliente vero. Se il database e' lento, se la tabella non esiste ancora su
 * un ambiente, se la service_role key manca, se la forma di `usage` cambia in
 * una versione futura dell'SDK: il cliente in chat non deve accorgersene.
 * Non c'e' nessun errore che valga la pena propagare -- una riga di
 * contabilita' persa e' un dato mancante, una conversazione rotta e' un
 * cliente perso.
 *
 * Per questo: try/catch su tutto, nessun `throw`, nessun valore di ritorno
 * che chi chiama debba controllare, e soprattutto NESSUN `await` bloccante
 * nel percorso della risposta (vedi `registraUsoApi`, che parte e non si
 * aspetta).
 *
 * Il prezzo di questa scelta, detto chiaramente: in caso di guasto i dati
 * sono incompleti e nessuno se ne accorge subito. E' accettabile qui perche'
 * questi numeri servono a decidere un listino con calma, non a fatturare.
 * Se un giorno serviranno a fatturare davvero, questa scelta va rifatta da
 * capo -- e allora la perdita silenziosa diventera' inaccettabile.
 */

interface ParametriRegistrazione {
  /** Null per la demo pubblica della landing, che non appartiene a nessun salone. */
  tenantId: string | null;
  canale: CanaleUsoApi;
  modello: string;
  /** L'oggetto `usage` come arriva dall'SDK, non normalizzato. */
  usage: unknown;
  listino?: ListinoModello;
}

/**
 * Registra l'uso, senza far aspettare nessuno.
 *
 * Non e' `async` per chi chiama: parte e ritorna subito. Aspettare la
 * scrittura vorrebbe dire aggiungere la latenza del database a OGNI risposta
 * dell'assistente, e un assistente che risponde piu' lentamente per tenere
 * la contabilita' ha invertito le priorita'.
 */
export function registraUsoApi(params: ParametriRegistrazione): void {
  void scrivi(params).catch(() => {
    // Gia' gestito dentro `scrivi`. Questo catch esiste solo perche' una
    // promise respinta e non gestita puo' abbattere il processo Node a
    // seconda della configurazione: l'ultima rete, non la prima.
  });
}

async function scrivi({ tenantId, canale, modello, usage, listino = LISTINO_HAIKU_4_5 }: ParametriRegistrazione) {
  try {
    const uso = leggiUso(usage);

    // Una chiamata senza nessun token non e' successa: non sporcare la
    // tabella con righe che diluiscono le medie verso il basso.
    if (uso.input === 0 && uso.output === 0 && uso.scritturaCache === 0 && uso.letturaCache === 0) return;

    const supabase = creaClientAdmin();
    const { error } = await supabase.from("usi_api_ai").insert({
      tenant_id: tenantId,
      canale,
      modello,
      listino: listino.nome,
      token_input: uso.input,
      token_output: uso.output,
      token_scrittura_cache: uso.scritturaCache,
      token_lettura_cache: uso.letturaCache,
      costo_microdollari: costoMicroDollari(uso, listino),
    });
    if (error) {
      console.error("[costi-ai] riga non scritta:", error.message);
    }
  } catch (errore) {
    console.error("[costi-ai] registrazione fallita:", errore instanceof Error ? errore.message : errore);
  }
}
