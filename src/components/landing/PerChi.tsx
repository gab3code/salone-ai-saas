"use client";

import type { LucideIcon } from "lucide-react";
import { Scissors, Sparkles, Users2, Dumbbell, Briefcase, CalendarCheck } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./Reveal";
import { TiltCard } from "./TiltCard";
import { SpotlightCard } from "./SpotlightCard";

interface Persona {
  titolo: string;
  testo: string;
  icona: LucideIcon;
  grande?: boolean;
}

/**
 * Riscritta (12/09/2026, punto 15 di Gabriel: la griglia uniforme "fa
 * schifo", scelta dopo aver visto le opzioni una bento grid asimmetrica
 * come Funzionalita.tsx -- stesso linguaggio visivo in tutto il sito
 * invece di un pattern diverso per ogni sezione). Il pubblico principale
 * (saloni/parrucchieri con team, da cui il nome del prodotto) prende un
 * riquadro doppio ed è il primo che si nota; gli altri restano normali.
 *
 * Aggiunta una sesta voce, esplicitamente un "chiunque altro" (richiesta
 * di Gabriel: "basta che attiri tutte le persone che prendono
 * appuntamenti") -- prima le 5 categorie elencate erano ampie ma implicite
 * nel non dire "e altri"; ora lo dice, senza dover elencare ogni singola
 * professione possibile.
 */
const PERSONE: Persona[] = [
  {
    titolo: "Parrucchieri e centri estetici con team",
    testo:
      "Più operatori, servizi con durate diverse e pause tra un trattamento e l'altro gestiti in automatico — niente più agenda cartacea con gli incastri fatti a mano.",
    icona: Scissors,
    grande: true,
  },
  {
    titolo: "Barbieri",
    testo: "Un link da mettere in bio: i clienti fissano da soli il taglio, tu resti concentrato sulla sedia, non sul telefono.",
    icona: Users2,
  },
  {
    titolo: "Centri estetici premium",
    testo: "Pacchetti di trattamenti, prenotazione online curata quanto il servizio che offri.",
    icona: Sparkles,
  },
  {
    titolo: "Personal trainer e centri fitness",
    testo: "Sessioni singole o ricorrenti, disponibilità sempre aggiornata anche su più sedi.",
    icona: Dumbbell,
  },
  {
    titolo: "Consulenti e liberi professionisti",
    testo: "Fisioterapisti, massaggiatori, tatuatori, consulenti: un'agenda seria anche senza uno studio con reception.",
    icona: Briefcase,
  },
  {
    titolo: "Qualunque attività lavori su appuntamento",
    testo: "Studi medici, centri benessere, scuole, noleggi: se i tuoi clienti prenotano un orario, funziona anche per te.",
    icona: CalendarCheck,
  },
];

function CardPersona({ p }: { p: Persona }) {
  return (
    <TiltCard className="h-full">
      <SpotlightCard
        className={`flex h-full flex-col rounded-2xl border p-5 ${
          p.grande ? "border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.04]" : "border-white/10 bg-white/5"
        }`}
      >
        <span className={`flex size-9 items-center justify-center rounded-lg ${p.grande ? "bg-violet-500/20 text-violet-200" : "bg-violet-500/15 text-violet-300"}`}>
          <p.icona className="size-4.5" />
        </span>
        <h3 className={`relative mt-3.5 font-medium text-white ${p.grande ? "text-base" : "text-[15px]"}`}>{p.titolo}</h3>
        <p className="relative mt-1.5 text-sm leading-relaxed text-white/60">{p.testo}</p>
      </SpotlightCard>
    </TiltCard>
  );
}

export function PerChi() {
  return (
    <section id="per-chi" className="scroll-mt-24 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-lg">
          <h2 className="text-sm font-medium text-violet-400">Per chi è</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Fatto per chi lavora su appuntamento — saloni, centri estetici e liberi professionisti.
          </p>
        </Reveal>

        <RevealStagger className="mt-12 grid auto-rows-fr grid-cols-1 gap-4 [grid-auto-flow:dense] sm:grid-cols-2 lg:grid-cols-4" gapMs={0.06}>
          {PERSONE.map((p) => (
            <RevealItem key={p.titolo} className={p.grande ? "sm:col-span-2" : "col-span-1"}>
              <CardPersona p={p} />
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
