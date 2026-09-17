"use client";

import { useState } from "react";
import Link from "next/link";
import { aggiornaNotifiche } from "./azioni";
import {
  CANALI_CONFERMA_CLIENTE,
  ETICHETTA_CANALE_CONFERMA,
  SPIEGAZIONE_CANALE_CONFERMA,
  canaleConsentitoDalPiano,
  type CanaleConfermaCliente,
} from "@/lib/notifiche-prenotazione";

/**
 * Due blocchi separati, e la separazione è il punto: "non voglio più
 * un'email per ogni prenotazione" e "i miei clienti non devono ricevere
 * niente" sono due decisioni diverse che fino a oggi non si potevano
 * prendere affatto, e mescolarle in un unico interruttore avrebbe fatto
 * spegnere per sbaglio la cosa sbagliata.
 *
 * Le opzioni che il piano non include si VEDONO comunque, disattivate e con
 * il motivo scritto. Nasconderle farebbe sembrare il prodotto più povero di
 * quello che è, e chi sta valutando Pro ha diritto di sapere cosa ci
 * troverebbe -- stesso principio delle etichette "da Growth"/"da Pro"
 * aggiunte alla landing.
 */
export function PannelloNotifiche({
  piano,
  avvisaTitolareIniziale,
  canaleIniziale,
}: {
  piano: string;
  avvisaTitolareIniziale: boolean;
  canaleIniziale: CanaleConfermaCliente;
}) {
  const [avvisaTitolare, setAvvisaTitolare] = useState(avvisaTitolareIniziale);
  const [canale, setCanale] = useState<CanaleConfermaCliente>(canaleIniziale);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  async function salva(formData: FormData) {
    setInCorso(true);
    setEsito(null);
    try {
      const risultato = await aggiornaNotifiche(formData);
      if (risultato?.errore) setEsito({ tipo: "errore", testo: risultato.errore });
      else setEsito({ tipo: "ok", testo: "Notifiche salvate." });
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form action={salva} className="flex max-w-lg flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-900">Per te</h2>
          <p className="text-xs text-zinc-500">Quello che arriva sulla tua casella.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
          <input
            type="checkbox"
            name="avvisa_titolare"
            checked={avvisaTitolare}
            onChange={(e) => setAvvisaTitolare(e.target.checked)}
            className="mt-0.5 size-4"
          />
          <span className="flex flex-col text-sm">
            <span className="font-medium text-zinc-900">Avvisami a ogni nuova prenotazione</span>
            <span className="text-xs text-zinc-500">
              Un&apos;email per ogni appuntamento che entra, da qualunque canale. Spegnila se guardi già il
              calendario: le prenotazioni ci finiscono comunque.
            </span>
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-medium text-zinc-900">Per i tuoi clienti</h2>
          <p className="text-xs text-zinc-500">
            La conferma che ricevono subito dopo aver prenotato. Promemoria, auguri e richieste di recensione
            hanno le loro impostazioni.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {CANALI_CONFERMA_CLIENTE.map((opzione) => {
            const disponibile = canaleConsentitoDalPiano(opzione, piano);
            return (
              <label
                key={opzione}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                  disponibile
                    ? canale === opzione
                      ? "cursor-pointer border-zinc-900 bg-zinc-50"
                      : "cursor-pointer border-zinc-200"
                    : "border-zinc-200 bg-zinc-50 opacity-60"
                }`}
              >
                <input
                  type="radio"
                  name="conferma_cliente_canale"
                  value={opzione}
                  checked={canale === opzione}
                  disabled={!disponibile}
                  onChange={() => setCanale(opzione)}
                  className="mt-0.5 size-4"
                />
                <span className="flex flex-col text-sm">
                  <span className="font-medium text-zinc-900">{ETICHETTA_CANALE_CONFERMA[opzione]}</span>
                  <span className="text-xs text-zinc-500">{SPIEGAZIONE_CANALE_CONFERMA[opzione]}</span>
                  {!disponibile && (
                    <span className="mt-1 text-xs text-zinc-600">
                      Richiede l&apos;SMS, incluso dal piano Pro in su.{" "}
                      <Link href="/dashboard/abbonamento?piano=pro" className="underline">
                        Vedi Pro
                      </Link>
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>

        {canale === "nessuna" && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Senza conferma il cliente non riceve nemmeno il link per cancellare da solo: le disdette ti
            arriveranno per telefono.
          </p>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={inCorso}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {inCorso ? "Salvo..." : "Salva"}
        </button>
        {esito && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              esito.tipo === "ok"
                ? "border border-green-300 bg-green-50 text-green-800"
                : "border border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {esito.testo}
          </p>
        )}
      </div>
    </form>
  );
}
