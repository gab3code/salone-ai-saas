"use client";

import type { LucideIcon } from "lucide-react";
import {
  Globe2,
  CalendarClock,
  Users,
  MessageSquareText,
  ShieldCheck,
  LayoutDashboard,
  UserPlus,
  BellRing,
  CreditCard,
  Smartphone,
  SlidersHorizontal,
  Scissors,
  BarChart3,
  MessageSquareMore,
} from "lucide-react";
import { RevealItem, RevealStagger, Reveal } from "./Reveal";
import { SpotlightCard } from "./SpotlightCard";

interface Voce {
  titolo: string;
  descrizione: string;
  icona: LucideIcon;
  /** riquadri "grande" per i 4 pilastri del prodotto -- il resto è "normale". */
  grande?: boolean;
}

/**
 * Griglia COMPLETA delle funzionalità (11/09/2026: spiegare tutto, non solo
 * quello che c'è oggi). Vetrina.tsx sopra racconta la storia di 6 di queste
 * in modo scroll-driven; questa griglia è il colpo d'occhio completo per chi
 * vuole scorrere tutto velocemente.
 *
 * Riscritta (12/09/2026, punto 3 di Gabriel: "cosa c'è oggi e cosa arriva
 * dopo è una sezione orrenda, su telefono devo scorrere tantissimo").
 * Cause reali di prima: (1) la separazione "disponibili" vs "in arrivo" non
 * ha più senso ora che il sito descrive il prodotto al lancio, non lo stato
 * di oggi (vedi Prezzi.tsx/Vetrina.tsx, stessa decisione) -- unite in
 * un'unica lista di 17 voci; (2) 17 card tutte identiche in griglia
 * uniforme sarebbero state ancora un muro indistinguibile, e su telefono
 * una colonna sola di 17 blocchi uguali è esattamente lo scroll infinito
 * lamentato. Soluzione (scelta con Gabriel dopo aver visto le opzioni,
 * ispirata alle "bento grid" di OriginKit/21st): una griglia asimmetrica --
 * i 4 pilastri del prodotto (calendario, AI in chat, dashboard, promemoria)
 * occupano un riquadro doppio e si notano subito; le altre 13 funzioni
 * restano in riquadri normali. `grid-flow-dense` chiude i buchi da solo,
 * niente ordine a mano da mantenere quando si aggiunge una voce.
 */
const FUNZIONI: Voce[] = [
  { titolo: "Calendario intelligente", descrizione: "Disponibilità calcolata da orari, pause, ferie e durata reale del servizio.", icona: CalendarClock, grande: true },
  { titolo: "Pagina di prenotazione online", descrizione: "Link tuo, condivisibile ovunque, self-service 24/7.", icona: Globe2 },
  { titolo: "CRM clienti", descrizione: "Storico completo, qualunque canale abbia usato per prenotare.", icona: Users },
  { titolo: "Assistente AI in chat, WhatsApp, Instagram e Telegram", descrizione: "Lo stesso assistente risponde e prenota da solo ovunque scrivano i clienti, e passa la mano a te quando serve una persona.", icona: MessageSquareText, grande: true },
  { titolo: "Multi-operatore e servizi", descrizione: "Ogni operatore con i propri orari, servizi e prezzi.", icona: Scissors },
  { titolo: "Dashboard con insight azionabili", descrizione: "Non solo numeri: un pulsante per contattare i clienti inattivi.", icona: LayoutDashboard, grande: true },
  { titolo: "Registrazione zero-attrito", descrizione: "Ti registri e il tuo spazio è già pronto, nessun passaggio manuale.", icona: UserPlus },
  { titolo: "Isolamento dati reale", descrizione: "Separazione a livello di database tra ogni attività, non solo applicativa.", icona: ShieldCheck },
  { titolo: "Sync Google Calendar", descrizione: "Impegni personali dell'operatore bloccano lo slot in automatico.", icona: CalendarClock },
  { titolo: "Promemoria automatici", descrizione: "Reminder prima dell'appuntamento e follow-up ai clienti inattivi, senza pensarci.", icona: BellRing, grande: true },
  { titolo: "SMS", descrizione: "Promemoria e conferme anche senza WhatsApp o smartphone.", icona: MessageSquareMore },
  { titolo: "Pagamenti e upgrade self-service", descrizione: "Cambio piano dal pannello, senza scriverci.", icona: CreditCard },
  { titolo: "App installabile (PWA)", descrizione: "Dashboard a schermo intero, come un'app nativa.", icona: Smartphone },
  { titolo: "Tono dell'AI personalizzabile", descrizione: "Guida il modo in cui l'assistente risponde ai tuoi clienti.", icona: SlidersHorizontal },
  { titolo: "Analytics", descrizione: "Andamento prenotazioni e clienti nel tempo, non solo i numeri di oggi.", icona: BarChart3 },
];

function Cella({ v }: { v: Voce }) {
  return (
    <SpotlightCard
      className={`flex h-full flex-col rounded-2xl border p-4 transition-colors duration-300 sm:p-5 ${
        v.grande
          ? "border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.04] hover:border-violet-400/40"
          : "border-white/10 bg-white/5 hover:border-white/20"
      }`}
    >
      <span
        className={`relative flex size-9 items-center justify-center rounded-lg ${
          v.grande ? "bg-violet-500/20 text-violet-200" : "bg-violet-500/15 text-violet-300"
        }`}
      >
        <v.icona className="size-4" />
      </span>
      <h3 className={`relative mt-3 font-medium text-white sm:mt-4 ${v.grande ? "text-base" : "text-[15px]"}`}>{v.titolo}</h3>
      {/* Descrizione nascosta su telefono per le card piccole (punto 3 di
          Gabriel: "su telefono devo scorrere tantissimo") -- titolo e icona
          bastano a far capire la funzione in uno sguardo su schermo
          stretto; il dettaglio resta per chi ha spazio (tablet in su) e per
          i 4 pilastri, che lo meritano su ogni schermo. */}
      <p className={`relative mt-1.5 text-sm leading-relaxed text-white/60 ${v.grande ? "" : "hidden sm:block"}`}>{v.descrizione}</p>
    </SpotlightCard>
  );
}

export function Funzionalita() {
  return (
    <section id="funzionalita" className="scroll-mt-24 mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal className="max-w-lg">
        <h2 className="text-sm font-medium text-violet-400">Tutto quello che include</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Tutto quello che serve, in un unico posto.</p>
      </Reveal>

      <RevealStagger className="mt-12 grid auto-rows-fr grid-cols-2 gap-3 [grid-auto-flow:dense] sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" gapMs={0.04}>
        {FUNZIONI.map((v) => (
          <RevealItem key={v.titolo} className={v.grande ? "col-span-2" : "col-span-1"}>
            <Cella v={v} />
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
