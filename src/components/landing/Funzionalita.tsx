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
  BarChart3,
  MessageSquareMore,
} from "lucide-react";
import { RevealItem, RevealStagger, Reveal } from "./Reveal";
import { SpotlightCard } from "./SpotlightCard";

interface Voce {
  titolo: string;
  descrizione: string;
  icona: LucideIcon;
}

/**
 * Griglia COMPLETA delle funzionalità, attuali e pianificate (richiesta di
 * Gabriel dell'11/09/2026: spiegare tutto, non solo quello che c'è oggi) --
 * ogni voce onestamente etichettata "disponibile ora" o "in arrivo", mai
 * presentata come pronta se non lo è (CLAUDE.md punto 7 esteso al
 * marketing). Vetrina.tsx sopra racconta la storia di 6 di queste in modo
 * scroll-driven; questa griglia è il colpo d'occhio completo per chi vuole
 * scorrere tutto velocemente.
 *
 * Riorganizzata (Giro 4, feedback di Gabriel: "le funzioni mi sembrano un
 * po' troppe ed incasinate"). Causa reale: 15 card identiche (10 vere + 5
 * pianificate) tutte con lo stesso peso visivo in un'unica griglia -- niente
 * distingueva "puoi usarlo oggi" da "arriverà" se non un piccolo badge
 * ambra sparso qua e là, difficile da notare a colpo d'occhio con 15 box
 * uguali. Ora sono due gruppi separati con peso diverso: le funzioni vere
 * restano card complete (quello che vendi oggi merita spazio), quelle in
 * arrivo diventano una fascia compatta di chip -- onesta ma minore, perché
 * minore è davvero.
 */
const DISPONIBILI: Voce[] = [
  { titolo: "Pagina di prenotazione online", descrizione: "Link tuo, condivisibile ovunque, self-service 24/7.", icona: Globe2 },
  { titolo: "Calendario intelligente", descrizione: "Disponibilità calcolata da orari, pause, ferie e durata reale del servizio.", icona: CalendarClock },
  { titolo: "CRM clienti", descrizione: "Storico completo, qualunque canale abbia usato per prenotare.", icona: Users },
  { titolo: "Assistente AI via chat web", descrizione: "Risponde e prenota da sola, passa la mano a te quando serve una persona.", icona: MessageSquareText },
  { titolo: "Multi-operatore e servizi", descrizione: "Ogni operatore con i propri orari, servizi e prezzi.", icona: Scissors },
  { titolo: "Dashboard con insight azionabili", descrizione: "Non solo numeri: un pulsante per contattare i clienti inattivi.", icona: LayoutDashboard },
  { titolo: "Registrazione zero-attrito", descrizione: "Ti registri e il tuo spazio è già pronto, nessun passaggio manuale.", icona: UserPlus },
  { titolo: "Isolamento dati reale", descrizione: "Separazione a livello di database tra ogni attività, non solo applicativa.", icona: ShieldCheck },
  { titolo: "Sync Google Calendar", descrizione: "Impegni personali dell'operatore bloccano lo slot in automatico.", icona: CalendarClock },
];

const IN_ARRIVO: Voce[] = [
  { titolo: "Assistente AI su WhatsApp", descrizione: "Stesso assistente, dove i tuoi clienti scrivono già.", icona: MessageCircle },
  { titolo: "Promemoria automatici", descrizione: "Reminder e follow-up ai clienti inattivi, senza pensarci.", icona: BellRing },
  { titolo: "Pagamenti e upgrade self-service", descrizione: "Cambio piano dal pannello, senza scriverci.", icona: CreditCard },
  { titolo: "App installabile (PWA)", descrizione: "Dashboard a schermo intero, come un'app nativa.", icona: Smartphone },
  { titolo: "AI su Instagram e Telegram", descrizione: "Stessa reception AI, su altri canali dove serve.", icona: Send },
  { titolo: "Tono dell'AI personalizzabile", descrizione: "Guida il modo in cui l'assistente risponde ai tuoi clienti.", icona: SlidersHorizontal },
  { titolo: "Analytics", descrizione: "Andamento prenotazioni e clienti nel tempo, non solo i numeri di oggi.", icona: BarChart3 },
  { titolo: "SMS", descrizione: "Promemoria e conferme anche senza WhatsApp o smartphone.", icona: MessageSquareMore },
];

function Cella({ v }: { v: Voce }) {
  return (
    <SpotlightCard className="h-full rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors duration-300 hover:border-white/20">
      <span className="relative flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
        <v.icona className="size-4" />
      </span>
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
          Cosa c&apos;è oggi, cosa arriva dopo — detto chiaro.
        </p>
      </Reveal>

      {/* 9 elementi, griglia pulita a 3 colonne (3 righe piene, nessun
          resto): niente più il mix con le 5 voci "in arrivo" che appesantiva
          il colpo d'occhio. */}
      <RevealStagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" gapMs={0.05}>
        {DISPONIBILI.map((v) => (
          <RevealItem key={v.titolo}>
            <Cella v={v} />
          </RevealItem>
        ))}
      </RevealStagger>

      {/* Fascia "in arrivo" separata e volutamente più leggera -- stesso
          contenuto onesto di prima (nulla è nascosto), ma un peso visivo
          minore perché non è ancora vendibile: chip compatte in un unico
          pannello, non altre 6 card identiche alle prime 9. */}
      <Reveal>
        <div className="mt-6 rounded-2xl border border-dashed border-amber-400/20 bg-amber-400/[0.03] p-5">
          <p className="text-xs font-medium tracking-wide text-amber-300/80 uppercase">Nel roadmap — non ancora incluso</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {IN_ARRIVO.map((v) => (
              <span
                key={v.titolo}
                title={v.descrizione}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1.5 pr-3 pl-2 text-xs text-white/70"
              >
                <v.icona className="size-3.5 text-amber-300/80" />
                {v.titolo}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
