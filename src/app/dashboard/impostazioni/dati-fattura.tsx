"use client";

import { useState, useTransition } from "react";
import { salvaDatiFattura } from "./dati-fattura-azioni";

/**
 * I dati di consegna della fattura elettronica, sulla pagina
 * dell'abbonamento (17/09/2026).
 *
 * Non è un modulo obbligatorio, ed è una scelta ragionata: senza codice
 * destinatario la fattura si emette lo stesso con "0000000" e lo SdI la
 * deposita nel cassetto fiscale del cliente -- resta valida a tutti gli
 * effetti, ma chi la riceve deve andarsela a prendere lì invece di trovarla
 * nel suo gestionale, e va avvisato a parte. È una scomodità per lui, non un
 * impedimento per noi: bloccare un pagamento per questo sarebbe sproporzionato.
 *
 * Il riquadro si mostra solo a chi ha un piano a pagamento, e si fa notare
 * solo quando i dati mancano davvero.
 *
 * Componente client e non server apposta: il modulo valida il formato del
 * codice e della PEC, e un errore di validazione che sparisce senza dire
 * niente e' peggio di nessuna validazione -- l'utente riscriverebbe lo
 * stesso valore convinto di aver salvato. Il resto della pagina resta
 * server.
 */
export function DatiFattura({
  codiceDestinatario,
  pecFatturazione,
}: {
  codiceDestinatario: string | null;
  pecFatturazione: string | null;
}) {
  const mancano = !codiceDestinatario && !pecFatturazione;
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [inCorso, avviaTransizione] = useTransition();

  function invia(formData: FormData) {
    setErrore(null);
    setSalvato(false);
    avviaTransizione(async () => {
      const esito = await salvaDatiFattura(formData);
      if (esito?.errore) setErrore(esito.errore);
      else setSalvato(true);
    });
  }

  return (
    <section
      className={`max-w-md rounded border p-5 ${mancano ? "border-amber-300 bg-amber-50" : "border-zinc-200"}`}
    >
      <h2 className="text-sm font-medium text-zinc-500">Dati per la fattura elettronica</h2>
      {mancano ? (
        <p className="mt-2 text-sm text-amber-900">
          Senza uno di questi due la fattura ti arriva nel cassetto fiscale dell&apos;Agenzia delle
          Entrate invece che nel tuo gestionale. Se non li conosci, chiedili al tuo commercialista:
          li ha sottomano.
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">
          Le fatture vengono consegnate qui. Puoi cambiarli quando vuoi.
        </p>
      )}

      <form action={invia} className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Codice destinatario SDI
          <input
            type="text"
            name="codice_destinatario"
            defaultValue={codiceDestinatario ?? ""}
            placeholder="7 caratteri, es. ABCDEFG"
            maxLength={7}
            className="rounded border border-zinc-300 px-2 py-1 uppercase"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          oppure PEC
          <input
            type="email"
            name="pec_fatturazione"
            defaultValue={pecFatturazione ?? ""}
            placeholder="nome@pec.esempio.it"
            className="rounded border border-zinc-300 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={inCorso}
          className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {inCorso ? "Salvo..." : "Salva"}
        </button>
        {errore && <p className="text-sm text-red-600">{errore}</p>}
        {salvato && !errore && <p className="text-sm text-emerald-700">Salvato.</p>}
      </form>

      <p className="mt-3 text-xs text-zinc-400">
        Partita IVA e indirizzo di fatturazione si cambiano da &quot;Gestisci abbonamento&quot;, dove
        li tiene Stripe.
      </p>
    </section>
  );
}
