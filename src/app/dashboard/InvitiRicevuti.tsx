"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { accettaInvitoAction } from "./team/azioni";
import type { InvitoRicevuto } from "@/lib/membri.server";

/**
 * Inviti che aspettano QUESTO account (Fase 5, migrazione 0027).
 *
 * Serve al caso "la persona invitata ha già un account": Supabase non le può
 * mandare un invito di registrazione, quindi l'invito lo trova qui la
 * prossima volta che entra. Chi invece si registra da zero entra già dentro
 * grazie al trigger della migrazione, e questo riquadro non lo vede mai.
 */
export function InvitiRicevuti({ inviti }: { inviti: InvitoRicevuto[] }) {
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, startTransition] = useTransition();
  const router = useRouter();

  if (inviti.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-900 bg-zinc-50 p-4">
      {inviti.map((invito) => (
        <div key={invito.id} className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-800">
            <span className="font-medium">{invito.nomeAttivita}</span> ti ha invitato a lavorare con
            loro come {invito.ruolo === "owner" ? "titolare" : "collaboratore"}.
          </p>
          <button
            type="button"
            disabled={inCorso}
            onClick={() => {
              setErrore(null);
              startTransition(async () => {
                const esito = await accettaInvitoAction(invito.id);
                if (esito?.errore) setErrore(esito.errore);
                else router.refresh();
              });
            }}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {inCorso ? "Accetto..." : "Accetta"}
          </button>
        </div>
      ))}
      {errore && <p className="text-xs text-red-600">{errore}</p>}
    </div>
  );
}
