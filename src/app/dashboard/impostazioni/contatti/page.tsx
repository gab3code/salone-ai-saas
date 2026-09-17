import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { PannelloContatti } from "./pannello-contatti";

/**
 * Impostazioni -> Contatti (17/09/2026).
 *
 * Nessun gate di piano: un recapito non è una funzione a pagamento, e
 * un'attività su Free deve poterlo mettere sulla propria pagina pubblica
 * come chiunque altro. Dove il piano conta è a valle -- l'assistente che usa
 * questi numeri esiste da Growth in su -- ma il dato è di tutti.
 */
export default async function PaginaContatti() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("telefono, telefono_whatsapp")
    .eq("id", tenantId)
    .single();

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <a href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </a>
        <h1 className="mt-2 text-xl font-semibold">Contatti</h1>
        <p className="mt-1 max-w-lg text-sm text-zinc-600">
          I recapiti su cui un cliente ti raggiunge quando l&apos;assistente non basta: un reclamo, una richiesta
          strana, o semplicemente qualcuno che vuole parlare con una persona. Sono anche i numeri mostrati sulla
          tua pagina pubblica.
        </p>
      </div>

      <PannelloContatti
        telefonoIniziale={tenant?.telefono ?? ""}
        whatsappIniziale={tenant?.telefono_whatsapp ?? ""}
      />
    </div>
  );
}
