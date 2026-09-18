"use client";

import { useState } from "react";
import { impostaEsportazioneAzione, scollegaCalendarioAzione } from "./azioni";

interface Operatore {
  id: string;
  nome: string;
}

interface Collegamento {
  id: string;
  operatoreId: string;
  provider: "google" | "apple";
  stato: string;
  ultimoErrore: string | null;
  esportaAppuntamenti: boolean;
}

/**
 * UI di collegamento calendari personali (Fase 6bis). Google Calendar è
 * mostrato ma disabilitato finché l'OAuth non è pronto (vedi PIANO.md) --
 * niente pulsante che promette qualcosa che non fa ancora nulla.
 *
 * Apple/iCloud (CalDAV) è stato TOLTO da questa UI l'11/09/2026 (deciso con
 * Gabriel): il client è tecnicamente corretto (verificato via test
 * comparativo diretto con `curl` -- stesse credenziali, 207 dal Mac di
 * Gabriel, 400 muto da Vercel) ma probabilmente inutilizzabile in produzione
 * perché Apple sembra bloccare il traffico CalDAV che arriva da IP di data
 * center/cloud come quelli di Vercel (vedi PROJECT_STATUS.md, problema noto
 * #14). Il codice backend (`collegaCalendarioApple` in `azioni.ts`, tutto
 * `caldav.server.ts`, il ramo apple di `collegamenti.server.ts`) resta
 * intatto e funzionante per un eventuale riutilizzo futuro (es. se Apple
 * cambia policy, o dietro un proxy con IP non-datacenter) -- va solo
 * ricollegato qui a un form quando servirà di nuovo.
 */
export function PannelloCalendari({
  operatori,
  collegamenti,
}: {
  operatori: Operatore[];
  collegamenti: Collegamento[];
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [operatoreGoogleSelezionato, setOperatoreGoogleSelezionato] = useState("");

  const operatoriPerId = new Map(operatori.map((o) => [o.id, o.nome]));

  async function scollega(id: string) {
    setErrore(null);
    const risultato = await scollegaCalendarioAzione(id);
    if (risultato?.errore) setErrore(risultato.errore);
  }

  async function cambiaEsportazione(id: string, attiva: boolean) {
    setErrore(null);
    const risultato = await impostaEsportazioneAzione(id, attiva);
    if (risultato?.errore) setErrore(risultato.errore);
  }

  return (
    <div className="flex flex-col gap-8">
      {/* --- Calendari già collegati --- */}
      <section>
        <h2 className="text-base font-medium">Calendari collegati</h2>
        {collegamenti.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Nessun calendario personale collegato per ora.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {collegamenti.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{operatoriPerId.get(c.operatoreId) ?? "?"}</span>
                  {" · "}
                  {c.provider === "apple" ? "Apple/iCloud" : "Google"}
                  {c.stato === "errore" && (
                    <span className="ml-2 text-red-600">
                      ultimo tentativo fallito{c.ultimoErrore ? `: ${c.ultimoErrore}` : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {/* Solo Google: il ramo CalDAV non ha ancora la scrittura. */}
                  {c.provider === "google" && (
                    <label className="flex items-center gap-2 text-xs text-zinc-600">
                      <input
                        type="checkbox"
                        checked={c.esportaAppuntamenti}
                        onChange={(e) => cambiaEsportazione(c.id, e.target.checked)}
                      />
                      Scrivi qui gli appuntamenti del salone
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => scollega(c.id)}
                    className="rounded border border-zinc-300 px-3 py-1 text-xs"
                  >
                    Scollega
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {errore && <p className="text-sm text-red-600">{errore}</p>}

      {/* --- Google --- */}
      <section>
        <h2 className="text-base font-medium">Collega Google Calendar</h2>
        <p className="mt-1 text-sm text-zinc-600">
          L&apos;operatore autorizza l&apos;accesso al proprio calendario Google -- finché Google
          non ha completato la revisione dell&apos;app, funziona solo per gli account aggiunti
          come utenti di test nel progetto Google Cloud.
        </p>
        <div className="mt-3 flex items-end gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Operatore</label>
            <select
              value={operatoreGoogleSelezionato}
              onChange={(e) => setOperatoreGoogleSelezionato(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1"
            >
              <option value="">Scegli...</option>
              {operatori.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <a
            href={operatoreGoogleSelezionato ? `/api/calendario/google/connect?operatore_id=${operatoreGoogleSelezionato}` : undefined}
            aria-disabled={!operatoreGoogleSelezionato}
            className={
              operatoreGoogleSelezionato
                ? "rounded bg-black px-4 py-2 text-xs font-medium text-white"
                : "pointer-events-none rounded bg-black px-4 py-2 text-xs font-medium text-white opacity-40"
            }
          >
            Collega Google
          </a>
        </div>
      </section>
    </div>
  );
}
