"use client";

import { useState } from "react";
import { aggiornaTonoAi } from "./azioni";

type Stile = "professionale" | "amichevole" | "informale_con_emoji";

const OPZIONI: { valore: Stile; etichetta: string; descrizione: string }[] = [
  {
    valore: "professionale",
    etichetta: "Professionale",
    descrizione: "Cordiale e conciso, come una vera persona alla reception. (default)",
  },
  {
    valore: "amichevole",
    etichetta: "Amichevole",
    descrizione: "Caloroso e colloquiale, come uno staff che conosce bene i clienti abituali.",
  },
  {
    valore: "informale_con_emoji",
    etichetta: "Informale, con emoji",
    descrizione: "Frizzante e diretto, con qualche emoji -- adatto a un pubblico giovane.",
  },
];

export function PannelloTonoAi({ stileIniziale, notaIniziale }: { stileIniziale: Stile; notaIniziale: string }) {
  const [stile, setStile] = useState<Stile>(stileIniziale);
  const [nota, setNota] = useState(notaIniziale);
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  async function salva(formData: FormData) {
    setInCorso(true);
    setMessaggio(null);
    try {
      const risultato = await aggiornaTonoAi(formData);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        setMessaggio({ tipo: "ok", testo: "Tono aggiornato." });
      }
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form action={salva} className="flex max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-col gap-2">
        {OPZIONI.map((opzione) => (
          <label
            key={opzione.valore}
            className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-sm ${
              stile === opzione.valore ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
            }`}
          >
            <span className="flex items-center gap-2 font-medium text-zinc-900">
              <input
                type="radio"
                name="stile"
                value={opzione.valore}
                checked={stile === opzione.valore}
                onChange={() => setStile(opzione.valore)}
                className="size-4"
              />
              {opzione.etichetta}
            </span>
            <span className="pl-6 text-xs text-zinc-500">{opzione.descrizione}</span>
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Nota aggiuntiva (facoltativa, max 300 caratteri)
        <textarea
          name="nota"
          value={nota}
          maxLength={300}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          placeholder='Es. "Chiamaci sempre studio, mai negozio."'
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <span className="text-xs text-zinc-400">
          Un&apos;indicazione in più che l&apos;assistente proverà a seguire -- non può comunque contraddire le
          regole di sicurezza (mai inventare prezzi, orari o disponibilità).
        </span>
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
