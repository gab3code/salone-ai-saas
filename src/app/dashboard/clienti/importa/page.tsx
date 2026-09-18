import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoImportareClienti } from "@/lib/ruoli";
import { PannelloImport } from "./pannello-import";

/**
 * Import della rubrica clienti (Fase 6ter).
 *
 * E' la funzione che decide se un salone puo' passare a noi davvero: chi ha
 * trecento clienti su un quaderno o in un Excel fatto male non li sposta a
 * mano, e finche' non li sposta non prova nemmeno il resto del prodotto.
 */
export default async function PaginaImportClienti() {
  const supabase = await creaClientServer();
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) redirect("/accedi");
  if (!puoImportareClienti(sessione.ruolo)) redirect("/dashboard/clienti");

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/dashboard/clienti" className="text-sm underline">
          ← Clienti
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Importa la rubrica</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Incolla l&apos;elenco dei tuoi clienti, o carica un file CSV. Va bene un foglio Excel
          copiato, un export di un altro gestionale o una lista scritta a mano: serve un numero
          di telefono per riga, il resto è facoltativo. Ti mostro cosa entrerebbe prima di
          salvare qualcosa.
        </p>
      </div>

      <PannelloImport />
    </div>
  );
}
