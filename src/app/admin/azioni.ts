"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { eAdminPiattaforma, ERRORE_PERMESSO_NEGATO } from "@/lib/ruoli";
import { impostaPianoManuale, riportaPianoSuStripe } from "@/lib/admin.server";

/**
 * Azioni del pannello di piattaforma. Il layout di /admin blocca già chi non
 * è admin, ma una server action è un endpoint POST richiamabile da chiunque
 * abbia una sessione valida senza mai aprire la pagina: il controllo va
 * rifatto qui, ogni volta.
 */
async function eAdminLoggato(): Promise<boolean> {
  const supabase = await creaClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profilo } = await supabase
    .from("profiles")
    .select("ruolo")
    .eq("id", user.id)
    .single();

  return eAdminPiattaforma(profilo?.ruolo);
}

export async function impostaPianoManualeAction(
  tenantId: string,
  piano: string,
  statoAbbonamento: string
) {
  if (!(await eAdminLoggato())) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await impostaPianoManuale(tenantId, piano, statoAbbonamento);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true };
}

export async function riportaPianoSuStripeAction(tenantId: string) {
  if (!(await eAdminLoggato())) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await riportaPianoSuStripe(tenantId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true };
}
