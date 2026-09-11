"use client";

import { useState } from "react";

/**
 * Apre il Customer Portal Stripe (self-service: cambio piano, carta,
 * cancellazione) -- mantiene la promessa "Cancella quando vuoi" di
 * CTAFinale.tsx sulla landing.
 */
export function PulsantePortaleAbbonamento() {
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function apriPortale() {
    setCaricamento(true);
    setErrore(null);
    try {
      const risposta = await fetch("/api/stripe/portal", { method: "POST" });
      const dati = await risposta.json();
      if (!risposta.ok || !dati.url) {
        throw new Error(dati.errore ?? "Errore durante l'apertura del portale.");
      }
      window.location.href = dati.url;
    } catch (e) {
      setErrore((e as Error).message);
      setCaricamento(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={apriPortale}
        disabled={caricamento}
        className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
      >
        {caricamento ? "Apertura..." : "Gestisci abbonamento"}
      </button>
      {errore && <p className="mt-2 text-sm text-red-600">{errore}</p>}
    </div>
  );
}
