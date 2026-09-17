import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inviaEmail } from "@/lib/email/mailjet.server";
import { contaMessaggiClienteQuestoMese } from "@/lib/ai/limiti.server";
import { limiteMensileMessaggi, pianoHaAccessoAIChatWeb } from "@/lib/ai/limiti";

/**
 * Avvisa il titolare quando la quota AI del mese sta per finire.
 *
 * Nasce da una domanda di Gabriel ("i limiti sono abbastanza?") che ha fatto
 * emergere il problema vero, che non era il costo: quando la quota finisce,
 * l'assistente smette di rispondere ai clienti di un salone CHE PAGA, per un
 * limite che protegge noi e non lui -- e fino a oggi il titolare non aveva
 * nessun modo di accorgersene prima, perche' il numero non era scritto da
 * nessuna parte.
 *
 * Adesso il numero si vede in dashboard, e questo avviso e' l'altra meta':
 * serve a chi in dashboard non guarda tutti i giorni.
 */
export const SOGLIA_AVVISO_QUOTA_AI = 0.8;

export interface EsitoAvvisiQuota {
  controllati: number;
  avvisati: number;
}

/** Il mese corrente nel formato in cui lo scrive il database. */
function meseCorrente(adesso: Date): string {
  return `${adesso.getUTCFullYear()}-${String(adesso.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function inviaAvvisiQuotaAi(
  admin: SupabaseClient,
  adesso: Date = new Date()
): Promise<EsitoAvvisiQuota> {
  const esito: EsitoAvvisiQuota = { controllati: 0, avvisati: 0 };
  const mese = meseCorrente(adesso);

  const { data: tenants } = await admin
    .from("tenants")
    .select("id, nome, piano, avviso_quota_ai_mese")
    .eq("e_demo", false);

  for (const tenant of tenants ?? []) {
    if (!pianoHaAccessoAIChatWeb(tenant.piano)) continue;
    // Gia' avvisato questo mese: l'avviso serve una volta, non ogni notte.
    if (tenant.avviso_quota_ai_mese === mese) continue;

    esito.controllati += 1;

    const numeroOperatori =
      tenant.piano === "pro"
        ? ((await admin.from("operatori").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id))
            .count ?? 1)
        : 1;
    const limite = limiteMensileMessaggi(tenant.piano, numeroOperatori);
    const usati = await contaMessaggiClienteQuestoMese(admin, tenant.id);
    if (usati < limite * SOGLIA_AVVISO_QUOTA_AI) continue;

    const { data: profili } = await admin
      .from("profiles")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("ruolo", "owner")
      .limit(1);
    const owner = profili?.[0]?.id as string | undefined;
    if (!owner) continue;
    const { data: utente } = await admin.auth.admin.getUserById(owner);
    const email = utente?.user?.email;
    if (!email) continue;

    const percentuale = Math.round((usati / limite) * 100);
    await inviaEmail({
      a: email,
      oggetto: `L'assistente di ${tenant.nome} ha usato il ${percentuale}% dei messaggi del mese`,
      nomeMittente: "Salone AI",
      html: `
        <p>Ciao,</p>
        <p>
          L'assistente di <strong>${tenant.nome}</strong> ha usato
          <strong>${usati} messaggi su ${limite}</strong> disponibili questo mese.
        </p>
        <p>
          Quando finiscono, ai clienti che scrivono sulla tua pagina pubblica l'assistente risponde di
          contattarti direttamente, invece di prendere l'appuntamento da solo. Il conteggio riparte il primo
          del mese.
        </p>
        <p>
          Se ti capita spesso, il piano superiore ne include molti di più: lo trovi in
          <a href="https://salone-ai-saas.vercel.app/dashboard/abbonamento">Abbonamento</a>.
        </p>
        <p style="color:#71717a;font-size:13px">
          Ti scriviamo una volta sola per mese, quando succede.
        </p>
      `,
    });

    // Si segna PRIMA di poter rimandare: una email in meno e' meglio di una
    // email ogni notte per una settimana.
    await admin.from("tenants").update({ avviso_quota_ai_mese: mese }).eq("id", tenant.id);
    esito.avvisati += 1;
  }

  return esito;
}
