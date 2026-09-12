"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { MessageCircleWarning, Euro, CalendarRange, CalendarX, TrendingDown, BellRing } from "lucide-react";
import { Reveal } from "./Reveal";
import { GlowBorder } from "./GlowBorder";

/**
 * Nuova sezione (controllo approfondito pre-pubblicazione, 12/09/2026,
 * richiesta esplicita di Gabriel: "il blocco del calcolo economico sembra
 * messo lì casualmente, deve diventare una vera visualizzazione del valore
 * economico"). Prima era un'unica riga di testo in fondo a PrimaDopo.tsx
 * (icona + frase + disclaimer) -- vero nel contenuto ma minuscolo nel peso
 * visivo per l'argomento di vendita più importante della pagina. Estratta
 * in una sezione propria, con lo stesso identico calcolo e la stessa
 * onestà di prima (nessun dato reale misurato, ipotesi dichiarate,
 * disclaimer esplicito) -- cambia solo QUANTO e COME viene mostrato, mai
 * cosa viene affermato.
 *
 * Aggiornamento 12/09/2026 -- due correzioni segnalate da Gabriel:
 * 1) il calcolo copriva solo i messaggi senza risposta, non i clienti che
 *    si dimenticano l'appuntamento e non si presentano -- una seconda causa
 *    di incasso perso, reale quanto la prima, e che il promemoria
 *    automatico (una delle funzioni della pagina Prezzi) evita da solo.
 *    Aggiunta una seconda catena di ipotesi in parallelo alla prima,
 *    sommate nel totale a destra.
 * 2) il separatore "×" tra le ipotesi era uno span isolato, allineato a
 *    destra come farebbe una "x" per rimuovere un chip in una UI editabile
 *    -- leggeva come "posso modificare questi valori" quando invece è
 *    contenuto statico, illustrativo (segnalato da Gabriel: "non riesco ad
 *    inserire alcun dato"). Tolto il simbolo isolato: ogni catena ora
 *    chiude con una riga di calcolo scritta per intero in testo semplice
 *    ("1 × 35€ × 52 = 1.820€/anno"), che si legge come una formula, non
 *    come un controllo dell'interfaccia.
 */

const IPOTESI = [
  { icona: MessageCircleWarning, valore: "1", etichetta: "messaggio senza risposta a settimana" },
  { icona: Euro, valore: "35€", etichetta: "scontrino medio a prenotazione" },
  { icona: CalendarRange, valore: "52", etichetta: "settimane in un anno" },
];

const IPOTESI_NOSHOW = [
  { icona: CalendarX, valore: "2", etichetta: "clienti al mese dimenticano l'appuntamento" },
  { icona: Euro, valore: "35€", etichetta: "scontrino medio a prenotazione" },
  { icona: CalendarRange, valore: "12", etichetta: "mesi in un anno" },
];

// Bug reale trovato scorrendo tutta la pagina con un controllo automatico
// (non a occhio): chiamare `.toLocaleString("it-IT")` su un numero fisso
// direttamente nel render produce testo diverso tra server e browser
// quando Node non ha i dati ICU completi per formattare i separatori delle
// migliaia ("1820" sul server, "1.820" nel browser) -- React rileva
// l'incoerenza e la segnala come errore di hydration. Il contatore
// animato sotto (NumeroAnimato) non ne risente perché il suo valore parte
// da 0 e cambia solo dopo il mount, interamente lato client. Per i numeri
// statici la soluzione robusta è scrivere la stringa già formattata una
// volta sola, invece di ricalcolarla ad ogni render sperando che l'ambiente
// la formatti allo stesso modo.
const TOTALE_RISPOSTE = 1820; // 1 x 35 x 52 -- stesso calcolo dichiarato, non un numero a parte
const TOTALE_RISPOSTE_FMT = "1.820";
const TOTALE_NOSHOW = 840; // 2 x 35 x 12 -- stesso calcolo dichiarato, non un numero a parte
const TOTALE_NOSHOW_FMT = "840";
const TOTALE_ANNUO = TOTALE_RISPOSTE + TOTALE_NOSHOW; // usato solo dal contatore animato, client-side
const PREZZO_GROWTH_ANNUO_FMT = "478,8"; // 39,90€/mese x 12 -- DECISIONS.md, stesso valore usato in Prezzi.tsx

