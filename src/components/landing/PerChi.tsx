"use client";

import type { LucideIcon } from "lucide-react";
import { Scissors, Sparkles, Users2, Dumbbell, Briefcase, CalendarCheck, Camera } from "lucide-react";
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
 * invece di un pattern diverso per ogni sezione).
 *
 * Aggiunta una sesta voce, esplicitamente un "chiunque altro" (richiesta
 * di Gabriel: "basta che attiri tutte le persone che prendono
 * appuntamenti") -- prima le 5 categorie elencate erano ampie ma implicite
 * nel non dire "e altri"; ora lo dice, senza dover elencare ogni singola
 * professione possibile.
 *
 * Aggiunta una settima voce (controllo approfondito pre-pubblicazione,
 * 12/09/2026, bug reale segnalato da Gabriel: "buchi... nei potenziali
 * clienti in basso a destra"). Causa: 1 riquadro doppio + 5 normali fa 7
 * "unità" di griglia, che non è multiplo né di 4 (griglia desktop lg) né di
 * 2 (griglia da sm in su, prima di lg) -- l'ultima riga resta sempre
 * incompleta di una cella, quasi sempre proprio in basso a destra. Una
 * settima voce porta il totale a 8 unità, multiplo di entrambi: nessun
 * buco. Scelta una categoria vera e distinta dalle altre 6 (fotografi),
 * non un riempitivo senza senso.
 *
 * Aggiornamento 12/09/2026 (terzo giro) -- il riquadro doppio (il primo che
 * si nota) è passato da "Parrucchieri e centri estetici con team" al
 * catch-all "Qualunque attività lavori su appuntamento" (richiesta esplicita
 * di Gabriel: il titolo della sezione non deve più essere incentrato sui
 * saloni/estetisti, "è PER TUTTI quelli che usano appuntamenti" -- il
 * riquadro più in vista deve dirlo, non una singola categoria). Il testo
 * del catch-all è stato rafforzato per reggere il ruolo di card
 * riepilogativa: nomina esplicitamente anche saloni/palestre invece di
 * lasciarli solo nelle card sotto, e chiarisce che quelle sotto sono
 * esempi, non un elenco chiuso.
 *
 * Testi accorciati (quinto giro, feedback di Gabriel su "Parrucchieri e
 * centri estetici con team": "testo troppo lungo, accorcia il testo,
 * accorcia questa card e tutte le altre per occupare meno spazio" --
 * devono però restare uguali verticalmente tra loro). La griglia usa
 * `auto-rows-fr`: ogni riga si stira all'altezza della card più alta di
 * TUTTA la griglia, non solo della propria riga -- è la stessa proprietà
 * che a Funzionalita.tsx causava card inutilmente alte (bug fixato
 * rimuovendola lì), ma qui è l'effetto voluto (uniformità tra le card): il
 * problema non era la proprietà in sé, ma un singolo testo (quello di
 * "Parrucchieri...", quasi il doppio degli altri) che da solo dettava
 * l'altezza di TUTTE le sette card. Accorciato quel testo e allineata la
 * lunghezza delle altre sei (tutte tra ~75 e ~100 caratteri, contro i 161
 * originali della più lunga) cala l'altezza massima e quindi quella di
 * tutta la griglia, restando comunque tutte uguali tra loro.
 */
const PERSONE: Persona[] = [
  {
    titolo: "Qualunque attività lavori su appuntamento",
    testo:
      "Saloni, studi medici, centri benessere, palestre, scuole, noleggi: se i clienti prenotano un orario, è per te. Le categorie sotto sono solo esempi.",
    icona: CalendarCheck,
    grande: true,
  },
  {
    titolo: "Parrucchieri e centri estetici con team",
    testo: "Operatori, durate diverse e pause tra i trattamenti, gestiti in automatico — addio agenda cartacea.",
    icona: Scissors,
  },
  {
    titolo: "Barbieri",
    testo: "Un link in bio: i clienti fissano da soli il taglio, tu resti concentrato sulla sedia.",
    icona: Users2,
  },
  {
    titolo: "Centri estetici premium",
    testo: "Pacchetti di trattamenti, prenotazione online curata quanto il servizio.",
    icona: Sparkles,
  },
  {
    titolo: "Personal trainer e centri fitness",
    testo: "Sessioni singole o ricorrenti, disponibilità aggiornata anche su più sedi.",
    icona: Dumbbell,
  },
  {
    titolo: "Consulenti e liberi professionisti",
    testo: "Fisioterapisti, massaggiatori, tatuatori: un'agenda seria anche senza reception.",
    icona: Briefcase,
  },
  {
    titolo: "Fotografi e studi fotografici",
    testo: "Pacchetti fotografici e slot prenotabili, gestiti come un appuntamento qualsiasi.",
    icona: Camera,
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
        {/* Titolo riscritto e centrato (terzo giro, richiesta di Gabriel:
            "basta essere incentrato su sti estetisti, è PER TUTTI quelli
            che usano appuntamenti" + "i titoli sono allineati a sinistra e
            non al centro") -- non elenca più specifici settori, la card
            grande sotto lo fa già in modo esplicito. */}
        <Reveal className="mx-auto max-w-xl text-center">
          <h2 className="text-sm font-medium text-violet-400">Per chi è</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Fatto per chi lavora su appuntamento, qualunque sia il tuo settore.
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
