"use client";

import { useState } from "react";
import { aggiornaFinestraCancellazione } from "./azioni";
import Link from "next/link";

export function PannelloCancellazione({
  oreIniziali,
  telefonoIniziale,
}: {
  oreIniziali: number;
  telefonoIniziale: string;
}) {
  const [ore, setOre] = useState(String(oreIniziali));
  // Solo da mostrare: si modifica in "Contatti" (17/09/2026).
  const telefono = telefonoIniziale;
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

      {/* Sola lettura (17/09/2026): il telefono si modifica in "Contatti",
          che è l'unico posto che lo scrive. Qui resta visibile perché senza
          un numero questa funzione non ha senso -- chi viene bloccato dalla
          finestra deve poter chiamare qualcuno. */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm">
        <p className="text-xs font-medium text-zinc-500">Numero mostrato a chi viene bloccato</p>
        {telefono ? (
          <p className="mt-0.5 text-zinc-800">{telefono}</p>
        ) : (
          <p className="mt-0.5 text-amber-800">
            Nessun numero: chi prova a cancellare troppo tardi non sa chi chiamare.
          </p>
        )}
        <Link href="/dashboard/impostazioni/contatti" className="mt-1 inline-block text-xs underline">
          Modifica in Contatti
        </Link>
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
