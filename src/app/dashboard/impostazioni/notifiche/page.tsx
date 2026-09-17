import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import {
  CANALE_CONFERMA_PREDEFINITO,
  canaleConfermaValido,
} from "@/lib/notifiche-prenotazione";
import { PannelloNotifiche } from "./pannello-notifiche";

/**
 * Impostazioni -> Notifiche (17/09/2026, richiesta di Gabriel).
 *
 * Nessun gate di piano sulla PAGINA: l'email esiste su ogni piano, quindi
 * ogni attività deve poter decidere cosa ne fa. Il piano decide solo quali
 * opzioni SMS sono selezionabili, e quelle restano visibili con il motivo
 * scritto accanto.
 */
export default async function PaginaNotifiche() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("piano, notifica_titolare_nuova_prenotazione, conferma_cliente_canale")
    .eq("id", tenantId)
    .single();

  // Un valore nullo o fuori elenco ricade sul comportamento storico, mai
  // sul silenzio: un dato sporco non deve spegnere le notifiche di un salone
  // senza che nessuno l'abbia chiesto.
  const canaleSalvato = tenant?.conferma_cliente_canale ?? "";
  const canale = canaleConfermaValido(canaleSalvato) ? canaleSalvato : CANALE_CONFERMA_PREDEFINITO;

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <a href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </a>
        <h1 className="mt-2 text-xl font-semibold">Notifiche</h1>
        <p className="mt-1 max-w-lg text-sm text-zinc-600">
          Chi viene avvisato quando entra una prenotazione: tu, i tuoi clienti, o nessuno dei due.
        </p>
      </div>

      <PannelloNotifiche
        piano={tenant?.piano ?? "free"}
        avvisaTitolareIniziale={tenant?.notifica_titolare_nuova_prenotazione !== false}
        canaleIniziale={canale}
      />
    </div>
  );
}
