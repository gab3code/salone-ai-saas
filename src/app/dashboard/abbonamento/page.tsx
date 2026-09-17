import Link from "next/link";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoGestireFatturazione } from "@/lib/ruoli";
import { pianoEPagante, ETICHETTA_PIANO, PIANI_PAGANTI, giorniDiProva } from "@/lib/stripe/piani";
import { PREZZO_BASE_CENTESIMI, formatoEuroDaCentesimi } from "@/lib/admin";
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

  const sp = await searchParams;
  const scelto = pianoEPagante(sp.piano) ? sp.piano : null;
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
              const giorni = giorniDiProva(piano);
              return (
                <div
                  key={piano}
                  className={`flex flex-col gap-2 rounded-2xl border p-4 ${
                    eAttuale ? "border-zinc-900" : "border-zinc-200"
                  }`}
                >
                  <p className="text-sm font-medium">{ETICHETTA_PIANO[piano]}</p>
                  <p className="text-lg font-semibold">
                    {formatoEuroDaCentesimi(PREZZO_BASE_CENTESIMI[piano] ?? 0)}
                    <span className="text-sm font-normal text-zinc-500">/mese</span>
                  </p>
                  {giorni !== undefined && (
                    <p className="text-xs text-emerald-700">{giorni} giorni di prova</p>
                  )}
                  {eAttuale ? (
                    <span className="mt-auto text-xs text-zinc-500">È il tuo piano</span>
                  ) : (
                    <Link
                      href={`/dashboard/abbonamento?piano=${piano}`}
                      className="mt-auto rounded-lg bg-zinc-900 px-3 py-1.5 text-center text-xs font-medium text-white"
                    >
                      {pianoAttuale === "free" ? "Attiva" : "Passa a questo"}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <p className="max-w-3xl text-xs text-zinc-500">
            Il prezzo include il primo operatore. Ogni operatore in più costa una quota fissa che
            dipende dal piano. I piani a pagamento richiedono una partita IVA, perché siamo tenuti
            a emettere fattura per ogni pagamento.
          </p>

          {pianoAttuale !== "free" && (
            <div className="max-w-3xl rounded-2xl border border-zinc-200 p-4">
              <p className="text-sm font-medium text-zinc-700">Metodo di pagamento e fatture</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Carta, ricevute e disdetta si gestiscono dal portale di Stripe.
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
              {formatoEuroDaCentesimi(PREZZO_BASE_CENTESIMI[scelto] ?? 0)}
              <span className="text-sm font-normal text-zinc-500">/mese</span>
            </p>
            {giorniDiProva(scelto) !== undefined && (
              <p className="text-sm text-emerald-700">
                {giorniDiProva(scelto)} giorni di prova prima del primo addebito.
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
              Ce li chiediamo una volta sola. Servono per emetterti la fattura elettronica di ogni
              pagamento: per legge dobbiamo emetterla, quindi senza non possiamo attivare il piano.
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
