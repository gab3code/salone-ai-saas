"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type EsitoAzione = { errore?: string } | { ok?: true } | void;

/**
 * Un bottone che chiama una server action e MOSTRA quello che risponde.
 *
 * Esiste per una ragione precisa (18/09/2026): da oggi `eliminaOperatore` e
 * `eliminaServizio` possono RIFIUTARSI, quando la riga ha appuntamenti o
 * caparre collegate, e il loro rifiuto e' un consiglio -- "disattivalo
 * invece". Nei form della pagina quel valore di ritorno finiva nel vuoto:
 * l'utente cliccava Elimina, non succedeva niente, e la conclusione naturale
 * era che il prodotto fosse rotto.
 *
 * Un rifiuto che nessuno vede e' peggio di nessun rifiuto: toglie la cosa
 * pericolosa e ci mette al suo posto una schermata che mente.
 */
export function BottoneAzione({
  azione,
  etichetta,
  etichettaInCorso,
  className,
}: {
  azione: () => Promise<EsitoAzione>;
  etichetta: string;
  etichettaInCorso?: string;
  className?: string;
}) {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={inCorso}
        className={className ?? "text-xs underline disabled:opacity-50"}
        onClick={() =>
          avvia(async () => {
            setErrore(null);
            const esito = await azione();
            if (esito && "errore" in esito && esito.errore) {
              setErrore(esito.errore);
              return;
            }
            router.refresh();
          })
        }
      >
        {inCorso ? (etichettaInCorso ?? "Attendi...") : etichetta}
      </button>
      {errore && (
        <span role="alert" className="max-w-md text-xs text-amber-700">
          {errore}
        </span>
      )}
    </span>
  );
}
