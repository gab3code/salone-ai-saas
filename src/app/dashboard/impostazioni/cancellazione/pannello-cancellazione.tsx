"use client";

import { useState } from "react";
import { aggiornaFinestraCancellazione } from "./azioni";

export function PannelloCancellazione({
  oreIniziali,
  telefonoIniziale,
}: {
  oreIniziali: number;
  telefonoIniziale: string;
}) {
  const [ore, setOre] = useState(String(oreIniziali));
  const [telefono, setTelefono] = useState(telefonoIniziale);
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  async function salva(formData: FormData) {
    setInCorso(true);
    setMessaggio(null);
    try {
      const risultato = await aggiornaFinestraCancellazione(formData);
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
      <label className="flex flex-col gap-1 text-sm">
        Ore minime prima dell&apos;appuntamento per cancellare online
        <input
          type="number"
          name="ore_minime_cancellazione"
          min={0}
          step={1}
          value={ore}
          onChange={(e) => setOre(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <p className="text-xs text-zinc-400">
        Sotto questa soglia il link &quot;gestisci la tua prenotazione&quot; nell&apos;email di conferma non mostra più il
        bottone di cancellazione, ma il numero qui sotto per farsi chiamare. Metti 0 per non avere nessun limite
        (cancellazione online sempre permessa, anche l&apos;ultimo minuto).
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Telefono della tua attività
        <input
          type="tel"
          name="telefono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Es. 02 1234567"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <p className="text-xs text-zinc-400">
        Mostrato ai clienti bloccati dalla finestra qui sopra e nella tua pagina pubblica di prenotazione. Lascialo
        vuoto se preferisci non pubblicarlo.
      </p>

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
            messaggio.tipo === "ok"
              ? "border border-green-300 bg-green-50 text-green-800"
              : "border border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {messaggio.testo}
        </p>
      )}
    </form>
  );
}
