"use client";

import { X, Check, Clock, MessageCircleWarning, Calculator } from "lucide-react";
import { Reveal } from "./Reveal";
import { CompareSlider } from "./CompareSlider";

function PannelloPrima() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 bg-gradient-to-br from-zinc-100 to-zinc-200 p-6 sm:p-8">
      <p className="mb-1 text-xs font-medium tracking-wide text-zinc-500 uppercase">Senza</p>
      {[
        { icona: MessageCircleWarning, testo: "3 messaggi non letti da ieri sera" },
        { icona: Clock, testo: "Cliente in attesa da 40 minuti" },
        { icona: X, testo: "Doppia prenotazione scoperta tardi" },
      ].map((r) => (
        <div key={r.testo} className="flex items-center gap-2.5 rounded-lg border border-zinc-300 bg-white/70 px-3 py-2.5 text-xs text-zinc-600 sm:text-sm">
          <r.icona className="size-4 shrink-0 text-zinc-400" />
          {r.testo}
        </div>
      ))}
    </div>
  );
}

function PannelloDopo() {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 sm:p-8">
      <p className="mb-1 text-xs font-medium tracking-wide text-violet-300 uppercase">Con l&apos;assistente AI</p>
      {[
        "Cliente prenota da solo fuori orario, tu lo trovi già confermato",
        "L'AI risponde in pochi secondi, 24 ore su 24",
        "Un solo calendario: zero doppie prenotazioni",
      ].map((r) => (
        <div key={r} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white/80 sm:text-sm">
          <Check className="size-4 shrink-0 text-emerald-400" />
          {r}
        </div>
      ))}
    </div>
  );
}

export function PrimaDopo() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8">
      <Reveal className="text-center">
        <h2 className="text-sm font-medium text-violet-400">Cosa cambia davvero</h2>
        <p className="mx-auto mt-2 max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Trascina per vedere la differenza.
        </p>
      </Reveal>

      <Reveal className="mt-10">
        <CompareSlider sinistra={<PannelloPrima />} destra={<PannelloDopo />} className="aspect-[4/3] w-full sm:aspect-[16/9]" />
      </Reveal>
      <p className="mt-3 text-center text-xs text-white/40">Situazioni tipiche, non dati di un cliente reale.</p>

      {/* Richiesta di Gabriel: far capire il vantaggio ECONOMICO, non solo
          l'esperienza. Non abbiamo clienti reali su cui basare una media
          (il prodotto non è ancora live, vedi PROJECT_STATUS.md) -- inventare
          "in media i clienti risparmiano X€" sarebbe un dato falso spacciato
          per statistica, la stessa cosa che il progetto evita ovunque
          (CLAUDE.md punto 7). Un calcolo esplicito con ipotesi dichiarate
          (non un numero misterioso) resta onesto e fa comunque capire la
          scala del problema. */}
      <Reveal>
        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <Calculator className="size-4.5" />
          </span>
          <p className="text-sm text-white/70">
            <span className="font-medium text-white">Un solo messaggio senza risposta alla settimana</span>, su uno scontrino
            medio di 35€, sono <span className="font-medium text-white">oltre 1.800€ l&apos;anno</span> di prenotazioni che
            non arrivano nemmeno a diventare un &quot;no&quot;.
          </p>
        </div>
        <p className="mt-2 text-center text-xs text-white/30">
          Calcolo illustrativo (1 messaggio/settimana × 35€ × 52 settimane) per far capire la scala del problema, non una media misurata sui nostri clienti.
        </p>
      </Reveal>
    </section>
  );
}
