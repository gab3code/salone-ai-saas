"use client";

import type { LucideIcon } from "lucide-react";
import { Scissors, Sparkles, Users2, Dumbbell, Briefcase } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./Reveal";
import { TiltCard } from "./TiltCard";
import { SpotlightCard } from "./SpotlightCard";

interface Persona {
  titolo: string;
  testo: string;
  icona: LucideIcon;
}

const PERSONE: Persona[] = [
  {
    titolo: "Parrucchieri e centri estetici con team",
    testo:
      "Più operatori, servizi con durate diverse e pause tra un trattamento e l'altro gestiti in automatico -- niente più agenda cartacea con gli incastri fatti a mano.",
    icona: Scissors,
  },
  {
    titolo: "Barbieri",
    testo: "Un link da mettere in bio: i clienti fissano da soli il taglio, tu resti concentrato sulla sedia, non sul telefono.",
    icona: Users2,
  },
  {
    titolo: "Centri estetici premium",
    testo: "Pacchetti di trattamenti, prenotazione online curata quanto il servizio che offri -- la prima impressione conta anche prima di entrare.",
    icona: Sparkles,
  },
  {
    titolo: "Personal trainer e centri fitness",
    testo: "Sessioni singole o ricorrenti, disponibilità sempre aggiornata anche quando lavori su più sedi o orari spezzati.",
    icona: Dumbbell,
  },
  {
    titolo: "Consulenti e altri liberi professionisti",
    testo: "Fisioterapisti, massaggiatori, tatuatori, consulenti: un'agenda seria e una pagina di prenotazione anche senza uno studio con reception.",
    icona: Briefcase,
  },
];

export function PerChi() {
  return (
    <section id="per-chi" className="bg-zinc-50 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-lg">
          <h2 className="text-sm font-medium text-violet-600">Per chi è</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Pensato per chi lavora su appuntamento -- non solo per i saloni.
          </p>
        </Reveal>

        <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" gapMs={0.06}>
          {PERSONE.map((p) => (
            <RevealItem key={p.titolo}>
              <TiltCard className="h-full">
                <SpotlightCard className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <p.icona className="size-4.5" />
                  </span>
                  <h3 className="relative mt-3.5 text-[15px] font-medium text-zinc-900">{p.titolo}</h3>
                  <p className="relative mt-1.5 text-sm leading-relaxed text-zinc-500">{p.testo}</p>
                </SpotlightCard>
              </TiltCard>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
