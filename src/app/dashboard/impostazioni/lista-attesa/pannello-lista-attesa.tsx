"use client";

import { useState } from "react";
import { useAllineamentoAlServer } from "@/lib/react/allineamento-al-server";
import { alInvio } from "@/lib/react/invio-form";
import { aggiornaListaAttesaContattoAutomatico } from "./azioni";

export function PannelloListaAttesa({ attivoIniziale }: { attivoIniziale: boolean }) {
  const [attivo, setAttivo] = useState(attivoIniziale);
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  /**
   * Allinearsi ai valori del server senza rimontarsi: `useState(prop)` legge la
   * prop solo al montaggio, quindi dopo un salvataggio il form mostrava ancora
   * il valore vecchio (difetto trovato su caparra e tono dell'AI il
   * 19/09/2026, poi cercato in tutti i pannelli). Vedi
   * `useAllineamentoAlServer`.
   */
  useAllineamentoAlServer({ attivo: attivoIniziale }, () => {
    setAttivo(attivoIniziale);
  });

  async function salva(formData: FormData) {
    setInCorso(true);
    setMessaggio(null);
    try {
      const risultato = await aggiornaListaAttesaContattoAutomatico(formData);
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
    <form onSubmit={alInvio(salva)} className="flex max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <label className="flex items-start gap-2 text-sm font-medium text-zinc-900">
        <input
          type="checkbox"
          name="attivo"
          checked={attivo}
          onChange={(e) => setAttivo(e.target.checked)}
          className="mt-0.5 size-4 rounded border-zinc-300"
        />
        Contatta automaticamente il cliente quando si libera un posto (altrimenti resta manuale: lo vedi in
        Dashboard → Lista d&apos;attesa e lo contatti tu)
      </label>

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
