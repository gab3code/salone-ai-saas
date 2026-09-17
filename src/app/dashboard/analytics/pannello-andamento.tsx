"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import type { ConfrontoPeriodo, Periodo, PuntoAndamento } from "@/lib/analytics";

/**
 * Le due card in cima piu' il grafico, presi insieme perche' sono un
 * comando solo: si sceglie la card e il grafico sotto cambia serie.
 *
 * Perche' UNA serie per volta invece dei due grafici affiancati di prima:
 * prenotazioni e nuovi clienti vivono su scale diverse (decine contro
 * unita'). Messi nello stesso grafico servirebbero due assi verticali, che
 * e' il modo piu' rapido di far leggere a qualcuno una correlazione che non
 * c'e'; messi in due grafici affiancati, come erano fino al 17/09/2026,
 * nessuno dei due ha abbastanza spazio e gli assi non sono comparabili
 * lo stesso. La soluzione presa dalla demo pubblica di Plausible (guardata
 * il 17/09/2026): un grafico solo, grande, e le card fanno da interruttore.
 *
 * Le card portano anche la variazione sul periodo precedente. "48
 * prenotazioni" da solo non dice a un titolare se sta andando bene; "48, il
 * 12% in piu' del trimestre prima" si'.
 */

type Serie = "prenotazioni" | "clienti";

const SERIE: Record<Serie, { etichetta: string; chiave: keyof PuntoAndamento; unita: string }> = {
  prenotazioni: { etichetta: "Prenotazioni confermate", chiave: "prenotazioniConfermate", unita: "prenotazioni" },
  clienti: { etichetta: "Nuovi clienti", chiave: "nuoviClienti", unita: "nuovi clienti" },
};

function Variazione({ valore }: { valore: number | null }) {
  if (valore === null) {
    // Da zero non esiste una percentuale: si dice cos'e' successo, non si
    // inventa un numero.
    return <span className="text-xs text-zinc-400">nessun confronto</span>;
  }
  if (valore === 0) return <span className="text-xs text-zinc-500">stabile</span>;
  const sale = valore > 0;
  return (
    <span className={`text-xs font-medium ${sale ? "text-emerald-600" : "text-red-600"}`}>
      {sale ? "↑" : "↓"} {Math.abs(valore)}%
    </span>
  );
}

function Card({
  etichetta,
  valore,
  variazione,
  selezionata,
  onSelect,
}: {
  etichetta: string;
  valore: number;
  variazione: number | null;
  selezionata: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selezionata}
      className={`flex flex-1 flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors ${
        selezionata ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white hover:bg-zinc-50"
      }`}
    >
      <span className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{etichetta}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-zinc-900 tabular-nums">{valore}</span>
        <Variazione valore={variazione} />
      </span>
    </button>
  );
}

// I generici vanno lasciati quelli di Recharts (`TooltipValueType`, e il
// nome come `string | number`): stringendoli a <number, string> il
// componente non e' piu' assegnabile alla prop `content` del Tooltip, che
// li dichiara larghi. Il valore si restringe qui dentro, non nella firma.
function Riquadro({ active, payload, label }: TooltipContentProps<TooltipValueType, string | number>) {
  if (!active || !payload?.length) return null;
  const voce = payload[0];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-zinc-900">{String(label ?? "")}</p>
      <p className="text-zinc-600">
        {String(voce.value ?? 0)} {String(voce.name ?? "")}
      </p>
    </div>
  );
}

export function PannelloAndamento({
  punti,
  confronto,
  periodo,
}: {
  punti: PuntoAndamento[];
  confronto: ConfrontoPeriodo;
  periodo: Periodo;
}) {
  const [serie, setSerie] = useState<Serie>("prenotazioni");
  const scelta = SERIE[serie];
  const vuoto = punti.every((p) => p.prenotazioniConfermate === 0 && p.nuoviClienti === 0);

  // Un'etichetta ogni N, altrimenti su 28 giorni si sovrappongono. Il
  // numero segue la lunghezza della serie invece di essere fisso.
  const passoEtichette = Math.max(1, Math.ceil(punti.length / 7));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Card
          etichetta={SERIE.prenotazioni.etichetta}
          valore={confronto.attuale.prenotazioniConfermate}
          variazione={confronto.variazionePrenotazioni}
          selezionata={serie === "prenotazioni"}
          onSelect={() => setSerie("prenotazioni")}
        />
        <Card
          etichetta={SERIE.clienti.etichetta}
          valore={confronto.attuale.nuoviClienti}
          variazione={confronto.variazioneNuoviClienti}
          selezionata={serie === "clienti"}
          onSelect={() => setSerie("clienti")}
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-zinc-900">{scelta.etichetta}</h2>
          <span className="text-xs text-zinc-400">
            {periodo.etichetta}, {periodo.granularita === "giorno" ? "giorno per giorno" : `per ${periodo.granularita}`}
          </span>
        </div>

        {vuoto ? (
          <p className="mt-6 mb-2 text-sm text-zinc-600">
            Nessuna prenotazione confermata e nessun cliente nuovo in questo periodo. Il grafico si popola da solo
            appena arrivano i primi dati: non c&apos;è niente da configurare.
          </p>
        ) : (
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={punti} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sfumaturaAndamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--grafico-accento)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--grafico-accento)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis
                  dataKey="etichetta"
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  tickLine={false}
                  axisLine={false}
                  interval={passoEtichette - 1}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#a1a1aa" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={44}
                />
                <Tooltip content={Riquadro} cursor={{ stroke: "#d4d4d8" }} />
                <Area
                  type="monotone"
                  dataKey={scelta.chiave as string}
                  name={scelta.unita}
                  stroke="var(--grafico-accento)"
                  strokeWidth={2}
                  fill="url(#sfumaturaAndamento)"
                  // Niente pallino su ogni punto: su 28 giorni sono 28
                  // dischetti che coprono la linea. Compare solo dove il
                  // mouse si ferma.
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
