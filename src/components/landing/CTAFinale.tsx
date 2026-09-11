import { Reveal } from "./Reveal";
import { Grana } from "./Grana";
import { MagneticButton } from "./MagneticButton";
import { VorticeSfondo } from "./VorticeSfondo";
import { BorderBeam } from "./BorderBeam";

export function CTAFinale() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-16 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(500px_circle_at_50%_0%,rgba(168,85,247,0.25),transparent_70%)]" />
          <VorticeSfondo />
          <Grana opacita={0.04} />
          <h2 className="relative text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Pronto a smettere di perdere prenotazioni?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/60">
            Attivo in 5 minuti, gratis per iniziare, nessuna carta di credito richiesta.
          </p>
          <div className="relative mt-7 inline-block rounded-full p-px">
            <BorderBeam durata={4} />
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
