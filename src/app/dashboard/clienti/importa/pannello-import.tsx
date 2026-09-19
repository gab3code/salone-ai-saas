"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analizzaImportAzione, applicaImportAzione, recuperaRigheNonCapiteAzione } from "./azioni";
import { haQualcosaDaCompletare, type DiffImport, type RigaImport } from "@/lib/importa-clienti";

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
  // Chi c'e' gia' e ha campi vuoti da riempire: parte NON spuntato, come
  // tutto cio' che tocca un cliente esistente.
  const [completaScelti, setCompletaScelti] = useState<boolean[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [recuperoInCorso, setRecuperoInCorso] = useState(false);
  const [notaRecupero, setNotaRecupero] = useState<string | null>(null);
  const [fatti, setFatti] = useState<{ creati: number; completati: number } | null>(null);

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
    setCompletaScelti(esito.diff.giaPresenti.map(() => false));
    setNotaRecupero(null);
  }

  /**
   * Le righe non capite, passate al modello. Le proposte entrano nella lista
   * dei nuovi (o dei gia' presenti) marcate, e partono non spuntate: il
   * modello propone, il titolare decide.
   */
  async function recupera() {
    if (!diff || diff.scartate.length === 0) return;
    setErrore(null);
    setRecuperoInCorso(true);
    const esito = await recuperaRigheNonCapiteAzione(diff.scartate);
    setRecuperoInCorso(false);
    if (!esito.ok) {
      setErrore(esito.errore);
      return;
    }
    const nuoveProposte = esito.proposte.filter((p) => !p.esistenteId);
    const giaPresentiProposte = esito.proposte.filter((p) => p.esistenteId);
    setDiff({
      nuovi: [...diff.nuovi, ...nuoveProposte],
      giaPresenti: [...diff.giaPresenti, ...giaPresentiProposte],
      scartate: esito.nonRecuperate,
    });
    setScelti([...scelti, ...nuoveProposte.map(() => false)]);
    setCompletaScelti([...completaScelti, ...giaPresentiProposte.map(() => false)]);
    const lette = esito.proposte.length;
    setNotaRecupero(
      `${lette === 1 ? "1 riga letta" : `${lette} righe lette`} dall'assistente: le trovi qui sotto, non spuntate. ` +
        (esito.aVita
          ? `Ti restano ${esito.rimaste} letture assistite.`
          : `Ti restano ${esito.rimaste} usi dell'AI questo mese.`)
    );
  }

  async function importa() {
    if (!diff) return;
    setErrore(null);
    setInCorso(true);
    const righe: RigaImport[] = diff.nuovi.filter((_, i) => scelti[i]);
    const completamenti: RigaImport[] = diff.giaPresenti.filter((_, i) => completaScelti[i]);
    const esito = await applicaImportAzione(righe, completamenti);
    setInCorso(false);
    if (!esito.ok) {
      setErrore(esito.errore);
      return;
    }
    setFatti({ creati: esito.creati, completati: esito.completati });
    setDiff(null);
    setTesto("");
    router.refresh();
  }

  async function daFile(file: File | null) {
    if (!file) return;
    setTesto(await file.text());
  }

  const quantiScelti = scelti.filter(Boolean).length;
  const quantiCompletamenti = completaScelti.filter(Boolean).length;
  const quantiTotali = quantiScelti + quantiCompletamenti;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {fatti !== null && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {fatti.creati === 1 ? "Importato 1 cliente." : fatti.creati > 1 ? `Importati ${fatti.creati} clienti.` : ""}
          {fatti.completati > 0 &&
            ` ${fatti.completati === 1 ? "Completato 1 cliente già presente." : `Completati ${fatti.completati} clienti già presenti.`}`}
          {fatti.creati === 0 && fatti.completati === 0 && "Niente da scrivere: era già tutto in rubrica."}{" "}
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
                      {riga.propostoDallAi && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
                          letto dall&apos;assistente
                        </span>
                      )}
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
                Li riconosco dal numero di telefono, anche se scritto in un altro formato. Quello che
                hai già non lo tocco: se il nome qui è diverso, resta il tuo. Dove invece un campo è
                vuoto e nel file c&apos;è, puoi scegliere di riempirlo.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-600">
                {diff.giaPresenti.slice(0, 50).map((riga, i) => (
                  <li key={`${riga.telefono}-${i}`}>
                    {haQualcosaDaCompletare(riga) ? (
                      <label className="flex flex-wrap items-center gap-2">
                        <input
                          type="checkbox"
                          checked={completaScelti[i] ?? false}
                          onChange={(e) =>
                            setCompletaScelti(completaScelti.map((v, j) => (j === i ? e.target.checked : v)))
                          }
                        />
                        <span>{riga.telefono}</span>
                        <span className="text-zinc-900">
                          aggiungi
                          {riga.completabile.nome && <> il nome «{riga.nome}»</>}
                          {riga.completabile.nome && riga.completabile.email && " e"}
                          {riga.completabile.email && <> l&apos;email {riga.email}</>}
                        </span>
                        {riga.propostoDallAi && (
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">
                            letto dall&apos;assistente
                          </span>
                        )}
                      </label>
                    ) : (
                      <>
                        {riga.telefono} · nel file «{riga.nome ?? "senza nome"}», qui «
                        {riga.nomeEsistente ?? "senza nome"}»
                      </>
                    )}
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
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={recupera}
                  disabled={recuperoInCorso || inCorso}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  {recuperoInCorso ? "Leggo con l'assistente..." : "Prova a leggerle con l'assistente"}
                </button>
                <span className="text-xs text-zinc-500">
                  Usa 1 della tua quota AI. Propone nome e numero, tu confermi riga per riga: un numero
                  che non c&apos;è nella riga non lo può inventare.
                </span>
              </div>
            </section>
          )}

          {notaRecupero && (
            <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{notaRecupero}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={importa}
              disabled={inCorso || quantiTotali === 0}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {inCorso
                ? "Importo..."
                : quantiTotali === 1
                  ? "Importa 1 cliente"
                  : `Importa ${quantiTotali} clienti`}
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
