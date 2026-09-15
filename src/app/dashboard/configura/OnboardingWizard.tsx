"use client";

import { useState } from "react";
import type { BozzaOnboarding } from "@/lib/onboarding-ai";
import { generaBozzaOnboardingAction } from "./onboarding-ai-azioni";
import { RevisioneBozzaOnboarding } from "./RevisioneBozzaOnboarding";

const TIPI_ATTIVITA = [
  "Parrucchiere/Barbiere",
  "Estetista",
  "Massoterapista/Osteopata/Fisioterapista",
  "Personal trainer",
  "Altro",
] as const;

const GIORNI_ORDINE_VISUALE = [1, 2, 3, 4, 5, 6, 0]; // lun..dom, più naturale di dom..sab per un titolare
const NOMI_GIORNI_BREVI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const NOMI_GIORNI_DESCRIZIONE = [
  "domenica",
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
];

export interface RisposteWizard {
  tipoAttivita: string;
  soloLavoro: boolean;
  altriNomi: string;
  giorniSelezionati: number[];
  apertura: string;
  chiusura: string;
  pausaSi: boolean;
  pausaInizio: string;
  pausaFine: string;
  descrizioneServizi: string;
}

export const RISPOSTE_INIZIALI: RisposteWizard = {
  tipoAttivita: TIPI_ATTIVITA[0],
  soloLavoro: true,
  altriNomi: "",
  giorniSelezionati: [1, 2, 3, 4, 5],
  apertura: "09:00",
  chiusura: "18:00",
  pausaSi: true,
  pausaInizio: "13:00",
  pausaFine: "14:00",
  descrizioneServizi: "",
};

/**
 * Traduce le risposte guidate in una descrizione in linguaggio naturale,
 * nello stesso formato che un titolare scriverebbe nella casella di testo
 * libero di `PannelloOnboardingAI` -- così può passare invariata alla stessa
 * `generaBozzaOnboardingAction` già testata, senza toccare né il prompt
 * dell'AI né il modulo di validazione (`onboarding-ai.ts`). Il nome del
 * titolare viene scritto esplicitamente qui (invece di lasciare che l'AI lo
 * indovini da "lavoro da solo") -- corregge di riflesso l'operatore
 * battezzato con un nome generico invece del nome vero, osservato durante il
 * test dal vivo del 15/09/2026 (vedi DECISIONS.md).
 */
export function costruisciDescrizioneOnboarding(risposte: RisposteWizard, nomeTitolare: string): string {
  const righe: string[] = [];
  righe.push(`Tipo di attività: ${risposte.tipoAttivita || "non specificato"}.`);
  righe.push(
    risposte.soloLavoro
      ? `Il titolare, ${nomeTitolare}, lavora da solo: nessun altro operatore.`
      : `Il titolare si chiama ${nomeTitolare}. Oltre a lui/lei lavorano anche: ${risposte.altriNomi || "altre persone non specificate"}.`
  );
  if (risposte.giorniSelezionati.length === 0) {
    righe.push("Nessun giorno di apertura indicato.");
  } else {
    const giorniOrdinati = [...risposte.giorniSelezionati].sort((a, b) => a - b);
    const nomiGiorni = giorniOrdinati.map((g) => NOMI_GIORNI_DESCRIZIONE[g]).join(", ");
    const pausa = risposte.pausaSi
      ? `, con pausa pranzo dalle ${risposte.pausaInizio} alle ${risposte.pausaFine}`
      : "";
    righe.push(
      `Aperto ${nomiGiorni} dalle ${risposte.apertura} alle ${risposte.chiusura}${pausa}. Chiuso gli altri giorni della settimana.`
    );
  }
  righe.push(`Servizi offerti: ${risposte.descrizioneServizi || "non specificati"}.`);
  return righe.join("\n");
}

type Fase =
  | { nome: "domande"; passo: 0 | 1 | 2 }
  | { nome: "generando" }
  | { nome: "revisione"; bozza: BozzaOnboarding }
  | { nome: "errore"; messaggio: string };

