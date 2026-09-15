"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BozzaOnboarding, OperatoreBozza, ServizioBozza, FaqBozza } from "@/lib/onboarding-ai";
import {
  applicaBozzaOnboarding,
  generaBozzaOnboardingAction,
  type RisultatoApplicazioneBozza,
} from "./onboarding-ai-azioni";

const NOMI_GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

interface OperatoreRevisione extends OperatoreBozza {
  incluso: boolean;
}
interface ServizioRevisione extends ServizioBozza {
  incluso: boolean;
}
interface FaqRevisione extends FaqBozza {
  incluso: boolean;
}

interface BozzaRevisione {
  originale: BozzaOnboarding;
  applicaOrari: boolean;
  operatori: OperatoreRevisione[];
  servizi: ServizioRevisione[];
  applicaInformazioni: boolean;
  faq: FaqRevisione[];
  applicaCancellazione: boolean;
}

function costruisciRevisione(bozza: BozzaOnboarding): BozzaRevisione {
  return {
    originale: bozza,
    applicaOrari: bozza.orari.some((o) => !o.chiuso),
    operatori: bozza.operatori.map((o) => ({ ...o, incluso: true })),
    servizi: bozza.servizi.map((s) => ({ ...s, incluso: true })),
    applicaInformazioni: bozza.informazioniAttivita !== null,
    faq: bozza.faq.map((f) => ({ ...f, incluso: true })),
    applicaCancellazione: bozza.oreMinimeCancellazione !== null,
  };
}

/** Dalla revisione (con incluso/esclusioni ed eventuali modifiche a mano) alla
 *  BozzaOnboarding effettiva da applicare -- righe escluse semplicemente non
 *  compaiono più, esattamente come se il modello non le avesse mai proposte. */
function bozzaDaApplicare(rev: BozzaRevisione): BozzaOnboarding {
  const operatoriInclusi = rev.operatori.filter((o) => o.incluso);
  const serviziInclusi = rev.servizi.filter((s) => s.incluso);
  const nomiOperatoriInclusi = new Set(operatoriInclusi.map((o) => o.nome));
  const nomiServiziInclusi = new Set(serviziInclusi.map((s) => s.nome));

  return {
    orari: rev.applicaOrari ? rev.originale.orari : rev.originale.orari.map((o) => ({ ...o, chiuso: true, apertura: null, chiusura: null, pausaInizio: null, pausaFine: null })),
    operatori: operatoriInclusi.map((o) => ({ nome: o.nome, descrizione: o.descrizione })),
    servizi: serviziInclusi.map((s) => ({ nome: s.nome, durataMinuti: s.durataMinuti, prezzoEuro: s.prezzoEuro })),
    // Un'associazione ha senso solo se sia l'operatore che il servizio coinvolti sono ancora inclusi.
    associazioni: rev.originale.associazioni.filter(
      (a) => nomiOperatoriInclusi.has(a.operatore) && nomiServiziInclusi.has(a.servizio)
    ),
    informazioniAttivita: rev.applicaInformazioni ? rev.originale.informazioniAttivita : null,
    faq: rev.faq.filter((f) => f.incluso).map((f) => ({ domanda: f.domanda, risposta: f.risposta })),
    oreMinimeCancellazione: rev.applicaCancellazione ? rev.originale.oreMinimeCancellazione : null,
  };
}

type Stato =
  | { fase: "descrizione" }
  | { fase: "generando" }
  | { fase: "revisione"; revisione: BozzaRevisione }
  | { fase: "applicando"; revisione: BozzaRevisione }
  | { fase: "fatto"; risultato: RisultatoApplicazioneBozza }
  | { fase: "errore"; messaggio: string };

/**
 * Fase 3 di PIANO.md (onboarding AI-assisted): il titolare scrive una
 * descrizione libera della sua attività, l'AI ne estrae una bozza, il
 * titolare la rivede/corregge/esclude quello che non va, e solo allora
 * viene applicata sui form di /dashboard/configura che esistono già --
 * mai un salvataggio diretto senza revisione esplicita (stessa regola di
 * "l'AI non deve inventare dati", qui estesa a "l'AI non deve mai scrivere
 * da sola nella configurazione reale").
 */
