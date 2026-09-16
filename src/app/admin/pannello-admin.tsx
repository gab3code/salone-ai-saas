"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { impostaPianoManualeAction, riportaPianoSuStripeAction } from "./azioni";
import { PIANI_ASSEGNABILI, STATI_ABBONAMENTO, type RigaAdmin } from "@/lib/admin";

function formatoData(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function RigaAttivita({ riga }: { riga: RigaAdmin }) {
  const [aperto, setAperto] = useState(false);
  const [piano, setPiano] = useState(riga.piano);
  const [stato, setStato] = useState(riga.statoAbbonamento);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, startTransition] = useTransition();
  const router = useRouter();

  function esegui(azione: () => Promise<{ errore?: string } | undefined>) {
    setErrore(null);
    startTransition(async () => {
      const esito = await azione();
      if (esito?.errore) setErrore(esito.errore);
      else {
        setAperto(false);
        router.refresh();
      }
    });
  }

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-zinc-900">
            {riga.nome}
            <span className="ml-2 text-xs font-normal text-zinc-400">/s/{riga.slug}</span>
          </span>
          <span className="text-xs text-zinc-500">
            {riga.emailTitolari.join(", ") || "nessun titolare collegato"} · dal {formatoData(riga.creatoIl)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white">
            {riga.piano}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
            {riga.statoAbbonamento}
          </span>
          {riga.pianoManuale && (
            <span
              className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
              title="Piano deciso a mano: il webhook Stripe non lo tocca"
            >
              manuale
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
        <span>{riga.membri} in team</span>
        <span>{riga.operatori} operatori</span>
        <span>{riga.clienti} clienti</span>
        <span>
          {riga.appuntamenti} appuntamenti ({riga.appuntamenti30Giorni} negli ultimi 30gg)
        </span>
        <span>{riga.haStripe ? "cliente Stripe collegato" : "nessun cliente Stripe"}</span>
      </div>

      {!aperto ? (
        <button type="button" onClick={() => setAperto(true)} className="mt-3 text-xs underline">
          Intervieni sul piano
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Piano</label>
            <select
              value={piano}
              onChange={(e) => setPiano(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            >
              {PIANI_ASSEGNABILI.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Stato</label>
            <select
              value={stato}
              onChange={(e) => setStato(e.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
            >
              {STATI_ABBONAMENTO.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={inCorso}
            onClick={() => esegui(() => impostaPianoManualeAction(riga.tenantId, piano, stato))}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {inCorso ? "Salvo..." : "Applica a mano"}
          </button>
          {riga.pianoManuale && (
            <button
              type="button"
              disabled={inCorso}
              onClick={() => esegui(() => riportaPianoSuStripeAction(riga.tenantId))}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Ridai il controllo a Stripe
            </button>
          )}
          <button type="button" onClick={() => setAperto(false)} className="text-xs underline">
            Annulla
          </button>
          <p className="w-full text-xs text-zinc-500">
            Applicando a mano, il webhook Stripe smette di aggiornare piano e stato per questa
            attività finché non ridai il controllo.
          </p>
          {errore && <p className="w-full text-xs text-red-600">{errore}</p>}
        </div>
      )}
    </li>
  );
}

export function PannelloAdmin({ righe }: { righe: RigaAdmin[] }) {
  const [filtro, setFiltro] = useState("");

  const visibili = righe.filter((riga) => {
    const q = filtro.trim().toLowerCase();
    if (!q) return true;
    return (
      riga.nome.toLowerCase().includes(q) ||
      riga.slug.toLowerCase().includes(q) ||
      riga.piano.toLowerCase().includes(q) ||
      riga.emailTitolari.some((e) => e.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Cerca per nome, slug, piano o email"
        className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      <ul className="flex flex-col gap-3">
        {visibili.map((riga) => (
          <RigaAttivita key={riga.tenantId} riga={riga} />
        ))}
        {visibili.length === 0 && (
          <li className="text-sm text-zinc-500">Nessuna attività corrisponde alla ricerca.</li>
        )}
      </ul>
    </div>
  );
}
