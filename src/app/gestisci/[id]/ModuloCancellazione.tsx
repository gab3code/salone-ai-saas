"use client";

import { useState, useTransition } from "react";
import { cancellaPrenotazionePubblica } from "./azioni";

/**
 * Client Component minimo: solo per il doppio-conferma ("sei sicuro?") e per
 * mostrare l'esito senza un refresh di pagina a mano -- la pagina stessa
 * resta un Server Component (vedi page.tsx), stesso principio del resto
 * della dashboard ("niente stato client da tenere sincronizzato a mano" se
 * non strettamente necessario).
 */
export function ModuloCancellazione({
  appuntamentoId,
  giaCancellata,
  messaggioBloccata,
}: {
  appuntamentoId: string;
  giaCancellata: boolean;
  // Non null quando la finestra minima di cancellazione (impostazioni del
  // titolare, vedi src/lib/finestra-cancellazione.ts) è già superata: qui
  // solo per mostrare subito il messaggio giusto invece del bottone, il
  // controllo che conta resta comunque in azioni.ts (un link riaperto da
  // una pagina in cache non deve mai bypassare la regola).
  messaggioBloccata?: string | null;
}) {
  const [confermaRichiesta, setConfermaRichiesta] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; messaggio: string } | null>(null);
  const [inCorso, avviaTransizione] = useTransition();

  if (giaCancellata || esito?.ok) {
    return <p className="text-sm text-zinc-600">Questa prenotazione è cancellata.</p>;
  }

  if (messaggioBloccata) {
    return <p className="text-sm text-zinc-600">{messaggioBloccata}</p>;
  }

  if (!confermaRichiesta) {
    return (
      <button
        type="button"
        onClick={() => setConfermaRichiesta(true)}
        className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
      >
        Cancella la prenotazione
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-700">Confermi di voler cancellare questa prenotazione?</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={inCorso}
          onClick={() =>
            avviaTransizione(async () => {
              const risultato = await cancellaPrenotazionePubblica(appuntamentoId);
              setEsito(
                risultato.ok
                  ? { ok: true, messaggio: "Prenotazione cancellata." }
                  : { ok: false, messaggio: risultato.errore }
              );
            })
          }
          className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {inCorso ? "Cancellazione in corso..." : "Sì, cancella"}
        </button>
        <button
          type="button"
          onClick={() => setConfermaRichiesta(false)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
        >
          No, torna indietro
        </button>
      </div>
      {esito && !esito.ok && <p className="text-sm text-red-600">{esito.messaggio}</p>}
    </div>
  );
}
