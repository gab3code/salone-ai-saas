"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { scollegaCalendario } from "@/lib/calendario-esterno/collegamenti.server";

/**
 * Collegamento calendari esterni (Fase 6bis, deciso con Gabriel il
 * 02/09/2026). Oggi resta solo lo scollegamento: Google passa dal suo flusso
 * OAuth (`/api/calendario/google/connect`), non da una server action.
 *
 * `collegaCalendarioApple` RIMOSSA il 17/09/2026 (controllo notturno).
 * L'11/09/2026 il collegamento Apple era stato tolto dalla UI perché
 * probabilmente inutilizzabile in produzione (Apple sembra bloccare il
 * CalDAV che arriva da IP di data center, vedi PROJECT_STATUS.md #14), ma
 * la server action era rimasta esportata -- e una server action esportata è
 * un endpoint POST vivo anche senza nessun componente che la chiami. Era
 * l'unica funzione del progetto in questa condizione, e prendeva in input
 * una password specifica per app da scrivere in
 * `collegamenti_calendario_esterni`, dove (per ammissione della migrazione
 * 0030) le credenziali restano in chiaro.
 *
 * Il motore non è stato toccato: `collegaCaldav` e tutto `caldav.server.ts`
 * restano al loro posto per il riutilizzo futuro previsto nel commento di
 * `pannello-calendari.tsx`. Quello che manca è solo questo involucro di una
 * dozzina di righe, da riscrivere insieme al form quando servirà davvero --
 * tenerlo vivo nel frattempo è superficie d'attacco gratuita.
 */

export async function scollegaCalendarioAzione(collegamentoId: string) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const risultato = await scollegaCalendario(supabase, tenantId, collegamentoId);
  revalidatePath("/dashboard/impostazioni/calendari");
  return risultato.ok ? { ok: true } : { errore: risultato.errore };
}
