import type { PuntoAndamento } from "@/lib/analytics";

/**
 * Grafico a barre scritto a mano (niente Recharts/Chart.js/ecc.): due serie
 * semplici su 12 colonne non giustificano una nuova dipendenza (bundle,
 * manutenzione) quando bastano dei div con altezza percentuale -- stesso
 * spirito "componenti costruiti a mano" già usato altrove nel progetto (es.
 * CompareSlider). Server Component: nessuno stato, il `title` nativo
 * dell'HTML basta come tooltip al passaggio del mouse, zero JavaScript
 * lato client necessario.
 */
function Barre({
  punti,
  valoreDi,
  coloreClasse,
  etichetta,
}: {
  punti: PuntoAndamento[];
  valoreDi: (p: PuntoAndamento) => number;
  coloreClasse: string;
  etichetta: string;
}) {
  const massimo = Math.max(1, ...punti.map(valoreDi));
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-900">{etichetta}</h2>
        <span className="text-xs text-zinc-400">Ultime {punti.length} settimane</span>
      </div>
      <div className="mt-4 flex h-32 items-end gap-1.5">
        {punti.map((p, i) => {
          const valore = valoreDi(p);
          const percentuale = Math.round((valore / massimo) * 100);
          const etichettaSettimana = p.inizioSettimana.toLocaleDateString("it-IT", {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          });
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`Settimana del ${etichettaSettimana}: ${valore}`}>
              <div className="flex h-full w-full items-end">
                <div
                  className={`w-full rounded-t ${coloreClasse} ${valore === 0 ? "min-h-[2px]" : ""}`}
                  style={{ height: `${valore === 0 ? 1 : percentuale}%` }}
                />
              </div>
              {i % 2 === 0 && <span className="text-[10px] text-zinc-400">{etichettaSettimana}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GraficoAndamento({ punti }: { punti: PuntoAndamento[] }) {
  const totalePrenotazioni = punti.reduce((s, p) => s + p.prenotazioniConfermate, 0);
  const totaleNuoviClienti = punti.reduce((s, p) => s + p.nuoviClienti, 0);

  if (totalePrenotazioni === 0 && totaleNuoviClienti === 0) {
    return (
      <p className="max-w-md rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        Ancora nessuna prenotazione confermata o nuovo cliente nelle ultime 12 settimane: il grafico si popola da
        solo appena arrivano i primi dati.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="flex-1">
        <Barre
          punti={punti}
          valoreDi={(p) => p.prenotazioniConfermate}
          coloreClasse="bg-zinc-900"
          etichetta="Prenotazioni confermate"
        />
      </div>
      <div className="flex-1">
        <Barre punti={punti} valoreDi={(p) => p.nuoviClienti} coloreClasse="bg-violet-500" etichetta="Nuovi clienti" />
      </div>
    </div>
  );
}
