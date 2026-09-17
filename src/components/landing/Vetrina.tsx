"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Calendar, Globe2, MessageSquareText, RefreshCw, Check, Users, BellRing, CalendarClock, type LucideIcon } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { Reveal } from "./Reveal";
import { Grana } from "./Grana";

interface Scena {
  titolo: string;
  testo: string;
  icona: LucideIcon;
}

/**
 * Vetrina scroll-driven -- questa è la sezione "vetrina" vera della landing
 * (richiesta di Gabriel dell'11/09/2026 di spingere di più su GSAP/Framer
 * Motion invece di un semplice bento statico, poi estesa il giorno stesso a
 * coprire TUTTO il set di funzionalità, attuali e pianificate, non solo 3):
 * un pannello resta fisso mentre si scorre, e cambia scena in base a quanto
 * si è scrollato -- pattern da vero "scrollytelling" (GSAP ScrollTrigger con
 * pin+scrub), non un fade-in a caso.
 *
 * Aggiornamento 12/09/2026 -- rimossi i badge "in arrivo" (decisione di
 * Gabriel, vedi DECISIONS.md "Il sito descrive il prodotto al lancio, non
 * lo stato di oggi"): tutte le scene, WhatsApp e promemoria inclusi, sono
 * ora descritte come già disponibili.
 */
const SCENE: Scena[] = [
  {
    titolo: "Un unico motore di prenotazione",
    testo:
      "Calendario, pagina pubblica e assistente AI leggono e scrivono sugli stessi appuntamenti in tempo reale — mai due sistemi che raccontano storie diverse.",
    icona: RefreshCw,
  },
  {
    titolo: "La tua pagina pubblica",
    testo: "Un link tutto tuo dove i clienti scelgono servizio, orario e prenotano da soli, 24 ore su 24.",
    icona: Globe2,
  },
  {
    titolo: "L'assistente AI, sempre presente",
    testo: "Risponde su chat web e WhatsApp a domande su orari e prezzi e prenota da sola — e passa la mano a te quando serve davvero una persona.",
    icona: MessageSquareText,
  },
  {
    titolo: "Anagrafica clienti che si aggiorna da sola",
    testo: "Ogni prenotazione, da dashboard o da AI, finisce nella stessa scheda cliente — storico completo, mai due archivi da tenere allineati a mano.",
    icona: Users,
  },
  {
    titolo: "Promemoria e clienti da recontattare",
    testo: "Un insight ti segnala chi non prenota da un po'; i promemoria automatici via messaggio chiudono il cerchio da soli.",
    icona: BellRing,
  },
  {
    titolo: "Il tuo calendario personale, sempre sincronizzato",
    // Solo Google (decisione di Gabriel, 12/09/2026): Apple/iCloud è
    // tecnicamente corretto (client CalDAV verificato via test comparativo
    // diretto) ma probabilmente inutilizzabile in produzione -- Apple sembra
    // bloccare il traffico CalDAV che arriva da IP di data center/cloud come
    // quelli di Vercel (PROJECT_STATUS.md, problema noto #14). Non solo il
    // marketing: anche la UI vera in /dashboard/impostazioni/calendari va
    // aggiornata per non offrire più il collegamento Apple (task separato).
    // 17/09/2026: la frase finiva con "e viceversa", cioè prometteva la
    // scrittura degli appuntamenti sul calendario personale. Il client fa
    // solo authorize/token/events.list (`calendario-esterno/google.server.ts`):
    // nessuna creazione di eventi. L'export verso Google è ancora una
    // direzione da decidere (PIANO.md, Fase 6bis), non una funzione.
    testo: "Google Calendar già collegabile: i tuoi impegni personali bloccano lo slot in automatico.",
    icona: CalendarClock,
  },
];

/** Percorso mostrato nella barra del finto browser che incornicia la scena --
 * un solo "schermo" persistente, coerente con quale parte del prodotto la
 * scena sta raccontando (pagina pubblica vs dashboard). */
const PERCORSI = [
  "salone-ai-saas.vercel.app/dashboard",
  "salone-ai-saas.vercel.app/s/il-tuo-salone",
  "salone-ai-saas.vercel.app/s/il-tuo-salone",
  "salone-ai-saas.vercel.app/dashboard/clienti",
  "salone-ai-saas.vercel.app/dashboard/clienti",
  "salone-ai-saas.vercel.app/dashboard/impostazioni/calendari",
];

