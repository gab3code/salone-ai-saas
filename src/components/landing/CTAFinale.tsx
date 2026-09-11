import { Reveal } from "./Reveal";
import { Grana } from "./Grana";
import { MagneticButton } from "./MagneticButton";
import { LiquidMetal } from "./LiquidMetal";
import { GlowBorder } from "./GlowBorder";

/**
 * Chiude il sito con lo stesso linguaggio visivo dell'Hero (Liquid Metal),
 * ma con parametri diversi -- un richiamo, non una copia identica: più
 * energico e con un "vuoto" meno marcato, per sentirsi come l'ultima spinta
 * verso la conversione, non un déjà-vu (Giro 3, vedi docs/librerie-ui.md).
 */
export function CTAFinale() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-noir px-8 py-16 text-center">
          <LiquidMetal angle={115} twist={3.4} stretch={6} bands={6} relief={7} scale={8.5} flow={9} voidSize={0.6} frost={1} sweep={6} />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(65% 60% at 50% 45%, rgba(5,1,8,0.55), transparent 75%)" }}
          />
          <Grana opacita={0.04} />
          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Pronto a smettere di perdere prenotazioni?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/60">
            Attivo in 5 minuti, gratis per iniziare, nessuna carta di credito richiesta.
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
        </div>
      </Reveal>
    </section>
  );
}
