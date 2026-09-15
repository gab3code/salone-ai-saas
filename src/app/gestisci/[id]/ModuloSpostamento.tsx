"use client";

import { useState, useTransition } from "react";
import { cercaSlotSpostamentoPubblico, spostaPrenotazionePubblica, type SlotSpostamento } from "./azioni";

/**
 * Spostamento self-service dell'appuntamento (Fase 4, richiesta di Gabriel
 * il 15/09/2026): stesso principio di ModuloCancellazione.tsx (Client
 * Component minimo, la pagina resta un Server Component) più un piccolo
 * flusso data -> slot ricalcato su FlussoPrenotazione.tsx (src/app/s/[slug]),
 * qui semplificato perché servizio e operatore restano quelli
 * dell'appuntamento originale -- il cliente sceglie solo un nuovo
 * giorno/orario.
 */
type Passo = "chiuso" | "data" | "slot" | "fatto";

function oggiYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatoOraCivile(iso: string): string {
  // `iso` è un istante "pseudo-UTC" (vedi src/lib/fuso-orario.ts): i campi
  // UTC rappresentano già l'ora civile del salone, stessa lettura di
  // FlussoPrenotazione.tsx.
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function formatoDataCivile(ymd: string): string {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export function ModuloSpostamento({
  appuntamentoId,
  giaCancellata,
  // Non null quando la finestra minima o il tetto di 1 spostamento (vedi
  // src/lib/finestra-spostamento.ts) sono già superati: qui solo per
  // mostrare subito il messaggio giusto invece del modulo, il controllo che
  // conta resta comunque nelle server action (un link riaperto da una tab
  // vecchia non deve mai bypassare la regola).
  messaggioBloccato,
}: {
  appuntamentoId: string;
  giaCancellata: boolean;
  messaggioBloccato?: string | null;
}) {
  const [passo, setPasso] = useState<Passo>("data");
  const [dataYMD, setDataYMD] = useState(oggiYMD());
  const [slot, setSlot] = useState<SlotSpostamento[]>([]);
  const [giornoChiuso, setGiornoChiuso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avviaTransizione] = useTransition();
  const [aperto, setAperto] = useState(false);
  const [nuovoInizioConfermato, setNuovoInizioConfermato] = useState<string | null>(null);

  if (giaCancellata) return null;

  if (passo === "fatto" && nuovoInizioConfermato) {
    const data = new Date(nuovoInizioConfermato);
    const quando = `${data.toLocaleDateString("it-IT", { timeZone: "UTC" })} alle ${formatoOraCivile(nuovoInizioConfermato)}`;
    return <p className="text-sm text-green-700">Appuntamento spostato: adesso è il {quando}.</p>;
  }

  if (messaggioBloccato) {
    return <p className="text-sm text-zinc-600">{messaggioBloccato}</p>;
  }

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        Sposta la prenotazione
      </button>
    );
  }

  function cercaDisponibilita() {
    setErrore(null);
    avviaTransizione(async () => {
      const risultato = await cercaSlotSpostamentoPubblico(appuntamentoId, dataYMD);
      if (!risultato.ok) {
        setErrore(risultato.errore);
        return;
      }
      setSlot(risultato.slot);
      setGiornoChiuso(risultato.giornoChiuso);
      setPasso("slot");
    });
  }

  function confermaSpostamento(inizioIso: string) {
    setErrore(null);
    avviaTransizione(async () => {
      const risultato = await spostaPrenotazionePubblica(appuntamentoId, inizioIso);
      if (!risultato.ok) {
        setErrore(risultato.errore);
        return;
      }
      setNuovoInizioConfermato(inizioIso);
      setPasso("fatto");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3">
      {passo === "data" && (
        <>
          <p className="text-sm font-medium text-zinc-900">Scegli il nuovo giorno</p>
          <input
            type="date"
            value={dataYMD}
            min={oggiYMD()}
            onChange={(e) => setDataYMD(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={inCorso}
              onClick={cercaDisponibilita}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {inCorso ? "Cerco disponibilità..." : "Cerca disponibilità"}
            </button>
            <button
              type="button"
              onClick={() => setAperto(false)}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
            >
              Annulla
            </button>
          </div>
        </>
      )}

      {passo === "slot" && (
        <>
          <button type="button" onClick={() => setPasso("data")} className="self-start text-xs text-zinc-400 underline">
            ← Cambia giorno
          </button>
          <p className="text-sm font-medium text-zinc-900">Orari disponibili -- {formatoDataCivile(dataYMD)}</p>
          {slot.length === 0 ? (
            <p className="text-sm text-zinc-600">
              {giornoChiuso ? "Chiuso in questo giorno, scegli un altro giorno." : "Nessuna disponibilità in questo giorno, prova un altro giorno."}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slot.map((s) => (
                <button
                  key={s.inizioIso}
                  type="button"
                  disabled={inCorso}
                  onClick={() => confermaSpostamento(s.inizioIso)}
                  className="rounded border border-zinc-200 px-2 py-1.5 text-sm hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {formatoOraCivile(s.inizioIso)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {errore && <p className="text-sm text-red-600">{errore}</p>}
    </div>
  );
}
