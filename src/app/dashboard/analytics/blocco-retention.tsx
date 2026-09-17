import Link from "next/link";
import {
  FINESTRA_PREDEFINITA,
  MINIMO_CLIENTI_PER_PERCENTUALE,
  finestraPiuVicinaA,
  type Retention,
  type RigaRetention,
} from "@/lib/retention";

/**
 * Quanti clienti tornano.
 *
 * Tutta la curva insieme, non una finestra per volta dietro a un menu.
 * Gabriel aveva proposto un selettore (settimana / mese / 3 / 6 / 12 mesi) e
 * poi mi ha lasciato la scelta dell'interfaccia: la curva completa e' la
 * risposta, non una delle sue righe. Il titolare che legge 12 / 41 / 63 / 71
 * vede DOVE perde i clienti, che e' la cosa su cui puo' agire; con un
 * selettore dovrebbe aprirlo cinque volte e tenere i numeri a mente per
 * fare lo stesso ragionamento.
 *
 * Ogni barra porta due numeri sulla stessa coorte (decisione di Gabriel del
 * 17/09/2026): la parte piena e' chi si e' davvero presentato, quella
 * chiara chi ha riprenotato ma poi non e' venuto. La distanza fra le due
 * e' quanto costano le assenze, ed e' visibile senza dover leggere un
 * numero.
 */

function Barra({ riga }: { riga: RigaRetention }) {
  const insufficienti = riga.percentualeRiprenotati === null;
  const presentati = riga.percentualePresentati ?? 0;
  const soloRiprenotati = Math.max(0, (riga.percentualeRiprenotati ?? 0) - presentati);

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-32 shrink-0 text-sm text-zinc-600">{riga.etichetta}</span>

      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
        {!insufficienti && (
          <div className="flex h-full">
            <div className="h-full bg-zinc-900" style={{ width: `${presentati}%` }} />
            <div className="h-full bg-zinc-300" style={{ width: `${soloRiprenotati}%` }} />
          </div>
        )}
      </div>

      <span className="w-14 shrink-0 text-right text-sm font-medium text-zinc-900 tabular-nums">
        {insufficienti ? "--" : `${riga.percentualeRiprenotati}%`}
      </span>
      <span className="w-28 shrink-0 text-right text-xs text-zinc-400 tabular-nums">
        {insufficienti
          ? `${riga.clientiValutabili} client${riga.clientiValutabili === 1 ? "e" : "i"}`
          : `su ${riga.clientiValutabili} client${riga.clientiValutabili === 1 ? "e" : "i"}`}
      </span>
    </div>
  );
}

export function BloccoRetention({
  retention,
  giorniFollowUp,
}: {
  retention: Retention;
  giorniFollowUp: number;
}) {
  const qualcosaDaMostrare = retention.nuoviClienti.some((r) => r.percentualeRiprenotati !== null);
  const finestraCollegata = finestraPiuVicinaA(giorniFollowUp);
  const rigaCollegata = retention.nuoviClienti.find((r) => r.chiave === finestraCollegata.chiave);
  const abituali = retention.abituali.find((r) => r.chiave === FINESTRA_PREDEFINITA);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-medium text-zinc-900">Quanti clienti tornano</h2>
        <p className="mt-1 max-w-2xl text-xs text-zinc-500">
          Dei clienti venuti da te per la prima volta, quanti sono tornati per una seconda. Chi è arrivato da poco
          non è conteggiato finché non ha avuto il tempo di tornare: senza questa esclusione il numero peggiorerebbe
          da solo ogni volta che arriva un cliente nuovo.
        </p>
      </div>

      {qualcosaDaMostrare ? (
        <>
          <div>{retention.nuoviClienti.map((r) => <Barra key={r.chiave} riga={r} />)}</div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-zinc-900" /> si sono presentati
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-zinc-300" /> hanno riprenotato ma non sono venuti
            </span>
            <span className="text-zinc-400">
              Sotto {MINIMO_CLIENTI_PER_PERCENTUALE} clienti non mostriamo una percentuale: non direbbe niente.
            </span>
          </div>

          {abituali?.percentualeRiprenotati !== null && abituali !== undefined && (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700">
              <strong>Clienti già abituali:</strong> di chi ha fatto almeno due visite, il{" "}
              <strong>{abituali.percentualePresentati}%</strong> ne ha fatta una terza entro tre mesi dalla seconda.
              È il numero che dice se il salone trattiene chi ha già scelto di tornare una volta.
            </p>
          )}

          {rigaCollegata?.percentualeRiprenotati !== null && rigaCollegata !== undefined && (
            <p className="text-xs text-zinc-500">
              Il tuo messaggio di recupero parte dopo <strong>{giorniFollowUp} giorni</strong> senza prenotare, e{" "}
              {rigaCollegata.etichetta} torna da solo il <strong>{rigaCollegata.percentualePresentati}%</strong> dei
              clienti nuovi.{" "}
              <Link href="/dashboard/impostazioni/promemoria" className="underline">
                Cambia la soglia
              </Link>
              .
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-zinc-600">
          Non ci sono ancora abbastanza clienti con storia alle spalle per dire quanti tornano. Serve che almeno{" "}
          {MINIMO_CLIENTI_PER_PERCENTUALE} clienti siano venuti una prima volta e abbiano avuto il tempo di tornare:
          il riquadro si riempie da solo, cominciando dalla riga &quot;entro 1 settimana&quot;.
        </p>
      )}
    </div>
  );
}
