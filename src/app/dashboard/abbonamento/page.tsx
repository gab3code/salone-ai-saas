import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoGestireFatturazione } from "@/lib/ruoli";
import { pianoEPagante, ETICHETTA_PIANO, PIANI_PAGANTI } from "@/lib/stripe/piani";
import {
  PREZZO_BASE_CENTESIMI,
  PREZZO_OPERATORE_EXTRA_CENTESIMI,
  formatoEuroDaCentesimi,
  prezzoMensileCentesimi,
} from "@/lib/piani";
import { leggiDatiFatturazione } from "@/lib/fatturazione.server";
import { ModuloFatturazione } from "../fatturazione/modulo";
import { PulsantePortaleAbbonamento } from "../impostazioni/pulsante-portale-abbonamento";

export const dynamic = "force-dynamic";

/**
 * L'unica pagina dell'abbonamento: listino, scelta del piano e dati per la
 * fattura, in un posto solo (17/09/2026).
 *
 * Nasce da due difetti che si vedevano usando il prodotto, non leggendolo.
 * Il primo: per attivare un piano si passava da quattro schermate --
 * registrazione, un lampo di dashboard, i dati fattura, di nuovo un lampo di
 * dashboard, e infine Stripe. Il secondo: dalle impostazioni, "passa a un
 * piano a pagamento" rimandava alla sezione prezzi della LANDING, cioè
 * spediva fuori dall'applicazione qualcuno che era già dentro e già
 * riconosciuto. Era un ripiego di quando dentro l'app non esisteva nessun
 * posto dove scegliere un piano. Adesso esiste, ed è questo.
 *
 * Con `?piano=` si arriva già con la scelta fatta (dalla registrazione o dal
 * listino qui sotto) e si vede solo quello che serve per attivarlo.
 */
