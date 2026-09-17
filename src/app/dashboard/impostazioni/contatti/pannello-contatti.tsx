"use client";

import { useMemo, useState } from "react";
import { aggiornaContatti } from "./azioni";
import { istruzioniContatto, linkWhatsapp } from "@/lib/contatti";

/**
 * Recapiti dell'attività, con anteprima dal vivo di cosa dirà l'assistente.
 *
 * L'anteprima non è decorazione: questi due campi finiscono dentro una frase
 * che l'AI dice a un cliente vero, e senza vederla scritta è impossibile
 * accorgersi che il numero è sbagliato o che si sta offrendo un WhatsApp
 * che nessuno guarda. Usa la stessa `istruzioniContatto` del prompt
 * (src/lib/contatti.ts), non una copia -- l'anteprima mostra la frase vera,
 * non una che le somiglia.
 */
export function PannelloContatti({
  telefonoIniziale,
  whatsappIniziale,
}: {
  telefonoIniziale: string;
  whatsappIniziale: string;
}) {
  const [telefono, setTelefono] = useState(telefonoIniziale);
  const [whatsapp, setWhatsapp] = useState(whatsappIniziale);
  // Acceso di partenza quando i due campi coincidono già: è il caso più
  // comune (la stragrande maggioranza dei saloni ha un numero solo) e
  // ritrovarlo spuntato spiega da sé a cosa serve.
  const [stessoNumero, setStessoNumero] = useState(
    whatsappIniziale.trim() !== "" && whatsappIniziale.trim() === telefonoIniziale.trim()
  );
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  const whatsappEffettivo = stessoNumero ? telefono : whatsapp;

  const anteprima = useMemo(
    () => istruzioniContatto({ telefono: telefono || null, telefonoWhatsapp: whatsappEffettivo || null }),
    [telefono, whatsappEffettivo]
  );
  const link = useMemo(() => linkWhatsapp(whatsappEffettivo || null), [whatsappEffettivo]);

  async function salva(formData: FormData) {
    // Con "stesso numero" spuntato il campo WhatsApp è disabilitato, e un
    // input disabilitato non entra nel FormData: si scrive a mano, altrimenti
    // salvare cancellerebbe il numero invece di copiarlo.
    if (stessoNumero) formData.set("telefono_whatsapp", telefono);

    setInCorso(true);
    setEsito(null);
    try {
      const risultato = await aggiornaContatti(formData);
      if (risultato?.errore) setEsito({ tipo: "errore", testo: risultato.errore });
      else setEsito({ tipo: "ok", testo: "Contatti salvati." });
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form action={salva} className="flex max-w-lg flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <label className="flex flex-col gap-1 text-sm">
        Telefono
        <input
          type="tel"
          name="telefono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Es. 02 1234567"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <span className="text-xs text-zinc-400">
          È anche il numero mostrato sulla tua pagina pubblica e a chi prova a cancellare troppo tardi.
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
        <input
          type="checkbox"
          checked={stessoNumero}
          onChange={(e) => setStessoNumero(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span className="flex flex-col text-sm">
          <span className="font-medium text-zinc-900">Su WhatsApp uso lo stesso numero</span>
          <span className="text-xs text-zinc-500">Quasi sempre è così. Togli la spunta se hai due numeri diversi.</span>
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        WhatsApp (facoltativo)
        <input
          type="tel"
          name="telefono_whatsapp"
          value={whatsappEffettivo}
          disabled={stessoNumero}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="Es. 333 1234567"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-500"
        />
        <span className="text-xs text-zinc-400">
          Lascia vuoto se non vuoi che i clienti ti scrivano su WhatsApp: l&apos;assistente non lo proporrà.
        </span>
      </label>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5">
        <p className="text-xs font-medium text-zinc-500">
          Quando l&apos;assistente non sa rispondere, dirà al cliente:
        </p>
        {anteprima ? (
          <p className="mt-1 text-sm text-zinc-800">
            «Su questo non posso aiutarti io: ti conviene {anteprima}.»
          </p>
        ) : (
          <p className="mt-1 text-sm text-amber-800">
            Senza nessun recapito può solo dire «contatta l&apos;attività direttamente», che è vago e fa perdere
            il cliente. Compila almeno il telefono.
          </p>
        )}
        {link && (
          <p className="mt-2 text-xs text-zinc-500">
            Link WhatsApp che riceverà: <span className="font-mono text-zinc-700">{link}</span>
          </p>
        )}
      </div>

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
            esito.tipo === "ok"
              ? "border border-green-300 bg-green-50 text-green-800"
              : "border border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {esito.testo}
        </p>
      )}
    </form>
  );
}
