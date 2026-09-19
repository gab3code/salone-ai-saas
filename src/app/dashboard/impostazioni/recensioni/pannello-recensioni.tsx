"use client";

import { useState } from "react";
import { useAllineamentoAlServer } from "@/lib/react/allineamento-al-server";
import { alInvio } from "@/lib/react/invio-form";
import { aggiornaToggleRecensioni, rispondiRecensione } from "./azioni";
import { LUNGHEZZA_MASSIMA_RISPOSTA_TITOLARE, type RecensioneMedia } from "@/lib/recensioni";
import type { RecensioneDashboard } from "@/lib/recensioni.server";

function Stelle({ valutazione }: { valutazione: number }) {
  return (
    <span className="text-amber-400" aria-label={`${valutazione} stelle su 5`}>
      {"★".repeat(valutazione)}
      <span className="text-zinc-200">{"★".repeat(5 - valutazione)}</span>
    </span>
  );
}

function formatoData(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function RigaRecensione({ recensione }: { recensione: RecensioneDashboard }) {
  const [rispostaAperta, setRispostaAperta] = useState(false);
  const [risposta, setRisposta] = useState(recensione.rispostaTitolare ?? "");
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);

  /**
   * Allinearsi al server senza rimontarsi (vedi `useAllineamentoAlServer`):
   * quando la risposta salvata cambia, il campo deve seguirla invece di
   * mostrare ancora quella di prima.
   */
  useAllineamentoAlServer({ risposta: recensione.rispostaTitolare ?? "" }, () => {
    setRisposta(recensione.rispostaTitolare ?? "");
  });

  async function salva() {
    setInCorso(true);
    setEsito(null);
    try {
      const risultato = await rispondiRecensione(recensione.id, risposta);
      if (risultato?.errore) {
        setEsito({ ok: false, testo: risultato.errore });
      } else {
        setEsito({ ok: true, testo: "Risposta salvata." });
        setRispostaAperta(false);
      }
    } finally {
      setInCorso(false);
    }
  }

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <Stelle valutazione={recensione.valutazione} />
        <span className="text-xs text-zinc-400">{formatoData(recensione.createdAt)}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {recensione.clienteNome ?? "Cliente"}
        {recensione.servizioNome ? ` -- ${recensione.servizioNome}` : ""}
      </p>
      {recensione.commento && <p className="mt-2 text-sm text-zinc-800">{recensione.commento}</p>}

      {recensione.rispostaTitolare && !rispostaAperta && (
        <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2">
          <p className="text-xs font-medium text-zinc-500">La tua risposta</p>
          <p className="mt-0.5 text-sm text-zinc-700">{recensione.rispostaTitolare}</p>
          <button type="button" onClick={() => setRispostaAperta(true)} className="mt-1 text-xs underline">
            Modifica risposta
          </button>
        </div>
      )}

      {!recensione.rispostaTitolare && !rispostaAperta && (
        <button type="button" onClick={() => setRispostaAperta(true)} className="mt-3 text-xs underline">
          Rispondi pubblicamente
        </button>
      )}

      {rispostaAperta && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={risposta}
            maxLength={LUNGHEZZA_MASSIMA_RISPOSTA_TITOLARE}
            onChange={(e) => setRisposta(e.target.value)}
            rows={2}
            placeholder="Rispondi pubblicamente a questa recensione..."
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={inCorso}
              onClick={salva}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {inCorso ? "Salvo..." : "Salva risposta"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRispostaAperta(false);
                setRisposta(recensione.rispostaTitolare ?? "");
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {esito && (
        <p className={`mt-2 text-xs ${esito.ok ? "text-green-700" : "text-red-600"}`}>{esito.testo}</p>
      )}
    </li>
  );
}

export function PannelloRecensioni({
  attivoIniziale,
  recensioni,
  media,
}: {
  attivoIniziale: boolean;
  recensioni: RecensioneDashboard[];
  media: RecensioneMedia;
}) {
  const [attivo, setAttivo] = useState(attivoIniziale);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  /** Allinearsi al server senza rimontarsi -- vedi `useAllineamentoAlServer`. */
  useAllineamentoAlServer({ attivo: attivoIniziale }, () => {
    setAttivo(attivoIniziale);
  });

  async function salvaToggle(formData: FormData) {
    setInCorso(true);
    setEsito(null);
    try {
      const risultato = await aggiornaToggleRecensioni(formData);
      setEsito(
        risultato?.errore ? { tipo: "errore", testo: risultato.errore } : { tipo: "ok", testo: "Impostazioni salvate." }
      );
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <form onSubmit={alInvio(salvaToggle)} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
          <input
            type="checkbox"
            name="attivo"
            checked={attivo}
            onChange={(e) => setAttivo(e.target.checked)}
            className="mt-0.5 size-4"
          />
          <span className="flex flex-col text-sm">
            <span className="font-medium text-zinc-900">Raccogli recensioni</span>
            <span className="text-xs text-zinc-500">
              Un solo interruttore per entrambe le cose: se lo spegni, non parte più nessuna nuova richiesta di
              recensione E la sezione recensioni sparisce dalla tua pagina pubblica (le recensioni già raccolte
              restano salvate, pronte a ricomparire se lo riaccendi).
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={inCorso}
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {inCorso ? "Salvo..." : "Salva"}
        </button>

        {esito && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              esito.tipo === "ok" ? "border border-green-300 bg-green-50 text-green-800" : "border border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {esito.testo}
          </p>
        )}
      </form>

      <div>
        <div className="mb-3 flex items-baseline gap-2">
          <h2 className="text-sm font-medium text-zinc-500">
            {media.totale > 0 ? `${media.media} su 5 (${media.totale} recensioni)` : "Nessuna recensione ancora"}
          </h2>
        </div>
        {recensioni.length > 0 && (
          <ul className="flex flex-col gap-3">
            {recensioni.map((r) => (
              <RigaRecensione key={r.id} recensione={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
