import { Reveal, RevealItem, RevealStagger } from "./Reveal";

const PASSI = [
  {
    numero: "01",
    titolo: "Ti registri e configuri il salone",
    testo: "Orari, operatori e servizi — 5 minuti, nessun tecnico necessario.",
  },
  {
    numero: "02",
    titolo: "Condividi la tua pagina",
    testo: "Un link unico (salone-ai-saas.app/s/il-tuo-nome) da mettere su Instagram, Google, WhatsApp.",
  },
  {
    numero: "03",
    titolo: "I clienti prenotano, l'AI risponde",
    testo: "Il calendario si aggiorna da solo, e chi scrive fuori orario riceve comunque una risposta.",
  },
];

export function ComeFunziona() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal className="max-w-lg">
        <h2 className="text-sm font-medium text-violet-400">Come funziona</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Operativo lo stesso giorno.
        </p>
      </Reveal>

      <RevealStagger className="mt-12 grid gap-8 sm:grid-cols-3" gapMs={0.12}>
        {PASSI.map((p) => (
          <RevealItem key={p.numero} className="relative">
            <span className="text-5xl font-semibold text-white/10">{p.numero}</span>
            <h3 className="mt-3 text-lg font-medium text-white">{p.titolo}</h3>
            <p className="mt-2 text-sm text-white/60">{p.testo}</p>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
