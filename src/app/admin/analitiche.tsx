import {
  formatoEuroDaCentesimi,
  formatoPercentuale,
  type Ricavi,
} from "@/lib/admin";
import type { Coorte, GradinoImbuto, MetrichePiattaforma, PuntoSettimana } from "@/lib/admin-metriche";

/**
 * Le metriche di piattaforma, sopra l'elenco delle attività (17/09/2026).
 *
 * Due colori soli in tutta la sezione, blu per l'assistente AI e arancio per
 * il lavoro fatto a mano: sono la coppia 1-2 della palette categorica
 * standard, verificata per il daltonismo (ΔE 24.7 protanopia, 33.6 a vista
 * normale) prima di essere usata. Non si aggiungono altre serie: se un
 * giorno servissero, vanno rivalidate insieme, non scelte a occhio.
 *
 * Ogni percentuale è scritta accanto ai suoi valori assoluti. Con dieci
 * saloni "il 30% è a rischio" vuol dire "tre", e la percentuale da sola fa
 * sembrare statistica quella che è aritmetica su numeri piccoli.
 */

const COLORE_AI = "#2a78d6";
const COLORE_MANUALE = "#eb6834";

export function Analitiche({
  ricavi,
  metriche,
}: {
  ricavi: Ricavi;
  metriche: MetrichePiattaforma;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Ricavo ricavi={ricavi} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Imbuto gradini={metriche.imbuto} mediana={metriche.medianaGiorniPrimaPrenotazione} />
        <ComeVaIlProdotto uso={metriche.uso} />
      </div>
      <Prenotazioni serie={metriche.serie} />
      <Coorti coorti={metriche.coorti} />
    </div>
  );
}

