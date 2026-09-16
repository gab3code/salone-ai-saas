"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { eAdminPiattaforma, ERRORE_PERMESSO_NEGATO } from "@/lib/ruoli";
import {
  cancellaAttivita,
  impostaPianoManuale,
  riattivaAttivita,
  riepilogoCancellazione,
  riportaPianoSuStripe,
  sospendiAttivita,
  type AutoreIntervento,
} from "@/lib/admin.server";

/**
 * Azioni del pannello di piattaforma. Il layout di /admin blocca già chi non
 * è admin, ma una server action è un endpoint POST richiamabile da chiunque
 * abbia una sessione valida senza mai aprire la pagina: il controllo va
 * rifatto qui, ogni volta.
 *
 * `autoreSeAdmin` restituisce anche CHI sta agendo, non solo un sì/no: ogni
 * intervento finisce nel registro (migrazione 0029) con il suo nome, e un
 * registro senza autore non dimostra niente.
 */
async function autoreSeAdmin(): Promise<AutoreIntervento | null> {
  const supabase = await creaClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profilo } = await supabase
    .from("profiles")
    .select("ruolo")
    .eq("id", user.id)
    .single();

  if (!eAdminPiattaforma(profilo?.ruolo)) return null;
  return { userId: user.id, email: user.email ?? null };
}

export async function impostaPianoManualeAction(
  tenantId: string,
  piano: string,
  statoAbbonamento: string
) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await impostaPianoManuale(autore, tenantId, piano, statoAbbonamento);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true };
}

export async function riportaPianoSuStripeAction(tenantId: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await riportaPianoSuStripe(autore, tenantId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true };
}

export async function sospendiAttivitaAction(tenantId: string, motivo: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await sospendiAttivita(autore, tenantId, motivo);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true };
}

export async function riattivaAttivitaAction(tenantId: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await riattivaAttivita(autore, tenantId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true };
}

/** Solo lettura: cosa sparirebbe. Mostrato prima di chiedere conferma. */
export async function riepilogoCancellazioneAction(tenantId: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };
  return riepilogoCancellazione(tenantId);
}

/**
 * La conferma non è un `confirm()` ma il nome esatto dell'attività digitato
 * a mano, verificato di nuovo QUI e non solo nel browser: è l'ultima
 * differenza fra "ho cancellato l'attività sbagliata" e "non è successo
 * niente", e un controllo che vive solo lato client non è un controllo.
 */
export async function cancellaAttivitaAction(tenantId: string, nomeDigitato: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  const riepilogo = await riepilogoCancellazione(tenantId);
  if ("errore" in riepilogo) return { errore: riepilogo.errore };

  if (nomeDigitato.trim() !== riepilogo.nome) {
    return { errore: `Per confermare devi scrivere esattamente: ${riepilogo.nome}` };
  }

  const esito = await cancellaAttivita(autore, tenantId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return {
    ok: true,
    messaggio:
      esito.accountCancellati > 0
        ? `Attività cancellata, insieme a ${esito.accountCancellati} account che non facevano parte di nient'altro.`
        : "Attività cancellata.",
  };
}
