import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaPromemoriaCompleanno } from "@/lib/piani";
import { PannelloCompleanno } from "./pannello-compleanno";

/**
 * Impostazioni -> Promemoria di compleanno (Pro/Enterprise, vedi
 * `pianoHaPromemoriaCompleanno`). CONFLITTO trovato il 15/09/2026 (vedi
 * DECISIONS.md/PIANO.md): pubblicizzata in `Prezzi.tsx` da prima del
 * 12/09/2026, zero codice fino ad oggi -- costruita dopo che Gabriel ha
 * approvato la funzione con la richiesta esplicita "rendi tutto
 * personalizzabile dallo staff". A differenza di `tono-ai` (dove il gate di
 * piano decide TUTTO), qui il piano decide solo chi PUÒ attivarla -- lo
 * staff deve anche accendere l'interruttore, di default spento (nessun
 * cliente riceve nulla finché il titolare non lo sceglie esplicitamente).
 */
export default async function PaginaCompleanno() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("piano, compleanno_attivo, compleanno_messaggio")
    .eq("id", tenantId)
    .single();

  const haAccesso = pianoHaPromemoriaCompleanno(tenant?.piano ?? "");

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Promemoria di compleanno</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manda un augurio automatico ai clienti che hanno lasciato la data di nascita (si aggiunge dalla scheda
          cliente in CRM) -- testo e attivazione decisi interamente da te.
        </p>
      </div>

      {haAccesso ? (
        <PannelloCompleanno
          attivoIniziale={tenant?.compleanno_attivo ?? false}
          messaggioIniziale={tenant?.compleanno_messaggio ?? ""}
        />
      ) : (
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-600">
            Il promemoria di compleanno è incluso dal piano <strong>Pro</strong> in su.
          </p>
          <Link href="/dashboard/abbonamento?piano=pro" className="mt-4 inline-block rounded bg-black px-3 py-2 text-sm font-medium text-white">
            Passa a Pro
          </Link>
        </div>
      )}
    </div>
  );
}
