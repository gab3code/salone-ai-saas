"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoGestireMembri, normalizzaRuolo, ERRORE_PERMESSO_NEGATO } from "@/lib/ruoli";
import { limiteMembri } from "@/lib/piani";
import {
  accettaInvito,
  cambiaRuoloMembro,
  cambiaSedeAttiva,
  invitaMembro,
  revocaInvito,
  rimuoviMembro,
} from "@/lib/membri.server";

/**
 * Azioni su appartenenze e inviti (Fase 5, migrazione 0027).
 *
 * Tutte le scritture vere stanno in `src/lib/membri.server.ts`, che usa il
 * client admin: qui ci sono solo il controllo di chi sta chiedendo e il
 * `revalidatePath`. La separazione è voluta -- il modulo con il service_role
 * non deve mai contenere anche la logica di "chi può", altrimenti diventa
 * facile aggiungerci una funzione dimenticandosi il controllo.
 */

export async function invitaMembroAction(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoGestireMembri);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  // Gate di piano (deciso con Gabriel il 16/09/2026): gli accessi per il
  // personale sono da Pro in su. Si contano i membri ESISTENTI, non si
  // rimuove mai nessuno: un tenant che scende di piano tiene le persone che
  // ha già -- togliere di colpo l'accesso a un dipendente che sta lavorando
  // sarebbe un danno al salone, non una difesa del ricavo. Quello che si
  // blocca è il prossimo invito.
  // Fail-open sulla lettura del piano, come in `creaOperatore`: non riuscire
  // a leggerlo non deve impedire un invito legittimo.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("piano")
    .eq("id", accesso.tenantId)
    .single();

  const limite = limiteMembri(tenant?.piano ?? "");
  if (limite !== Infinity) {
    const { count } = await supabase
      .from("membri_tenant")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", accesso.tenantId);

    if ((count ?? 0) >= limite) {
      return {
        errore:
          "Gli accessi per il personale sono inclusi dal piano Pro. Passa a Pro per dare a un collaboratore un suo accesso alla dashboard.",
      };
    }
  }

  const email = String(formData.get("email") || "");
  const ruolo = normalizzaRuolo(String(formData.get("ruolo") || "staff"));

  const esito = await invitaMembro(accesso.tenantId, email, ruolo, accesso.sessione.userId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/dashboard/team");
  return {
    ok: true,
    messaggio: esito.giaRegistrato
      ? "Questa persona ha già un account: troverà l'invito in cima alla sua dashboard al prossimo accesso."
      : "Invito inviato per email.",
  };
}

export async function revocaInvitoAction(invitoId: string) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoGestireMembri);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const esito = await revocaInvito(accesso.tenantId, invitoId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function cambiaRuoloMembroAction(userId: string, nuovoRuoloGrezzo: string) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoGestireMembri);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const esito = await cambiaRuoloMembro(
    accesso.tenantId,
    userId,
    normalizzaRuolo(nuovoRuoloGrezzo)
  );
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function rimuoviMembroAction(userId: string) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoGestireMembri);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  // Togliersi da soli è un modo silenzioso di perdere l'accesso
  // all'abbonamento: se vuole uscire, prima passa il ruolo a qualcun altro.
  if (userId === accesso.sessione.userId) {
    return { errore: "Non puoi rimuovere te stesso dall'attività." };
  }

  const esito = await rimuoviMembro(accesso.tenantId, userId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/dashboard/team");
  return { ok: true };
}

/**
 * Cambio sede: l'unica azione di questo file che NON è riservata al
 * titolare. Un dipendente che lavora in due negozi della stessa catena deve
 * poterci passare in mezzo come chiunque altro -- resta staff in entrambi.
 */
export async function cambiaSedeAction(tenantId: string) {
  const supabase = await creaClientServer();
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await cambiaSedeAttiva(sessione.userId, tenantId);
  if ("errore" in esito) return { errore: esito.errore };

  // Ogni schermata della dashboard legge dati filtrati per tenant: dopo un
  // cambio sede va ricalcolata tutta, non solo la pagina corrente.
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function accettaInvitoAction(invitoId: string) {
  const supabase = await creaClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { errore: "Devi accedere." };

  const esito = await accettaInvito(user.id, user.email ?? null, invitoId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
