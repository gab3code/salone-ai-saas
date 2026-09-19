"use client";

import { useState } from "react";
import { useAllineamentoAlServer } from "@/lib/react/allineamento-al-server";
import { alInvio } from "@/lib/react/invio-form";
import { aggiornaCaparra } from "./azioni";
import type { RegolaCaparra, TipoCaparra } from "@/lib/stripe/caparra";

interface ConfigurazioneCaparra {
  attiva: boolean;
  tipo: TipoCaparra;
  valore: number; // percentuale: 1-100; fisso: centesimi (convertito in euro solo per il campo del form)
  regola: RegolaCaparra;
  sogliaNoShow: number;
}

export function PannelloCaparra({ configurazioneIniziale }: { configurazioneIniziale: ConfigurazioneCaparra }) {
  const [attiva, setAttiva] = useState(configurazioneIniziale.attiva);
  const [tipo, setTipo] = useState<TipoCaparra>(configurazioneIniziale.tipo);
  const [valore, setValore] = useState<string>(
    configurazioneIniziale.tipo === "fisso"
      ? (configurazioneIniziale.valore / 100).toString()
      : configurazioneIniziale.valore.toString()
  );
  const [regola, setRegola] = useState<RegolaCaparra>(configurazioneIniziale.regola);
  const [soglia, setSoglia] = useState<string>(configurazioneIniziale.sogliaNoShow.toString());
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  /**
   * Allinearsi ai valori del server senza rimontarsi: il perche' e la storia
   * dei due difetti di fila (spunta che tornava blu, conferma verde che
   * spariva) stanno in `useAllineamentoAlServer`.
   */
  useAllineamentoAlServer(
    {
      attiva: configurazioneIniziale.attiva,
      tipo: configurazioneIniziale.tipo,
      valore: configurazioneIniziale.valore,
      regola: configurazioneIniziale.regola,
      sogliaNoShow: configurazioneIniziale.sogliaNoShow,
    },
    () => {
      setAttiva(configurazioneIniziale.attiva);
      setTipo(configurazioneIniziale.tipo);
      setRegola(configurazioneIniziale.regola);
      setSoglia(configurazioneIniziale.sogliaNoShow.toString());
      setValore(
        configurazioneIniziale.tipo === "fisso"
          ? (configurazioneIniziale.valore / 100).toString()
          : configurazioneIniziale.valore.toString()
      );
    }
  );

  async function salva(formData: FormData) {
    setInCorso(true);
    setMessaggio(null);
    try {
      const risultato = await aggiornaCaparra(formData);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        // NON "Impostazioni salvate", ma COSA e' stato salvato.
        //
        // Il 19/09/2026 Gabriel ha tolto la spunta, ha salvato, ha letto
        // "Impostazioni salvate" e si e' visto la spunta tornare blu. Un
        // messaggio che conferma senza dire cosa non aiuta a capire chi dei
        // due ha ragione. Questo lo dice, e siccome nasce da quello che
        // abbiamo appena mandato al server, non puo' contraddirlo.
        setMessaggio({
          tipo: "ok",
          testo: attiva
            ? `Caparra attiva: ${tipo === "percentuale" ? `${valore}% del prezzo` : `${valore}€ fissi`}, ${
                regola === "dopo_no_show"
                  ? `solo a chi ha saltato almeno ${soglia} ${soglia === "1" ? "appuntamento" : "appuntamenti"}`
                  : "a tutti"
              }.`
            : "Caparra disattivata: le prenotazioni online non richiedono piu' un anticipo.",
        });
      }
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form onSubmit={alInvio(salva)} className="flex max-w-md flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <label className="flex items-center gap-2 text-sm font-medium text-zinc-900">
        <input
          type="checkbox"
          name="attiva"
          checked={attiva}
          onChange={(e) => setAttiva(e.target.checked)}
          className="size-4 rounded border-zinc-300"
        />
        Richiedi una caparra per confermare le prenotazioni online
      </label>

      <div className={`flex flex-col gap-3 ${attiva ? "" : "opacity-50"}`}>
        <label className="flex flex-col gap-1 text-sm">
          Tipo
          <select
            name="tipo"
            value={tipo}
            disabled={!attiva}
            onChange={(e) => setTipo(e.target.value as TipoCaparra)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="percentuale">Percentuale del prezzo del servizio</option>
            <option value="fisso">Importo fisso</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          {tipo === "percentuale" ? "Percentuale (%)" : "Importo (€)"}
          <input
            type="number"
            name="valore"
            min={0}
            step={tipo === "percentuale" ? 1 : 0.5}
            value={valore}
            disabled={!attiva}
            onChange={(e) => setValore(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-zinc-400">
          {tipo === "percentuale"
            ? "Es. 20% su un servizio da 50€ richiede una caparra di 10€."
            : "Stesso importo per ogni servizio, indipendentemente dal prezzo."}
        </p>

        <label className="flex flex-col gap-1 text-sm">
          A chi chiederla
          <select
            name="regola"
            value={regola}
            disabled={!attiva}
            onChange={(e) => setRegola(e.target.value as RegolaCaparra)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          >
            <option value="tutti">A tutti, a ogni prenotazione online</option>
            <option value="dopo_no_show">Solo a chi ha già saltato un appuntamento</option>
          </select>
        </label>
        {regola === "dopo_no_show" && (
          <label className="flex flex-col gap-1 text-sm">
            Da quanti appuntamenti saltati in poi
            <input
              type="number"
              name="soglia"
              min={1}
              step={1}
              value={soglia}
              disabled={!attiva}
              onChange={(e) => setSoglia(e.target.value)}
              className="w-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
            <span className="text-xs text-zinc-400">
              Conta gli appuntamenti segnati come &laquo;non presentato&raquo; dal calendario. Un cliente nuovo
              non paga niente: la caparra scatta solo per chi ti ha già fatto perdere un posto.
            </span>
          </label>
        )}
      </div>

      <button
        type="submit"
        disabled={inCorso}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {inCorso ? "Salvo..." : "Salva"}
      </button>

      {messaggio && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            messaggio.tipo === "ok" ? "border border-green-300 bg-green-50 text-green-800" : "border border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {messaggio.testo}
        </p>
      )}
    </form>
  );
}
