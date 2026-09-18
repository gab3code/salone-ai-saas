"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analizzaImportAzione, applicaImportAzione } from "./azioni";
import type { DiffImport, RigaImport } from "@/lib/importa-clienti";

/**
 * Due fasi, mai una sola: prima si vede cosa entrerebbe, poi si scrive.
 *
 * Una rubrica importata male non si "corregge dopo": si ripulisce a mano
 * riga per riga, cioe' esattamente la serata di lavoro che questa funzione
 * esiste per far risparmiare. Per questo chi c'e' gia' parte NON spuntato e
 * le righe che non ho capito si vedono, invece di sparire in un "180 su 200"
 * che nessuno puo' controllare.
 */
export function PannelloImport() {
  const router = useRouter();
  const [testo, setTesto] = useState("");
  const [diff, setDiff] = useState<DiffImport | null>(null);
  const [scelti, setScelti] = useState<boolean[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [fatti, setFatti] = useState<number | null>(null);

  async function analizza() {
    setErrore(null);
    setFatti(null);
    setInCorso(true);
    const esito = await analizzaImportAzione(testo);
    setInCorso(false);
    if (!esito.ok) {
      setDiff(null);
      setErrore(esito.errore);
      return;
    }
    setDiff(esito.diff);
    setScelti(esito.diff.nuovi.map(() => true));
  }

  async function importa() {
    if (!diff) return;
    setErrore(null);
    setInCorso(true);
    const righe: RigaImport[] = diff.nuovi.filter((_, i) => scelti[i]);
    const esito = await applicaImportAzione(righe);
    setInCorso(false);
    if (!esito.ok) {
      setErrore(esito.errore);
      return;
    }
    setFatti(esito.creati);
    setDiff(null);
    setTesto("");
    router.refresh();
  }

  async function daFile(file: File | null) {
    if (!file) return;
    setTesto(await file.text());
  }

  const quantiScelti = scelti.filter(Boolean).length;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {fatti !== null && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {fatti === 1 ? "Importato 1 cliente." : `Importati ${fatti} clienti.`}{" "}
          <Link href="/dashboard/clienti" className="underline">
            Vai alla rubrica
          </Link>
        </p>
      )}

      {diff === null && (
        <>
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            rows={10}
            placeholder={"Nome;Telefono;Email\nMaria Rossi;333 123 4567;maria@esempio.it\nLuca Bianchi;333 987 6543;"}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={analizza}
              disabled={inCorso || testo.trim() === ""}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {inCorso ? "Leggo..." : "Vediamo cosa entra"}
            </button>
            <label className="text-sm text-zinc-600">
              oppure{" "}
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={(e) => daFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </label>
          </div>
        </>
      )}

      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {diff && (
        <div className="flex flex-col gap-5">
          {diff.nuovi.length > 0 ? (
            <section>
              <h2 className="text-sm font-medium">
                {diff.nuovi.length === 1 ? "1 cliente nuovo" : `${diff.nuovi.length} clienti nuovi`}
              </h2>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {diff.nuovi.map((riga, i) => (
                  <li key={`${riga.telefono}-${i}`}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={scelti[i] ?? false}
                        onChange={(e) =>
                          setScelti(scelti.map((v, j) => (j === i ? e.target.checked : v)))
                        }
                      />
                      <span className="font-medium">{riga.nome ?? "(senza nome)"}</span>
                      <span className="text-zinc-500">{riga.telefono}</span>
                      {riga.email && <span className="text-xs text-zinc-400">{riga.email}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-zinc-600">Nessun cliente nuovo: sono già tutti in rubrica.</p>
          )}

          {diff.giaPresenti.length > 0 && (
            <section>
              <h2 className="text-sm font-medium">
                {diff.giaPresenti.length === 1
                  ? "1 cliente è già in rubrica"
                  : `${diff.giaPresenti.length} clienti sono già in rubrica`}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Li riconosco dal numero di telefono, anche se scritto in un altro formato. Non li
                tocco: se il nome qui è diverso, quello che hai già resta com&apos;è.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-600">
                {diff.giaPresenti.slice(0, 50).map((riga, i) => (
                  <li key={`${riga.telefono}-${i}`}>
                    {riga.telefono} · nel file «{riga.nome ?? "senza nome"}», qui «
                    {riga.nomeEsistente ?? "senza nome"}»
                  </li>
                ))}
              </ul>
              {diff.giaPresenti.length > 50 && (
                <p className="mt-1 text-xs text-zinc-500">…e altri {diff.giaPresenti.length - 50}.</p>
              )}
            </section>
          )}

          {diff.scartate.length > 0 && (
            <section>
              <h2 className="text-sm font-medium">
                {diff.scartate.length === 1
                  ? "1 riga che non ho capito"
                  : `${diff.scartate.length} righe che non ho capito`}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Non c&apos;era un numero di telefono riconoscibile. Te le mostro invece di
                contarle e basta: se qui dentro c&apos;è un cliente vero, aggiungilo a mano.
              </p>
              <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-zinc-500">
                {diff.scartate.slice(0, 20).map((riga, i) => (
                  <li key={i}>{riga}</li>
                ))}
              </ul>
              {diff.scartate.length > 20 && (
                <p className="mt-1 text-xs text-zinc-500">…e altre {diff.scartate.length - 20}.</p>
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={importa}
              disabled={inCorso || quantiScelti === 0}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {inCorso
                ? "Importo..."
                : quantiScelti === 1
                  ? "Importa 1 cliente"
                  : `Importa ${quantiScelti} clienti`}
            </button>
            <button
              type="button"
              onClick={() => {
                setDiff(null);
                setErrore(null);
              }}
              className="text-sm underline"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
