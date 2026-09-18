"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BozzaOnboarding, FaqBozza } from "@/lib/onboarding-ai";
import type {
  DiffConfigurazione,
  ModificaAssociazione,
  ModificaOperatore,
  ModificaServizio,
  StatoSalone,
} from "@/lib/onboarding-ai-diff";
import { applicaBozzaOnboarding, type RisultatoApplicazioneBozza } from "./onboarding-ai-azioni";

const NOMI_GIORNI = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

/**
 * Revisione di una bozza di onboarding. Riscritta il 18/09/2026, dopo che
 * Gabriel ha provato l'onboarding dal vivo e ha trovato due cose:
 *
 * 1. dicendo chi faceva quali servizi, quei collegamenti non arrivavano in
 *    configurazione -- e non c'era modo di accorgersene, perche' questa
 *    schermata non li mostrava affatto. Ora c'e' una matrice spuntabile:
 *    qualunque cosa faccia il modello, si vede e si corregge in cinque
 *    secondi;
 * 2. l'onboarding sapeva solo aggiungere. Ora la bozza arriva insieme al
 *    DIFF con la configurazione esistente, e la revisione ha tre gruppi
 *    distinti: cosa nasce, cosa cambia (con il prima -> dopo), cosa
 *    sparirebbe.
 *
 * Regola che non va persa: le RIMOZIONI partono sempre non spuntate. Il
 * modello propone, il titolare decide, e niente sparisce per distrazione.
 */

interface OperatoreRevisione {
  modifica: ModificaOperatore;
  chiave: string;
  nome: string;
  descrizione: string | null;
  incluso: boolean;
}

interface ServizioRevisione {
  modifica: ModificaServizio;
  chiave: string;
  nome: string;
  durataMinuti: number | null;
  prezzoEuro: number | null;
  incluso: boolean;
}

interface FaqRevisione extends FaqBozza {
  incluso: boolean;
}

/** Una riga o una colonna della matrice "chi fa cosa". */
interface VoceMatrice {
  chiave: string;
  /** id se la riga esiste gia', null se nascera' da questa bozza. */
  id: string | null;
  nome: string;
  nuovo: boolean;
}

interface BozzaRevisione {
  bozza: BozzaOnboarding;
  stato: StatoSalone;
  applicaOrari: boolean;
  operatori: OperatoreRevisione[];
  servizi: ServizioRevisione[];
  /** chiaveOperatore + "::" + chiaveServizio -> spuntato */
  matrice: Record<string, boolean>;
  applicaInformazioni: boolean;
  faq: FaqRevisione[];
  applicaCancellazione: boolean;
}

const SEP = "::";
const cella = (operatore: string, servizio: string) => `${operatore}${SEP}${servizio}`;

function chiaveOperatore(m: ModificaOperatore, indice: number): string {
  return m.id ?? `nuovo-op-${indice}`;
}
function chiaveServizio(m: ModificaServizio, indice: number): string {
  return m.id ?? `nuovo-sv-${indice}`;
}

function costruisciRevisione(
  bozza: BozzaOnboarding,
  diff: DiffConfigurazione,
  stato: StatoSalone
): BozzaRevisione {
  const operatori: OperatoreRevisione[] = diff.operatori.map((modifica, i) => ({
    modifica,
    chiave: chiaveOperatore(modifica, i),
    nome: modifica.dopo?.nome ?? modifica.prima?.nome ?? "",
    descrizione: modifica.dopo?.descrizione ?? modifica.prima?.descrizione ?? null,
    // Le rimozioni partono spente: e' la riga piu' importante di questo file.
    incluso: modifica.tipo !== "rimuovi",
  }));

  const servizi: ServizioRevisione[] = diff.servizi.map((modifica, i) => ({
    modifica,
    chiave: chiaveServizio(modifica, i),
    nome: modifica.dopo?.nome ?? modifica.prima?.nome ?? "",
    durataMinuti: modifica.dopo?.durataMinuti ?? modifica.prima?.durataMinuti ?? null,
    prezzoEuro: modifica.dopo?.prezzoEuro ?? modifica.prima?.prezzoEuro ?? null,
    incluso: modifica.tipo !== "rimuovi",
  }));

  return {
    bozza,
    stato,
    applicaOrari: bozza.orari.some((o) => !o.chiuso),
    operatori,
    servizi,
    matrice: costruisciMatrice(diff, stato, operatori, servizi),
    applicaInformazioni: bozza.informazioniAttivita !== null,
    faq: bozza.faq.map((f) => ({ ...f, incluso: true })),
    applicaCancellazione: bozza.oreMinimeCancellazione !== null,
  };
}

