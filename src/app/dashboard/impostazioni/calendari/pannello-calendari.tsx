"use client";

import { useState } from "react";
import { collegaCalendarioApple, scollegaCalendarioAzione } from "./azioni";

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
}

/**
 * UI di collegamento calendari personali (Fase 6bis). Apple/iCloud è
 * funzionante da subito (CalDAV, nessuna revisione esterna); Google Calendar
 * è mostrato ma disabilitato finché l'OAuth non è pronto (vedi PIANO.md) --
 * niente pulsante che promette qualcosa che non fa ancora nulla.
 */
export function PannelloCalendari({
  operatori,
  collegamenti,
}: {
  operatori: Operatore[];
  collegamenti: Collegamento[];
}) {
  const [errore, setErrore] = useState<string | null>(null);
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [operatoreGoogleSelezionato, setOperatoreGoogleSelezionato] = useState("");

  const operatoriPerId = new Map(operatori.map((o) => [o.id, o.nome]));

  async function inviaCollegamento(formData: FormData) {
    setInvioInCorso(true);
    setErrore(null);
    const risultato = await collegaCalendarioApple(formData);
    setInvioInCorso(false);
    if (risultato?.errore) setErrore(risultato.errore);
  }

  async function scollega(id: string) {
    setErrore(null);
    const risultato = await scollegaCalendarioAzione(id);
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
                <button
                  type="button"
                  onClick={() => scollega(c.id)}
                  className="rounded border border-zinc-300 px-3 py-1 text-xs"
                >
                  Scollega
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Collega Apple/iCloud --- */}
      <section>
        <h2 className="text-base font-medium">Collega Apple/iCloud Calendar</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Serve una <strong>password specifica per l&apos;app</strong> (non la password del tuo
          Apple ID): si genera una volta sola su{" "}
          <a href="https://appleid.apple.com" target="_blank" rel="noreferrer" className="underline">
            appleid.apple.com
          </a>{" "}
          -&gt; Accesso e sicurezza -&gt; Password per le app.
        </p>
        <form action={inviaCollegamento} className="mt-3 flex flex-wrap items-end gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Operatore</label>
            <select name="operatore_id" required className="rounded border border-zinc-300 px-2 py-1">
              <option value="">Scegli...</option>
              {operatori.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Apple ID (email)</label>
            <input
              name="apple_id"
              type="email"
              required
              className="rounded border border-zinc-300 px-2 py-1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Password per l&apos;app</label>
            <input
              name="password_app"
              type="password"
              required
              className="rounded border border-zinc-300 px-2 py-1"
            />
          </div>
          <button
            type="submit"
            disabled={invioInCorso}
            className="rounded bg-black px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {invioInCorso ? "Verifico..." : "Collega"}
          </button>
        </form>
        {errore && <p className="mt-2 text-sm text-red-600">{errore}</p>}
      </section>

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