function Riquadro({
  titolo,
  nota,
  children,
}: {
  titolo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-medium text-zinc-900">{titolo}</h2>
      {nota && <p className="mt-0.5 text-xs text-zinc-400">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Ricavo({ ricavi }: { ricavi: Ricavi }) {
  const haRicavi = ricavi.mrrCentesimi > 0;

  return (
    <Riquadro
      titolo="Ricavo mensile ricorrente (stimato)"
      nota="Solo attività con un abbonamento Stripe attivo, ai prezzi di listino. La verità sulla fatturazione resta Stripe."
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-3xl font-semibold tracking-tight text-zinc-900">
          {formatoEuroDaCentesimi(ricavi.mrrCentesimi)}
        </span>
        <span className="text-sm text-zinc-500">
          da {ricavi.paganti} {ricavi.paganti === 1 ? "attività pagante" : "attività paganti"}
          {ricavi.paganti > 0 && ` · ${formatoEuroDaCentesimi(ricavi.arpaCentesimi)} in media`}
        </span>
      </div>

      {haRicavi && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Voce
            etichetta="Dai piani"
            valore={formatoEuroDaCentesimi(ricavi.baseCentesimi)}
            nota={`${formatoPercentuale(ricavi.baseCentesimi / ricavi.mrrCentesimi)} del totale`}
          />
          <Voce
            etichetta="Dagli operatori extra"
            valore={formatoEuroDaCentesimi(ricavi.operatoriCentesimi)}
            nota={
              ricavi.operatoriCentesimi > 0
                ? `${formatoPercentuale(ricavi.operatoriCentesimi / ricavi.mrrCentesimi)} del totale`
                : "nessuno finora"
            }
          />
          <Voce
            etichetta="Dal cliente più grande"
            valore={formatoPercentuale(ricavi.concentrazione)}
            nota={
              ricavi.concentrazione >= 0.4
                ? "perderlo significherebbe perdere questa fetta"
                : "nessuna dipendenza da un solo cliente"
            }
            allarme={ricavi.concentrazione >= 0.4}
          />
          <Voce
            etichetta="A rischio"
            valore={formatoEuroDaCentesimi(ricavi.aRischioCentesimi)}
            nota={
              ricavi.aRischioCentesimi > 0
                ? "attività paganti con un segnale grave"
                : "nessuna attività pagante in allarme"
            }
            allarme={ricavi.aRischioCentesimi > 0}
          />
        </dl>
      )}

      {ricavi.perPiano.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
          {ricavi.perPiano.map((p) => (
            <li key={p.piano}>
              <span className="font-medium text-zinc-700">{p.piano}</span>: {p.paganti} ·{" "}
              {formatoEuroDaCentesimi(p.mrrCentesimi)}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-zinc-500">
        Fuori dal totale: {ricavi.inProva} in prova, {ricavi.omaggio} attive senza abbonamento
        Stripe (omaggio o piano messo a mano), {ricavi.aPreventivo} su Enterprise a preventivo.
      </p>
    </Riquadro>
  );
}

function Voce({
  etichetta,
  valore,
  nota,
  allarme,
}: {
  etichetta: string;
  valore: string;
  nota?: string;
  allarme?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{etichetta}</dt>
      <dd className={`mt-0.5 text-lg font-semibold ${allarme ? "text-red-700" : "text-zinc-900"}`}>
        {valore}
      </dd>
      {nota && <p className="text-xs text-zinc-400">{nota}</p>}
    </div>
  );
}

function Imbuto({ gradini, mediana }: { gradini: GradinoImbuto[]; mediana: number | null }) {
  const partenza = gradini[0]?.quante ?? 0;

  return (
    <Riquadro
      titolo="Dove si fermano"
      nota="Ogni gradino è un sottoinsieme di quello sopra: la differenza fra due righe è quante si sono perse lì."
    >
      <ul className="flex flex-col gap-2">
        {gradini.map((gradino, indice) => {
          const precedente = indice > 0 ? gradini[indice - 1].quante : null;
          const perse = precedente !== null ? precedente - gradino.quante : 0;
          const larghezza = partenza > 0 ? (gradino.quante / partenza) * 100 : 0;
          return (
            <li key={gradino.etichetta}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-700">{gradino.etichetta}</span>
                <span className="text-zinc-500">
                  {gradino.quante}
                  {perse > 0 && <span className="text-zinc-400"> · {perse} perse qui</span>}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-zinc-100">
                <div
                  className="h-full rounded"
                  style={{ width: `${larghezza}%`, backgroundColor: COLORE_AI }}
                />
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">{gradino.spiegazione}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-zinc-500">
        {mediana === null
          ? "Nessuna attività ha ancora ricevuto la prima prenotazione."
          : `Dall'iscrizione alla prima prenotazione: ${mediana} ${mediana === 1 ? "giorno" : "giorni"} (mediana).`}
      </p>
    </Riquadro>
  );
}

function ComeVaIlProdotto({ uso }: { uso: MetrichePiattaforma["uso"] }) {
  const quota = (parte: number, tutto: number) => (tutto > 0 ? formatoPercentuale(parte / tutto) : "--");

  return (
    <Riquadro
      titolo="Come va il prodotto"
      nota="Conteggi su tutta la piattaforma. Nessun contenuto di conversazioni o dati dei clienti finali."
    >
      <dl className="grid grid-cols-2 gap-3">
        <Voce
          etichetta="Prenotazioni prese dall'AI"
          valore={String(uso.presiDallAi)}
          nota={`${quota(uso.presiDallAi, uso.appuntamenti)} di ${uso.appuntamenti} totali`}
        />
        <Voce
          etichetta="Passate a una persona"
          valore={String(uso.passateAOperatore)}
          nota={`${quota(uso.passateAOperatore, uso.conversazioni)} di ${uso.conversazioni} conversazioni`}
        />
        <Voce
          etichetta="No-show"
          valore={String(uso.noShow)}
          nota={`${quota(uso.noShow, uso.appuntamenti)} degli appuntamenti`}
        />
        <Voce
          etichetta="Cancellati"
          valore={String(uso.cancellati)}
          nota={`${quota(uso.cancellati, uso.appuntamenti)} degli appuntamenti`}
        />
      </dl>
      <p className="mt-3 text-xs text-zinc-500">
        {uso.mediaValutazioni === null
          ? "Nessuna recensione ancora raccolta."
          : `${uso.recensioni} recensioni, media ${uso.mediaValutazioni.toFixed(1)} su 5.`}
      </p>
    </Riquadro>
  );
}

function Prenotazioni({ serie }: { serie: PuntoSettimana[] }) {
  const massimo = Math.max(...serie.map((p) => p.totale), 1);
  const totale = serie.reduce((somma, p) => somma + p.totale, 0);
  const totaleAi = serie.reduce((somma, p) => somma + p.ai, 0);
  const indiceMassimo = serie.findIndex((p) => p.totale === massimo && p.totale > 0);

  return (
    <Riquadro
      titolo="Prenotazioni per settimana"
      nota="Ultime 12 settimane, su tutta la piattaforma. Le settimane vuote restano nel grafico: sono l'informazione, non un buco da nascondere."
    >
      {totale === 0 ? (
        <p className="text-sm text-zinc-500">Nessuna prenotazione nelle ultime 12 settimane.</p>
      ) : (
        <>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: COLORE_AI }} />
              Assistente AI
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: COLORE_MANUALE }} />
              A mano
            </span>
          </div>

          <div className="mt-3 flex h-36 items-end gap-1.5">
            {serie.map((punto, indice) => {
              const altezza = (punto.totale / massimo) * 100;
              return (
                <div key={punto.inizio} className="group relative flex h-full flex-1 flex-col justify-end">
                  {indice === indiceMassimo && (
                    <span className="mb-1 text-center text-[10px] font-medium text-zinc-500">
                      {punto.totale}
                    </span>
                  )}
                  <div
                    className="flex w-full flex-col justify-end gap-0.5"
                    style={{ height: `${altezza}%` }}
                  >
                    {punto.manuali > 0 && (
                      <div
                        className="w-full rounded-t"
                        style={{
                          backgroundColor: COLORE_MANUALE,
                          flexGrow: punto.manuali,
                          // Angoli arrotondati solo in cima alla pila, come
                          // vuole la regola sui "data end": la base resta
                          // ancorata all'asse.
                          borderRadius: "4px 4px 0 0",
                        }}
                      />
                    )}
                    {punto.ai > 0 && (
                      <div
                        className="w-full"
                        style={{
                          backgroundColor: COLORE_AI,
                          flexGrow: punto.ai,
                          borderRadius: punto.manuali > 0 ? 0 : "4px 4px 0 0",
                        }}
                      />
                    )}
                  </div>
                  {/* Tooltip al passaggio del mouse, senza JavaScript. */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 text-[11px] text-white group-hover:block">
                    settimana del {punto.etichetta}: {punto.totale} ({punto.ai} AI, {punto.manuali} a
                    mano)
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-1 flex gap-1.5 text-[10px] text-zinc-400">
            {serie.map((punto, indice) => (
              <span key={punto.inizio} className="flex-1 text-center">
                {indice % 3 === 0 || indice === serie.length - 1 ? punto.etichetta : ""}
              </span>
            ))}
          </div>

          <p className="mt-3 text-xs text-zinc-500">
            {totale} prenotazioni in 12 settimane, {totaleAi} prese dall&apos;assistente (
            {formatoPercentuale(totaleAi / totale)}).
          </p>
        </>
      )}
    </Riquadro>
  );
}

function Coorti({ coorti }: { coorti: Coorte[] }) {
  if (coorti.length === 0) return null;

  return (
    <Riquadro
      titolo="Chi è entrato, e chi è rimasto"
      nota='"Vive" = hanno ricevuto almeno una prenotazione negli ultimi 30 giorni. Se la colonna peggiora di mese in mese, il problema non è trovare clienti.'
    >
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="pb-2 font-normal">Iscritte nel mese</th>
            <th className="pb-2 text-right font-normal">Iscritte</th>
            <th className="pb-2 text-right font-normal">Configurate</th>
            <th className="pb-2 text-right font-normal">Vive</th>
            <th className="pb-2 text-right font-normal">Paganti</th>
          </tr>
        </thead>
        <tbody>
          {coorti.map((coorte) => (
            <tr key={coorte.mese} className="border-t border-zinc-100">
              <td className="py-1.5 text-zinc-700">{coorte.etichetta}</td>
              <td className="py-1.5 text-right text-zinc-700">{coorte.iscritte}</td>
              <td className="py-1.5 text-right text-zinc-700">{coorte.configurate}</td>
              <td className="py-1.5 text-right text-zinc-700">{coorte.vive}</td>
              <td className="py-1.5 text-right text-zinc-700">{coorte.paganti}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Riquadro>
  );
}
