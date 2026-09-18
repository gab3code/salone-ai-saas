import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inviaEmail } from "@/lib/email/mailjet.server";
import { escapeHtml, urlBaseSito } from "@/lib/email/notifiche.server";
import { pianoHaFollowUpAi } from "@/lib/piani";
import { consumaUsoAiInterno } from "@/lib/ai/usi-interni.server";
import { tettoProvaAssistente } from "@/lib/ai/limiti";
import {
  SYSTEM_REPORT,
  commentoAccettabile,
  eGiornoDelReport,
  meseDaRaccontare,
  promptReport,
  type DatiReportMensile,
} from "@/lib/report-mensile";

/**
 * Il report mensile di Pro: una volta al mese, senza doverlo chiedere.
 *
 * I numeri li conta questo file leggendo il database. Il commento lo scrive
 * il modello e non puo' contenere cifre (vedi report-mensile.ts): se il
 * commento non passa i controlli, il report parte lo stesso, solo senza
 * commento. I numeri sono la sostanza, il commento e' il valore aggiunto --
 * mai il contrario.
 */

const MODELLO = "claude-haiku-4-5-20251001";

export interface EsitoReportMensile {
  inviati: number;
  saltati: number;
}

let client: Anthropic | null = null;
function ottieniClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

async function scriviCommento(
  tenantId: string,
  piano: string,
  numeroOperatori: number,
  dati: DatiReportMensile
): Promise<string | null> {
  const anthropic = ottieniClient();
  if (!anthropic) return null;

  const consumo = await consumaUsoAiInterno(tenantId, "follow_up", tettoProvaAssistente(piano, numeroOperatori));
  if (!consumo.ok) return null;

  try {
    const risposta = await anthropic.messages.create({
      model: MODELLO,
      max_tokens: 400,
      system: SYSTEM_REPORT,
      messages: [{ role: "user", content: promptReport(dati) }],
    });
    const blocco = risposta.content.find((b) => b.type === "text");
    return commentoAccettabile(blocco && blocco.type === "text" ? blocco.text : null);
  } catch (errore) {
    console.error("[report] commento non scritto:", tenantId, errore);
    return null;
  }
}

/**
 * Gira ogni notte dentro il cron dei promemoria, ma fa qualcosa solo il
 * primo del mese: il piano Hobby di Vercel concede un cron al giorno, e un
 * secondo cron mensile sarebbe una dipendenza in piu' per una riga di `if`.
 */
export async function inviaReportMensili(
  admin: SupabaseClient,
  adesso: Date = new Date()
): Promise<EsitoReportMensile> {
  const esito: EsitoReportMensile = { inviati: 0, saltati: 0 };
  if (!eGiornoDelReport(adesso)) return esito;

  const mese = meseDaRaccontare(adesso);
  const inizioPrecedente = new Date(
    Date.UTC(mese.inizio.getUTCFullYear(), mese.inizio.getUTCMonth() - 1, 1)
  );

  const { data: tenants } = await admin
    .from("tenants")
    .select("id, nome, slug, piano, report_mensile_inviato")
    .eq("e_demo", false);

  for (const tenant of tenants ?? []) {
    if (!pianoHaFollowUpAi(tenant.piano)) continue;
    // Gia' mandato per questo mese: il cron gira tutti i giorni, il report no.
    if (tenant.report_mensile_inviato === mese.chiave) continue;

    const [{ data: appuntamenti }, { data: clienti }, { count: numeroOperatori }] = await Promise.all([
      admin
        .from("appuntamenti")
        .select("stato, inizio, cliente_id, servizi(nome)")
        .eq("tenant_id", tenant.id)
        .gte("inizio", inizioPrecedente.toISOString())
        .lt("inizio", mese.fine.toISOString()),
      admin.from("clienti").select("id, created_at").eq("tenant_id", tenant.id),
      admin.from("operatori").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    ]);

    const righe = appuntamenti ?? [];
    const nelMese = righe.filter((r) => {
      const quando = new Date(r.inizio as string);
      return quando >= mese.inizio && quando < mese.fine;
    });
    const nelPrecedente = righe.filter((r) => new Date(r.inizio as string) < mese.inizio);

    // Un salone che nel mese non ha fatto niente non ha bisogno di un report
    // che glielo ricordi: probabilmente era chiuso, o non usa il prodotto.
    if (nelMese.length === 0) {
      esito.saltati += 1;
      continue;
    }

    const perServizio = new Map<string, number>();
    for (const r of nelMese) {
      if (r.stato === "cancellato") continue;
      const servizio = Array.isArray(r.servizi) ? r.servizi[0] : r.servizi;
      const nome = (servizio as { nome?: string } | null)?.nome;
      if (!nome) continue;
      perServizio.set(nome, (perServizio.get(nome) ?? 0) + 1);
    }

    const visteNelMese = new Set(nelMese.map((r) => r.cliente_id as string | null).filter(Boolean));
    const dati: DatiReportMensile = {
      nomeSalone: tenant.nome,
      mese: mese.nome,
      appuntamenti: nelMese.filter((r) => r.stato !== "cancellato").length,
      appuntamentiMesePrecedente: nelPrecedente.filter((r) => r.stato !== "cancellato").length,
      noShow: nelMese.filter((r) => r.stato === "no_show").length,
      cancellati: nelMese.filter((r) => r.stato === "cancellato").length,
      clientiNuovi: (clienti ?? []).filter((c) => {
        const creato = new Date(c.created_at as string);
        return creato >= mese.inizio && creato < mese.fine;
      }).length,
      clientiCheNonTornano: (clienti ?? []).filter((c) => !visteNelMese.has(c.id as string)).length,
      serviziPiuRichiesti: [...perServizio.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([nome, quante]) => ({ nome, quante })),
    };

    const commento = await scriviCommento(tenant.id, tenant.piano, numeroOperatori ?? 1, dati);

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

    const base = await urlBaseSito();
    const differenza = dati.appuntamenti - dati.appuntamentiMesePrecedente;
    const riga = (etichetta: string, valore: string) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#71717a">${etichetta}</td><td style="padding:4px 0"><strong>${valore}</strong></td></tr>`;

    const inviata = await inviaEmail({
      a: email,
      oggetto: `${tenant.nome}: com'è andato ${mese.nome}`,
      nomeMittente: "Salone AI",
      html: `
        <p>Ciao,</p>
        <p>Il riassunto di <strong>${escapeHtml(mese.nome)}</strong> per ${escapeHtml(tenant.nome)}.</p>
        <table style="border-collapse:collapse;font-size:14px">
          ${riga("Appuntamenti", `${dati.appuntamenti}`)}
          ${riga(
            "Rispetto al mese prima",
            differenza === 0 ? "uguale" : `${differenza > 0 ? "+" : ""}${differenza}`
          )}
          ${riga("Clienti nuovi", `${dati.clientiNuovi}`)}
          ${riga("Cancellati", `${dati.cancellati}`)}
          ${riga("Non presentati", `${dati.noShow}`)}
          ${riga("Clienti che non tornano da un po'", `${dati.clientiCheNonTornano}`)}
          ${dati.serviziPiuRichiesti
            .map((s) => riga(escapeHtml(s.nome), `${s.quante}`))
            .join("")}
        </table>
        ${commento ? `<p>${escapeHtml(commento)}</p>` : ""}
        ${base ? `<p><a href="${base}/dashboard/analytics">Guarda i numeri completi</a></p>` : ""}
      `,
    });
    if (!inviata) continue;

    await admin.from("tenants").update({ report_mensile_inviato: mese.chiave }).eq("id", tenant.id);
    esito.inviati += 1;
  }

  return esito;
}