export default async function PaginaAbbonamento({
  searchParams,
}: {
  searchParams: Promise<{ piano?: string }>;
}) {
  const supabase = await creaClientServer();
  const sessione = await ottieniSessioneTenant(supabase);
  if (!sessione) redirect("/accedi");
  if (!puoGestireFatturazione(sessione.ruolo)) redirect("/dashboard");

  const { data: tenant } = await supabase
    .from("tenants")
    .select("piano, stato_abbonamento")
    .eq("id", sessione.tenantId)
    .single();
  const pianoAttuale = (tenant?.piano as string) ?? "free";

  // Gli operatori configurati decidono il prezzo vero: la quota per operatore
  // cambia con il piano (10 su Starter, 15 su Growth, 20 su Pro), quindi un
  // salone con tre persone che passa da Starter a Growth non va da 19,90 a
  // 39,90 ma da 39,90 a 69,90. Mostrare solo il prezzo base significherebbe
  // fargli scoprire il resto sulla schermata di pagamento, che è il posto
  // peggiore per una sorpresa.
  const { count: numeroOperatori } = await supabase
    .from("operatori")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", sessione.tenantId);
  const operatori = numeroOperatori ?? 0;
  const operatoriExtra = Math.max(0, operatori - 1);

  // Chi ha già un abbonamento vivo non passa da qui per cambiare piano: il
  // checkout glielo rifiuterebbe (creerebbe un SECONDO abbonamento sullo
  // stesso cliente, il difetto da 109,80 € al mese chiuso stanotte), quindi
  // portarlo fino al modulo e fermarlo alla fine sarebbe un vicolo cieco
  // servito tardi. Gli si mostra subito la strada giusta.
  const giaAbbonato = pianoAttuale !== "free";

  const sp = await searchParams;
  const scelto = !giaAbbonato && pianoEPagante(sp.piano) ? sp.piano : null;
  const dati = scelto ? await leggiDatiFatturazione(supabase, sessione.tenantId) : null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Link href="/dashboard" className="text-sm underline">
        ← Dashboard
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Abbonamento</h1>
        <p className="text-sm text-zinc-500">
          Piano attuale: <span className="font-medium capitalize text-zinc-800">{pianoAttuale}</span>
          {tenant?.stato_abbonamento ? ` · ${tenant.stato_abbonamento}` : ""}
        </p>
      </header>

      {scelto === null ? (
        <>
          <div className="grid max-w-3xl gap-3 sm:grid-cols-3">
            {PIANI_PAGANTI.map((piano) => {
              const eAttuale = piano === pianoAttuale;
              return (
                <div
                  key={piano}
                  className={`flex flex-col gap-2 rounded-2xl border p-4 ${
                    eAttuale ? "border-zinc-900" : "border-zinc-200"
                  }`}
                >
                  <p className="text-sm font-medium">{ETICHETTA_PIANO[piano]}</p>
                  <p className="text-lg font-semibold">
                    {formatoEuroDaCentesimi(prezzoMensileCentesimi(piano, operatori))}
                    <span className="text-sm font-normal text-zinc-500">/mese</span>
                  </p>
                  {operatoriExtra > 0 && (
                    <p className="text-xs text-zinc-500">
                      {formatoEuroDaCentesimi(PREZZO_BASE_CENTESIMI[piano] ?? 0)} di piano +{" "}
                      {operatoriExtra}{" "}
                      {operatoriExtra === 1 ? "operatore in più" : "operatori in più"} da{" "}
                      {formatoEuroDaCentesimi(PREZZO_OPERATORE_EXTRA_CENTESIMI[piano] ?? 0)}
                    </p>
                  )}
                  {eAttuale ? (
                    <span className="mt-auto text-xs text-zinc-500">È il tuo piano</span>
                  ) : giaAbbonato ? (
                    <span className="mt-auto text-xs text-zinc-500">
                      Si cambia dal portale qui sotto
                    </span>
                  ) : (
                    <Link
                      href={`/dashboard/abbonamento?piano=${piano}`}
                      className="mt-auto rounded-lg bg-zinc-900 px-3 py-1.5 text-center text-xs font-medium text-white"
                    >
                      Attiva
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <p className="max-w-3xl text-xs text-zinc-500">
            {operatoriExtra > 0
              ? `Le cifre qui sopra sono quelle che pagheresti tu, con i ${operatori} operatori che hai adesso: il prezzo del piano include il primo, gli altri hanno una quota che cambia da piano a piano. Se assumi o togli qualcuno, l'abbonamento si aggiorna da solo.`
              : "Il prezzo include un operatore. Ogni operatore in più ha una quota mensile che cambia da piano a piano, e l'abbonamento si aggiorna da solo quando ne aggiungi o ne togli uno."}{" "}
            I piani a pagamento richiedono una partita IVA, perché per legge dobbiamo emettere
            fattura per ogni pagamento.
          </p>

          {giaAbbonato && (
            <div className="max-w-3xl rounded-2xl border border-zinc-200 p-4">
              <p className="text-sm font-medium text-zinc-700">Gestisci il tuo abbonamento</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Cambio di piano, carta, ricevute e disdetta si fanno dal portale: così
                l&apos;abbonamento attuale viene sostituito invece di affiancargliene un secondo, e
                la differenza viene conguagliata subito.
              </p>
              <PulsantePortaleAbbonamento />
            </div>
          )}

          <Link href="/dashboard/fatturazione" className="text-sm underline">
            Dati per la fattura
          </Link>
        </>
      ) : (
        <>
          <section className="max-w-xl rounded-2xl border border-zinc-900 p-4">
            <p className="text-sm text-zinc-500">Stai attivando</p>
            <p className="mt-1 text-lg font-semibold">
              {ETICHETTA_PIANO[scelto]} ·{" "}
              {formatoEuroDaCentesimi(prezzoMensileCentesimi(scelto, operatori))}
              <span className="text-sm font-normal text-zinc-500">/mese</span>
            </p>
            {operatoriExtra > 0 && (
              <p className="text-sm text-zinc-500">
                {formatoEuroDaCentesimi(PREZZO_BASE_CENTESIMI[scelto] ?? 0)} di piano, più{" "}
                {operatoriExtra} {operatoriExtra === 1 ? "operatore" : "operatori"} oltre il primo
                da {formatoEuroDaCentesimi(PREZZO_OPERATORE_EXTRA_CENTESIMI[scelto] ?? 0)} ciascuno.
              </p>
            )}
            <Link
              href="/dashboard/abbonamento"
              className="mt-2 inline-block text-xs text-zinc-500 underline"
            >
              scegli un altro piano
            </Link>
          </section>

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-zinc-700">Dati per la fattura</h2>
            <p className="max-w-xl text-sm text-zinc-500">
              Te li chiediamo una volta sola. Ogni volta che paghi siamo tenuti per legge a
              emetterti una fattura elettronica, e per compilarla servono questi campi.
            </p>
          </div>

          <ModuloFatturazione
            iniziali={dati!}
            piano={scelto}
            etichettaBottone={`Attiva ${ETICHETTA_PIANO[scelto]}`}
          />
        </>
      )}
    </div>
  );
}
