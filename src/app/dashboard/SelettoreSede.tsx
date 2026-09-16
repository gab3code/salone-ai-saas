"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cambiaSedeAction } from "./team/azioni";
import type { SedeDisponibile } from "@/lib/membri.server";

/**
 * Selettore di sede (Fase 5, migrazione 0027): un account può appartenere a
 * più attività -- una catena con due negozi sono due attività separate
 * collegate allo stesso login, non un'attività con dentro due "sedi".
 *
 * Con una sola attività non compare nulla: la stragrande maggioranza dei
 * clienti ne ha una, e un menu a tendina con un solo elemento è rumore.
 */
export function SelettoreSede({ sedi }: { sedi: SedeDisponibile[] }) {
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, startTransition] = useTransition();
  const router = useRouter();

  if (sedi.length < 2) return null;

  const attiva = sedi.find((s) => s.attiva);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="selettore_sede" className="text-xs text-zinc-500">
        Attività
      </label>
      <select
        id="selettore_sede"
        value={attiva?.tenantId ?? ""}
        disabled={inCorso}
        onChange={(e) => {
          const tenantId = e.target.value;
          setErrore(null);
          startTransition(async () => {
            const esito = await cambiaSedeAction(tenantId);
            if (esito?.errore) setErrore(esito.errore);
            else router.refresh();
          });
        }}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
      >
        {sedi.map((sede) => (
          <option key={sede.tenantId} value={sede.tenantId}>
            {sede.nome}
            {sede.ruolo === "staff" ? " (collaboratore)" : ""}
          </option>
        ))}
      </select>
      {errore && <p className="text-xs text-red-600">{errore}</p>}
    </div>
  );
}
