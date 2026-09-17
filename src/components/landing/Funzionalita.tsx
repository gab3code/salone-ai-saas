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
import { TiltCard } from "./TiltCard";

interface Voce {
  titolo: string;
  descrizione: string;
  icona: LucideIcon;
  /** riquadri "grande" per i 4 pilastri del prodotto -- il resto è "normale". */
  grande?: boolean;
  /**
   * Piano minimo che include la funzione, quando NON è inclusa ovunque
   * (17/09/2026, controllo notturno chiesto da Gabriel).
   *
   * Questa sezione si intitola "Tutto quello che include" ed è linkata dalla
   * barra di navigazione: un lettore che si ferma qui e non scorre fino ai
   * prezzi leggeva Assistente AI, SMS, Analytics, Promemoria e Tono dell'AI
   * come se fossero inclusi in ogni piano, mentre nel codice sono tutte
   * dietro un gate (`PIANI_CON_AI_CHAT_WEB` in `lib/ai/limiti.ts`,
   * `pianoHaAnalytics`/`pianoHaPromemoria`/`pianoHaSms` in `lib/piani.ts`).
   * L'etichetta non è un badge decorativo: è la differenza tra una lista di
   * funzioni e una promessa che il checkout poi smentisce.
   */
  da?: "Growth" | "Pro";
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
 * i pilastri del prodotto (calendario, CRM, AI in chat, dashboard,
 * promemoria) occupano un riquadro doppio e si notano subito; le altre
 * funzioni restano in riquadri normali. `grid-flow-dense` chiude i buchi
 * lasciati da un riquadro doppio fuori posto, ma non inventa contenuto: se
 * il totale delle "unità" di griglia (1 per riquadro normale, 2 per doppio)
 * non è multiplo del numero di colonne, l'ultima riga resta comunque
 * incompleta -- ed è lì che finisce il buco, quasi sempre in basso a destra
 * (bug reale segnalato da Gabriel dopo aver usato il sito). Con 5 riquadri
 * doppi e 10 normali il totale è 20 unità: multiplo di 4 (griglia desktop
 * lg) e di 2 (griglia telefono, prima del breakpoint sm) -- nessun buco su
 * nessuno dei due. "CRM clienti" è passato a riquadro doppio apposta per
 * arrivare a questo numero, non a caso: è comunque uno dei pilastri veri
 * del prodotto (vedi il sottotitolo della pagina), non un riempitivo.
 *
 * Aggiornamento 12/09/2026 (terzo giro, segnalazione di Gabriel dopo uno
 * screenshot: "nella foto che vedi, manca ordine"). Causa reale, trovata
 * rileggendo l'algoritmo invece che ad occhio: 20 unità è multiplo di 4 e
 * di 2 (verificato sopra) ma NON di 3 -- e la griglia passa proprio da 3
 * colonne nella fascia intermedia (`sm:grid-cols-3`, tablet/finestre
 * strette, prima di arrivare a 4 su desktop pieno). A 3 colonne un riquadro
 * doppio piazzato a 2 celle dall'inizio riga non ci sta, lascia un buco, e
 * `dense` lo richiude facendo "saltare avanti" nell'ordine visivo la prima
 * card piccola successiva che ci sta -- risultato: la sequenza che si VEDE
 * non è più quella dell'elenco (una card "minore" compare prima di un
 * pilastro), che è esattamente cosa vuol dire "manca ordine". Due fix
 * assieme, decisi con Gabriel:
 * 1) l'elenco è riordinato 2 normali + 1 riquadro doppio ripetuto 5 volte
 *    (invece di raggruppare i pilastri vicini come prima) -- così un
 *    riquadro doppio cade sempre su un confine di riga "pari" (posizione
 *    0 o 2 di una riga da 4, oppure 0 di una riga da 2), non lo attraversa
 *    mai e non lascia buchi da richiudere a 2 e 4 colonne.
 * 2) la fascia intermedia a 3 colonne (l'unica in cui 20 non torna esatto)
 *    è tolta: `sm:grid-cols-3` diventa `lg:grid-cols-4` diretto, quindi la
 *    griglia resta a 2 colonne fino al breakpoint desktop invece di passare
 *    per una larghezza dove il conto non quadra mai.
 * Risultato: zero buchi e zero riordini a runtime su entrambe le larghezze
 * rimaste (2 e 4 colonne) -- l'ordine visivo torna sempre uguale a quello
 * dell'elenco qui sotto.
 */
// Ordine: 2 riquadri normali + 1 doppio, ripetuto 5 volte (vedi commento
// sopra) -- non è più "prima tutti i pilastri principali", ma è quello che
// garantisce zero buchi/riordini nella griglia. I 5 pilastri (Calendario,
// CRM, Assistente AI, Dashboard, Promemoria) restano nello stesso ordine
// relativo di prima, solo distribuiti lungo l'elenco invece che ravvicinati.
const FUNZIONI: Voce[] = [
  { titolo: "Pagina di prenotazione online", descrizione: "Link tuo, condivisibile ovunque, self-service 24/7.", icona: Globe2 },
  // 17/09/2026: diceva "Ogni operatore con i propri orari, servizi e prezzi".
  // Falso su due terzi: `orari_apertura` ha un vincolo unico
  // (tenant_id, giorno_settimana) -- gli orari sono dell'attività, non
  // dell'operatore (booking-engine.ts lo dichiara esplicitamente) -- e il
  // prezzo vive su `servizi`, non su `operatori_servizi`, che è una pura
  // tabella di collegamento. Quello che esiste davvero: quali servizi fa
  // ciascuno, e le sue assenze puntuali (tabella `chiusure`).
  { titolo: "Multi-operatore e servizi", descrizione: "Chi fa cosa, con le assenze di ciascuno già scalate dalla disponibilità.", icona: Scissors },
  { titolo: "Calendario intelligente", descrizione: "Disponibilità calcolata da orari, pause, ferie e durata reale del servizio.", icona: CalendarClock, grande: true },
  { titolo: "Registrazione zero-attrito", descrizione: "Ti registri e il tuo spazio è già pronto, nessun passaggio manuale.", icona: UserPlus },
  { titolo: "Isolamento dati reale", descrizione: "Separazione a livello di database tra ogni attività, non solo applicativa.", icona: ShieldCheck },
  { titolo: "CRM clienti", descrizione: "Storico completo per ogni cliente, qualunque canale abbia usato per prenotare — mai due archivi da tenere allineati a mano.", icona: Users, grande: true },
  { titolo: "Sync Google Calendar", descrizione: "Impegni personali dell'operatore bloccano lo slot in automatico.", icona: CalendarClock },
  { titolo: "SMS", descrizione: "Promemoria anche ai clienti che non hanno lasciato un'email.", icona: MessageSquareMore, da: "Pro" },
  {
    titolo: "Assistente AI in chat e su WhatsApp",
    // Instagram e Telegram tolti dal copy attuale (richiesta di Gabriel,
    // 12/09/2026: "come obiettivo ci sta ma solo whatsapp, è inutile" --
    // restano un'ambizione futura per l'assistente multi-canale, non
    // qualcosa da promettere già oggi in home).
    descrizione: "Lo stesso assistente risponde e prenota da solo su chat web e WhatsApp, e passa la mano a te quando serve una persona.",
    icona: MessageSquareText,
    grande: true,
    // Chat web da Growth, WhatsApp da Pro: l'etichetta indica il piano da cui
    // la funzione compare (il dettaglio per canale è nella scheda prezzi).
    da: "Growth",
  },
  { titolo: "Pagamenti e upgrade self-service", descrizione: "Cambio piano dal pannello, senza scriverci.", icona: CreditCard },
  { titolo: "App installabile (PWA)", descrizione: "Dashboard a schermo intero, come un'app nativa.", icona: Smartphone },
  // 17/09/2026: "un pulsante per contattare i clienti inattivi" -- il pulsante
  // esiste ma porta alla lista filtrata con export, non contatta nessuno.
  // Il contatto automatico esiste, ma è il follow-up del cron promemoria,
  // che è un'altra voce di questo stesso elenco.
  { titolo: "Dashboard con insight azionabili", descrizione: "Non solo numeri: ti porta dritto all'elenco dei clienti da recuperare.", icona: LayoutDashboard, grande: true },
  { titolo: "Tono dell'AI personalizzabile", descrizione: "Guida il modo in cui l'assistente risponde ai tuoi clienti.", icona: SlidersHorizontal, da: "Pro" },
  { titolo: "Analytics", descrizione: "Andamento prenotazioni e clienti nel tempo, non solo i numeri di oggi.", icona: BarChart3, da: "Growth" },
  { titolo: "Promemoria automatici", descrizione: "Reminder prima dell'appuntamento e follow-up ai clienti inattivi, senza pensarci.", icona: BellRing, grande: true, da: "Growth" },
];

function Cella({ v }: { v: Voce }) {
  return (
    // TiltCard aggiunto (punto 8 di Gabriel: "nella sezione sopra con i
    // servizi no, sistema" -- riferito al confronto con PerChi.tsx qui
    // sotto, che già aveva l'inclinazione 3D al passaggio del mouse).
    // Stesso identico pattern di CardPersona in PerChi.tsx: TiltCard fuori,
    // il contenuto (qui SpotlightCard) dentro, "h-full" su entrambi perché
    // la card vive in una griglia -- lo stretch di default allinea comunque
    // in altezza le card della stessa riga (vedi commento sulla griglia).
    <TiltCard className="h-full">
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
        <h3 className={`relative mt-3 font-medium text-white sm:mt-4 ${v.grande ? "text-base" : "text-[15px]"}`}>
          {v.titolo}
          {v.da ? (
            <span className="ml-2 align-middle rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-normal text-violet-200">
              da {v.da}
            </span>
          ) : null}
        </h3>
        {/* La descrizione era nascosta su telefono per le card piccole (punto
            3 del terzo giro: "su telefono devo scorrere tantissimo") --
            tornata visibile ovunque (quinto giro, segnalazione di Gabriel:
            "su telefono le card piccole non hanno il testo, es. SMS").
            Effetto collaterale positivo: era anche la causa reale delle card
            "troppo grandi verticalmente, molto inutilmente" -- con la
            griglia a `auto-rows-fr` (sotto) le card senza descrizione si
            stiravano comunque per pareggiare l'altezza della card più alta
            della stessa riga, lasciando vuoto invece di contenuto. */}
        <p className="relative mt-1.5 text-sm leading-relaxed text-white/60">{v.descrizione}</p>
      </SpotlightCard>
    </TiltCard>
  );
}

export function Funzionalita() {
  return (
    <section id="funzionalita" className="scroll-mt-24 mx-auto max-w-6xl px-5 py-24 sm:px-8">
      {/* Centrato (punto 8 di Gabriel: "allinea i titoli al centro") --
          allineato con PerChi/Prezzi/PercheNoi/ComeFunziona, che centrano il
          proprio titolo di sezione; qui prima era rimasto allineato a
          sinistra, l'unica eccezione senza un vero motivo. */}
      <Reveal className="mx-auto max-w-lg text-center">
        <h2 className="text-sm font-medium text-violet-400">Tutto quello che include</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Tutto quello che serve, in un unico posto.</p>
      </Reveal>

      {/* `auto-rows-fr` tolto (quinto giro): su una griglia senza altezza
          fissa, forzava ogni riga implicita a pareggiare l'altezza della
          riga più alta di TUTTA la griglia (non solo delle card della
          stessa riga) -- le card piccole senza molto contenuto si
          stiravano per pareggiare righe lontane con card "grande" a
          descrizione lunga, lasciando vuoto invece di restare compatte.
          Senza, ogni riga implicita si dimensiona sul proprio contenuto;
          `items-start` sulle singole card (dentro Cella, via SpotlightCard)
          non serve perché lo stretch di default resta comunque utile PER
          RIGA (due card fianco a fianco con titoli di lunghezza diversa
          restano allineate in altezza tra loro), solo non più tra righe
          diverse. */}
      <RevealStagger className="mt-12 grid grid-cols-2 gap-3 [grid-auto-flow:dense] sm:gap-4 lg:grid-cols-4" gapMs={0.04}>
        {FUNZIONI.map((v) => (
          <RevealItem key={v.titolo} className={v.grande ? "col-span-2" : "col-span-1"}>
            <Cella v={v} />
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
