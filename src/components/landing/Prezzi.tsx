import { Check } from "lucide-react";
import { Reveal, RevealItem, RevealStagger } from "./Reveal";
import { GlowBorder } from "./GlowBorder";

/**
 * Struttura piani reale, decisa con Gabriel e documentata in DECISIONS.md
 * (voce "Struttura piani Free -> Enterprise") -- NON numeri inventati per la
 * landing. L'AI è inclusa da Growth in su (non solo Pro): il costo reale per
 * conversazione è basso, vedi DECISIONS.md per il ragionamento completo.
 *
 * Ogni voce può essere un testo semplice o `{ testo, inArrivo: true }`.
 * Aggiunto dopo la richiesta di Gabriel di verificare che "tutto quello che
 * offriamo lo possiamo effettivamente realizzare": controllato ogni voce
 * contro PROJECT_STATUS.md e Funzionalita.tsx -- Analytics (zero codice
 * oltre ai dati grezzi), Promemoria automatici, Assistente AI su WhatsApp,
 * SMS (zero codice, nessuna integrazione), Tono dell'AI personalizzabile,
 * Instagram/Telegram e PWA sono tutte funzioni ancora da costruire, non
 * disponibili oggi -- venderle senza dirlo su un piano a pagamento sarebbe
 * una promessa che oggi non possiamo mantenere. Marcate "in arrivo" come
 * già fatto altrove sul sito, non tolte (restano vere decisioni di prezzo/
 * posizionamento, solo non ancora costruite).
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
    voci: ["Tutto di Starter", "Assistente AI via chat web", { testo: "Analytics", inArrivo: true }, { testo: "Promemoria automatici", inArrivo: true }],
    consigliato: true,
  },
  {
    nome: "Pro",
    prezzo: "€69,90",
    periodo: "/mese",
    descrizione: "Anche su WhatsApp.",
    voci: [
      "Tutto di Growth",
      { testo: "Assistente AI su WhatsApp", inArrivo: true },
      { testo: "SMS", inArrivo: true },
      { testo: "Tono dell'AI personalizzabile", inArrivo: true },
    ],
    consigliato: false,
  },
  {
    nome: "Enterprise",
    prezzo: "Su misura",
    periodo: "",
    descrizione: "Per catene e gruppi.",
    voci: ["Tutto di Pro", { testo: "Instagram e Telegram", inArrivo: true }, { testo: "App installabile (PWA)", inArrivo: true }, "Supporto dedicato"],
    consigliato: false,
  },
];

function testoVoce(v: string | { testo: string; inArrivo?: boolean }): string {
  return typeof v === "string" ? v : v.testo;
}
function inArrivoVoce(v: string | { testo: string; inArrivo?: boolean }): boolean {
  return typeof v === "string" ? false : Boolean(v.inArrivo);
}

export function Prezzi() {
  return (
    <section id="prezzi" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal className="max-w-lg">
        <h2 className="text-sm font-medium text-violet-400">Prezzi</h2>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Cresci di piano quando ti serve, non prima.
        </p>
      </Reveal>

      {/* Bug segnalato da Gabriel: piani "di lunghezze diverse e storti" --
          causa reale: h-full sull'ultimo div non aveva un'altezza da cui
          ereditare, perché nessun antenato tra il grid item e lì aveva
          h-full esplicito (una griglia CSS stira il grid item stesso, ma
          non i suoi figli a cascata). Aggiunto h-full su RevealItem e sul
          wrapper -- ora le 5 card hanno sempre la stessa altezza di riga. */}
      <RevealStagger className="mt-12 grid items-stretch gap-4 lg:grid-cols-5" gapMs={0.06}>
        {PIANI.map((p) => (
          <RevealItem key={p.nome} className="h-full">
            {/* Bug segnalato da Gabriel: il badge "Consigliato" viveva DENTRO
                il flusso della card (prima di nome/prezzo) -- su Growth
                aggiungeva ~36px prima del titolo che le altre 4 card non
                avevano, quindi nome/prezzo/descrizione di Growth partivano
                più in basso delle altre e rompevano l'allineamento della
                riga ("rovina l'ordine"). Ora è un'etichetta assoluta che
                sporge SOPRA il bordo della card, fuori dal flusso -- il
                contenuto interno riparte identico su tutti e 5 i piani. */}
            <div className={`relative h-full rounded-2xl ${p.consigliato ? "p-px" : ""}`}>
              {p.consigliato && <GlowBorder rounded={14} borderWidth={1.5} speed={6} tailLength={45} glowColor="#f0abfc" tailColor="rgba(217,70,239,0.4)" baseColor="rgba(255,255,255,0.04)" />}
              {p.consigliato && (
                <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-violet-600 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-white shadow-md shadow-violet-950/40">
                  Consigliato
                </span>
              )}
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-5 text-white ${
                  p.consigliato
                    ? "border-transparent bg-white/[0.07] shadow-xl shadow-violet-600/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
              <h3 className={`text-sm font-medium ${p.consigliato ? "text-white/70" : "text-white/50"}`}>{p.nome}</h3>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tracking-tight">{p.prezzo}</span>
                <span className={`text-sm ${p.consigliato ? "text-white/50" : "text-white/40"}`}>{p.periodo}</span>
              </div>
              <p className={`mt-1 text-xs ${p.consigliato ? "text-white/50" : "text-white/40"}`}>{p.descrizione}</p>

              <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
                {p.voci.map((v) => (
                  <li key={testoVoce(v)} className={`flex items-start gap-2 ${p.consigliato ? "text-white/80" : "text-white/60"}`}>
                    <Check className="mt-0.5 size-3.5 shrink-0 text-violet-400" />
                    <span>
                      {testoVoce(v)}
                      {inArrivoVoce(v) && <span className="ml-1.5 inline-block rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-amber-300">in arrivo</span>}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="/registrati"
                className={`mt-5 rounded-full px-4 py-2 text-center text-sm font-medium transition-colors ${
                  p.consigliato ? "bg-white text-zinc-900 hover:bg-white/90" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {/* Bug reale segnalato da Gabriel: "Inizia gratis" compariva
                    anche su Starter/Growth/Pro (€19,90-69,90), come se
                    l'abbonamento a pagamento partisse gratis -- confuso a
                    ragione. Verità tecnica (DECISIONS.md + PROJECT_STATUS.md):
                    non esiste ancora uno Stripe checkout, "/registrati" crea
                    SEMPRE lo stesso account sul piano Free, qualunque card
                    si clicchi -- il piano si cambia oggi solo a mano nel
                    database. "Inizia gratis" resta quindi accurato SOLO per
                    la card Free; per i piani a pagamento il copy non deve
                    promettere un'attivazione che non esiste -- "Crea il tuo
                    account" è vero per tutti (l'account è sempre gratuito da
                    creare), senza dichiarare che quel piano specifico parte
                    subito. */}
                {p.nome === "Enterprise" ? "Richiedi info" : p.nome === "Free" ? "Inizia gratis" : "Crea il tuo account"}
              </a>
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealStagger>
    </section>
  );
}
