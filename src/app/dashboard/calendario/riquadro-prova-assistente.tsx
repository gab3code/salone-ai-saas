"use client";

import { useState } from "react";
import Link from "next/link";
import { provaAssistente } from "./azioni-prova-assistente";
import { DOMANDE_ESEMPIO, LUNGHEZZA_MASSIMA_DOMANDA_DEMO } from "@/lib/ai/demo-assistente";
import { SLUG_DEMO_GROWTH } from "@/lib/demo";

/**
 * Il riquadro che compare dopo un appuntamento inserito a mano, sui piani
 * senza assistente (Fase 5, ultimo punto aperto, chiuso il 17/09/2026).
 *
 * Perche' proprio qui e non nella pagina dei prezzi: un appuntamento
 * inserito a mano E' una telefonata a cui ha risposto il titolare. Questo
 * e' il momento in cui ha appena fatto la fatica che l'assistente gli
 * toglierebbe, e una tabella prezzi non arriva mai in quel momento.
 *
 * La prova non e' un esempio scritto da noi: e' una chiamata vera al
 * modello, sui servizi, i prezzi, gli orari e l'agenda VERI di questo
 * salone. Un esempio finto si riconosce e non convince. Quello che la
 * prova non puo' fare e' prenotare: vede l'agenda, non la tocca -- ed e'
 * detto a schermo, perche' e' esattamente la differenza che si paga
 * passando a Growth.
 *
 * Si chiude, e resta chiuso per un mese: un riquadro commerciale che
 * ricompare a ogni appuntamento inserito diventa un fastidio e fa
 * l'effetto contrario.
 */

const CHIAVE_CHIUSURA = "salone-ai:prova-assistente-chiusa-fino-a";
const GIORNI_DI_SILENZIO = 30;

function chiudiPerUnMese() {
  try {
    const fino = Date.now() + GIORNI_DI_SILENZIO * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(CHIAVE_CHIUSURA, String(fino));
  } catch {
    // Finestra anonima, storage pieno o bloccato: pazienza, il riquadro
    // ricomparira'. Non vale un errore a schermo.
  }
}

function chiusaDiRecente(): boolean {
  try {
    const salvato = window.localStorage.getItem(CHIAVE_CHIUSURA);
    return salvato !== null && Number(salvato) > Date.now();
  } catch {
    return false;
  }
}

export function RiquadroProvaAssistente({ rimasteIniziali }: { rimasteIniziali: number }) {
  // Inizializzatore pigro invece di un `useEffect` che chiama setState
  // (che e' anche un errore di lint, giustamente: farebbe un secondo render
  // a vuoto a ogni montaggio).
  //
  // Leggere `localStorage` durante il render sarebbe rischioso in un
  // componente disegnato anche dal server -- l'HTML del server e quello del
  // browser non coinciderebbero -- ma questo non lo e' mai: la pagina lo
  // monta solo quando `appenaCreato` diventa vero, cioe' dopo che il
  // titolare ha salvato un appuntamento, quindi ben dopo l'idratazione. Nel
  // dubbio il `try` copre comunque il caso in cui `window` non esista.
  const [chiuso, setChiuso] = useState(chiusaDiRecente);
  const [domanda, setDomanda] = useState(DOMANDE_ESEMPIO[0]);
  const [risposta, setRisposta] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [rimaste, setRimaste] = useState(rimasteIniziali);
  const [inCorso, setInCorso] = useState(false);

  if (chiuso) return null;

  async function prova() {
    setInCorso(true);
    setErrore(null);
    setRisposta(null);
    try {
      const esito = await provaAssistente(domanda);
      if (typeof esito.rimaste === "number") setRimaste(esito.rimaste);
      if (esito.errore) setErrore(esito.errore);
      else if (esito.risposta) setRisposta(esito.risposta);
    } finally {
      setInCorso(false);
    }
  }

  const esaurite = rimaste <= 0 && risposta === null;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-300 bg-zinc-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-900">Questo appuntamento l&apos;hai preso tu</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-600">
            Con <strong>Growth</strong> l&apos;assistente risponde al posto tuo e prenota da solo, anche di domenica
            e alle undici di sera. Scrivi qui sotto quello che ti ha chiesto un cliente al telefono: ti faccio
            vedere cosa gli avrebbe risposto, con i tuoi servizi e i tuoi orari veri. Se invece vuoi vedere la
            scena dalla parte del cliente,{" "}
            <a href={`/s/${SLUG_DEMO_GROWTH}`} target="_blank" rel="noopener" className="underline">
              apri il salone di prova
            </a>{" "}
            e prenota tu stesso.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            chiudiPerUnMese();
            setChiuso(true);
          }}
          aria-label="Chiudi, e non mostrarlo per un mese"
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {DOMANDE_ESEMPIO.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDomanda(d)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              domanda === d
                ? "border-zinc-900 bg-white text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:bg-white"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <textarea
        value={domanda}
        maxLength={LUNGHEZZA_MASSIMA_DOMANDA_DEMO}
        onChange={(e) => setDomanda(e.target.value)}
        rows={2}
        className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
        aria-label="La domanda di un cliente"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={prova}
          disabled={inCorso || esaurite}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {inCorso ? "Sto rispondendo..." : "Guarda cosa avrebbe risposto"}
        </button>
        <span className="text-xs text-zinc-500">
          {rimaste > 0
            ? `Ti ${rimaste === 1 ? "resta 1 prova" : `restano ${rimaste} prove`} questo mese.`
            : "Prove finite per questo mese."}
        </span>
      </div>

      {errore && (
        <p className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{errore}</p>
      )}

      {risposta && (
        <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">L&apos;assistente avrebbe detto</p>
          <p className="mt-2 text-sm whitespace-pre-line text-zinc-800">{risposta}</p>
          <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Nella prova l&apos;assistente guarda la tua agenda ma non la tocca. Con Growth l&apos;appuntamento lo
            avrebbe anche preso: questo, che hai appena scritto tu, lo avresti trovato già in calendario.{" "}
            <a href={`/s/${SLUG_DEMO_GROWTH}`} target="_blank" rel="noopener" className="underline">
              Guarda come lo vede un tuo cliente
            </a>
            .
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4">
        <Link
          href="/dashboard/abbonamento?piano=growth"
          className="rounded-lg border border-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
        >
          Passa a Growth
        </Link>
        <span className="text-xs text-zinc-500">Dieci giorni di prova prima del primo addebito.</span>
      </div>
    </section>
  );
}
