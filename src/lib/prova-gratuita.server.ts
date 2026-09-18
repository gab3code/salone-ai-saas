import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inviaEmail } from "@/lib/email/mailjet.server";
import { urlBaseSito } from "@/lib/email/notifiche.server";
import {
  daAvvisare,
  daDeclassare,
  giorniRimanentiProva,
  type TenantConProva,
} from "@/lib/prova-gratuita";

/**
 * La manutenzione della prova gratuita di Growth: spegnerla quando scade e
 * avvisare prima che succeda. Gira una volta al giorno dentro il cron dei
 * promemoria (il piano Hobby di Vercel concede un cron solo).
 *
 * Le decisioni stanno tutte in prova-gratuita.ts, pure e testate. Qui c'e'
 * solo la lettura, la scrittura e l'email: se un giorno questo job cambia
 * forma, la regola "chi paga non si tocca mai" non deve poter cambiare
 * insieme.
 */

export interface EsitoManutenzioneProve {
  declassati: number;
  avvisati: number;
}

interface RigaTenant {
  id: string;
  nome: string;
  piano: string;
  prova_growth_fino_al: string | null;
  stripe_subscription_id: string | null;
  avviso_prova_inviato: boolean;
}

function versoModello(r: RigaTenant): TenantConProva & { avvisoProvaInviato: boolean } {
  return {
    id: r.id,
    piano: r.piano,
    provaGrowthFinoAl: r.prova_growth_fino_al,
    stripeSubscriptionId: r.stripe_subscription_id,
    avvisoProvaInviato: r.avviso_prova_inviato,
  };
}

export async function manutenzioneProveGratuite(
  admin: SupabaseClient,
  adesso: Date = new Date()
): Promise<EsitoManutenzioneProve> {
  const esito: EsitoManutenzioneProve = { declassati: 0, avvisati: 0 };

  const { data, error } = await admin
    .from("tenants")
    .select("id, nome, piano, prova_growth_fino_al, stripe_subscription_id, avviso_prova_inviato")
    .not("prova_growth_fino_al", "is", null);

  if (error) {
    console.error("[prove] impossibile leggere i tenant in prova:", error);
    return esito;
  }

  const righe = (data ?? []) as RigaTenant[];
  const modelli = righe.map(versoModello);

  // --- Prove finite: si torna su Free ----------------------------------
  const idsDaDeclassare = daDeclassare(modelli, adesso);
  if (idsDaDeclassare.length > 0) {
    const { error: erroreDeclassamento } = await admin
      .from("tenants")
      .update({ piano: "free", prova_growth_fino_al: null })
      .in("id", idsDaDeclassare);
    if (erroreDeclassamento) {
      console.error("[prove] declassamento fallito:", erroreDeclassamento);
    } else {
      esito.declassati = idsDaDeclassare.length;
    }
  }

  // --- Prove che stanno per finire: un avviso, una volta sola -----------
  const idsDaAvvisare = new Set(daAvvisare(modelli, adesso));
  for (const riga of righe) {
    if (!idsDaAvvisare.has(riga.id)) continue;

    const { data: profili } = await admin
      .from("profiles")
      .select("id")
      .eq("tenant_id", riga.id)
      .eq("ruolo", "owner")
      .limit(1);
    const owner = profili?.[0]?.id as string | undefined;
    if (!owner) continue;
    const { data: utente } = await admin.auth.admin.getUserById(owner);
    const email = utente?.user?.email;
    if (!email) continue;

    const giorni = giorniRimanentiProva(riga.prova_growth_fino_al, adesso);
    const base = await urlBaseSito();
    const inviata = await inviaEmail({
      a: email,
      oggetto:
        giorni === 1
          ? `Ultimo giorno di prova per ${riga.nome}`
          : `Restano ${giorni} giorni di prova per ${riga.nome}`,
      nomeMittente: "Salone AI",
      html: `
        <p>Ciao,</p>
        <p>
          La prova di <strong>Growth</strong> per <strong>${riga.nome}</strong>
          ${giorni === 1 ? "finisce domani" : `finisce fra ${giorni} giorni`}.
        </p>
        <p>
          Quando finisce, l'assistente smette di rispondere ai tuoi clienti e il salone
          torna al piano gratuito. Gli appuntamenti, i clienti e la configurazione restano
          dove sono: non si perde niente.
        </p>
        ${base ? `<p><a href="${base}/dashboard/abbonamento">Guarda i piani</a></p>` : ""}
      `,
    });
    if (!inviata) continue;

    // Segnato solo DOPO che l'email e' partita davvero: al contrario, un
    // invio fallito lascerebbe il titolare senza avviso e senza un secondo
    // tentativo la notte dopo.
    await admin.from("tenants").update({ avviso_prova_inviato: true }).eq("id", riga.id);
    esito.avvisati += 1;
  }

  return esito;
}
