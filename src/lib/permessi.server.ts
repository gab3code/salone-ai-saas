import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ottieniSessioneTenant, type SessioneTenant } from "@/lib/supabase/tenant";
import { ERRORE_PERMESSO_NEGATO, type RuoloAttivita } from "@/lib/ruoli";

export type AccessoNegato = { errore: string };
export type AccessoConcesso = { tenantId: string; sessione: SessioneTenant };

export function accessoNegato(esito: AccessoConcesso | AccessoNegato): esito is AccessoNegato {
  return "errore" in esito;
}

/**
 * Il gate di permesso delle server action (Fase 5). Sostituisce
 * `ottieniTenantCorrente` in tutte le azioni che NON deve poter eseguire un
 * dipendente, e mantiene la stessa forma di ritorno `{ errore }` già usata
 * ovunque nel progetto, così le chiamanti non cambiano struttura.
 *
 * Perché il controllo sta QUI e non solo nel layout della pagina: un
 * `layout.tsx` protegge quello che l'utente VEDE, ma una server action è un
 * endpoint POST richiamabile da chiunque abbia una sessione valida, anche
 * senza mai aprire la pagina. Il layout è comodità, questo è sicurezza.
 *
 * Uso:
 *   const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
 *   if (accessoNegato(accesso)) return { errore: accesso.errore };
 *   // accesso.tenantId, accesso.sessione.ruolo
 */
export async function richiediPermesso(
  supabase: SupabaseClient,
  permesso: (ruolo: RuoloAttivita) => boolean
): Promise<AccessoConcesso | AccessoNegato> {
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) return { errore: "Nessuna attività associata a questo utente." };
  if (!permesso(sessione.ruolo)) return { errore: ERRORE_PERMESSO_NEGATO };
  return { tenantId: sessione.tenantId, sessione };
}
