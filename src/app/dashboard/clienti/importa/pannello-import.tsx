"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analizzaImportAzione, applicaImportAzione, leggiFotoAzione, recuperaRigheNonCapiteAzione } from "./azioni";
import { haQualcosaDaCompletare, telefonoCanonico, type DiffImport, type RigaImport } from "@/lib/importa-clienti";
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
/** Pagine per giro: oltre, meglio due giri che un'attesa di minuti senza vedere niente. */
const MAX_FOTO_PER_GIRO = 10;

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
  // Le foto dell'agenda: scelte, mostrate, e lette SOLO al clic (ogni foto
  // costa un uso della quota, non parte da sola). Piu' pagine in un giro:
  // un quaderno non e' una pagina sola.
  const [foto, setFoto] = useState<FotoPronta[]>([]);
  const [fotoInCorso, setFotoInCorso] = useState<number | null>(null);
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
   * Le foto, lette dal modello una alla volta. Tutto quello che torna e' una
   * proposta: parte non spuntato, e accanto a ogni riga c'e' la trascrizione
   * da confrontare con la foto che il titolare ha davanti. Lo stesso numero
   * su due pagine si tiene una volta. Se una foto fallisce (quota finita,
   * rete) ci si ferma li' e si mostra quello che si e' letto fino a quel
   * punto, con l'errore.
   */
  async function leggiFoto() {
    if (foto.length === 0) return;
    setErrore(null);
    setFatti(null);
    const nuovi: RigaImport[] = [];
    const giaPresenti: RigaImport[] = [];
    const nonLette: VoceNonLetta[] = [];
    const visti = new Set<string>();
    let lette = 0;
    let fotoLette = 0;
    let erroreFoto: string | null = null;
    let ultimoEsito: { rimaste: number; aVita: boolean } | null = null;
    for (let i = 0; i < foto.length; i++) {
      setFotoInCorso(i);
      const esito = await leggiFotoAzione({ base64: foto[i].base64, tipo: foto[i].tipo });
      if (!esito.ok) {
        erroreFoto = foto.length > 1 ? `Foto ${i + 1} (${foto[i].nome}): ${esito.errore}` : esito.errore;
        break;
      }
      fotoLette += 1;
      ultimoEsito = { rimaste: esito.rimaste, aVita: esito.aVita };
      for (const p of esito.proposte) {
        const chiave = telefonoCanonico(p.telefono);
        if (visti.has(chiave)) continue;
        visti.add(chiave);
        lette += 1;
        if (p.esistenteId) giaPresenti.push(p);
        else nuovi.push(p);
      }
      nonLette.push(...esito.nonLette);
      if (esito.nonEUnaRubrica && esito.proposte.length === 0) {
        nonLette.push({ trascrizione: `(foto ${i + 1}, ${foto[i].nome}: non ci ho trovato un elenco di persone)`, motivo: "senza_numero" });
      }
    }
    setFotoInCorso(null);
    if (fotoLette === 0) {
      setErrore(erroreFoto ?? "Non ho letto niente.");
      return;
    }
    if (erroreFoto) setErrore(`${erroreFoto} Le foto lette prima sono qui sotto.`);
    setDiff({ nuovi, giaPresenti, scartate: [] });
    setScelti(nuovi.map(() => false));
    setCompletaScelti(giaPresenti.map(() => false));
    setVociNonLette(nonLette);
    setNotaRecupero(
      `${lette === 1 ? "1 voce letta" : `${lette} voci lette`} da ${fotoLette === 1 ? "1 foto" : `${fotoLette} foto`}: le trovi qui sotto, non spuntate, con accanto quello che ho letto. ` +
        (nonLette.length > 0 ? `${nonLette.length === 1 ? "1 voce" : `${nonLette.length} voci`} non le ho lette con certezza: le vedi in fondo. ` : "") +
        (ultimoEsito
          ? ultimoEsito.aVita
            ? `Ti restano ${ultimoEsito.rimaste} letture assistite.`
            : `Ti restano ${ultimoEsito.rimaste} usi dell'AI questo mese.`
          : "")
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
    setFoto([]);
    setVociNonLette([]);
    router.refresh();
  }

  async function daFile(lista: FileList | null) {
    const file = Array.from(lista ?? []);
    if (file.length === 0) return;
    setErrore(null);
    const immagini = file.filter((f) => f.type.startsWith("image/"));
    if (immagini.length > 0) {
      const pronte: FotoPronta[] = [];
      const errori: string[] = [];
      for (const f of immagini.slice(0, MAX_FOTO_PER_GIRO)) {
        const pronta = await preparaFotoPerImport(f);
        if (pronta.ok) pronte.push(pronta.foto);
        else errori.push(`${f.name}: ${pronta.errore}`);
      }
      if (errori.length > 0) setErrore(errori.join(" "));
      setFoto((prima) => [...prima, ...pronte].slice(0, MAX_FOTO_PER_GIRO));
      return;
    }
    setFoto([]);
    setTesto(await file[0].text());
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
                multiple
                accept=".csv,.txt,.vcf,text/csv,text/plain,text/vcard,image/*"
                onChange={(e) => {
                  void daFile(e.target.files);
                  e.target.value = "";
                }}
                className="text-sm"
              />
            </label>
          </div>

          {foto.length > 0 && (
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3">
              <ul className="flex flex-wrap gap-3">
                {foto.map((f, i) => (
                  <li key={`${f.nome}-${i}`} className="flex flex-col items-start gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale, non un asset */}
                    <img src={f.anteprima} alt={`Foto ${i + 1}`} className="max-h-40 w-auto rounded" />
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="max-w-40 truncate">{f.nome}</span>
                      <button
                        type="button"
                        onClick={() => setFoto(foto.filter((_, j) => j !== i))}
                        disabled={fotoInCorso !== null}
                        className="underline"
                      >
                        togli
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-zinc-500">
                {foto.length === 1 ? "La leggo" : `Le leggo una alla volta`} con l&apos;assistente, due volte
                ciascuna: trascrive ogni voce e propone nome e numero solo se le due letture coincidono, tu
                confermi riga per riga guardando la foto. Le cifre che non legge con certezza non le indovina:
                quelle voci te le mostro a parte, e un&apos;email letta in due modi diversi la lascia vuota. {foto.length === 1 ? "Usa 1 della tua quota AI." : `Usa ${foto.length} della tua quota AI (1 per foto).`}
                {foto.length < MAX_FOTO_PER_GIRO && " Puoi aggiungere altre pagine dallo stesso pulsante."}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={leggiFoto}
                  disabled={fotoInCorso !== null || inCorso}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {fotoInCorso !== null
                    ? foto.length > 1
                      ? `Leggo la foto ${fotoInCorso + 1} di ${foto.length}...`
                      : "Leggo la foto..."
                    : foto.length > 1
                      ? `Leggi le ${foto.length} foto con l'assistente`
                      : "Leggi la foto con l'assistente"}
                </button>
                <button type="button" onClick={() => setFoto([])} disabled={fotoInCorso !== null} className="text-sm underline">
                  {foto.length > 1 ? "Togli tutte" : "Togli la foto"}
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
                Leggo ogni foto due volte e propongo un numero solo se le due letture coincidono; dove una
                cifra non si legge metto un «?» e non propongo niente. Un numero indovinato è peggio di un
                numero mancante. Confronta con la foto e aggiungi a mano chi è un cliente vero.
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
                          : voce.motivo === "letture_discordanti"
                            ? "letto in due modi diversi"
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
