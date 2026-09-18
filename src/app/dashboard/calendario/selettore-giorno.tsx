"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { formattaGiornoEsteso } from "@/lib/data-italiana";

/**
 * Il selettore del giorno del calendario.
 *
 * Nasce da una confusione vera (18/09/2026): il giorno si poteva cambiare in
 * due posti -- le frecce in cima e un secondo campo data dentro "Nuovo
 * appuntamento" -- e scrivevano lo stesso parametro nell'URL, quindi toccarne
 * uno muoveva l'altro. Due controlli che si rispecchiano sembrano due cose
 * diverse che si influenzano per sbaglio: sono una sola, e adesso si vede una
 * sola volta.
 *
 * La data resta `AAAA-MM-GG` nell'URL (e' il formato con cui viaggia nel
 * database e nel motore), ma accanto si legge in italiano: "2026-09-21" in
 * un'agenda lascia il dubbio se 09 sia il mese o il giorno.
 */
export function SelettoreGiorno({ dataYMD }: { dataYMD: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function vaiAlGiorno(nuovaData: string) {
    if (!nuovaData) return; // il campo data puo' essere svuotato: non e' un giorno
    const parametri = new URLSearchParams(searchParams.toString());
    parametri.set("data", nuovaData);
    // L'errore appartiene al giorno che si stava guardando, non al prossimo.
    parametri.delete("errore");
    router.push(`/dashboard/calendario?${parametri.toString()}`);
  }

  function giornoAdiacente(passo: number): string {
    const [anno, mese, giorno] = dataYMD.split("-").map(Number);
    const spostata = new Date(Date.UTC(anno, mese - 1, giorno + passo));
    return spostata.toISOString().slice(0, 10);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button
        type="button"
        onClick={() => vaiAlGiorno(giornoAdiacente(-1))}
        className="rounded border border-zinc-300 px-2 py-1"
      >
        ← Giorno prima
      </button>

      <label className="flex items-center gap-2">
        <span className="sr-only">Giorno</span>
        <input
          type="date"
          value={dataYMD}
          onChange={(e) => vaiAlGiorno(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1"
        />
      </label>

      <button
        type="button"
        onClick={() => vaiAlGiorno(giornoAdiacente(1))}
        className="rounded border border-zinc-300 px-2 py-1"
      >
        Giorno dopo →
      </button>

      <span className="font-medium">{formattaGiornoEsteso(dataYMD)}</span>
    </div>
  );
}