function Chip({ attivo, onClick, children }: { attivo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        attivo
          ? "rounded-full bg-violet-700 px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
      }
    >
      {children}
    </button>
  );
}

/**
 * Onboarding a domande guidate per chi si registra la prima volta (richiesta
 * esplicita di Gabriel, 15/09/2026): non più una sola casella di testo
 * libero, ma poche schermate con domande chiuse (tipo attività, chi ci
 * lavora, giorni/orari) e una aperta (servizi, l'unica parte davvero
 * variabile da testo libero) -- l'AI entra in gioco solo alla fine, sulla
 * stessa `generaBozzaOnboardingAction` di sempre, per estrarre durata/prezzo
 * dei servizi descritti. Mostrato SOLO quando l'attività è ancora vuota
 * (vedi `page.tsx`): una volta applicata la prima bozza, le visite
 * successive tornano ai form manuali + "Compila con l'AI" di sempre, pensati
 * per modifiche puntuali, non per il primo giro.
 */
export function OnboardingWizard({ nomeTitolare }: { nomeTitolare: string }) {
  const [risposte, setRisposte] = useState<RisposteWizard>(RISPOSTE_INIZIALI);
  const [fase, setFase] = useState<Fase>({ nome: "domande", passo: 0 });
  // Tracciato separatamente da risposte.tipoAttivita (che qui contiene già il
  // testo finale, non l'etichetta del chip): tenerlo nello stesso campo
  // rompeva l'input libero al primo carattere digitato, perché la
  // condizione che mostra l'input ("tipoAttivita === 'Altro'") sarebbe
  // diventata subito falsa non appena il testo smetteva di essere "Altro".
  const [altroTipoSelezionato, setAltroTipoSelezionato] = useState(false);

  function aggiorna<K extends keyof RisposteWizard>(campo: K, valore: RisposteWizard[K]) {
    setRisposte((r) => ({ ...r, [campo]: valore }));
  }

  function toggleGiorno(giorno: number) {
    setRisposte((r) => ({
      ...r,
      giorniSelezionati: r.giorniSelezionati.includes(giorno)
        ? r.giorniSelezionati.filter((g) => g !== giorno)
        : [...r.giorniSelezionati, giorno],
    }));
  }

  async function generaBozza() {
    setFase({ nome: "generando" });
    const descrizione = costruisciDescrizioneOnboarding(risposte, nomeTitolare);
    const esito = await generaBozzaOnboardingAction(descrizione);
    if (!esito.ok) {
      setFase({ nome: "errore", messaggio: esito.errore });
      return;
    }
    setFase({ nome: "revisione", bozza: esito.bozza });
  }

  if (fase.nome === "revisione") {
    return (
      <RevisioneBozzaOnboarding
        bozzaIniziale={fase.bozza}
        onRicomincia={() => {
          setRisposte(RISPOSTE_INIZIALI);
          setFase({ nome: "domande", passo: 0 });
        }}
      />
    );
  }

  if (fase.nome === "generando") {
    return <p className="text-sm text-zinc-600">Genero la bozza in base a quello che mi hai detto...</p>;
  }

  const passo = fase.nome === "errore" ? 2 : fase.passo;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
        <span className={passo === 0 ? "text-violet-700" : ""}>1. Chi lavora qui</span>
        <span>→</span>
        <span className={passo === 1 ? "text-violet-700" : ""}>2. Orari</span>
        <span>→</span>
        <span className={passo === 2 ? "text-violet-700" : ""}>3. Servizi</span>
      </div>

      {passo === 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium">Che tipo di attività hai?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TIPI_ATTIVITA.map((tipo) => (
                <Chip
                  key={tipo}
                  attivo={tipo === "Altro" ? altroTipoSelezionato : !altroTipoSelezionato && risposte.tipoAttivita === tipo}
                  onClick={() => {
                    if (tipo === "Altro") {
                      setAltroTipoSelezionato(true);
                      aggiorna("tipoAttivita", "");
                    } else {
                      setAltroTipoSelezionato(false);
                      aggiorna("tipoAttivita", tipo);
                    }
                  }}
                >
                  {tipo}
                </Chip>
              ))}
            </div>
            {altroTipoSelezionato && (
              <input
                value={risposte.tipoAttivita}
                onChange={(e) => aggiorna("tipoAttivita", e.target.value)}
                placeholder="Che tipo di attività?"
                className="mt-2 w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            )}
          </div>

          <div>
            <p className="text-sm font-medium">Lavori da solo o con altre persone?</p>
            <div className="mt-2 flex gap-2">
              <Chip attivo={risposte.soloLavoro} onClick={() => aggiorna("soloLavoro", true)}>
                Da solo
              </Chip>
              <Chip attivo={!risposte.soloLavoro} onClick={() => aggiorna("soloLavoro", false)}>
                Con altre persone
              </Chip>
            </div>
            {!risposte.soloLavoro && (
              <input
                value={risposte.altriNomi}
                onChange={(e) => aggiorna("altriNomi", e.target.value)}
                placeholder="Nomi delle altre persone, separati da virgola"
                className="mt-2 w-full max-w-sm rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            )}
          </div>

          <button
            onClick={() => setFase({ nome: "domande", passo: 1 })}
            className="w-fit rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white"
          >
            Avanti
          </button>
        </div>
      )}

      {passo === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium">In quali giorni sei aperto?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {GIORNI_ORDINE_VISUALE.map((giorno) => (
                <Chip key={giorno} attivo={risposte.giorniSelezionati.includes(giorno)} onClick={() => toggleGiorno(giorno)}>
                  {NOMI_GIORNI_BREVI[giorno]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Apertura
              <input
                type="time"
                value={risposte.apertura}
                onChange={(e) => aggiorna("apertura", e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Chiusura
              <input
                type="time"
                value={risposte.chiusura}
                onChange={(e) => aggiorna("chiusura", e.target.value)}
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
              />
            </label>
          </div>

          <div>
            <p className="text-sm font-medium">Fai una pausa pranzo?</p>
            <div className="mt-2 flex gap-2">
              <Chip attivo={risposte.pausaSi} onClick={() => aggiorna("pausaSi", true)}>
                Sì
              </Chip>
              <Chip attivo={!risposte.pausaSi} onClick={() => aggiorna("pausaSi", false)}>
                No
              </Chip>
            </div>
            {risposte.pausaSi && (
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Pausa da
                  <input
                    type="time"
                    value={risposte.pausaInizio}
                    onChange={(e) => aggiorna("pausaInizio", e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Pausa a
                  <input
                    type="time"
                    value={risposte.pausaFine}
                    onChange={(e) => aggiorna("pausaFine", e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  />
                </label>
              </div>
            )}
          </div>

          <p className="text-xs text-zinc-500">
            Stesso orario per tutti i giorni selezionati -- se un giorno è diverso dagli altri potrai
            correggerlo dopo, nella tabella qui sotto.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setFase({ nome: "domande", passo: 0 })}
              className="text-sm text-zinc-500 underline"
            >
              Indietro
            </button>
            <button
              onClick={() => setFase({ nome: "domande", passo: 2 })}
              className="w-fit rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white"
            >
              Avanti
            </button>
          </div>
        </div>
      )}

      {passo === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium">Che servizi offri?</p>
            <p className="mt-1 text-xs text-zinc-500">
              Scrivi nome, durata e prezzo per ciascuno -- es. &quot;Taglio uomo, 30 minuti, 20€. Piega, 45
              minuti, 35€&quot;.
            </p>
            <textarea
              rows={4}
              value={risposte.descrizioneServizi}
              onChange={(e) => aggiorna("descrizioneServizi", e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          {fase.nome === "errore" && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {fase.messaggio}
            </p>
          )}
          <div className="flex items-center gap-3">
            <button onClick={() => setFase({ nome: "domande", passo: 1 })} className="text-sm text-zinc-500 underline">
              Indietro
            </button>
            <button
              onClick={generaBozza}
              disabled={!risposte.descrizioneServizi.trim()}
              className="w-fit rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Genera la mia configurazione
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
