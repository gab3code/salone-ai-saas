"use client";

import { ShieldCheck, Sparkles, Globe2, Layers, UserCheck } from "lucide-react";
import { RevealStagger, RevealItem } from "./Reveal";
import { Lampada } from "./Lampada";
import { SpotlightCard } from "./SpotlightCard";

const NODI_FLUSSO = [
  "Il cliente scrive dalla chat o dalla pagina pubblica.",
  "Un unico motore decide la disponibilità in tempo reale.",
  "Calendario, CRM e AI restano sempre allineati.",
];

/**
 * Riscritta (punto 4 di Gabriel: "i tre punti non hanno senso"). Prima erano
 * 3 cerchi su una riga orizzontale collegati da una linea sottile, con un
 * pallino che ci correva sopra avanti e indietro all'infinito -- un'
 * animazione carina di per sé, ma senza un vero motivo per esistere qui:
 * non stava raccontando un caricamento o un progresso reale, girava a vuoto
 * e distraeva da un contenuto che è comunque solo un flusso logico in 3
 * passaggi (vedi "How It Works Timeline"/OriginKit come riferimento).
 * Sostituita con una timeline verticale: numeri collegati da una linea
 * tratteggiata ferma, ogni passaggio compare quando entra in vista invece
 * di muoversi in loop -- comunica "sequenza", non "caricamento".
 */
function FlussoAnimato() {
  return (
    <RevealStagger className="mx-auto mt-14 max-w-lg" gapMs={0.15}>
      {NODI_FLUSSO.map((testo, i) => (
        <RevealItem key={testo} className="relative flex gap-4 pb-8 last:pb-0">
          {i < NODI_FLUSSO.length - 1 && (
            <span className="absolute top-10 left-5 h-[calc(100%-2.5rem)] w-px border-l-2 border-dashed border-white/15" />
          )}
          <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-noir text-sm font-semibold text-violet-300">
            {i + 1}
          </span>
          <p className="pt-2 text-sm leading-relaxed text-white/60 sm:text-base">{testo}</p>
        </RevealItem>
      ))}
    </RevealStagger>
  );
}

const DIFFERENZIATORI = [
  {
    icona: Sparkles,
    titolo: "L'AI dove serve, non solo sul piano più caro",
    testo:
      "L'assistente che risponde ai clienti è già incluso da un piano intermedio, non riservato al piano top — perché è una delle funzioni che aiuta di più chi sta ancora crescendo, non un premio per chi paga già di più.",
  },
  {
    icona: Globe2,
    titolo: "Pagina di prenotazione inclusa da subito",
    testo:
      "Un link tuo, condivisibile ovunque, con prenotazione self-service — anche sul piano gratuito. Non è un extra da sbloccare più avanti.",
  },
  {
    icona: ShieldCheck,
    titolo: "I tuoi dati sono solo tuoi",
    testo:
      "Isolamento reale a livello di database tra ogni attività iscritta, non solo un filtro nell'applicazione — un bug altrove non può mai far leggere i tuoi clienti a qualcun altro.",
  },
  {
    icona: Layers,
    titolo: "Prezzi che si capiscono a colpo d'occhio",
    testo:
      "Pochi piani chiari, senza una decina di componenti aggiuntivi da combinare per capire quanto pagherai davvero.",
  },
  {
    icona: UserCheck,
    titolo: "L'AI sa quando fermarsi",
    testo:
      "Richieste ambigue, reclami, casi fuori dal normale: passati a te con tutto il contesto, non gestiti a forza da un modello che indovina.",
  },
];

export function PercheNoi() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <Lampada>
        <div className="text-center">
          <h2 className="text-sm font-medium text-violet-400">Perché questo, non un gestionale qualsiasi</h2>
          <p className="mx-auto mt-2 max-w-xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Le differenze che contano quando lo usi ogni giorno.
          </p>
        </div>
      </Lampada>

      <FlussoAnimato />

      {/* 5 elementi su una griglia a 3 colonne: l'ultima riga (2 elementi)
          lascerebbe un buco a destra (bug reale segnalato da Gabriel -- un
          semplice "col-start" non basta perché la riga finale non ha UN
          elemento solo, ne ha due). Le prime 3 vanno nella griglia normale,
          le ultime 2 in una riga a parte centrata, larghe quanto sarebbero
          state nella griglia (stesso gap) -- nessun buco, nessuna card
          storta. */}
      <RevealStagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DIFFERENZIATORI.slice(0, 3).map((d) => (
          <RevealItem key={d.titolo}>
            <SpotlightCard className="h-full rounded-2xl border border-white/10 bg-white/5 p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <d.icona className="size-4.5" />
              </span>
              <h3 className="mt-3 text-[15px] font-medium text-white">{d.titolo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">{d.testo}</p>
            </SpotlightCard>
          </RevealItem>
        ))}
      </RevealStagger>
      <RevealStagger className="mt-4 flex flex-wrap justify-center gap-4">
        {DIFFERENZIATORI.slice(3).map((d) => (
          <RevealItem key={d.titolo} className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]">
            <SpotlightCard className="h-full rounded-2xl border border-white/10 bg-white/5 p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <d.icona className="size-4.5" />
              </span>
              <h3 className="mt-3 text-[15px] font-medium text-white">{d.titolo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">{d.testo}</p>
            </SpotlightCard>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