/** I 3 "surface" che il motore di prenotazione tiene sincronizzati -- usati
 * dalla scena 0 (vedi VisualeScena, indice 0). */
const SUPERFICI_MOTORE = [
  { icona: Calendar, etichetta: "Calendario" },
  { icona: Globe2, etichetta: "Pagina pubblica" },
  { icona: MessageSquareText, etichetta: "Assistente AI" },
];

/**
 * Riscritte (Giro 4, feedback di Gabriel su uno screenshot: "riquadro dentro
 * un altro riquadro, e quello dentro è minuscolo"). Causa reale: ogni scena
 * portava con sé la propria mini-finestra (bordo + pallini rosso/giallo/
 * verde), annidata dentro il grande pannello "palco" che GIÀ la incornicia
 * -- due finestre una dentro l'altra, e quella interna a `max-w-xs` restava
 * piccola nel grande spazio del palco. Ora il palco stesso mostra UNA sola
 * barra da finestra (sotto, sempre presente, con l'URL che cambia in base
 * alla scena) e queste funzioni restituiscono solo il CONTENUTO -- niente
 * bordo/pallini propri, larghezza piena del palco.
 *
 * Scena 0 riscritta di nuovo (controllo approfondito pre-pubblicazione,
 * 12/09/2026, segnalazione di Gabriel: "lo spazio con quel quadrato è
 * visivamente brutto e poco utile"). Prima usava lo stesso fallback generico
 * delle altre scene "di scorta" (griglia di 3 icone spente + una scritta) --
 * risultato: la primissima scena che chiunque vede aprendo la Vetrina era
 * anche la più vuota delle 6, con un pannello di 26rem quasi tutto nero.
 * Ora ha una vera illustrazione dell'"unico motore": tre superfici
 * (calendario, pagina pubblica, assistente AI) che convergono su un hub
 * centrale animato -- lo stesso linguaggio visivo (puntino che viaggia su
 * una linea) già usato in PercheNoi.tsx per il flusso a 3 nodi, qui piegato
 * a un layout radiale invece che lineare, così la sezione "perché è
 * diverso" resta visivamente coerente con "perché questo" invece di
 * inventare un motivo nuovo.
 */