export function PannelloOnboardingAI({ evidenzia }: { evidenzia: boolean }) {
  const router = useRouter();
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
    setStato({ fase: "revisione", revisione: costruisciRevisione(esito.bozza) });
  }

  async function applica() {
    if (stato.fase !== "revisione") return;
    const revisione = stato.revisione;
    setStato({ fase: "applicando", revisione });
    const risultato = await applicaBozzaOnboarding(bozzaDaApplicare(revisione));
    setStato({ fase: "fatto", risultato });
    router.refresh(); // le liste di operatori/servizi/orari qui sotto sono un Server Component
  }

  function aggiornaOperatore(indice: number, campo: keyof OperatoreRevisione, valore: string | boolean) {
    if (stato.fase !== "revisione") return;
    const operatori = stato.revisione.operatori.map((o, i) => (i === indice ? { ...o, [campo]: valore } : o));
    setStato({ fase: "revisione", revisione: { ...stato.revisione, operatori } });
  }

  function aggiornaServizio(indice: number, campo: keyof ServizioRevisione, valore: string | number | boolean | null) {
    if (stato.fase !== "revisione") return;
    const servizi = stato.revisione.servizi.map((s, i) => (i === indice ? { ...s, [campo]: valore } : s));
    setStato({ fase: "revisione", revisione: { ...stato.revisione, servizi } });
  }

  function aggiornaFaq(indice: number, incluso: boolean) {
    if (stato.fase !== "revisione") return;
    const faq = stato.revisione.faq.map((f, i) => (i === indice ? { ...f, incluso } : f));
    setStato({ fase: "revisione", revisione: { ...stato.revisione, faq } });
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

      {(stato.fase === "revisione" || stato.fase === "applicando") && (
        <div className="mt-4 flex flex-col gap-5">
          <p className="text-sm font-medium text-violet-900">
            Rivedi la bozza: togli la spunta a quello che non va, correggi i valori, poi applica.
          </p>

          {stato.revisione.originale.orari.some((o) => !o.chiuso) && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={stato.revisione.applicaOrari}
                  onChange={(e) =>
                    setStato({ fase: "revisione", revisione: { ...stato.revisione, applicaOrari: e.target.checked } })
                  }
                />
                Orari di apertura
              </label>
              <ul className="mt-1 ml-6 text-sm text-zinc-600">
                {stato.revisione.originale.orari
                  .filter((o) => !o.chiuso)
                  .map((o) => (
                    <li key={o.giornoSettimana}>
                      {NOMI_GIORNI[o.giornoSettimana]}: {o.apertura ?? "?"}–{o.chiusura ?? "?"}
                      {o.pausaInizio && o.pausaFine && ` (pausa ${o.pausaInizio}–${o.pausaFine})`}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {stato.revisione.operatori.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Operatori</h3>
              <ul className="mt-1 flex flex-col gap-2">
                {stato.revisione.operatori.map((o, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={o.incluso} onChange={(e) => aggiornaOperatore(i, "incluso", e.target.checked)} />
                    <input
                      value={o.nome}
                      onChange={(e) => aggiornaOperatore(i, "nome", e.target.value)}
                      disabled={!o.incluso}
                      className="w-40 rounded border border-zinc-300 px-2 py-1 disabled:opacity-50"
                    />
                    <input
                      value={o.descrizione ?? ""}
                      onChange={(e) => aggiornaOperatore(i, "descrizione", e.target.value)}
                      disabled={!o.incluso}
                      placeholder="Specializzazione (opzionale)"
                      className="w-56 rounded border border-zinc-300 px-2 py-1 disabled:opacity-50"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stato.revisione.servizi.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Servizi</h3>
              <ul className="mt-1 flex flex-col gap-2">
                {stato.revisione.servizi.map((s, i) => {
                  const incompleto = s.durataMinuti === null || s.prezzoEuro === null;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <input type="checkbox" checked={s.incluso} onChange={(e) => aggiornaServizio(i, "incluso", e.target.checked)} />
                      <input
                        value={s.nome}
                        onChange={(e) => aggiornaServizio(i, "nome", e.target.value)}
                        disabled={!s.incluso}
                        className="w-40 rounded border border-zinc-300 px-2 py-1 disabled:opacity-50"
                      />
                      <input
                        type="number"
                        min={1}
                        value={s.durataMinuti ?? ""}
                        onChange={(e) => aggiornaServizio(i, "durataMinuti", e.target.value === "" ? null : Number(e.target.value))}
                        disabled={!s.incluso}
                        placeholder="min"
                        className="w-20 rounded border border-zinc-300 px-2 py-1 disabled:opacity-50"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={s.prezzoEuro ?? ""}
                        onChange={(e) => aggiornaServizio(i, "prezzoEuro", e.target.value === "" ? null : Number(e.target.value))}
                        disabled={!s.incluso}
                        placeholder="€"
                        className="w-20 rounded border border-zinc-300 px-2 py-1 disabled:opacity-50"
                      />
                      {incompleto && s.incluso && (
                        <span className="text-xs font-medium text-amber-700">
                          ⚠ durata e prezzo mancanti nel testo -- completali prima di applicare
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {stato.revisione.originale.informazioniAttivita && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={stato.revisione.applicaInformazioni}
                onChange={(e) =>
                  setStato({ fase: "revisione", revisione: { ...stato.revisione, applicaInformazioni: e.target.checked } })
                }
              />
              Informazioni sull&apos;attività (descrizione, indirizzo, parcheggio, pagamenti)
            </label>
          )}

          {stato.revisione.faq.length > 0 && (
            <div>
              <h3 className="text-sm font-medium">Domande frequenti</h3>
              <ul className="mt-1 flex flex-col gap-1">
                {stato.revisione.faq.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={f.incluso} onChange={(e) => aggiornaFaq(i, e.target.checked)} className="mt-1" />
                    <span>
                      <strong>{f.domanda}</strong> — {f.risposta}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stato.revisione.originale.oreMinimeCancellazione !== null && (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={stato.revisione.applicaCancellazione}
                onChange={(e) =>
                  setStato({ fase: "revisione", revisione: { ...stato.revisione, applicaCancellazione: e.target.checked } })
                }
              />
              Cancellazione entro {stato.revisione.originale.oreMinimeCancellazione} ore prima
            </label>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={applica}
              disabled={stato.fase === "applicando"}
              className="w-fit rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {stato.fase === "applicando" ? "Applico..." : "Applica alla configurazione"}
            </button>
            <button
              onClick={() => setStato({ fase: "descrizione" })}
              disabled={stato.fase === "applicando"}
              className="text-sm text-zinc-500 underline disabled:opacity-50"
            >
              Ricomincia
            </button>
          </div>
        </div>
      )}

      {stato.fase === "fatto" && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
            Applicato: {stato.risultato.operatoriCreati} operatori, {stato.risultato.serviziCreati} servizi,{" "}
            {stato.risultato.associazioniCreate} associazioni
            {stato.risultato.orariSalvati && ", orari"}
            {stato.risultato.informazioniSalvate && ", informazioni attività"}
            {stato.risultato.faqCreate > 0 && `, ${stato.risultato.faqCreate} FAQ`}
            {stato.risultato.finestraCancellazioneSalvata && ", finestra di cancellazione"}.
          </p>
          {stato.risultato.errori.length > 0 && (
            <ul className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {stato.risultato.errori.map((errore, i) => (
                <li key={i}>⚠ {errore}</li>
              ))}
            </ul>
          )}
          <button
            onClick={() => {
              setDescrizione("");
              setStato({ fase: "descrizione" });
            }}
            className="w-fit text-sm text-zinc-500 underline"
          >
            Genera un&apos;altra bozza
          </button>
        </div>
      )}
    </section>
  );
}
