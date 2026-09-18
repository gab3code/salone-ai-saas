import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { PannelloMedia } from "./pannello-media";
import Link from "next/link";

/**
 * Impostazioni -> Logo e foto di copertina (Fase 4, galleria/upload
 * immagini -- ultimo punto rimasto aperto della fase, vedi PIANO.md).
 * Disponibile su TUTTI i piani (nessun gate: ogni salone ha una pagina
 * pubblica fin dal piano Free). Le due immagini alimentano `/s/[slug]`
 * (vedi `pagina-pubblica.server.ts`) e, da quando esiste (Fase 7), sono
 * anche il punto in cui il redesign vuole "foto vere nei punti chiave"
 * invece di sola decorazione astratta.
 */
export default async function PaginaPubblicaImpostazioni() {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) redirect("/accedi");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("logo_url, cover_url, slug")
    .eq("id", tenantId)
    .single();

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <Link href="/dashboard/impostazioni" className="text-sm underline">
          ← Impostazioni
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Logo e foto di copertina</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Mostrati in cima alla tua pagina pubblica di prenotazione
          {tenant?.slug && (
            <>
              {" "}
              (
              <a href={`/s/${tenant.slug}`} target="_blank" rel="noreferrer" className="underline">
                vedi la tua pagina
              </a>
              )
            </>
          )}
          . Facoltativi: senza immagini la pagina resta comunque funzionante.
        </p>
      </div>

      <PannelloMedia
        tipo="logo"
        urlIniziale={tenant?.logo_url ?? null}
        descrizione="Mostrato accanto al nome della tua attività. Meglio un'immagine quadrata."
      />
      <PannelloMedia
        tipo="cover"
        urlIniziale={tenant?.cover_url ?? null}
        descrizione="Immagine grande in cima alla pagina, dietro al nome. Meglio un formato largo (orizzontale)."
      />
    </div>
  );
}
