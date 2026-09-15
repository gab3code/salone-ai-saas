"use client";

import { useState } from "react";
import type { BozzaOnboarding } from "@/lib/onboarding-ai";
import { generaBozzaOnboardingAction } from "./onboarding-ai-azioni";
import { RevisioneBozzaOnboarding } from "./RevisioneBozzaOnboarding";

type Stato =
  | { fase: "descrizione" }
  | { fase: "generando" }
  | { fase: "revisione"; bozza: BozzaOnboarding }
  | { fase: "errore"; messaggio: string };

/**
 * Fase 3 di PIANO.md (onboarding AI-assisted): il titolare scrive una
 * descrizione libera della sua attività, l'AI ne estrae una bozza, il
 * titolare la rivede/corregge/esclude quello che non va, e solo allora
 * viene applicata sui form di /dashboard/configura che esistono già --
 * mai un salvataggio diretto senza revisione esplicita (stessa regola di
 * "l'AI non deve inventare dati", qui estesa a "l'AI non deve mai scrivere
 * da sola nella configurazione reale").
 *
 * Refactor 15/09/2026: la revisione/applicazione della bozza è stata
 * estratta in `RevisioneBozzaOnboarding.tsx` per essere riusata anche da
 * `OnboardingWizard.tsx` (onboarding a domande guidate per chi si registra
 * la prima volta) -- questo componente si occupa solo di raccogliere il
 * testo libero e generare la bozza iniziale.
 */
export function PannelloOnboardingAI({ evidenzia }: { evidenzia: boolean }) {
  const [stato, setStato] = useState<Stato>({ fase: "descrizione" });
  const [descrizione, setDescrizione] = useState("");
  const [aperto, setAperto] = useState(evidenzia);

  async function generaBozza() {
    setStato({ fase: "generando" });
    const esito = await generaBozzaOnboardingAction(descrizione);
    if (!esito.ok) {
      setStato({ fase: "errore", messaggio: esito.errore });
      return;
    }
    setStato({ fase: "revisione", bozza: esito.bozza });
  }

  if (!aperto) {
    return (
      <button
        onClick={() => setAperto(true)}
        className="w-fit rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-900"
      >
        ✨ Compila con l&apos;AI
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">✨ Compila con l&apos;AI</h2>
        {!evidenzia && (
          <button onClick={() => setAperto(false)} className="text-xs text-zinc-500 underline">
            Nascondi
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-600">
        Descrivi la tua attività in poche righe (orari, chi ci lavora, che servizi offri, i prezzi) e l&apos;AI
        prepara una bozza da rivedere e correggere prima di salvarla -- non scrive nulla senza la tua conferma.
      </p>

      {(stato.fase === "descrizione" || stato.fase === "generando" || stato.fase === "errore") && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            rows={5}
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder="Es. Siamo un salone di parrucchieri in centro, aperti dal martedì al sabato 9-19 con pausa 13-14. Siamo in due: io (Maria, colore e taglio) e Luca (barba e taglio uomo). Facciamo piega (30 min, 20€), taglio donna (45 min, 35€), taglio uomo (20 min, 15€)."
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
            disabled={stato.fase === "generando"}
          />
          <button
            onClick={generaBozza}
            disabled={stato.fase === "generando" || !descrizione.trim()}
            className="w-fit rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {stato.fase === "generando" ? "Genero la bozza..." : "Genera bozza"}
          </button>
          {stato.fase === "errore" && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {stato.messaggio}
            </p>
          )}
        </div>
      )}

      {stato.fase === "revisione" && (
        <div className="mt-4">
          <RevisioneBozzaOnboarding
            bozzaIniziale={stato.bozza}
            onRicomincia={() => {
              setDescrizione("");
              setStato({ fase: "descrizione" });
            }}
          />
        </div>
      )}
    </section>
  );
}
