import { Scissors, Sparkles, Users2, Briefcase } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./Reveal";

const PERSONE = [
  { titolo: "Parrucchieri", testo: "Gestisci più operatori e servizi diversi senza incastri a mano sull'agenda cartacea.", icona: Scissors },
  { titolo: "Barbieri", testo: "Un link da mettere in bio: i clienti fissano da soli il taglio, tu resti concentrato in negozio.", icona: Users2 },
  { titolo: "Centri estetici", testo: "Servizi con durate diverse, pacchetti e pause tra un trattamento e l'altro gestiti in automatico.", icona: Sparkles },
  { titolo: "Liberi professionisti", testo: "Nail artist, massaggiatori, personal trainer: un'agenda seria anche senza uno studio con reception.", icona: Briefcase },
];

export function PerChi() {
  return (
    <section id="per-chi" className="bg-zinc-50 py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="max-w-lg">
          <h2 className="text-sm font-medium text-violet-600">Per chi è</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Pensato per chi lavora su appuntamento.
          </p>
        </Reveal>

        <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gapMs={0.08}>
          {PERSONE.map((p) => (
            <RevealItem key={p.titolo}>
              <div className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-5">
                <p.icona className="size-5 text-violet-600" />
                <h3 className="mt-3 text-[15px] font-medium text-zinc-900">{p.titolo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{p.testo}</p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
