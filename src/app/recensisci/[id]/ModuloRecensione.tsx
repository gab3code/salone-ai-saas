"use client";

import { useState } from "react";
import { inviaRecensionePubblica } from "./azioni";
import { LUNGHEZZA_MASSIMA_COMMENTO, VALUTAZIONE_MASSIMA, VALUTAZIONE_MINIMA } from "@/lib/recensioni";

/** Stesso campo trappola invisibile di FlussoPrenotazione.tsx (vedi
 * src/lib/anti-bot.ts) -- duplicato qui invece di condiviso: è tre righe di
 * markup, non vale un componente condiviso tra due cartelle diverse per
 * questo soltanto. */
function CampoTrappola({ valore, onChange }: { valore: string; onChange: (v: string) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Lascia questo campo vuoto
        <input type="text" tabIndex={-1} autoComplete="off" value={valore} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}

const VALORI_STELLE = Array.from({ length: VALUTAZIONE_MASSIMA - VALUTAZIONE_MINIMA + 1 }, (_, i) => VALUTAZIONE_MINIMA + i);

export function ModuloRecensione({ appuntamentoId }: { appuntamentoId: string }) {
  const [iniziatoAlleMs] = useState(() => Date.now());
  const [trappola, setTrappola] = useState("");
  const [valutazione, setValutazione] = useState(0);
  const [valutazioneInHover, setValutazioneInHover] = useState(0);
  const [commento, setCommento] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; messaggio: string } | null>(null);

  if (esito?.ok) {
    return (
      <p className="rounded-lg border border-green-300 bg-green-50 px-3 py-2.5 text-sm text-green-800">
        Grazie per la tua recensione!
      </p>
    );
  }

  async function invia() {
    if (valutazione === 0) {
      setEsito({ ok: false, messaggio: "Scegli una valutazione da 1 a 5 stelle." });
      return;
    }
    setInCorso(true);
    setEsito(null);
    try {
      const risultato = await inviaRecensionePubblica(appuntamentoId, { valutazione, commento, trappola, iniziatoAlleMs });
      setEsito(risultato.ok ? { ok: true, messaggio: "" } : { ok: false, messaggio: risultato.errore });
    } finally {
      setInCorso(false);
    }
  }

  const valutazioneMostrata = valutazioneInHover || valutazione;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-zinc-900">La tua valutazione</p>
        <div className="flex gap-1" onMouseLeave={() => setValutazioneInHover(0)}>
          {VALORI_STELLE.map((v) => (
            <button
              key={v}
              type="button"
              aria-label={`${v} stelle`}
              onMouseEnter={() => setValutazioneInHover(v)}
              onClick={() => setValutazione(v)}
              className="text-3xl leading-none"
            >
              <span className={v <= valutazioneMostrata ? "text-amber-400" : "text-zinc-200"}>★</span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Commento (facoltativo)
        <textarea
          value={commento}
          maxLength={LUNGHEZZA_MASSIMA_COMMENTO}
          onChange={(e) => setCommento(e.target.value)}
          rows={4}
          placeholder="Com'è andata?"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>

      <CampoTrappola valore={trappola} onChange={setTrappola} />

      <button
        type="button"
        disabled={inCorso}
        onClick={invia}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {inCorso ? "Invio..." : "Invia recensione"}
      </button>

      {esito && !esito.ok && <p className="text-sm text-red-600">{esito.messaggio}</p>}
    </div>
  );
}
