"use client";

import { useMemo, useState } from "react";
import { useAllineamentoAlServer } from "@/lib/react/allineamento-al-server";
import { alInvio } from "@/lib/react/invio-form";
import { aggiornaCompleanno } from "./azioni";
import {
  comporreMessaggioCompleanno,
  LUNGHEZZA_MASSIMA_MESSAGGIO_COMPLEANNO,
  MESSAGGIO_COMPLEANNO_PREDEFINITO,
} from "@/lib/compleanno";

/** Nome di esempio SOLO per l'anteprima qui sotto -- mai inviato a nessuno,
 * sostituito interamente lato client mentre lo staff scrive, cosi' non
 * serve un giro di andata/ritorno col server solo per vedere l'effetto di
 * "{nome}". */
const NOME_ESEMPIO = "Giulia";

export function PannelloCompleanno({
  attivoIniziale,
  messaggioIniziale,
}: {
  attivoIniziale: boolean;
  messaggioIniziale: string;
}) {
  const [attivo, setAttivo] = useState(attivoIniziale);
  const [messaggio, setMessaggio] = useState(messaggioIniziale);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  /**
   * Allinearsi ai valori del server senza rimontarsi: `useState(prop)` legge la
   * prop solo al montaggio, quindi dopo un salvataggio il form mostrava ancora
   * il valore vecchio (difetto trovato su caparra e tono dell'AI il
   * 19/09/2026, poi cercato in tutti i pannelli). Vedi
   * `useAllineamentoAlServer`.
   */
  useAllineamentoAlServer({ attivo: attivoIniziale, messaggio: messaggioIniziale }, () => {
    setAttivo(attivoIniziale);
    setMessaggio(messaggioIniziale);
  });

  const anteprima = useMemo(
    () => comporreMessaggioCompleanno(messaggio || null, NOME_ESEMPIO),
    [messaggio]
  );

  async function salva(formData: FormData) {
    setInCorso(true);
    setEsito(null);
    try {
      const risultato = await aggiornaCompleanno(formData);
      if (risultato?.errore) {
        setEsito({ tipo: "errore", testo: risultato.errore });
      } else {
        setEsito({ tipo: "ok", testo: "Impostazioni salvate." });
      }
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form onSubmit={alInvio(salva)} className="flex max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
        <input
          type="checkbox"
          name="attivo"
          checked={attivo}
          onChange={(e) => setAttivo(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span className="flex flex-col text-sm">
          <span className="font-medium text-zinc-900">Manda l&apos;augurio automaticamente</span>
          <span className="text-xs text-zinc-500">
            Spento di default -- finché non lo attivi, nessun cliente riceve nulla anche se ha lasciato la data di
            nascita.
          </span>
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Messaggio (facoltativo, max {LUNGHEZZA_MASSIMA_MESSAGGIO_COMPLEANNO} caratteri)
        <textarea
          name="messaggio"
          value={messaggio}
          maxLength={LUNGHEZZA_MASSIMA_MESSAGGIO_COMPLEANNO}
          onChange={(e) => setMessaggio(e.target.value)}
          rows={3}
          placeholder={MESSAGGIO_COMPLEANNO_PREDEFINITO}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <span className="text-xs text-zinc-400">
          Usa <code className="rounded bg-zinc-100 px-1">{"{nome}"}</code> per inserire il nome del cliente. Lascia
          vuoto per usare il messaggio predefinito.
        </span>
      </label>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5">
        <p className="text-xs font-medium text-zinc-500">Anteprima (a {NOME_ESEMPIO})</p>
        <p className="mt-1 text-sm text-zinc-800">{anteprima}</p>
      </div>

      <button
        type="submit"
        disabled={inCorso}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {inCorso ? "Salvo..." : "Salva"}
      </button>

      {esito && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            esito.tipo === "ok" ? "border border-green-300 bg-green-50 text-green-800" : "border border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {esito.testo}
        </p>
      )}
    </form>
  );
}
