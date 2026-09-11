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
  MessageCircle,
  BellRing,
  CreditCard,
  Smartphone,
  Send,
  SlidersHorizontal,
  Scissors,
} from "lucide-react";
import { RevealItem, RevealStagger, Reveal } from "./Reveal";
import { SpotlightCard } from "./SpotlightCard";

interface Voce {
  titolo: string;
  descrizione: string;
  icona: LucideIcon;
  inArrivo?: boolean;
}

/**
 * Griglia COMPLETA delle funzionalità, attuali e pianificate (richiesta di
 * Gabriel dell'11/09/2026: spiegare tutto, non solo quello che c'è oggi) --
 * ogni voce onestamente etichettata "disponibile ora" o "in arrivo", mai
 * presentata come pronta se non lo è (CLAUDE.md punto 7 esteso al
 * marketing). Vetrina.tsx sopra racconta la storia di 6 di queste in modo
 * scroll-driven; questa griglia è il colpo d'occhio completo per chi vuole
 * scorrere tutto velocemente.
 */
const VOCI: Voce[] = [
  { titolo: "Pagina di prenotazione online", descrizione: "Link tuo, condivisibile ovunque, self-service 24/7.", icona: Globe2 },
  { titolo: "Calendario intelligente", descrizione: "Disponibilità calcolata da orari, pause, ferie e durata reale del servizio.", icona: CalendarClock },
  { titolo: "CRM clienti", descrizione: "Storico completo, qualunque canale abbia usato per prenotare.", icona: Users },
  { titolo: "Assistente AI via chat web", descrizione: "Risponde e prenota da sola, passa la mano a te quando serve una persona.", icona: MessageSquareText },
  { titolo: "Multi-operatore e servizi", descrizione: "Ogni operatore con i propri orari, servizi e prezzi.", icona: Scissors },
  { titolo: "Dashboard con insight azionabili", descrizione: "Non solo numeri: un pulsante per contattare i clienti inattivi.", icona: LayoutDashboard },
  { titolo: "Registrazione zero-attrito", descrizione: "Ti registri e il tuo spazio è già pronto, nessun passaggio manuale.", icona: UserPlus },
  { titolo: "Isolamento dati reale", descrizione: "Separazione a livello di database tra ogni attività, non solo applicativa.", icona: ShieldCheck },
  { titolo: "Sync Google Calendar", descrizione: "Impegni personali dell'operatore bloccano lo slot in automatico.", icona: CalendarClock },
  { titolo: "Assistente AI su WhatsApp", descrizione: "Stesso assistente, dove i tuoi clienti scrivono già.", icona: MessageCircle, inArrivo: true },
  { titolo: "Promemoria automatici", descrizione: "Reminder e follow-up ai clienti inattivi, senza pensarci.", icona: BellRing, inArrivo: true },
  { titolo: "Pagamenti e upgrade self-service", descrizione: "Cambio piano dal pannello, senza scriverci.", icona: CreditCard, inArrivo: true },
  { titolo: "App installabile (PWA)", descrizione: "Dashboard a schermo intero, come un'app nativa.", icona: Smartphone, inArrivo: true },
  { titolo: "AI su Instagram e Telegram", descrizione: "Stessa reception AI, su altri canali dove serve.", icona: Send, inArrivo: true },
  { titolo: "Tono dell'AI personalizzabile", descrizione: "Guida il modo in cui l'assistente risponde ai tuoi clienti.", icona: SlidersHorizontal, inArrivo: true },
];

function Cella({ v }: { v: Voce }) {
  return (
    <SpotlightCard className="h-full rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors duration-300 hover:border-white/20">
      <div className="relative flex items-start justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <v.icona className="size-4" />
        </span>
        {v.inArrivo && (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">in arrivo</span>
        )}
      </div>
      <h3 className="relative mt-4 text-[15px] font-medium text-white">{v.titolo}</h3>
      <p className="relative mt-1.5 text-sm leading-relaxed text-white/60">{v.descrizione}</p>
    </SpotlightCard>
  );
}

export function Funzionalita() {
  return (
    <section id="funzionalita" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal className="max-w-lg">
        <h2 className="text-sm font-medium text-violet-400">Tutto quello che include</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Cosa c&apos;è oggi, cosa arriva dopo -- detto chiaro.
        </p>
      </Reveal>

      <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" gapMs={0.05}>
        {VOCI.map((v) => (
          <RevealItem key={v.titolo}>
            <Cella v={v} />
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
