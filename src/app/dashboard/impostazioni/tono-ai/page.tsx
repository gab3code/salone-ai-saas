import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { pianoHaTonoPersonalizzato } from "@/lib/ai/limiti";
import { PannelloTonoAi } from "./pannello-tono-ai";

/**
 * Impostazioni -> Tono dell'AI (Fase 5, Pro/Enterprise). Trovato mancante
 * nel mega-controllo competitor del 12/09/2026 (pubblicizzato su Pro in
 * `Prezzi.tsx`, zero codice) -- costruito il 13/09/2026, guidato a poche
 * opzioni invece di un prompt libero (vedi `docs/analisi-estetia.md` punto
 * 3 e il commento in `src/lib/ai/agente.ts`).
 */
export default async function PaginaTonoAi() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("piano, tono_ai, tono_ai_nota")
    .eq("id", tenantId)
    .single();

  const haAccesso = pianoHaTonoPersonalizzato(tenant?.piano ?? "");

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <a href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </a>
        <h1 className="mt-2 text-xl font-semibold">Tono dell&apos;AI</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Guida il modo in cui l&apos;assistente risponde ai tuoi clienti in chat -- resta comunque vincolato alle
          stesse regole di sempre (mai prezzi o disponibilità inventati).
        </p>
      </div>

      {haAccesso ? (
        <PannelloTonoAi
          stileIniziale={(tenant?.tono_ai as "professionale" | "amichevole" | "informale_con_emoji") ?? "professionale"}
          notaIniziale={tenant?.tono_ai_nota ?? ""}
        />
      ) : (
        <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-600">
            Il tono personalizzabile è incluso dal piano <strong>Pro</strong> in su. Il tuo assistente risponde già
            oggi con un tono professionale e cordiale di default.
          </p>
          <Link href="/#prezzi" className="mt-4 inline-block rounded bg-black px-3 py-2 text-sm font-medium text-white">
            Passa a Pro
          </Link>
        </div>
      )}
    </div>
  );
}
