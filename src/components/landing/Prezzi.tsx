import { Check } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./Reveal";
import { GlowBorder } from "./GlowBorder";

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
        <h2 className="text-sm font-medium text-violet-400">Prezzi</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Cresci di piano quando ti serve, non prima.
        </p>
      </Reveal>

      <RevealStagger className="mt-12 grid gap-4 lg:grid-cols-5" gapMs={0.06}>
        {PIANI.map((p) => (
          <RevealItem key={p.nome}>
            <div className={`relative rounded-2xl ${p.consigliato ? "p-px" : ""}`}>
              {p.consigliato && <GlowBorder rounded={14} borderWidth={1.5} speed={6} tailLength={45} glowColor="#f0abfc" tailColor="rgba(217,70,239,0.4)" baseColor="rgba(255,255,255,0.04)" />}
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-5 text-white ${
                  p.consigliato
                    ? "border-transparent bg-white/[0.07] shadow-xl shadow-violet-600/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
              {p.consigliato && (
                <span className="mb-3 inline-block w-fit rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-medium text-white">
                  Consigliato
                </span>
              )}
              <h3 className={`text-sm font-medium ${p.consigliato ? "text-white/70" : "text-white/50"}`}>{p.nome}</h3>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight">{p.prezzo}</span>
                <span className={`text-sm ${p.consigliato ? "text-white/50" : "text-white/40"}`}>{p.periodo}</span>
              </div>
              <p className={`mt-1 text-xs ${p.consigliato ? "text-white/50" : "text-white/40"}`}>{p.descrizione}</p>

              <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
                {p.voci.map((v) => (
                  <li key={v} className={`flex items-start gap-2 ${p.consigliato ? "text-white/80" : "text-white/60"}`}>
                    <Check className="mt-0.5 size-3.5 shrink-0 text-violet-400" />
                    {v}
                  </li>
                ))}
              </ul>

              <a
                href="/registrati"
                className={`mt-5 rounded-full px-4 py-2 text-center text-sm font-medium transition-colors ${
                  p.consigliato ? "bg-white text-zinc-900 hover:bg-white/90" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {p.nome === "Enterprise" ? "Richiedi info" : "Inizia gratis"}
              </a>
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
