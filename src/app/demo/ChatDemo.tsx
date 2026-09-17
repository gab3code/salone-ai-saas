"use client";

import { useRef, useState } from "react";
import {
  APPUNTAMENTI_MASSIMI_DEMO,
  LUNGHEZZA_MASSIMA_MESSAGGIO_DEMO,
} from "@/lib/demo/limiti-demo";
import type { StatoDemo } from "@/lib/demo/strumenti-demo";
import { operatoreDemoPerId, servizioDemoPerId } from "@/lib/demo/salone-finto";

/**
 * La chat della demo.
 *
 * Tiene storico e agenda nello stato del componente e li rimanda al server a
 * ogni messaggio: e' questo che rende la demo isolata fra visitatori senza
 * costare niente -- ognuno ha il suo stato, in memoria, e quando la scheda si
 * chiude non resta niente da nessuna parte. Non c'e' nessun salone condiviso
 * su cui pestarsi i piedi, e nessun dato da cancellare dopo.
 *
 * L'agenda si mostra a schermo man mano che si riempie: e' il pezzo che
 * convince davvero, perche' fa vedere che l'assistente non ha solo risposto
 * bene, ha messo l'appuntamento da qualche parte.
 */

const SUGGERIMENTI = [
  "Buongiorno, avete posto giovedì pomeriggio per un taglio?",
  "Quanto viene un colore e quanto ci vuole?",
  "Vorrei taglio e piega insieme, con chi posso?",
];

const SUGGERIMENTI_PRO = ["Dove posso parcheggiare?", "Fate il colore vegetale?"];

interface Messaggio {
  ruolo: "cliente" | "assistente";
  contenuto: string;
}

function formattaQuando(iso: string): string {
  const d = new Date(iso);
  const giorno = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const ora = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${giorno} alle ${ora}`;
}

export function ChatDemo({ piano }: { piano: "growth" | "pro" }) {
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [stato, setStato] = useState<StatoDemo>({ appuntamenti: [] });
  const [testo, setTesto] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [chiusa, setChiusa] = useState(false);
  const fine = useRef<HTMLDivElement>(null);

  async function invia(messaggio: string) {
    const pulito = messaggio.trim();
    if (!pulito || inCorso) return;

    setErrore(null);
    setTesto("");
    const storico = messaggi;
    setMessaggi([...storico, { ruolo: "cliente", contenuto: pulito }]);
    setInCorso(true);

    try {
      const risposta = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ piano, messaggio: pulito, storico, stato }),
      });
      const dati = (await risposta.json()) as {
        risposta?: string;
        stato?: StatoDemo;
        errore?: string;
        conversazioneChiusa?: boolean;
      };

      if (!risposta.ok || dati.errore) {
        setErrore(dati.errore ?? "Qualcosa non ha funzionato. Riprova.");
      } else {
        setMessaggi((m) => [...m, { ruolo: "assistente", contenuto: dati.risposta ?? "" }]);
        if (dati.stato) setStato(dati.stato);
        // Il server chiude la conversazione quando si e' parlato d'altro due
        // volte di fila: da li' in poi la casella resta spenta, e per
        // riprovare basta ricaricare.
        if (dati.conversazioneChiusa) setChiusa(true);
      }
    } catch {
      setErrore("Non riesco a raggiungere l'assistente. Controlla la connessione.");
    } finally {
      setInCorso(false);
      setTimeout(() => fine.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  const suggerimenti = piano === "pro" ? [...SUGGERIMENTI, ...SUGGERIMENTI_PRO] : SUGGERIMENTI;
  const agendaPiena = stato.appuntamenti.length >= APPUNTAMENTI_MASSIMI_DEMO;
  const bloccata = agendaPiena || chiusa;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-[22rem] flex-col rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-5 py-3">
          <p className="text-sm font-medium text-zinc-900">Scrivi come farebbe un tuo cliente</p>
          <p className="text-xs text-zinc-500">
            Risponde l&apos;assistente vero, sui servizi e sugli orari di questo salone.
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {messaggi.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {suggerimenti.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => invia(s)}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messaggi.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
                m.ruolo === "cliente"
                  ? "self-end bg-zinc-900 text-white"
                  : "self-start border border-zinc-200 bg-zinc-50 text-zinc-800"
              }`}
            >
              {m.contenuto}
            </div>
          ))}

          {inCorso && <p className="self-start text-xs text-zinc-400">L&apos;assistente sta scrivendo...</p>}
          <div ref={fine} />
        </div>

        {errore && (
          <p className="mx-5 mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {errore}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            invia(testo);
          }}
          className="flex gap-2 border-t border-zinc-100 p-3"
        >
          <input
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            maxLength={LUNGHEZZA_MASSIMA_MESSAGGIO_DEMO}
            placeholder={
              chiusa
                ? "Ricarica la pagina per ricominciare"
                : agendaPiena
                  ? "Hai già preso tutti gli appuntamenti di prova"
                  : "Scrivi qui..."
            }
            disabled={inCorso || bloccata}
            aria-label="Messaggio per l'assistente"
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-50"
          />
          <button
            type="submit"
            disabled={inCorso || bloccata || testo.trim() === ""}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Invia
          </button>
        </form>
      </div>

      {stato.appuntamenti.length > 0 && (
        <div className="rounded-2xl border border-zinc-900 bg-zinc-900 p-5 text-white">
          <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">
            L&apos;agenda del salone, adesso
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {stato.appuntamenti.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="font-medium">{formattaQuando(a.inizio)}</span>
                <span className="text-zinc-400">
                  {" — "}
                  {a.servizioIds.map((id) => servizioDemoPerId(id)?.nome ?? "servizio").join(" + ")}
                  {" con "}
                  {operatoreDemoPerId(a.operatoreId)?.nome ?? "operatore"}
                  {", "}
                  {a.clienteNome}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
            L&apos;assistente non ha solo risposto: ha messo l&apos;appuntamento in agenda da solo. Nel tuo salone
            lo troveresti qui, e il cliente riceverebbe la conferma con il link per disdire.
          </p>
        </div>
      )}
    </div>
  );
}
