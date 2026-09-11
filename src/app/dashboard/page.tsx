import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { caricaMetriche } from "@/lib/metriche.server";
import { esci } from "./azioni";
import { AvviaCheckoutSeNecessario } from "./avvia-checkout-se-necessario";

/**
 * Prima pagina protetta: prova che l'intera catena funziona davvero, non
 * solo "sulla carta" -- login riuscito, RLS che restituisce ESATTAMENTE il
 * tenant di questo utente (mai quello di un altro), profilo creato dal
 * trigger di provisioning automatico alla registrazione (migrazione 0004).
 */
export default async function PaginaDashboard({
  searchParams,
}: {
  searchParams: Promise<{ piano?: string; checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const supabase = await creaClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: profilo } = await supabase
    .from("profiles")
    .select("nome, ruolo, tenant_id")
    .eq("id", user.id)
    .single();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nome, slug, piano, stato_abbonamento, created_at")
    .single();

  const metriche = tenant && profilo?.tenant_id ? await caricaMetriche(supabase, profilo.tenant_id) : null;
  const formatoEuro = (centesimi: number) =>
    (centesimi / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <form action={esci}>
          <button type="submit" className="text-sm underline">
            Esci
          </button>
        </form>
      </div>

      {tenant && (
        <Suspense fallback={null}>
          <AvviaCheckoutSeNecessario pianoAttuale={tenant.piano} />
        </Suspense>
      )}

      {checkout === "successo" && (
        <p className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Abbonamento attivato. Bentornato!
        </p>
      )}

      {tenant && (
        <div className="mt-4 flex gap-3 text-sm">
          <a href="/dashboard/calendario" className="rounded border border-zinc-300 px-3 py-1.5">
            Calendario
          </a>
          <Link href="/dashboard/clienti" className="rounded border border-zinc-300 px-3 py-1.5">
            Clienti
          </Link>
          <a href="/dashboard/configura" className="rounded border border-zinc-300 px-3 py-1.5">
            Configura il salone
          </a>
          <a href="/dashboard/impostazioni" className="rounded border border-zinc-300 px-3 py-1.5">
            Impostazioni
          </a>
        </div>
      )}

      {!tenant ? (
        <p className="mt-4 text-sm text-red-600">
          Nessun salone trovato per questo utente -- il provisioning automatico non è andato a
          buon fine (controlla i log del trigger al_nuovo_utente su Supabase).
        </p>
      ) : (
        <>
          <dl className="mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Salone</dt>
            <dd>{tenant.nome}</dd>
            <dt className="text-zinc-500">Slug pagina pubblica</dt>
            <dd>{tenant.slug}</dd>
            <dt className="text-zinc-500">Piano</dt>
            <dd>{tenant.piano}</dd>
            <dt className="text-zinc-500">Stato abbonamento</dt>
            <dd>{tenant.stato_abbonamento}</dd>
            <dt className="text-zinc-500">Tu</dt>
            <dd>
              {profilo?.nome || user.email} ({profilo?.ruolo})
            </dd>
          </dl>

          {metriche && (
            <>
              <h2 className="mt-8 text-sm font-medium text-zinc-500">Come sta andando</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <CardMetrica etichetta="Appuntamenti oggi" valore={String(metriche.appuntamentiOggi)} />
                <CardMetrica
                  etichetta="Valore prenotato oggi"
                  valore={formatoEuro(metriche.valorePrenotazioniOggiCentesimi)}
                />
                <CardMetrica
                  etichetta="Occupazione oggi"
                  valore={
                    metriche.percentualeOccupazioneOggi === null
                      ? "chiuso"
                      : `${metriche.percentualeOccupazioneOggi}%`
                  }
                />
                <CardMetrica etichetta="Clienti totali" valore={String(metriche.clientiTotali)} />
                <CardMetrica
                  etichetta="Nuovi clienti (30gg)"
                  valore={String(metriche.nuoviClientiUltimi30Giorni)}
                />
                <CardMetrica
                  etichetta="Cancellazioni (30gg)"
                  valore={String(metriche.cancellazioniUltimi30Giorni)}
                />
              </div>

              {metriche.clientiInattiviDa60Giorni > 0 && (
                <div className="mt-4 flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                  <span>
                    <strong>{metriche.clientiInattiviDa60Giorni}</strong>{" "}
                    {metriche.clientiInattiviDa60Giorni === 1
                      ? "cliente non prenota"
                      : "clienti non prenotano"}{" "}
                    da oltre 60 giorni.
                  </span>
                  <Link
                    href="/dashboard/clienti?filtro=inattivi"
                    className="rounded border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900"
                  >
                    Contatta questi clienti
                  </Link>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function CardMetrica({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="rounded border border-zinc-200 p-3">
      <p className="text-xs text-zinc-500">{etichetta}</p>
      <p className="mt-1 text-lg font-semibold">{valore}</p>
    </div>
  );
}
