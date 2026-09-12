"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { MessageCircleWarning, Euro, CalendarRange, TrendingDown } from "lucide-react";
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
 * Le 3 ipotesi (1 messaggio/settimana, scontrino medio 35€, 52 settimane)
 * sono le stesse di prima, ora scomposte visivamente come i passaggi di un
 * calcolo invece che nascoste dentro una frase. Il numero finale conta
 * verso l'alto quando entra in vista (percepito come "vivo", non un valore
 * statico) e il confronto col prezzo di Growth (dati reali da
 * Prezzi.tsx/DECISIONS.md, non inventati) trasforma il numero in un
 * argomento di ROI concreto: "quello che rischi di perdere" vs "quanto
 * costa risolverlo".
 */

const IPOTESI = [
  { icona: MessageCircleWarning, valore: "1", etichetta: "messaggio senza risposta a settimana" },
  { icona: Euro, valore: "35€", etichetta: "scontrino medio a prenotazione" },
  { icona: CalendarRange, valore: "52", etichetta: "settimane in un anno" },
];

const TOTALE_ANNUO = 1820; // 1 x 35 x 52 -- stesso calcolo dichiarato, non un numero a parte
const PREZZO_GROWTH_MENSILE = 39.9; // DECISIONS.md, stesso valore usato in Prezzi.tsx
const PREZZO_GROWTH_ANNUO = Math.round(PREZZO_GROWTH_MENSILE * 12 * 10) / 10;

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
          Un messaggio senza risposta oggi è un anno di prenotazioni perse.
        </p>
      </Reveal>

      <Reveal>
        <div className="relative mt-12 grid gap-0 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] lg:grid-cols-[1.1fr_1fr]">
          {/* Colonna sinistra: le 3 ipotesi dichiarate, scomposte come i
              passaggi di un calcolo invece che nascoste in una frase. */}
          <div className="flex flex-col justify-center gap-5 p-7 sm:p-10">
            <p className="text-xs font-medium tracking-wide text-white/40 uppercase">Il calcolo, passo per passo</p>
            <div className="flex flex-col gap-3">
              {IPOTESI.map((ip, i) => (
                <div key={ip.etichetta} className="flex items-center gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-300">
                    <ip.icona className="size-4.5" />
                  </span>
                  <p className="text-sm text-white/70">
                    <span className="font-semibold text-white">{ip.valore}</span> {ip.etichetta}
                  </p>
                  {i < IPOTESI.length - 1 && <span className="ml-auto pr-1 text-lg text-white/20">×</span>}
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-white/40">
              Calcolo illustrativo per far capire la scala del problema, non una media misurata sui nostri clienti —
              il prodotto non è ancora live.
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
              <p className="mt-1 text-sm text-white/50">l&apos;anno di prenotazioni che non arrivano nemmeno a diventare un &quot;no&quot;</p>
            </div>

            <div className="mt-2 w-full max-w-xs rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3 text-left text-xs text-emerald-200/90">
              Il piano Growth costa <strong className="text-emerald-300">€{PREZZO_GROWTH_ANNUO.toLocaleString("it-IT")}/anno</strong> — meno
              di un quarto di quello che rischi di lasciare senza risposta.
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