/**
 * Lo stato iniziale della matrice: quello che vale OGGI, corretto da quello
 * che la bozza propone. Per le righe nuove il default e' spuntato ("tutti
 * fanno tutto"), perche' un servizio che nessuno esegue non e' prenotabile
 * da nessuno -- meglio uno slot di troppo, che si toglie con un clic.
 */
function costruisciMatrice(
  diff: DiffConfigurazione,
  stato: StatoSalone,
  operatori: OperatoreRevisione[],
  servizi: ServizioRevisione[]
): Record<string, boolean> {
  const matrice: Record<string, boolean> = {};

  for (const operatore of operatori) {
    for (const servizio of servizi) {
      const esisteGia =
        operatore.modifica.id !== null &&
        servizio.modifica.id !== null &&
        stato.associazioni.some(
          (a) => a.operatoreId === operatore.modifica.id && a.servizioId === servizio.modifica.id
        );
      const nuovo = operatore.modifica.tipo === "crea" || servizio.modifica.tipo === "crea";
      matrice[cella(operatore.chiave, servizio.chiave)] = esisteGia || nuovo;
    }
  }

  // Quello che il modello ha detto esplicitamente vince sul default.
  for (const coppia of diff.associazioni) {
    const operatore = trovaPerNomeOId(operatori, coppia.operatoreId, coppia.nomeOperatore);
    const servizio = trovaPerNomeOId(servizi, coppia.servizioId, coppia.nomeServizio);
    if (!operatore || !servizio) continue;
    matrice[cella(operatore.chiave, servizio.chiave)] = coppia.tipo === "crea";
  }

  return matrice;
}

function trovaPerNomeOId<T extends { chiave: string; nome: string; modifica: { id: string | null } }>(
  righe: T[],
  id: string | null,
  nome: string
): T | undefined {
  if (id) {
    const perId = righe.find((r) => r.modifica.id === id);
    if (perId) return perId;
  }
  return righe.find((r) => r.nome.trim().toLowerCase() === nome.trim().toLowerCase());
}

/**
 * Dalla revisione alle due cose che servono per applicare: la bozza (per
 * orari, informazioni, FAQ, cancellazione) e il diff ripulito, che contiene
 * SOLO le modifiche confermate. Cio' che non e' spuntato semplicemente non
 * esiste piu', esattamente come se il modello non lo avesse mai proposto.
 */
function pianoDaApplicare(rev: BozzaRevisione): { bozza: BozzaOnboarding; diff: DiffConfigurazione } {
  const operatoriInclusi = rev.operatori.filter((o) => o.incluso);
  const serviziInclusi = rev.servizi.filter((s) => s.incluso);

  const operatori: ModificaOperatore[] = operatoriInclusi.map((o) => ({
    ...o.modifica,
    dopo:
      o.modifica.tipo === "rimuovi"
        ? null
        : { id: o.modifica.id, nome: o.nome.trim(), descrizione: o.descrizione?.trim() || null },
  }));

  const servizi: ModificaServizio[] = serviziInclusi.map((s) => ({
    ...s.modifica,
    dopo:
      s.modifica.tipo === "rimuovi"
        ? null
        : { id: s.modifica.id, nome: s.nome.trim(), durataMinuti: s.durataMinuti, prezzoEuro: s.prezzoEuro },
  }));

  return {
    bozza: {
      ...rev.bozza,
      orari: rev.applicaOrari
        ? rev.bozza.orari
        : rev.bozza.orari.map((o) => ({ ...o, chiuso: true, apertura: null, chiusura: null, pausaInizio: null, pausaFine: null })),
      informazioniAttivita: rev.applicaInformazioni ? rev.bozza.informazioniAttivita : null,
      faq: rev.faq.filter((f) => f.incluso).map((f) => ({ domanda: f.domanda, risposta: f.risposta })),
      oreMinimeCancellazione: rev.applicaCancellazione ? rev.bozza.oreMinimeCancellazione : null,
    },
    diff: {
      operatori,
      servizi,
      associazioni: associazioniDallaMatrice(rev, operatoriInclusi, serviziInclusi),
      idSconosciuti: [],
    },
  };
}