function VisualeScena({ indice }: { indice: number }) {
  if (indice === 0) {
    return (
      <div className="flex w-full max-w-xs flex-col items-center gap-5">
        <div className="flex w-full items-start justify-between gap-2">
          {SUPERFICI_MOTORE.map((n, i) => (
            <motion.div
              key={n.etichetta}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.1, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <span className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-300">
                <n.icona className="size-4.5" />
              </span>
              <span className="text-center text-[10px] leading-tight text-white/50">{n.etichetta}</span>
              <div className="relative h-7 w-px bg-gradient-to-b from-white/15 to-transparent">
                <motion.span
                  aria-hidden
                  className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-violet-400 shadow-[0_0_8px_2px_rgba(168,85,247,0.55)]"
                  animate={{ top: ["0%", "100%"], opacity: [0, 1, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.4, delay: i * 0.35, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ scale: 0.75, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45, ease: [0.23, 1, 0.32, 1] }}
          className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-950/40"
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
            className="flex"
          >
            <RefreshCw className="size-5" />
          </motion.span>
        </motion.div>

        <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-white/50">
          Stesso appuntamento, ovunque tu lo guardi
        </p>
      </div>
    );
  }

  if (indice === 1) {
    return (
      <motion.div
        initial="nascosto"
        animate="visibile"
        variants={{ visibile: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
        className="w-full max-w-sm"
      >
        <motion.div variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }} className="h-3 w-2/3 rounded bg-white/20" />
        <motion.div variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }} className="mt-2 h-2 w-1/2 rounded bg-white/10" />
        <motion.div variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }} className="mt-4 flex gap-2">
          {["Taglio", "Colore", "Piega"].map((s) => (
            <span key={s} className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70">
              {s}
            </span>
          ))}
        </motion.div>
        <motion.div
          variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }}
          className="mt-4 rounded-xl bg-violet-500/20 px-4 py-3 text-sm text-violet-200"
        >
          Ven 15 · 16:30 disponibile
        </motion.div>
      </motion.div>
    );
  }

  if (indice === 2) {
    return (
      // Bug reale segnalato da Gabriel ("le due risposte compaiono prima di
      // 'sta scrivendo', non dopo"): la domanda e le due righe di risposta
      // erano semplici <div> senza alcuna animazione -- comparivano quindi
      // TUTTE al montaggio del componente (istante 0), mentre l'indicatore
      // "sta scrivendo" (l'unico ad avere un'animazione) si accendeva e
      // spegneva in loop SOPRA risposte già visibili da subito: l'ordine
      // logico (domanda -> sta scrivendo -> risposta) non esisteva davvero,
      // era solo un'illusione data dal loop infinito che ripassava sopra
      // contenuto già in vista. Riscritta come sequenza vera, una tantum,
      // con `delay` crescenti: la domanda compare, poi l'indicatore, poi
      // (solo quando l'indicatore è già sparito) le due righe di risposta.
      <div className="flex w-full max-w-sm flex-col gap-2">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="self-end rounded-2xl rounded-br-sm bg-white/10 px-3 py-2 text-xs text-white/80"
        >
          Siete aperti domenica?
        </motion.div>
        {/* L'orb non è decorazione: rende letteralmente visibile il momento in
            cui l'AI sta elaborando la risposta, prima che compaia -- stato
            "connecting" di thinking-orbs, pensato apposta per agenti AI. */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.6, times: [0, 0.2, 0.75, 1], delay: 0.75, ease: "easeInOut" }}
          className="flex items-center gap-1.5 self-start pl-1"
        >
          <ThinkingOrb state="connecting" size={20} theme="dark" aria-label="L'assistente sta elaborando la risposta" />
          <span className="text-[10px] text-white/40">sta scrivendo…</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 2.35 }}
          className="self-start rounded-2xl rounded-bl-sm bg-gradient-to-br from-violet-500/80 to-fuchsia-500/80 px-3 py-2 text-xs text-white"
        >
          Siamo chiusi la domenica, ma sabato ho le 11:00 libere!
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 2.65 }}
          className="mt-1 flex items-center gap-1.5 self-start text-[11px] text-emerald-400"
        >
          <Check className="size-3" /> Nessuno del salone ha dovuto rispondere
        </motion.div>
      </div>
    );
  }

  if (indice === 3) {
    return (
      <motion.div
        initial="nascosto"
        animate="visibile"
        variants={{ visibile: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } }}
        className="w-full max-w-sm"
      >
        <motion.div variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }} className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-violet-500/20 text-xs font-medium text-violet-200">GB</span>
          <div className="h-2.5 w-1/2 rounded bg-white/20" />
        </motion.div>
        <div className="mt-3.5 flex flex-col gap-2">
          {["Taglio · 12/09", "Colore · 20/08 (da AI)", "Piega · 02/08"].map((r) => (
            <motion.div
              key={r}
              variants={{ nascosto: { opacity: 0, y: 8 }, visibile: { opacity: 1, y: 0 } }}
              className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/60"
            >
              {r}
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (indice === 4) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-white/50">Promemoria automatico</span>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">inviato</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70">
          &quot;Ciao Giulia, ti aspettiamo domani alle 16:30 da noi 👋&quot;
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3">
      <div className="flex w-full max-w-[9.5rem] flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-4">
        <CalendarClock className="size-5 text-violet-300" />
        <span className="text-xs text-white/70">Google Calendar</span>
        <span className="text-[10px] text-emerald-400">collegato</span>
      </div>
      <div className="w-full rounded-lg bg-white/5 px-3 py-2.5 text-center text-xs text-white/50">
        impegni personali = slot bloccato
      </div>
    </div>
  );
}

/** Altezza del mock-schermo per ogni scena nella versione mobile impilata
 * (`lg:hidden` più sotto). Bug reale segnalato da Gabriel ("il primo card è
 * tagliato su telefono"): tutte le scene condividevano la stessa `h-64`, ma
 * la scena 0 (illustrazione radiale "motore di prenotazione": 3 icone +
 * linee animate + hub centrale + didascalia) ha più contenuto verticale
 * delle altre scene -- superava i 256px disponibili e veniva tagliata in
 * basso dall'`overflow-hidden` dello Schermo. Le altre scene (mock UI più
 * semplici) restano su `h-64`, solo la 0 ha una cornice più alta. */
const ALTEZZA_MOBILE_PER_SCENA = ["h-80", "h-64", "h-64", "h-64", "h-64", "h-64"];

/** Un pannello "schermo" (barra con pallini + URL + contenuto) -- usato sia
 * dal palco fisso desktop sia da ogni card mobile, così le due versioni
 * condividono esattamente lo stesso linguaggio visivo. */
function Schermo({ indice, altezza }: { indice: number; altezza: string }) {
  return (
    <div className={`relative flex ${altezza} w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950`}>
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="size-2.5 rounded-full bg-red-400/70" />
        <span className="size-2.5 rounded-full bg-amber-400/70" />
        <span className="size-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 truncate text-xs text-white/40">{PERCORSI[indice]}</span>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-6 sm:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(280px circle at 50% 20%, rgba(168,85,247,0.15), transparent 70%)" }}
        />
        <VisualeScena indice={indice} />
      </div>
    </div>
  );
}

export function Vetrina() {
  const [attivo, setAttivo] = useState(0);
  const contenitoreRef = useRef<HTMLDivElement>(null);
  const schermoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // Controllo approfondito pre-pubblicazione (12/09/2026, segnalazione di
    // Gabriel: la sezione "vista da telefono fa pena"). Causa reale trovata
    // con Playwright (scroll reale, non un salto istantaneo): il blocco
    // pinnato (palco + lista di 6 pulsanti-scena) è più alto della viewport
    // su schermo verticale -- circa 1500-1600px di contenuto dentro un
    // pin che, essendo `position: fixed` per tutta la durata dei 600vh di
    // scroll, mostra sempre e solo la sua PRIMA porzione. Risultato
    // verificato: su mobile si vedevano sempre e solo le prime 2 scene
    // dell'elenco testuale (le altre 4 semplicemente non diventavano mai
    // raggiungibili), mentre il palco sopra cambiava contenuto normalmente
    // -- un'esperienza rotta, non "poco elegante". Il pin ha senso SOLO
    // quando il blocco pinnato entra per intero nella viewport (desktop,
    // dove il layout è a 2 colonne e quindi molto meno alto): con
    // `gsap.matchMedia()` la scrollytelling con pin+scrub esiste ora SOLO
    // da `lg` in su; sotto `lg` la sezione usa un layout completamente
    // diverso (vedi il blocco JSX `lg:hidden` più sotto), scritto apposta
    // per lo scroll verticale invece di essere lo stesso desktop rimpicciolito.
    //
    // Quinto giro, quinta parte -- lo stesso identico bug si è ripresentato
    // anche su DESKTOP (screenshot di Gabriel: "anche questo viene
    // tagliato", l'ultima scena della lista tagliata in basso). L'assunzione
    // scritta sopra ("il layout a 2 colonne è molto meno alto") era vera
    // solo in media, non sempre -- la lista di 6 pulsanti-scena (titolo +
    // descrizione + icona ciascuno) supera comunque l'altezza della finestra
    // su schermi non altissimi (es. un laptop con la barra degli indirizzi
    // visibile), e prima pinnavamo l'INTERA griglia a 2 colonne (lista +
    // palco insieme) -- stesso identico problema del pin mobile, spostato di
    // un breakpoint più in alto. Fix: pinnare SOLO il palco di destra
    // (`schermoRef`, un riquadro di altezza fissa 20-26rem che entra in
    // QUALUNQUE viewport ragionevole), non più l'intera griglia -- la lista
    // di sinistra torna un elemento normale nel flusso della pagina, libera
    // di essere alta quanto serve e sempre scorrevole/raggiungibile per
    // intero, esattamente come già garantito sotto `lg` per un motivo
    // analogo. Il progresso di scroll (`onUpdate`, quale scena è "attivo")
    // resta legato allo stesso trigger di 600vh su `contenitoreRef` -- cambia
    // solo COSA viene pinnato, non il ritmo della scrollytelling.
    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px)", () => {
      if (!contenitoreRef.current || !schermoRef.current) return;

      const trigger = ScrollTrigger.create({
        trigger: contenitoreRef.current,
        start: "top top+=72",
        end: "bottom bottom",
        pin: schermoRef.current,
        pinSpacing: false,
        scrub: true,
        onUpdate: (self) => {
          const indice = Math.min(SCENE.length - 1, Math.floor(self.progress * SCENE.length));
          setAttivo(indice);
        },
      });

      return () => trigger.kill();
    });

    return () => mm.revert();
  }, []);

  return (
    <section className="relative bg-noir py-4">
      {/* Quinto giro, quinta parte -- `overflow-hidden` viveva sulla
          <section> stessa (per ritagliare la texture di Grana ai suoi
          bordi). Bug reale: `overflow: hidden` su un ANTENATO disattiva
          `position: sticky` su ogni discendente (la lista qui sotto, appena
          resa sticky per il fix del pin) -- non per un conflitto visivo, ma
          perché la spec CSS lega lo sticky al più vicino "contenitore di
          scroll", e un antenato con overflow diverso da `visible` conta
          come tale anche se non è mai scrollabile a mano dall'utente:
          rispetto a QUEL contenitore (che non scorre mai) lo sticky non ha
          mai un motivo per attivarsi, anche se la PAGINA attorno scorre
          normalmente. Spostato `overflow-hidden` su un contenitore dedicato
          solo alla texture -- stessa resa visiva (Grana resta ritagliata ai
          bordi della sezione), ma la sezione stessa torna "aperta" per la
          sticky positioning dei suoi discendenti. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Grana opacita={0.035} />
      </div>
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        {/* Centrato (terzo giro, segnalazione di Gabriel: "il titolo della
            sezione non è al centro") -- allineato con le altre sezioni. */}
        <Reveal className="mx-auto max-w-xl pt-16 text-center">
          <h2 className="text-sm font-medium text-violet-400">Perché è diverso</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Non è un altro calendario online.
          </p>
        </Reveal>

        {/* Desktop/tablet largo (lg+): scrollytelling con pin+scrub invariato --
            contenitore alto NxSchermo (una "schermata" di scroll per scena),
            GSAP anima "attivo" mentre lo si attraversa scrollando, il
            pannello di destra resta fisso (pin). */}
        <div ref={contenitoreRef} className="relative mt-8 hidden lg:block" style={{ height: `${SCENE.length * 100}vh` }}>
          <div className="grid h-full gap-10 py-10 lg:grid-cols-2 lg:items-start">
            {/* Quinto giro, quinta parte -- tolto il pin GSAP da questa lista
                (vedi il commento nell'useEffect sopra), ma lasciarla come
                normale contenuto scorrevole crea un problema NUOVO: la lista
                (alta ~900px) è molto più corta dei 5400px di scroll assegnati
                alle 6 scene, quindi dopo il primo ~20% dello scroll la lista
                finisce fuori dalla pagina e resta solo il palco pinnato a
                destra, con uno spazio vuoto e morto a sinistra per il resto
                della sezione -- peggio della clip, ora sembra rotta per un
                motivo diverso. Fix: `sticky` invece di `fixed` (via GSAP) --
                la lista resta agganciata in vista per l'intera durata dello
                scroll, ESATTAMENTE come il palco, ma con `overflow-y-auto` +
                un `max-height` legato alla viewport: se anche in futuro
                dovesse superare l'altezza disponibile, scorre CON LA ROTELLA
                del mouse al suo interno invece di tagliare l'ultima voce --
                non più raggiungibile "mai" (il bug originale) ma sempre
                raggiungibile scrollando, qualunque sia l'altezza della lista
                o della finestra.

                Due insidie trovate SOLO verificando con uno scroll reale via
                Playwright (non bastava leggere il CSS): (1) `position:
                sticky` smetteva di agganciarsi dopo pochi px -- il
                CONTENITORE diretto della lista (questo `<div>`) aveva
                altezza automatica (quella del contenuto), quindi lo spazio
                in cui la lista poteva restare "attaccata" era cortissimo.
                Aggiunto `h-full` qui sopra (eredita i 5400px di
                `contenitoreRef`) per dare alla sticky tutto lo spazio dei
                600vh di scroll. (2) Farlo con `lg:items-center` (come prima)
                centrava però il PALCO di destra al centro di una riga alta
                5400px -- cioè a metà scroll di distanza dall'alto, fuori
                dallo schermo -- e GSAP calcola la posizione del pin dalla
                posizione "naturale" dell'elemento AL MOMENTO in cui lo crea:
                risultato, il palco veniva pinnato a `top: 2564px`, invisibile
                per tutta la sezione. Cambiato in `lg:items-start`: il palco
                nasce in cima alla riga (accanto al titolo), dove GSAP lo
                pinna correttamente vicino alla cima dello schermo. */}
            <div className="order-2 flex flex-col gap-3 lg:order-1 lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-96px)] lg:self-start lg:overflow-y-auto lg:pr-1">
              {SCENE.map((s, i) => (
                <button
                  key={s.titolo}
                  type="button"
                  onClick={() => {
                    setAttivo(i);
                    const target = contenitoreRef.current;
                    if (!target) return;
                    // Bug reale segnalato da Gabriel ("mi sposta sulla pagina
                    // a caso"): `offsetTop` è relativo al più vicino
                    // antenato posizionato (qui la <section> stessa, che ha
                    // `relative`), NON alla cima del documento -- un numero
                    // piccolo (la distanza dal titolo della sezione), non la
                    // vera posizione di scroll assoluta. `scrollTo({top})`
                    // interpretava quel numero come posizione assoluta nella
                    // pagina, atterrando molto più in alto di dove doveva.
                    // Fix: `getBoundingClientRect().top + scrollY` dà la
                    // posizione reale rispetto al documento, qualunque sia
                    // la catena di antenati posizionati sopra.
                    const cimaAssoluta = target.getBoundingClientRect().top + window.scrollY;
                    const y = cimaAssoluta + (target.offsetHeight * i) / SCENE.length + 20;
                    window.scrollTo({ top: y, behavior: "smooth" });
                  }}
                  className={`rounded-2xl border p-5 text-left transition-colors duration-300 ${
                    attivo === i ? "border-violet-500/50 bg-white/5" : "border-white/5 bg-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
                        attivo === i ? "bg-violet-500 text-white" : "bg-white/5 text-white/40"
                      }`}
                    >
                      <s.icona className="size-4" />
                    </span>
                    <h3 className={`text-[15px] font-medium transition-colors duration-300 ${attivo === i ? "text-white" : "text-white/50"}`}>
                      {s.titolo}
                    </h3>
                  </div>
                  <p className={`mt-2 text-sm leading-relaxed transition-colors duration-300 ${attivo === i ? "text-white/70" : "text-white/30"}`}>
                    {s.testo}
                  </p>
                </button>
              ))}
            </div>

            {/* Un solo "schermo" persistente (barra con pallini + URL), non
                una finestra diversa per ogni scena -- prima ogni scena
                portava la propria mini-finestra dentro questa già presente,
                risultando in un riquadro minuscolo dentro un riquadro
                grande (feedback di Gabriel su screenshot). L'URL nella
                barra cambia con la scena, per dare comunque il senso di
                "stiamo guardando parti diverse del prodotto". */}
            <div ref={schermoRef} className="order-1 h-80 sm:h-[26rem] lg:order-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={attivo}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                  className="h-full"
                >
                  <Schermo indice={attivo} altezza="h-full" />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Sotto `lg`: niente pin, niente scroll-jacking -- una scena per
            volta, impilata verticalmente, ognuna con il proprio schermo
            compatto e un reveal-on-scroll normale (stesso `Reveal` usato nel
            resto del sito). Composizione pensata per lo schermo verticale,
            non il desktop rimpicciolito: qui il visitatore scorre UNA volta
            sola per vedere tutte e 6 le funzionalità, invece di dover
            "sbloccare" 600vh di scroll per raggiungerle. */}
        <div className="mt-10 flex flex-col gap-5 lg:hidden">
          {SCENE.map((s, i) => (
            <Reveal key={s.titolo}>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                    <s.icona className="size-4.5" />
                  </span>
                  <h3 className="text-[15px] font-medium text-white">{s.titolo}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{s.testo}</p>

                <div className="mt-4">
                  <Schermo indice={i} altezza={ALTEZZA_MOBILE_PER_SCENA[i] ?? "h-64"} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
