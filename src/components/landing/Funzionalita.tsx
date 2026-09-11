"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Users, ShieldCheck } from "lucide-react";
import { RevealItem, RevealStagger, Reveal } from "./Reveal";

interface VoceBento {
  titolo: string;
  descrizione: string;
  icona: ReactNode;
}

// Griglia volutamente REGOLARE (3 colonne, nessuno span disomogeneo): un bento
// con riquadri di larghezza diversa è elegante solo quando il numero di voci
// si incastra senza buchi -- con un numero che cambia nel tempo (aggiungeremo
// funzionalità) un buco orfano è quasi garantito. I 3 differenziatori
// "principali" hanno la loro vetrina animata sopra (Vetrina.tsx); qui restano
// le funzionalità di supporto, in forma più sobria.
const VOCI: VoceBento[] = [
  {
    titolo: "CRM clienti integrato",
    descrizione: "Storico completo di ogni cliente, qualunque canale abbia usato per prenotare.",
    icona: <Users className="size-4" />,
  },
  {
    titolo: "Calendario sempre allineato",
    descrizione: "Si sincronizza con il Google Calendar personale di ogni operatore: niente doppie prenotazioni.",
    icona: <CalendarClock className="size-4" />,
  },
  {
    titolo: "Isolamento dati per salone",
    descrizione: "I dati di ogni attività restano separati e protetti: il tuo salone vede solo i tuoi dati.",
    icona: <ShieldCheck className="size-4" />,
  },
];

function Cella({ v }: { v: VoceBento }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-lg"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(320px circle at 20% 0%, rgba(168,85,247,0.08), transparent 70%)" }}
      />
      <div className="relative flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
        {v.icona}
      </div>
      <h3 className="relative mt-4 text-[15px] font-medium text-zinc-900">{v.titolo}</h3>
      <p className="relative mt-1.5 text-sm leading-relaxed text-zinc-500">{v.descrizione}</p>
    </motion.div>
  );
}

export function Funzionalita() {
  return (
    <section id="funzionalita" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal className="max-w-lg">
        <h2 className="text-sm font-medium text-violet-600">E ancora</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          Le basi, fatte bene.
        </p>
      </Reveal>

      <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-3" gapMs={0.08}>
        {VOCI.map((v) => (
          <RevealItem key={v.titolo}>
            <Cella v={v} />
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