/**
 * La matrice e' la verita': si confronta con quello che c'e' nel database e
 * si produce solo la differenza. Cosi' una spunta tolta a mano diventa una
 * rimozione vera, e una spunta lasciata dov'era non produce nessuna
 * scrittura inutile.
 */
function associazioniDallaMatrice(
  rev: BozzaRevisione,
  operatori: OperatoreRevisione[],
  servizi: ServizioRevisione[]
): ModificaAssociazione[] {
  const modifiche: ModificaAssociazione[] = [];

  for (const operatore of operatori) {
    if (operatore.modifica.tipo === "rimuovi") continue;
    for (const servizio of servizi) {
      if (servizio.modifica.tipo === "rimuovi") continue;

      const spuntata = rev.matrice[cella(operatore.chiave, servizio.chiave)] ?? false;
      const operatoreId = operatore.modifica.id;
      const servizioId = servizio.modifica.id;
      const esisteGia =
        operatoreId !== null &&
        servizioId !== null &&
        rev.stato.associazioni.some((a) => a.operatoreId === operatoreId && a.servizioId === servizioId);

      if (spuntata === esisteGia) continue; // niente da scrivere

      modifiche.push({
        tipo: spuntata ? "crea" : "rimuovi",
        operatoreId,
        servizioId,
        nomeOperatore: operatore.nome.trim(),
        nomeServizio: servizio.nome.trim(),
      });
    }
  }

  return modifiche;
}

type Stato =
  | { fase: "revisione"; revisione: BozzaRevisione }
  | { fase: "applicando"; revisione: BozzaRevisione }
  | { fase: "fatto"; risultato: RisultatoApplicazioneBozza };

const ETICHETTA: Record<string, string> = {
  crea: "nuovo",
  aggiorna: "modificato",
  rimuovi: "da togliere",
};

const COLORE: Record<string, string> = {
  crea: "bg-green-100 text-green-800",
  aggiorna: "bg-amber-100 text-amber-800",
  rimuovi: "bg-red-100 text-red-800",
};