function NumeroAnimato({ a, prefisso = "", suffisso = "" }: { a: number; prefisso?: string; suffisso?: string }) {
  const rif = useRef<HTMLSpanElement>(null);
  const inView = useInView(rif, { once: true, margin: "-60px" });
  const [valore, setValore] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, a, {
      duration: 1.5,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValore(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, a]);

  return (
    <span ref={rif}>
      {prefisso}
      {valore.toLocaleString("it-IT")}
      {suffisso}
    </span>
  );
}

export function ImpattoEconomico() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <Reveal className="mx-auto max-w-xl text-center">
        <h2 className="text-sm font-medium text-violet-400">Cosa costa non rispondere</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Messaggi senza risposta e appuntamenti dimenticati: un anno di incasso perso.
        </p>
      </Reveal>

      <Reveal>
        <div className="relative mt-12 grid gap-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] lg:grid-cols-[1.1fr_1fr]">
          {/* Colonna sinistra: due catene di ipotesi dichiarate, scomposte
              come i passaggi di un calcolo invece che nascoste in una
              frase -- e chiuse da una riga di formula in testo semplice,
              non da un'icona isolata che potrebbe leggersi come un
              controllo dell'interfaccia. */}
          <div className="flex flex-col justify-center gap-6 p-7 sm:p-10">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium tracking-wide text-white/40 uppercase">Messaggi senza risposta</p>
              {IPOTESI.map((ip) => (
                <div key={ip.etichetta} className="flex items-center gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-300">
                    <ip.icona className="size-4.5" />
                  </span>
                  <p className="text-sm text-white/70">
                    <span className="font-semibold text-white">{ip.valore}</span> {ip.etichetta}
                  </p>
                </div>
              ))}
              <p className="pl-14 text-xs text-white/40">
                1 × 35€ × 52 = <span className="font-medium text-white/70">{TOTALE_RISPOSTE_FMT}€/anno</span>
              </p>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 pt-6">
              <p className="text-xs font-medium tracking-wide text-white/40 uppercase">Appuntamenti dimenticati</p>
              {IPOTESI_NOSHOW.map((ip) => (
                <div key={ip.etichetta} className="flex items-center gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-300">
                    <ip.icona className="size-4.5" />
                  </span>
                  <p className="text-sm text-white/70">
                    <span className="font-semibold text-white">{ip.valore}</span> {ip.etichetta}
                  </p>
                </div>
              ))}
              <p className="pl-14 text-xs text-white/40">
                2 × 35€ × 12 = <span className="font-medium text-white/70">{TOTALE_NOSHOW_FMT}€/anno</span>
              </p>
              <p className="flex items-center gap-2 pl-14 text-xs text-emerald-300/80">
                <BellRing className="size-3.5 shrink-0" />
                Il promemoria automatico prima dell&apos;appuntamento evita questa voce da solo.
              </p>
            </div>

            <p className="text-xs text-white/40">
              Calcolo illustrativo per far capire la scala del problema, non una media misurata sui nostri clienti.
            </p>
          </div>

          {/* Colonna destra: il risultato, grande e curato -- glow-border
              come il piano "Consigliato" in Prezzi.tsx, stesso linguaggio
              premium riusato invece di inventarne uno nuovo. */}
          <div className="relative flex flex-col items-center justify-center gap-5 border-t border-white/10 bg-gradient-to-br from-violet-500/[0.07] to-fuchsia-500/[0.04] p-7 text-center sm:p-10 lg:border-t-0 lg:border-l">
            <GlowBorder rounded={0} borderWidth={1} speed={6} tailLength={40} glowColor="#c084fc" tailColor="rgba(168,85,247,0.35)" baseColor="rgba(255,255,255,0.02)" />

            <span className="flex size-10 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <TrendingDown className="size-5" />
            </span>

            <div>
              <p className="bg-gradient-to-br from-white to-white/70 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-6xl">
                <NumeroAnimato a={TOTALE_ANNUO} prefisso="€" />
                <span className="text-3xl sm:text-4xl">+</span>
              </p>
              <p className="mt-1 text-sm text-white/50">l&apos;anno tra chi non riceve risposta e chi si dimentica l&apos;appuntamento</p>
            </div>

            <div className="mt-2 w-full max-w-xs rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3 text-left text-xs text-emerald-200/90">
              Il piano Growth costa <strong className="text-emerald-300">€{PREZZO_GROWTH_ANNUO_FMT}/anno</strong> — meno
              di un quarto di quello che rischi di perdere.
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
