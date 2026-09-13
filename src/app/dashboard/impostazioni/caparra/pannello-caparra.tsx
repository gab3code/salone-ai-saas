"use client";

import { useState } from "react";
import { aggiornaCaparra } from "./azioni";
import type { TipoCaparra } from "@/lib/stripe/caparra";

interface ConfigurazioneCaparra {
  attiva: boolean;
  tipo: TipoCaparra;
  valore: number; // percentuale: 1-100; fisso: centesimi (convertito in euro solo per il campo del form)
}

export function PannelloCaparra({ configurazioneIniziale }: { configurazioneIniziale: ConfigurazioneCaparra }) {
  const [attiva, setAttiva] = useState(configurazioneIniziale.attiva);
  const [tipo, setTipo] = useState<TipoCaparra>(configurazioneIniziale.tipo);
  const [valore, setValore] = useState<string>(
    configurazioneIniziale.tipo === "fisso"
      ? (configurazioneIniziale.valore / 100).toString()
      : configurazioneIniziale.valore.toString()
  );
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  async function salva(formData: FormData) {
    setInCorso(true);
    setMessaggio(null);
    try {
      const risultato = await aggiornaCaparra(formData);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        setMessaggio({ tipo: "ok", testo: "Impostazioni salvate." });
      }
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form action={salva} className="flex max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
        <input
          type="checkbox"
          name="attiva"
          checked={attiva}
          onChange={(e) => setAttiva(e.target.checked)}
          className="size-4 rounded border-zinc-300"
        />
        Richiedi una caparra per confermare le prenotazioni online
      </label>

      <div className={`flex flex-col gap-3 ${attiva ? "" : "opacity-50"}`}>
        <label className="flex flex-col gap-1 text-sm">
          Tipo
          <select
            name="tipo"
            value={tipo}
            disabled={!attiva}
            onChange={(e) => setTipo(e.target.value as TipoCaparra)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="percentuale">Percentuale del prezzo del servizio</option>
            <option value="fisso">Importo fisso</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {tipo === "percentuale" ? "Percentuale (%)" : "Importo (€)"}
          <input
            type="number"
            name="valore"
            min={0}
            step={tipo === "percentuale" ? 1 : 0.5}
            value={valore}
            disabled={!attiva}
            onChange={(e) => setValore(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-zinc-400">
          {tipo === "percentuale"
            ? "Es. 20% su un servizio da 50€ richiede una caparra di 10€."
            : "Stesso importo per ogni servizio, indipendentemente dal prezzo."}
        </p>
      </div>

      <button
        type="submit"
        disabled={inCorso}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {inCorso ? "Salvo..." : "Salva"}
      </button>

      {messaggio && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            messaggio.tipo === "ok" ? "border border-green-300 bg-green-50 text-green-800" : "border border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {messaggio.testo}
        </p>
      )}
    </form>
  );
}