function Etichetta({ tipo }: { tipo: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${COLORE[tipo] ?? ""}`}>
      {ETICHETTA[tipo] ?? tipo}
    </span>
  );
}

export function RevisioneBozzaOnboarding({
  bozzaIniziale,
  diffIniziale,
  statoIniziale,
  onRicomincia,
}: {
  bozzaIniziale: BozzaOnboarding;
  diffIniziale: DiffConfigurazione;
  statoIniziale: StatoSalone;
  onRicomincia: () => void;
}) {
  const router = useRouter();
  const [stato, setStato] = useState<Stato>({
    fase: "revisione",
    revisione: costruisciRevisione(bozzaIniziale, diffIniziale, statoIniziale),
  });

  async function applica() {
    if (stato.fase !== "revisione") return;
    const revisione = stato.revisione;
    setStato({ fase: "applicando", revisione });
    const piano = pianoDaApplicare(revisione);
    const risultato = await applicaBozzaOnboarding(piano.bozza, piano.diff);
    setStato({ fase: "fatto", risultato });
    router.refresh();
  }

  function aggiornaOperatore(indice: number, campo: "nome" | "descrizione" | "incluso", valore: string | boolean) {
    if (stato.fase !== "revisione") return;
    const operatori = stato.revisione.operatori.map((o, i) => (i === indice ? { ...o, [campo]: valore } : o));
    setStato({ fase: "revisione", revisione: { ...stato.revisione, operatori } });
  }

  function aggiornaServizio(
    indice: number,
    campo: "nome" | "durataMinuti" | "prezzoEuro" | "incluso",
    valore: string | number | boolean | null
  ) {
    if (stato.fase !== "revisione") return;
    const servizi = stato.revisione.servizi.map((s, i) => (i === indice ? { ...s, [campo]: valore } : s));
    setStato({ fase: "revisione", revisione: { ...stato.revisione, servizi } });
  }

  function aggiornaCella(chiave: string, valore: boolean) {
    if (stato.fase !== "revisione") return;
    setStato({
      fase: "revisione",
      revisione: { ...stato.revisione, matrice: { ...stato.revisione.matrice, [chiave]: valore } },
    });
  }

  function aggiornaFaq(indice: number, incluso: boolean) {
    if (stato.fase !== "revisione") return;
    const faq = stato.revisione.faq.map((f, i) => (i === indice ? { ...f, incluso } : f));
    setStato({ fase: "revisione", revisione: { ...stato.revisione, faq } });
  }

  if (stato.fase === "fatto") {
    const r = stato.risultato;
    const fatte = [
      r.operatoriCreati > 0 && `${r.operatoriCreati} operatori aggiunti`,
      r.operatoriAggiornati > 0 && `${r.operatoriAggiornati} operatori aggiornati`,
      r.operatoriRimossi > 0 && `${r.operatoriRimossi} operatori tolti`,
      r.serviziCreati > 0 && `${r.serviziCreati} servizi aggiunti`,
      r.serviziAggiornati > 0 && `${r.serviziAggiornati} servizi aggiornati`,
      r.serviziRimossi > 0 && `${r.serviziRimossi} servizi tolti`,
      r.associazioniCreate > 0 && `${r.associazioniCreate} collegamenti creati`,
      r.associazioniRimosse > 0 && `${r.associazioniRimosse} collegamenti tolti`,
      r.orariSalvati && "orari",
      r.informazioniSalvate && "informazioni attività",
      r.faqCreate > 0 && `${r.faqCreate} FAQ`,
      r.finestraCancellazioneSalvata && "finestra di cancellazione",
    ].filter(Boolean) as string[];

    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          {fatte.length > 0 ? `Applicato: ${fatte.join(", ")}.` : "Non c'era niente da cambiare."}
        </p>
        {r.errori.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {r.errori.map((errore, i) => (
              <li key={i}>⚠ {errore}</li>
            ))}
          </ul>
        )}
        <button onClick={onRicomincia} className="w-fit text-sm text-zinc-500 underline">
          Genera un&apos;altra bozza
        </button>
      </div>
    );
  }

  const rev = stato.revisione;
  const operatoriInMatrice: VoceMatrice[] = rev.operatori
    .filter((o) => o.incluso && o.modifica.tipo !== "rimuovi")
    .map((o) => ({ chiave: o.chiave, id: o.modifica.id, nome: o.nome, nuovo: o.modifica.tipo === "crea" }));
  const serviziInMatrice: VoceMatrice[] = rev.servizi
    .filter((s) => s.incluso && s.modifica.tipo !== "rimuovi")
    .map((s) => ({ chiave: s.chiave, id: s.modifica.id, nome: s.nome, nuovo: s.modifica.tipo === "crea" }));

  const nienteDaFare =
    rev.operatori.length === 0 && rev.servizi.length === 0 && !rev.applicaOrari && rev.faq.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-medium text-violet-900">
        Rivedi la bozza: togli la spunta a quello che non va, correggi i valori, poi applica. Quello che
        non è spuntato non viene toccato.
      </p>

      {nienteDaFare && (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          Rispetto a com&apos;è configurata adesso l&apos;attività, non cambierebbe niente.
        </p>
      )}

      {rev.bozza.orari.some((o) => !o.chiuso) && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={rev.applicaOrari}
              onChange={(e) => setStato({ fase: "revisione", revisione: { ...rev, applicaOrari: e.target.checked } })}
            />
            Orari di apertura
          </label>
          <ul className="mt-1 ml-6 text-sm text-zinc-600">
            {rev.bozza.orari
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

      {rev.operatori.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Operatori</h3>
          <ul className="mt-1 flex flex-col gap-2">
            {rev.operatori.map((o, i) => (
              <li key={o.chiave} className="flex flex-wrap items-center gap-2 text-sm">
                <input type="checkbox" checked={o.incluso} onChange={(e) => aggiornaOperatore(i, "incluso", e.target.checked)} />
                <Etichetta tipo={o.modifica.tipo} />
                {o.modifica.tipo === "rimuovi" ? (
                  <span className="text-zinc-600">
                    {o.nome}
                    <span className="ml-2 text-xs text-zinc-500">
                      non compare più nella descrizione. Se ha appuntamenti non verrà cancellato: va disattivato.
                    </span>
                  </span>
                ) : (
                  <>
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
                    {o.modifica.tipo === "aggiorna" && o.modifica.prima && (
                      <span className="text-xs text-zinc-500">era: {o.modifica.prima.nome}</span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rev.servizi.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Servizi</h3>
          <ul className="mt-1 flex flex-col gap-2">
            {rev.servizi.map((s, i) => {
              const incompleto = s.durataMinuti === null || s.prezzoEuro === null;
              return (
                <li key={s.chiave} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.incluso} onChange={(e) => aggiornaServizio(i, "incluso", e.target.checked)} />
                  <Etichetta tipo={s.modifica.tipo} />
                  {s.modifica.tipo === "rimuovi" ? (
                    <span className="text-zinc-600">
                      {s.nome}
                      <span className="ml-2 text-xs text-zinc-500">
                        non compare più nella descrizione. Con appuntamenti o caparre collegate non verrà cancellato.
                      </span>
                    </span>
                  ) : (
                    <>
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
                      {s.modifica.tipo === "aggiorna" && s.modifica.prima && (
                        <span className="text-xs text-zinc-500">
                          era: {s.modifica.prima.nome}, {s.modifica.prima.durataMinuti} min,{" "}
                          {s.modifica.prima.prezzoEuro.toFixed(2)}€
                        </span>
                      )}
                      {incompleto && s.incluso && (
                        <span className="text-xs font-medium text-amber-700">
                          ⚠ durata e prezzo mancanti nel testo, completali prima di applicare
                        </span>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {operatoriInMatrice.length > 0 && serviziInMatrice.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Chi fa cosa</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Un operatore riceve prenotazioni solo per i servizi spuntati qui.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-zinc-500">Operatore</th>
                  {serviziInMatrice.map((s) => (
                    <th key={s.chiave} className="px-2 py-1 text-left font-medium text-zinc-500">
                      {s.nome || "(senza nome)"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {operatoriInMatrice.map((o) => (
                  <tr key={o.chiave} className="border-t border-zinc-100">
                    <td className="px-2 py-1">{o.nome || "(senza nome)"}</td>
                    {serviziInMatrice.map((s) => {
                      const chiave = cella(o.chiave, s.chiave);
                      return (
                        <td key={s.chiave} className="px-2 py-1">
                          <input
                            type="checkbox"
                            aria-label={`${o.nome} esegue ${s.nome}`}
                            checked={rev.matrice[chiave] ?? false}
                            onChange={(e) => aggiornaCella(chiave, e.target.checked)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rev.bozza.informazioniAttivita && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={rev.applicaInformazioni}
            onChange={(e) => setStato({ fase: "revisione", revisione: { ...rev, applicaInformazioni: e.target.checked } })}
          />
          Informazioni sull&apos;attività (descrizione, indirizzo, parcheggio, pagamenti)
        </label>
      )}

      {rev.faq.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Domande frequenti</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {rev.faq.map((f, i) => (
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

      {rev.bozza.oreMinimeCancellazione !== null && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={rev.applicaCancellazione}
            onChange={(e) => setStato({ fase: "revisione", revisione: { ...rev, applicaCancellazione: e.target.checked } })}
          />
          Cancellazione entro {rev.bozza.oreMinimeCancellazione} ore prima
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
          onClick={onRicomincia}
          disabled={stato.fase === "applicando"}
          className="text-sm text-zinc-500 underline disabled:opacity-50"
        >
          Ricomincia
        </button>
      </div>
    </div>
  );
}
