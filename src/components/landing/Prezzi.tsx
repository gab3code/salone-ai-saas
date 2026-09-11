import { Check } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./Reveal";

/**
 * Struttura piani reale, decisa con Gabriel e documentata in DECISIONS.md
 * (voce "Struttura piani Free -> Enterprise") -- NON numeri inventati per la
 * landing. L'AI è inclusa da Growth in su (non solo Pro): il costo reale per
 * conversazione è basso, vedi DECISIONS.md per il ragionamento completo.
 */
const PIANI = [
  {
    nome: "Free",
    prezzo: "€0",
    periodo: "/mese",
    descrizione: "Per iniziare senza rischi.",
    voci: ["1 operatore", "Calendario e pagina pubblica", "CRM di base", "Fino a 60 prenotazioni/mese"],
    consigliato: false,
  },
  {
    nome: "Starter",
    prezzo: "€19,90",
    periodo: "/mese",
    descrizione: "Quando il salone cresce.",
    voci: ["Prenotazioni illimitate", "Operatori illimitati", "CRM completo"],
    consigliato: false,
  },
  {
    nome: "Growth",
    prezzo: "€39,90",
    periodo: "/mese",
    descrizione: "Con l'assistente AI.",
    voci: ["Tutto di Starter", "Assistente AI via chat web", "Analytics", "Promemoria automatici"],
    consigliato: true,
  },
  {
    nome: "Pro",
    prezzo: "€69,90",
    periodo: "/mese",
    descrizione: "Anche su WhatsApp.",
    voci: ["Tutto di Growth", "Assistente AI su WhatsApp", "SMS", "Tono dell'AI personalizzabile"],
    consigliato: false,
  },
  {
    nome: "Enterprise",
    prezzo: "Su misura",
    periodo: "",
    descrizione: "Per catene e gruppi.",
    voci: ["Tutto di Pro", "Instagram e Telegram", "App installabile (PWA)", "Supporto dedicato"],
    consigliato: false,
  },
];

export function Prezzi() {
  return (
    <section id="prezzi" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal className="max-w-lg">
        <h2 className="text-sm font-medium text-violet-600">Prezzi</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          Cresci di piano quando ti serve, non prima.
        </p>
      </Reveal>

      <RevealStagger className="mt-12 grid gap-4 lg:grid-cols-5" gapMs={0.06}>
        {PIANI.map((p) => (
          <RevealItem key={p.nome}>
            <div
              className={`flex h-full flex-col rounded-2xl border p-5 ${
                p.consigliato
                  ? "border-violet-600 bg-zinc-900 text-white shadow-xl shadow-violet-600/10"
                  : "border-zinc-200 bg-white"
              }`}
            >
              {p.consigliato && (
                <span className="mb-3 inline-block w-fit rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white">
                  Consigliato
                </span>
              )}
              <h3 className={`text-sm font-medium ${p.consigliato ? "text-white/70" : "text-zinc-500"}`}>{p.nome}</h3>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight">{p.prezzo}</span>
                <span className={`text-sm ${p.consigliato ? "text-white/50" : "text-zinc-400"}`}>{p.periodo}</span>
              </div>
              <p className={`mt-1 text-xs ${p.consigliato ? "text-white/50" : "text-zinc-400"}`}>{p.descrizione}</p>

              <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
                {p.voci.map((v) => (
                  <li key={v} className={`flex items-start gap-2 ${p.consigliato ? "text-white/80" : "text-zinc-600"}`}>
                    <Check className={`mt-0.5 size-3.5 shrink-0 ${p.consigliato ? "text-violet-400" : "text-violet-600"}`} />
                    {v}
                  </li>
                ))}
              </ul>

              <a
                href="/registrati"
                className={`mt-5 rounded-full px-4 py-2 text-center text-sm font-medium transition-transform hover:scale-105 ${
                  p.consigliato ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"
                }`}
              >
                {p.nome === "Enterprise" ? "Richiedi info" : "Inizia gratis"}
              </a>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
