"use client";

import { useState, useTransition } from "react";
import { aggiungiRegolaPromemoria, eliminaRegolaPromemoria } from "./azioni";

interface Regola {
  id: string;
  orePreavviso: number;
}

const PRESET_ORE = [24, 48, 72];

/** Descrizione leggibile di un numero di ore -- "24 ore prima (circa 1 giorno)" invece del solo
 * numero, più facile da valutare a colpo d'occhio per chi configura. */
function descrivi(ore: number): string {
  if (ore % 24 === 0) {
    const giorni = ore / 24;
    return `${ore} ore prima (${giorni} giorn${giorni === 1 ? "o" : "i"} prima)`;
  }
  return `${ore} ore prima`;
}

export function PannelloPromemoria({ regoleIniziali }: { regoleIniziali: Regola[] }) {
  const [regole, setRegole] = useState<Regola[]>(regoleIniziali);
  const [oreNuova, setOreNuova] = useState<string>("");
  const [inCorso, startTransition] = useTransition();
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  const oreNumero = Number(oreNuova);
  const valida = oreNuova.trim() !== "" && Number.isInteger(oreNumero) && oreNumero > 0 && oreNumero <= 720;

  function aggiungi(formData: FormData) {
    setMessaggio(null);
    startTransition(async () => {
      const risultato = await aggiungiRegolaPromemoria(formData);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        setRegole((prev) => [...prev, { id: crypto.randomUUID(), orePreavviso: oreNumero }].sort((a, b) => a.orePreavviso - b.orePreavviso));
        setOreNuova("");
        setMessaggio({ tipo: "ok", testo: "Promemoria aggiunto." });
      }
    });
  }

  function elimina(id: string) {
    setMessaggio(null);
    startTransition(async () => {
      const risultato = await eliminaRegolaPromemoria(id);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        setRegole((prev) => prev.filter((r) => r.id !== id));
      }
    });
  }

  return (
    <div className="flex max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      {regole.length === 0 ? (
        <p className="text-sm text-zinc-500">Nessun promemoria attivo -- i clienti non riceveranno reminder.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {regole.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              <span>{descrivi(r.orePreavviso)}</span>
              <button
                type="button"
                disabled={inCorso}
                onClick={() => elimina(r.id)}
                className="text-xs text-red-600 underline disabled:opacity-50"
              >
                Rimuovi
              </button>
            </li>
          ))}
        </ul>
      )}

      <form action={aggiungi} className="flex flex-col gap-2 border-t border-zinc-100 pt-4">
        <label className="text-sm font-medium text-zinc-700">Aggiungi un promemoria</label>
        <div className="flex flex-wrap gap-2">
          {PRESET_ORE.map((ore) => (
            <button
              key={ore}
              type="button"
              onClick={() => setOreNuova(String(ore))}
              className={`rounded-full border px-3 py-1 text-xs ${
                oreNuova === String(ore) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
              }`}
            >
              {ore}h ({ore / 24}g)
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="ore_preavviso"
            min={1}
            max={720}
            value={oreNuova}
            onChange={(e) => setOreNuova(e.target.value)}
            placeholder="Ore prima"
            className="w-32 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={!valida || inCorso}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {inCorso ? "Aggiungo..." : "Aggiungi"}
          </button>
        </div>
        {valida && oreNumero < 24 && (
          <p className="text-xs text-amber-700">
            Sotto le 24 ore il promemoria gira su un controllo giornaliero (una volta al giorno): potrebbe non
            partire in tempo per ogni orario. Affidabile da 24 ore in su.
          </p>
        )}
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
