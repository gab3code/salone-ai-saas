"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analizzaImportAzione, applicaImportAzione, leggiFotoAzione, recuperaRigheNonCapiteAzione } from "./azioni";
import { haQualcosaDaCompletare, type DiffImport, type RigaImport } from "@/lib/importa-clienti";
import type { VoceNonLetta } from "@/lib/importa-clienti-ai.server";
import { preparaFotoPerImport, type FotoPronta } from "./foto";

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
  // La foto dell'agenda: scelta, mostrata, e letta SOLO al clic (costa un uso
  // della quota, non parte da sola).
  const [foto, setFoto] = useState<FotoPronta | null>(null);
  const [fotoInCorso, setFotoInCorso] = useState(false);
  // Le voci della foto non proposte, con la trascrizione: si aggiungono a
  // mano guardando la foto. Vuoto quando la revisione viene da un incolla.
  const [vociNonLette, setVociNonLette] = useState<VoceNonLetta[]>([]);

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
    setVociNonLette([]);
    setNotaRecupero(null);
  }

  /**
   * La foto, letta dal modello. Tutto quello che torna e' una proposta: parte
   * non spuntato, e accanto a ogni riga c'e' la trascrizione da confrontare
   * con la foto che il titolare ha davanti.
   */
  async function leggiFoto() {
    if (!foto) return;
    setErrore(null);
    setFatti(null);
    setFotoInCorso(true);
    const esito = await leggiFotoAzione({ base64: foto.base64, tipo: foto.tipo });
    setFotoInCorso(false);
    if (!esito.ok) {
      setErrore(esito.errore);
      return;
    }
    if (esito.nonEUnaRubrica && esito.proposte.length === 0) {
      setErrore("In questa foto non ho trovato un elenco di persone. Prova con una foto piu' vicina e dritta della pagina.");
      return;
    }
    const nuovi = esito.proposte.filter((p) => !p.esistenteId);
    const giaPresenti = esito.proposte.filter((p) => p.esistenteId);
    setDiff({ nuovi, giaPresenti, scartate: [] });
    setScelti(nuovi.map(() => false));
    setCompletaScelti(giaPresenti.map(() => false));
    setVociNonLette(esito.nonLette);
    const lette = esito.proposte.length;
    setNotaRecupero(
      `${lette === 1 ? "1 voce letta" : `${lette} voci lette`} dalla foto: le trovi qui sotto, non spuntate, con accanto quello che ho letto. ` +
        (esito.nonLette.length > 0 ? `${esito.nonLette.length === 1 ? "1 voce" : `${esito.nonLette.length} voci`} non le ho lette con certezza: le vedi in fondo. ` : "") +
        (esito.aVita ? `Ti restano ${esito.rimaste} letture assistite.` : `Ti restano ${esito.rimaste} usi dell'AI questo mese.`)
    );
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
    setFoto(null);
    setVociNonLette([]);
    router.refresh();
  }

  async function daFile(file: File | null) {
    if (!file) return;
    setErrore(null);
    if (file.type.startsWith("image/")) {
      const pronta = await preparaFotoPerImport(file);
      if (!pronta.ok) {
        setErrore(pronta.errore);
        return;
      }
      setFoto(pronta.foto);
      return;
    }
    setFoto(null);
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
              oppure carica un file (CSV, rubrica .vcf, foto dell&apos;agenda){" "}
              <input
                type="file"
                accept=".csv,.txt,.vcf,text/csv,text/plain,text/vcard,image/*"
                onChange={(e) => daFile(e.target.files?.[0] ?? null)}
                className="text-sm"
              />
            </label>
          </div>

          {foto && (
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale, non un asset */}
              <img src={foto.anteprima} alt="La foto scelta" className="max-h-64 w-auto self-start rounded" />
              <p className="text-xs text-zinc-500">
                {foto.nome} · La leggo con l&apos;assistente: trascrive ogni voce e propone nome e numero, tu
                confermi riga per riga guardando la foto. Le cifre che non legge con certezza non le
                indovina: quelle voci te le mostro a parte. Usa 1 della tua quota AI.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={leggiFoto}
                  disabled={fotoInCorso || inCorso}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {fotoInCorso ? "Leggo la foto..." : "Leggi la foto con l'assistente"}
                </button>
                <button type="button" onClick={() => setFoto(null)} className="text-sm underline">
                  Togli la foto
                </button>
              </div>
            </div>
          )}
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
                      {riga.rigaOriginale && (
                        <span className="text-xs text-zinc-400">da «{riga.rigaOriginale}»</span>
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
                        {riga.rigaOriginale && (
                          <span className="text-xs text-zinc-400">da «{riga.rigaOriginale}»</span>
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

          {vociNonLette.length > 0 && (
            <section>
              <h2 className="text-sm font-medium">
                {vociNonLette.length === 1
                  ? "1 voce della foto che non ho letto con certezza"
                  : `${vociNonLette.length} voci della foto che non ho letto con certezza`}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                Dove una cifra non si legge metto un «?» e non propongo niente: un numero indovinato è
                peggio di un numero mancante. Confronta con la foto e aggiungi a mano chi è un cliente vero.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-zinc-500">
                {vociNonLette.slice(0, 50).map((voce, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono">{voce.trascrizione}</span>
                    <span className="text-zinc-400">
                      {voce.motivo === "cifre_incerte"
                        ? "cifre incerte"
                        : voce.motivo === "senza_numero"
                          ? "senza numero"
                          : "numero non riconoscibile"}
                    </span>
                  </li>
                ))}
              </ul>
              {vociNonLette.length > 50 && (
                <p className="mt-1 text-xs text-zinc-500">…e altre {vociNonLette.length - 50}.</p>
              )}
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
                setVociNonLette([]);
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
