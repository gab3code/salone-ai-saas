import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoGestireFatturazione } from "@/lib/ruoli";
import { leggiDatiFatturazione } from "@/lib/fatturazione.server";
import { ModuloFatturazione } from "./modulo";

export const dynamic = "force-dynamic";

/**
 * I dati di fatturazione, chiesti una volta prima del primo pagamento.
 *
 * Perché i piani a pagamento richiedono la partita IVA: per un servizio
 * digitale venduto online a un consumatore italiano la fattura è SEMPRE
 * obbligatoria, non solo su richiesta, e per emetterla a un privato servirebbe
 * il suo codice fiscale. Siccome i clienti di questo prodotto sono saloni,
 * centri estetici, palestre e liberi professionisti -- che la partita IVA ce
 * l'hanno tutti, per forza -- tenere in piedi un secondo percorso per i
 * privati significherebbe raddoppiare moduli e casi limite per un cliente che
 * non si presenta. Il piano Free resta aperto a chiunque, senza carta e senza
 * partita IVA: quello che serve la partita IVA è pagare.
 */
export default async function PaginaFatturazione({
  searchParams,
}: {
  searchParams: Promise<{ piano?: string }>;
}) {
  const supabase = await creaClientServer();
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) redirect("/accedi");
  if (!puoGestireFatturazione(sessione.ruolo)) redirect("/dashboard");

  const sp = await searchParams;
  const dati = await leggiDatiFatturazione(supabase, sessione.tenantId);

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/dashboard/impostazioni" className="text-sm underline">
        ← Impostazioni
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Dati per la fattura</h1>
        <p className="max-w-xl text-sm text-zinc-600">
          Ci servono una volta sola, e poi restano. Li usiamo per emetterti la fattura elettronica
          di ogni pagamento: per legge dobbiamo emetterla, quindi senza questi dati non possiamo
          attivare un piano a pagamento.
        </p>
        <p className="max-w-xl text-sm text-zinc-500">
          I piani a pagamento sono per chi ha una partita IVA. Il piano Free resta disponibile
          senza.
        </p>
      </header>

      <ModuloFatturazione iniziali={dati} piano={sp.piano ?? null} />
    </div>
  );
}
