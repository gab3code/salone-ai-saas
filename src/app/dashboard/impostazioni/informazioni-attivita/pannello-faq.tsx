"use client";

import { useState, useTransition } from "react";
import { aggiungiFaq, eliminaFaq } from "./azioni";

interface Faq {
  id: string;
  domanda: string;
  risposta: string;
}

export function PannelloFaq({ faqIniziali }: { faqIniziali: Faq[] }) {
  const [faq, setFaq] = useState<Faq[]>(faqIniziali);
  const [domandaNuova, setDomandaNuova] = useState("");
  const [rispostaNuova, setRispostaNuova] = useState("");
  const [inCorso, startTransition] = useTransition();
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  const valida = domandaNuova.trim() !== "" && rispostaNuova.trim() !== "";

  function aggiungi(formData: FormData) {
    setMessaggio(null);
    startTransition(async () => {
      const risultato = await aggiungiFaq(formData);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        setFaq((prev) => [...prev, { id: crypto.randomUUID(), domanda: domandaNuova.trim(), risposta: rispostaNuova.trim() }]);
        setDomandaNuova("");
        setRispostaNuova("");
        setMessaggio({ tipo: "ok", testo: "Domanda aggiunta." });
      }
    });
  }

  function elimina(id: string) {
    setMessaggio(null);
    startTransition(async () => {
      const risultato = await eliminaFaq(id);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        setFaq((prev) => prev.filter((f) => f.id !== id));
      }
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      {faq.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Nessuna domanda frequente ancora -- l&apos;AI userà solo le informazioni sopra e le sue capacità di
          prenotazione.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {faq.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-zinc-900">{f.domanda}</p>
                <p className="mt-1 text-zinc-600">{f.risposta}</p>
              </div>
              <button
                type="button"
                disabled={inCorso}
                onClick={() => elimina(f.id)}
                className="shrink-0 text-xs text-red-600 underline disabled:opacity-50"
              >
                Rimuovi
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={aggiungi} className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
        <label className="text-sm font-medium text-zinc-700">Aggiungi una domanda frequente</label>
        <input
          type="text"
          name="domanda"
          value={domandaNuova}
          onChange={(e) => setDomandaNuova(e.target.value)}
          maxLength={300}
          placeholder="Es. Fate anche colore per capelli corti?"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <textarea
          name="risposta"
          value={rispostaNuova}
          onChange={(e) => setRispostaNuova(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Risposta che l'AI userà per rispondere ai clienti"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!valida || inCorso}
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {inCorso ? "Aggiungo..." : "Aggiungi"}
        </button>
      </form>

      {messaggio && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            messaggio.tipo === "ok" ? "border border-green-300 bg-green-50 text-green-800" : "border border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {messaggio.testo}
        </p>
      )}
    </div>
  );
}
