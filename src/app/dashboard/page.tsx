import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoConfigurareAttivita, puoGestireMembri, puoVedereAnalytics } from "@/lib/ruoli";
import { elencaInvitiRicevuti, elencaSediUtente } from "@/lib/membri.server";
import { caricaMetriche } from "@/lib/metriche.server";
import { contaMessaggiClienteQuestoMese } from "@/lib/ai/limiti.server";
import { limiteMensileMessaggi } from "@/lib/ai/limiti";
import { pianoHaAccessoAIChatWeb } from "@/lib/ai/limiti";
import { urlBaseSito } from "@/lib/email/notifiche.server";
import { generaQrCodeDataUrl } from "@/lib/qrcode.server";
import { esci } from "./azioni";
import { CondividiLink } from "./CondividiLink";
import { SelettoreSede } from "./SelettoreSede";
import { InvitiRicevuti } from "./InvitiRicevuti";
// `formatoEuro` non è più definita qui (17/09/2026): era la stessa riga,
// identica, in quattro file diversi. La casa è `lib/piani.ts`, dove sta
// già il listino.
import { formatoEuroDaCentesimi as formatoEuro } from "@/lib/piani";

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
  const { checkout, piano: pianoRichiesto } = await searchParams;

  // Vecchi link e email di conferma già spedite possono ancora portare qui
  // con `?piano=`. Si reindirizza LATO SERVER, prima che la pagina venga
  // disegnata: il lampo di dashboard che si vedeva prima del pagamento
  // nasceva proprio dal contrario -- la decisione la prendeva un componente
  // client, cioè il browser, a pagina già a schermo.
  if (pianoRichiesto) {
    redirect(`/dashboard/abbonamento?piano=${encodeURIComponent(pianoRichiesto)}`);
  }
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

  // Fase 5 (migrazione 0027): il ruolo decide cosa compare in questa pagina.
  const sessione = await ottieniSessioneTenant(supabase);
  const ruolo = sessione?.ruolo ?? "staff";
  const vedeNumeri = puoVedereAnalytics(ruolo);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nome, slug, piano, stato_abbonamento, created_at")
    .single();

  const [sedi, invitiRicevuti] = await Promise.all([
    elencaSediUtente(user.id, sessione?.tenantId ?? null),
    elencaInvitiRicevuti(user.email ?? null),
  ]);

  const metriche = tenant && profilo?.tenant_id ? await caricaMetriche(supabase, profilo.tenant_id) : null;

  // Quanti messaggi AI ha usato questo mese.
  //
  // Fino al 17/09/2026 questo numero non era scritto DA NESSUNA PARTE: quando
  // la quota finiva, l'assistente smetteva di rispondere ai clienti di un
  // salone che paga, e il titolare lo scopriva solo se glielo diceva
  // qualcuno. Mostrarlo costa una query e toglie di mezzo tutta quella
  // categoria di sorprese -- ed e' anche il miglior argomento per passare a
  // Pro, perche' chi si avvicina al tetto lo vede da solo.
  const mostraQuotaAi = !!tenant && vedeNumeri && pianoHaAccessoAIChatWeb(tenant.piano);
  const operatoriPerQuota =
    mostraQuotaAi && tenant.piano === "pro" && profilo?.tenant_id
      ? ((await supabase.from("operatori").select("id", { count: "exact", head: true }).eq("tenant_id", profilo.tenant_id))
          .count ?? 1)
      : 1;
  const quotaAi =
    mostraQuotaAi && profilo?.tenant_id
      ? {
          usati: await contaMessaggiClienteQuestoMese(supabase, profilo.tenant_id),
          limite: limiteMensileMessaggi(tenant.piano, operatoriPerQuota),
        }
      : null;

  // Link pubblico da condividere (Google Business, bio Instagram, QR in
  // negozio) -- stesso helper già usato per il link nell'email di
  // promemoria, così l'URL è sempre coerente in tutta l'app. `urlBaseSito()`
  // può restituire null solo se manca sia `NEXT_PUBLIC_SITE_URL` sia
  // l'header `host` (fail-open, vedi notifiche.server.ts): niente riquadro
  // "condividi" piuttosto che un link rotto, non dovrebbe mai capitare in
  // una richiesta reale servita da Vercel.
  const urlBase = tenant ? await urlBaseSito() : null;
  const urlPaginaPubblica = urlBase && tenant ? `${urlBase}/s/${tenant.slug}` : null;
  const qrCodeDataUrl = urlPaginaPubblica ? await generaQrCodeDataUrl(urlPaginaPubblica) : null;

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

      {invitiRicevuti.length > 0 && (
        <div className="mt-4">
          <InvitiRicevuti inviti={invitiRicevuti} />
        </div>
      )}

      {sedi.length > 1 && (
        <div className="mt-4">
          <SelettoreSede sedi={sedi} />
        </div>
      )}

      {tenant && vedeNumeri && (
        <Suspense fallback={null}>
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
          <Link href="/dashboard/lista-attesa" className="rounded border border-zinc-300 px-3 py-1.5">
            Lista d&apos;attesa
          </Link>
          {puoVedereAnalytics(ruolo) && (
            <Link href="/dashboard/analytics" className="rounded border border-zinc-300 px-3 py-1.5">
              Analytics
            </Link>
          )}
          <a href="/dashboard/configura" className="rounded border border-zinc-300 px-3 py-1.5">
            Configura l&apos;attività
          </a>
          {puoConfigurareAttivita(ruolo) && (
            <a href="/dashboard/impostazioni" className="rounded border border-zinc-300 px-3 py-1.5">
              Impostazioni
            </a>
          )}
          {puoGestireMembri(ruolo) && (
            <Link href="/dashboard/team" className="rounded border border-zinc-300 px-3 py-1.5">
              Team
            </Link>
          )}
        </div>
      )}

      {!tenant ? (
        <p className="mt-4 text-sm text-red-600">
          Nessuna attività trovata per questo utente -- il provisioning automatico non è andato a
          buon fine (controlla i log del trigger al_nuovo_utente su Supabase).
        </p>
      ) : (
        <>
          <dl className="mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Attività</dt>
            <dd>{tenant.nome}</dd>
            {vedeNumeri && (
              <>
                <dt className="text-zinc-500">Piano</dt>
                <dd>{tenant.piano}</dd>
                <dt className="text-zinc-500">Stato abbonamento</dt>
                <dd>{tenant.stato_abbonamento}</dd>
                {quotaAi && (
                  <>
                    <dt className="text-zinc-500">Messaggi dell&apos;assistente</dt>
                    <dd>
                      <span className="tabular-nums">
                        {quotaAi.usati} di {quotaAi.limite}
                      </span>
                      <span className="text-zinc-500"> questo mese</span>
                      {quotaAi.usati >= quotaAi.limite * 0.8 && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                          {quotaAi.usati >= quotaAi.limite
                            ? "esauriti: l'assistente non risponde più fino al mese prossimo"
                            : "quasi finiti"}
                        </span>
                      )}
                    </dd>
                  </>
                )}
              </>
            )}
            <dt className="text-zinc-500">Tu</dt>
            <dd>
              {profilo?.nome || user.email} ({ruolo === "owner" ? "titolare" : "collaboratore"})
            </dd>
          </dl>

          {urlPaginaPubblica && qrCodeDataUrl && (
            <CondividiLink url={urlPaginaPubblica} qrDataUrl={qrCodeDataUrl} nomeFile={`qr-${tenant.slug}`} />
          )}

          {metriche && (
            <>
              <h2 className="mt-8 text-sm font-medium text-zinc-500">Come sta andando</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <CardMetrica etichetta="Appuntamenti oggi" valore={String(metriche.appuntamentiOggi)} />
                {vedeNumeri && (
                  <CardMetrica
                    etichetta="Valore prenotato oggi"
                    valore={formatoEuro(metriche.valorePrenotazioniOggiCentesimi)}
                  />
                )}
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

              {/* Incassi previsti (Gruppo B-bis #4 di PIANO.md): proiezione sugli appuntamenti
                  già confermati nei prossimi 7/30 giorni, non un incasso reale registrato --
                  riga separata dalle metriche di "oggi" sopra per non confonderle a colpo
                  d'occhio con un dato già incassato. */}
              {vedeNumeri && (
                <>
                  <h2 className="mt-6 text-sm font-medium text-zinc-500">Incassi previsti</h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
                    <CardMetrica
                      etichetta="Prossimi 7 giorni"
                      valore={formatoEuro(metriche.incassiPrevistiCentesimi7Giorni)}
                    />
                    <CardMetrica
                      etichetta="Prossimi 30 giorni"
                      valore={formatoEuro(metriche.incassiPrevistiCentesimi30Giorni)}
                    />
                  </div>
                </>
              )}

              {metriche.clientiInattiviDa60Giorni > 0 && (
                <div className="mt-4 flex items-center justify-between rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                  <span>
                    <strong>{metriche.clientiInattiviDa60Giorni}</strong>{" "}
                    {metriche.clientiInattiviDa60Giorni === 1
                      ? "cliente non prenota"
                      : "clienti non prenotano"}{" "}
                    da oltre {metriche.giorniInattivitaUsati} giorni.
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
