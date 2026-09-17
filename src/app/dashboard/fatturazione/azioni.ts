"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoGestireFatturazione } from "@/lib/ruoli";
import {
  leggiDatiFatturazione,
  rispecchiaSuStripe,
  salvaDatiFatturazione,
} from "@/lib/fatturazione.server";
import type { DatiFatturazione, ErroriFatturazione } from "@/lib/fatturazione";

/**
 * Esito del salvataggio, nella stessa forma che restituisce
 * `salvaDatiFatturazione` (17/09/2026).
 *
 * Prima erano tre rami di cui uno già coperto da un altro, e nessuno dei tre
 * coincideva con la firma reale della funzione sottostante: due descrizioni
 * dello stesso esito che non combaciavano. Il tipo non era nemmeno importato
 * da nessuno -- `modulo.tsx` ispeziona l'esito con `"errori" in esito` --
 * ma un tipo esportato è una promessa su cosa può tornare, e una promessa
 * sbagliata è peggio di nessuna promessa.
 */
export type EsitoSalvataggio =
  | { ok: true }
  | { errori: ErroriFatturazione }
  | { errore: string };

export async function salvaFatturazioneAction(dati: DatiFatturazione): Promise<EsitoSalvataggio> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoGestireFatturazione);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const esito = await salvaDatiFatturazione(accesso.tenantId, dati);
  if ("errori" in esito) return { errori: esito.errori };
  if ("errore" in esito) return { errore: esito.errore };

  // Rispecchia su Stripe solo se un customer esiste già. Al primo passaggio
  // spesso non c'è ancora: lo creerà il checkout, che rispecchia da sé.
  const admin = creaClientAdmin();
  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_customer_id")
    .eq("id", accesso.tenantId)
    .maybeSingle();
  if (tenant?.stripe_customer_id) {
    await rispecchiaSuStripe(
      tenant.stripe_customer_id as string,
      await leggiDatiFatturazione(admin, accesso.tenantId)
    );
  }

  revalidatePath("/dashboard/fatturazione");
  revalidatePath("/dashboard/impostazioni");
  return { ok: true };
}
