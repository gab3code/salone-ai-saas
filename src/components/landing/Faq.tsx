"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal, RevealItem, RevealStagger } from "./Reveal";

/**
 * FAQ (aggiunta autonoma, controllo approfondito pre-pubblicazione,
 * 12/09/2026 -- punto 10 della richiesta di Gabriel: "se ritieni che serva
 * una FAQ, inseriscila"). Risponde ai dubbi concreti che frenano la
 * conversione dell'ultimo passo (fiducia -> decisione), tutti con risposte
 * vere e già dette altrove sul sito -- nessun fatto nuovo inventato qui,
 * solo raccolto in un punto dove chi sta per decidere lo trova subito senza
 * dover ricostruire la pagina intera.
 */
const DOMANDE = [
  {
    domanda: "Devo saperne di tecnologia o installare qualcosa?",
    risposta:
      "No. Ti registri, configuri orari/operatori/servizi in circa 5 minuti e la tua pagina di prenotazione è già online — nessun tecnico, nessun software da installare.",
  },
  {
    domanda: "Posso provarlo gratis prima di pagare?",
    risposta:
      "Sì, in due modi: il piano Free resta gratuito senza scadenza (fino a 60 prenotazioni al mese), oppure scegli Growth o Pro con 10 giorni di prova prima del primo addebito — richiediamo una carta all'attivazione, ma non viene addebitata nulla finché la prova non finisce.",
  },
  {
    domanda: "Posso cancellare quando voglio?",
    risposta: "Sì, in qualsiasi momento dal pannello di gestione dell'abbonamento, senza vincoli di durata né penali.",
  },
  {
    domanda: "L'assistente AI risponde sempre in modo corretto?",
    risposta:
      "Gestisce da sola le richieste comuni — orari, prezzi, disponibilità, prenotazioni — ma riconosce le situazioni ambigue, i reclami e i casi fuori dal normale e li passa a te con tutto il contesto della conversazione, invece di indovinare una risposta.",
  },
  {
    domanda: "Funziona anche su WhatsApp?",
    risposta:
      "Sì. L'assistente risponde sulla chat della tua pagina pubblica su tutti i piani; su WhatsApp è incluso dal piano Pro in su.",
  },
  {
    domanda: "I dati dei miei clienti sono al sicuro?",
    risposta:
      "Ogni attività iscritta ha un isolamento reale a livello di database, non solo un filtro nell'applicazione: un bug in un altro salone non può mai far leggere i tuoi clienti a qualcun altro. L'infrastruttura che ospita i dati è europea.",
  },
  {
    domanda: "Cosa succede se ho già un'agenda cartacea o un altro gestionale?",
    risposta:
      "Puoi configurare orari, operatori e servizi da zero in pochi minuti e iniziare a usare Salone AI in parallelo finché non ti senti pronto a lasciare il vecchio sistema — non c'è un passaggio tutto-o-niente obbligato.",
  },
] as const;

/**
 * Bug segnalato da Gabriel: le voci "sono laggose e si allargano" su
 * desktop. Causa reale, non una sensazione: animare `height: "auto"` con
 * Framer Motion (versione precedente) non è direttamente interpolabile,
 * quindi la libreria deve ri-misurare il layout ad ogni frame -- da lì il
 * lag. L'allargamento è un effetto collaterale: quando l'altezza della
 * pagina supera l'altezza della finestra, compare la scrollbar verticale
 * e la larghezza disponibile si restringe di colpo (visibile su
 * desktop/mouse, dove macOS mostra sempre la scrollbar, non su telefono
 * dove è overlay) -- il contenuto si "riflowa" e sembra allargarsi.
 * Corretto in due punti: qui si misura l'altezza reale del contenuto una
 * volta (via ref) e si anima quel valore in pixel invece di "auto" --
 * niente più ri-misurazione ad ogni frame; `scrollbar-gutter: stable` in
 * globals.css riserva sempre lo spazio della scrollbar, quindi aprirla o
 * chiuderla non fa più spostare la larghezza della pagina.
 */
function Voce({ domanda, risposta, aperta, onToggle }: { domanda: string; risposta: string; aperta: boolean; onToggle: () => void }) {
  const contenutoRef = useRef<HTMLParagraphElement>(null);
  const [altezza, setAltezza] = useState(0);

  useEffect(() => {
    if (contenutoRef.current) {
      setAltezza(contenutoRef.current.scrollHeight);
    }
  }, [risposta]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aperta}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-[15px] font-medium text-white">{domanda}</span>
        <ChevronDown className={`size-4 shrink-0 text-white/40 transition-transform duration-300 ${aperta ? "rotate-180" : ""}`} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: aperta ? altezza : 0, opacity: aperta ? 1 : 0 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="overflow-hidden"
        aria-hidden={!aperta}
      >
        <p ref={contenutoRef} className="px-5 pb-4 text-sm leading-relaxed text-white/60">
          {risposta}
        </p>
      </motion.div>
    </div>
  );
}

export function Faq() {
  const [apertaIndice, setApertaIndice] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-24 mx-auto max-w-3xl px-5 py-24 sm:px-8">
      <Reveal className="text-center">
        <h2 className="text-sm font-medium text-violet-400">Domande frequenti</h2>
        <p className="mx-auto mt-2 max-w-lg text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Le domande che ti staresti facendo tu.
        </p>
      </Reveal>

      <RevealStagger className="mt-10 flex flex-col gap-3" gapMs={0.05}>
        {DOMANDE.map((d, i) => (
          <RevealItem key={d.domanda}>
            <Voce
              domanda={d.domanda}
              risposta={d.risposta}
              aperta={apertaIndice === i}
              onToggle={() => setApertaIndice((corrente) => (corrente === i ? null : i))}
            />
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
