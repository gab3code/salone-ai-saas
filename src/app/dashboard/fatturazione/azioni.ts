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

export type EsitoSalvataggio =
  | { ok: true }
  | { errore: string; errori?: ErroriFatturazione }
  | { errori: ErroriFatturazione; errore?: undefined };

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
