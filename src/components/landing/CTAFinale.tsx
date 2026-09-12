import { Check } from "lucide-react";
import { Reveal, RevealStagger, RevealItem } from "./Reveal";
import { Grana } from "./Grana";
import { MagneticButton } from "./MagneticButton";
import { GlowBorder } from "./GlowBorder";

const GARANZIE = ["Nessuna carta richiesta", "Attivo in 5 minuti", "Cancella quando vuoi"];

/**
 * Riscritta da zero (Giro 4, feedback esplicito di Gabriel: "la cosa in
 * fondo non mi piace, cambiala completamente"). La versione precedente
 * riusava LiquidMetal (lo stesso shader dell'Hero) dentro una card piccola:
 * in Hero funziona perché è a piena pagina, con un badge/titolo/mockup
 * prodotto sopra a bilanciarlo -- lo sguardo ha altro su cui posarsi. Chiusa
 * dentro una card stretta con solo un titolo e un bottone, lo stesso vortice
 * satura diventa l'UNICO elemento visivo: legge come un gradient da
 * "template AI generico", non come la chiusura sobria di un vero SaaS
 * premium (vedi screenshot in docs/librerie-ui.md).
 *
 * Nuova direzione: niente shader. Un bagliore ambientale morbido (stessa
 * tecnica di Lampada.tsx, ellissi sfocate, mai un vortice a piena card) +
 * contenuto vero al posto del colore -- tre garanzie concrete come badge,
 * non solo una riga di sottotitolo. Il bordo animato (GlowBorder, già usato
 * su Hero e sul piano consigliato) resta come unico richiamo dinamico:
 * un dettaglio, non il protagonista.
 */
export function CTAFinale() {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-12 pb-24 sm:px-8 sm:pt-16">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-noir px-8 py-20 text-center sm:py-24">
          <GlowBorder rounded={24} borderWidth={1} speed={5} hoverMultiplier={2} tailLength={35} dualTails={false} glowColor="#c084fc" tailColor="rgba(168,85,247,0.35)" baseColor="rgba(255,255,255,0.03)" />

          {/* Bagliore ambientale, non un vortice: due ellissi sfocate agli
              angoli opposti, mai al centro sopra il testo. */}
          <div className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-violet-600/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rounded-full bg-fuchsia-600/15 blur-3xl" />
          <Grana opacita={0.05} />

          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Pronto a smettere di perdere prenotazioni?
          </h2>
          {/* Bug segnalato da Gabriel: la riga andava a capo in un punto
              brutto (una singola parola isolata sull'ultima riga) --
              max-w-md non bastava per stare su una riga sola a desktop, e
              su telefono il wrap automatico del browser tagliava a caso.
              Fix: a capo esplicito al confine naturale della frase (la
              virgola), visibile solo su telefono; da sm in su il
              contenitore è abbastanza largo da stare su un'unica riga. */}
          <p className="relative mx-auto mt-3 max-w-xs text-white/60 sm:max-w-2xl">
            Il tuo salone online in 5 minuti,<br className="sm:hidden" /> senza toccare una riga di codice.
          </p>

          <div className="relative mt-7 inline-block rounded-full p-px">
            <GlowBorder rounded={100} borderWidth={1.5} speed={10} hoverMultiplier={3} glowColor="#ffffff" tailColor="rgba(240,171,252,0.5)" baseColor="rgba(255,255,255,0.04)" />
            <MagneticButton
              href="/registrati"
              className="relative block rounded-full bg-white px-7 py-3 text-sm font-medium text-zinc-900"
            >
              Crea il tuo account
            </MagneticButton>
          </div>

          <RevealStagger className="relative mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2" gapMs={0.05}>
            {GARANZIE.map((g) => (
              <RevealItem key={g}>
                <span className="flex items-center gap-1.5 text-xs text-white/50">
                  <Check className="size-3.5 text-violet-400" />
                  {g}
                </span>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </Reveal>
    </section>
  );
}
