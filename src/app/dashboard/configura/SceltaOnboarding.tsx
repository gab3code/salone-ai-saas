"use client";

import { useState, type ReactNode } from "react";
import { PannelloOnboardingAI } from "./PannelloOnboardingAI";
import { OnboardingWizard } from "./OnboardingWizard";
import { ContatoreBozze } from "./AvvisoBozza";

type Modo = "domande" | "descrizione" | "mano";

/**
 * Le tre strade per configurare l'attivita' la prima volta, messe sullo
 * stesso piano invece che una davanti e due nascoste (richiesta di Gabriel,
 * 18/09/2026).
 *
 * Prima il wizard a domande era l'unica cosa visibile, il testo libero non
 * c'era affatto in questa schermata e la configurazione a mano stava sotto
 * un dettaglio richiuso. Tre modi diversi di fare la stessa cosa, e chi
 * apriva la pagina ne vedeva uno: chi aveva gia' in testa la descrizione
 * della propria attivita' doveva comunque passare per le domande.
 *
 * Le tre non sono equivalenti e le descrizioni lo dicono: le domande
 * guidano chi non sa da dove iniziare, il testo libero e' piu' veloce per
 * chi sa gia' cosa dire, i form a mano sono l'unica strada che non passa
 * dall'AI. Nessuna e' presentata come "quella giusta".
 */
export function SceltaOnboarding({
  nomeTitolare,
  sezioniManuali,
  bozzeRimaste = null,
}: {
  nomeTitolare: string;
  sezioniManuali: ReactNode;
  /** Configurazioni assistite ancora disponibili, o null se il piano ha una quota mensile. */
  bozzeRimaste?: number | null;
}) {
  const [modo, setModo] = useState<Modo | null>(null);

  if (modo === null) {
    return (
      <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
        <h2 className="text-base font-medium">Iniziamo a configurare la tua attività</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Tre modi per arrivare allo stesso punto. Con i primi due l&apos;AI prepara una bozza che
          rivedi prima di salvare: non scrive niente senza la tua conferma.
        </p>

        <div className="mt-3">
          <ContatoreBozze rimaste={bozzeRimaste} />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Scelta
            titolo="Rispondi a qualche domanda"
            descrizione="Poche domande una alla volta. La strada più semplice se non sai da dove iniziare."
            onClick={() => setModo("domande")}
          />
          <Scelta
            titolo="Racconta la tua attività"
            descrizione="Scrivi com'è fatto il tuo salone in un testo solo: orari, chi ci lavora, cosa fate, ferie. L'AI ne ricava tutta la configurazione."
            onClick={() => setModo("descrizione")}
          />
          <Scelta
            titolo="Compila a mano"
            descrizione="I campi uno per uno, senza AI. Più lungo, ma vedi esattamente cosa stai salvando."
            onClick={() => setModo("mano")}
          />
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-700">{TITOLO[modo]}</p>
        <button type="button" onClick={() => setModo(null)} className="text-sm text-zinc-500 underline">
          Cambia modo
        </button>
      </div>

      {modo === "domande" && (
        <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
          <OnboardingWizard nomeTitolare={nomeTitolare} />
        </section>
      )}

      {modo === "descrizione" && (
        <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
          <PannelloOnboardingAI evidenzia bozzeRimaste={bozzeRimaste} />
        </section>
      )}

      {modo === "mano" && <div className="flex flex-col gap-10">{sezioniManuali}</div>}
    </div>
  );
}

const TITOLO: Record<Modo, string> = {
  domande: "Configurazione a domande",
  descrizione: "Configurazione da una descrizione",
  mano: "Configurazione a mano",
};

function Scelta({
  titolo,
  descrizione,
  onClick,
}: {
  titolo: string;
  descrizione: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-violet-400"
    >
      <span className="text-sm font-medium">{titolo}</span>
      <span className="text-xs text-zinc-600">{descrizione}</span>
    </button>
  );
}
