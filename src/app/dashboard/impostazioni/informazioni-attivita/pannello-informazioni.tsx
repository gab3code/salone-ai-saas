"use client";

import { useState } from "react";
import { aggiornaInformazioniAttivita } from "./azioni";

interface InformazioniAttivita {
  descrizione: string;
  indirizzo: string;
  parcheggio: string;
  metodiPagamento: string;
}

export function PannelloInformazioni({ informazioniIniziali }: { informazioniIniziali: InformazioniAttivita }) {
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  async function salva(formData: FormData) {
    setInCorso(true);
    setMessaggio(null);
    try {
      const risultato = await aggiornaInformazioniAttivita(formData);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        setMessaggio({ tipo: "ok", testo: "Informazioni salvate." });
      }
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form action={salva} className="flex max-w-xl flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <label className="flex flex-col gap-1 text-sm">
        Descrizione dell&apos;attività
        <textarea
          name="descrizione"
          rows={3}
          maxLength={2000}
          defaultValue={informazioniIniziali.descrizione}
          placeholder="Es. Salone di parrucchieri nel centro di Milano, specializzato in colore e trattamenti..."
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Indirizzo
        <textarea
          name="indirizzo"
          rows={2}
          maxLength={2000}
          defaultValue={informazioniIniziali.indirizzo}
          placeholder="Es. Via Roma 10, 20100 Milano"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Parcheggio
        <textarea
          name="parcheggio"
          rows={2}
          maxLength={2000}
          defaultValue={informazioniIniziali.parcheggio}
          placeholder="Es. Parcheggio gratuito nel cortile interno, ingresso da via Verdi"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Metodi di pagamento accettati
        <textarea
          name="metodi_pagamento"
          rows={2}
          maxLength={2000}
          defaultValue={informazioniIniziali.metodiPagamento}
          placeholder="Es. Contanti, carte di credito/debito, Satispay"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
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
