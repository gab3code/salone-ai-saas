"use client";

import { ShieldCheck, Sparkles, Globe2, Layers, UserCheck } from "lucide-react";
import { Reveal, RevealStagger, RevealItem } from "./Reveal";
import { SpotlightCard } from "./SpotlightCard";

const DIFFERENZIATORI = [
  {
    icona: Sparkles,
    titolo: "L'AI dove serve, non solo sul piano più caro",
    testo:
      "L'assistente che risponde ai clienti è già incluso da un piano intermedio, non riservato al piano top — perché è una delle funzioni che aiuta di più chi sta ancora crescendo, non un premio per chi paga già di più.",
  },
  {
    icona: Globe2,
    titolo: "Pagina di prenotazione inclusa da subito",
    testo:
      "Un link tuo, condivisibile ovunque, con prenotazione self-service — anche sul piano gratuito. Non è un extra da sbloccare più avanti.",
  },
  {
    icona: ShieldCheck,
    titolo: "I tuoi dati sono solo tuoi",
    testo:
      "Isolamento reale a livello di database tra ogni attività iscritta, non solo un filtro nell'applicazione — un bug altrove non può mai far leggere i tuoi clienti a qualcun altro.",
  },
  {
    icona: Layers,
    titolo: "Prezzi che si capiscono a colpo d'occhio",
    testo:
      "Pochi piani chiari, senza una decina di componenti aggiuntivi da combinare per capire quanto pagherai davvero.",
  },
  {
    icona: UserCheck,
    titolo: "L'AI sa quando fermarsi",
    testo:
      "Richieste ambigue, reclami, casi fuori dal normale: passati a te con tutto il contesto, non gestiti a forza da un modello che indovina.",
  },
];

export function PercheNoi() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      {/* Bagliore viola (Lampada) e flusso numerato 1-2-3 tolti (controllo
          approfondito pre-pubblicazione, 12/09/2026, doppia segnalazione di
          Gabriel: "i punti da 1 a 3 non hanno alcun senso e il colore sopra
          viola sfumato tanto meno" -- ancora dopo averne già cambiato una
          volta la messa in scena, vedi commit precedente). Due problemi di
          fondo, non solo estetici:
          1) il contenuto del flusso ("un unico motore decide la
             disponibilità", "calendario/CRM/AI sempre allineati") è lo
             STESSO concetto già raccontato per intero, con un'animazione
             sua propria, dalla scena 0 di Vetrina.tsx ("Un unico motore di
             prenotazione") -- ripeterlo qui con dei numeri 1-2-3 leggeva
             come un secondo "come funziona" fuori posto in una sezione che
             parla di differenziatori, non di un flusso operativo, e per di
             più duplicava il linguaggio a numeri già usato (con significato
             diverso: passi di onboarding) da ComeFunziona.tsx.
          2) Lampada esiste per dare peso a un titolo quando NON c'è
             una griglia di card subito sotto (vedi il suo commento) -- qui
             invece la sezione ha sempre avuto la griglia DIFFERENZIATORI
             appena sotto, quindi il bagliore non stava coprendo il vuoto per
             cui era stato pensato, si vedeva e basta.
          Tolti entrambi: resta il titolo (Reveal semplice, come nelle altre
          sezioni) seguito direttamente dalla griglia dei differenziatori. */}
      <Reveal className="mx-auto max-w-xl text-center">
        <h2 className="text-sm font-medium text-violet-400">Perché questo, non un gestionale qualsiasi</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Le differenze che contano quando lo usi ogni giorno.
        </p>
      </Reveal>

      {/* 5 elementi su una griglia a 3 colonne: l'ultima riga (2 elementi)
          lascerebbe un buco a destra (bug reale segnalato da Gabriel -- un
          semplice "col-start" non basta perché la riga finale non ha UN
          elemento solo, ne ha due). Le prime 3 vanno nella griglia normale,
          le ultime 2 in una riga a parte centrata, larghe quanto sarebbero
          state nella griglia (stesso gap) -- nessun buco, nessuna card
          storta. */}
      <RevealStagger className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DIFFERENZIATORI.slice(0, 3).map((d) => (
          <RevealItem key={d.titolo}>
            <SpotlightCard className="h-full rounded-2xl border border-white/10 bg-white/5 p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <d.icona className="size-4.5" />
              </span>
              <h3 className="mt-3 text-[15px] font-medium text-white">{d.titolo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">{d.testo}</p>
            </SpotlightCard>
          </RevealItem>
        ))}
      </RevealStagger>
      <RevealStagger className="mt-4 flex flex-wrap justify-center gap-4">
        {DIFFERENZIATORI.slice(3).map((d) => (
          <RevealItem key={d.titolo} className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]">
            <SpotlightCard className="h-full rounded-2xl border border-white/10 bg-white/5 p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                <d.icona className="size-4.5" />
              </span>
              <h3 className="mt-3 text-[15px] font-medium text-white">{d.titolo}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">{d.testo}</p>
            </SpotlightCard>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
