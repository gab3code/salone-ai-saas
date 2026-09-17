"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancellaCliente } from "../azioni";

/**
 * Cancellazione definitiva di una scheda cliente (17/09/2026).
 *
 * Conferma in due passaggi INLINE, non un `confirm()` del browser: un dialog
 * nativo blocca la pagina (ed è la prima cosa che un utente impara a
 * schiacciare senza leggere), mentre qui la seconda schermata può dire
 * esattamente cosa succede -- compreso il fatto che gli appuntamenti passati
 * restano nei conti, che è la domanda vera di chi sta per premere.
 *
 * Reso solo al titolare (vedi `puoCancellareClienti`): mostrarlo a uno staff
 * per poi farlo fallire lato server sarebbe una trappola, non un permesso.
 */
export function PulsanteCancellaCliente({
  clienteId,
  nomeCliente,
}: {
  clienteId: string;
  nomeCliente: string;
}) {
  const [confermaAperta, setConfermaAperta] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();
  const router = useRouter();

  if (!confermaAperta) {
    return (
      <div className="mt-4 border-t border-zinc-200 pt-4">
        <button
          type="button"
          onClick={() => setConfermaAperta(true)}
          className="text-sm text-red-700 underline underline-offset-2 hover:text-red-800"
        >
          Cancella definitivamente questo cliente
        </button>
        <p className="mt-1 text-xs text-zinc-500">
          Da usare quando il cliente chiede la cancellazione dei suoi dati.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded border border-red-200 bg-red-50 p-3">
      <p className="text-sm text-red-900">
        Cancellare la scheda di <strong>{nomeCliente}</strong>? Spariscono nome, telefono, email,
        note e tag, e non si possono recuperare. Gli appuntamenti già registrati restano nei tuoi
        conti, ma senza più il nome di nessuno.
      </p>
      {errore && <p className="mt-2 text-sm text-red-800">{errore}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={inCorso}
          onClick={() =>
            avvia(async () => {
              const esito = await cancellaCliente(clienteId);
              if (esito && "errore" in esito && esito.errore) {
                setErrore(esito.errore);
                return;
              }
              router.push("/dashboard/clienti");
            })
          }
          className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-60"
        >
          {inCorso ? "Cancellazione..." : "Sì, cancella"}
        </button>
        <button
          type="button"
          disabled={inCorso}
          onClick={() => {
            setConfermaAperta(false);
            setErrore(null);
          }}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
