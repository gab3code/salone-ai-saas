"use client";

import { useState } from "react";
import { aggiungiListaAttesa } from "./azioni";

interface Servizio {
  id: string;
  nome: string;
}
interface Operatore {
  id: string;
  nome: string;
}

export function PannelloListaAttesa({ servizi, operatori }: { servizi: Servizio[]; operatori: Operatore[] }) {
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);
  // Per svuotare il form dopo un invio riuscito (i campi restano "controllati" solo per questo).
  const [chiaveForm, setChiaveForm] = useState(0);

  async function invia(formData: FormData) {
    setInCorso(true);
    setMessaggio(null);
    try {
      const risultato = await aggiungiListaAttesa(formData);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        setMessaggio({ tipo: "ok", testo: "Aggiunto alla lista d'attesa." });
        setChiaveForm((k) => k + 1);
      }
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form
      key={chiaveForm}
      action={invia}
      className="flex max-w-lg flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5"
    >
      <p className="text-sm font-medium text-zinc-900">Aggiungi un cliente alla lista d&apos;attesa</p>

      <label className="flex flex-col gap-1 text-sm">
        Servizio
        <select name="servizio_id" required className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
          <option value="">Scegli un servizio...</option>
          {servizi.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Operatore preferito (opzionale)
        <select name="operatore_id" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
          <option value="">Va bene qualunque operatore</option>
          {operatori.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Nome cliente
          <input name="cliente_nome" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Telefono
          <input name="cliente_telefono" required className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Giorno preferito (opzionale)
        <input type="date" name="data_preferita" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
        <span className="text-xs text-zinc-400">Se vuoto, va bene qualunque giorno si liberi.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Note (opzionale)
        <input name="note" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
      </label>

      <button
        type="submit"
        disabled={inCorso}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {inCorso ? "Aggiungo..." : "Aggiungi alla lista"}
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
