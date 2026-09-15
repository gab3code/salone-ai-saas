import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaKnowledgeBaseAi } from "@/lib/piani";
import { PannelloInformazioni } from "./pannello-informazioni";
import { PannelloFaq } from "./pannello-faq";

/**
 * Impostazioni -> Informazioni per l'AI receptionist (Fase 2, Pro/Enterprise
 * -- vedi `pianoHaKnowledgeBaseAi`). Oggi l'AI in chat pubblica risponde
 * solo a domande transazionali (servizi/prezzi/durate/disponibilità/
 * prenotazioni); questa pagina lascia al titolare configurare le
 * informazioni generali (parcheggio, pagamenti, policy di cancellazione,
 * FAQ libere) che lo strumento `info_attivita` (src/lib/ai/tools.ts) legge
 * per rispondere onestamente anche a domande non transazionali -- i clienti
 * potranno chiedere all'AI in chat parcheggio, pagamenti, policy e altro,
 * usando esattamente queste informazioni.
 */
export default async function PaginaInformazioniAttivita() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("piano, descrizione, indirizzo, parcheggio, metodi_pagamento")
    .eq("id", tenantId)
    .single();
  const haAccesso = pianoHaKnowledgeBaseAi(tenant?.piano ?? "");

  const { data: faqGrezze } = haAccesso
    ? await supabase
        .from("faq_attivita")
        .select("id, domanda, risposta")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: true })
    : { data: null };

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <a href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </a>
        <h1 className="mt-2 text-xl font-semibold">Informazioni per l&apos;AI (receptionist)</h1>
        <p className="mt-1 text-sm text-zinc-600">
          I clienti potranno chiedere all&apos;AI in chat parcheggio, pagamenti, policy di cancellazione e
          qualunque altra informazione generale sull&apos;attività -- usando esattamente le informazioni che
          configuri qui sotto.
        </p>
      </div>

      {haAccesso ? (
        <>
          <PannelloInformazioni
            informazioniIniziali={{
              descrizione: tenant?.descrizione ?? "",
              indirizzo: tenant?.indirizzo ?? "",
              parcheggio: tenant?.parcheggio ?? "",
              metodiPagamento: tenant?.metodi_pagamento ?? "",
            }}
          />
          <PannelloFaq faqIniziali={faqGrezze ?? []} />
        </>
      ) : (
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-600">
            Il receptionist AI con knowledge base è incluso dal piano <strong>Pro</strong> in su.
          </p>
          <Link href="/#prezzi" className="mt-4 inline-block rounded bg-black px-3 py-2 text-sm font-medium text-white">
            Passa a Pro
          </Link>
        </div>
      )}
    </div>
  );
}
