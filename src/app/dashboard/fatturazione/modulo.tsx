"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvaFatturazioneAction } from "./azioni";
import type { DatiFatturazione, ErroriFatturazione } from "@/lib/fatturazione";

/**
 * Il modulo dei dati di fatturazione, che si compila UNA volta prima del
 * primo pagamento e poi resta.
 *
 * Sta su una pagina nostra e non dentro la schermata di Stripe per un motivo
 * preciso: i campi personalizzati di Stripe Checkout si definiscono quando la
 * sessione viene creata, quindi non possono essere resi obbligatori in base a
 * quello che l'utente spunta, e non si possono riposizionare. Qui invece
 * sono obbligatori davvero, in ordine, e validati prima di prendere i soldi.
 *
 * In cambio la schermata di Stripe si accorcia: gli passiamo tutto già
 * compilato e a lui resta solo la carta.
 */
export function ModuloFatturazione({
  iniziali,
  piano,
  etichettaBottone,
}: {
  iniziali: DatiFatturazione;
  /** Quando c'è, dopo il salvataggio si va dritti al pagamento di quel piano. */
  piano: string | null;
  etichettaBottone?: string;
}) {
  const [dati, setDati] = useState<DatiFatturazione>(iniziali);
  const [errori, setErrori] = useState<ErroriFatturazione>({});
  const [erroreGenerale, setErroreGenerale] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [inCorso, avviaTransizione] = useTransition();
  const router = useRouter();

  function campo(nome: keyof DatiFatturazione) {
    return {
      value: dati[nome],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setDati((precedenti) => ({ ...precedenti, [nome]: e.target.value })),
    };
  }

  function invia(e: React.FormEvent) {
    e.preventDefault();
    setErrori({});
    setErroreGenerale(null);
    setSalvato(false);
    avviaTransizione(async () => {
      const esito = await salvaFatturazioneAction(dati);
      if ("errori" in esito && esito.errori) {
        setErrori(esito.errori);
        return;
      }
      if ("errore" in esito && esito.errore) {
        setErroreGenerale(esito.errore);
        return;
      }
      setSalvato(true);

      if (!piano) {
        router.refresh();
        return;
      }

      // Si era qui per pagare: si va a Stripe subito, senza rimbalzare per
      // la dashboard. Il rimbalzo era il motivo per cui si vedeva lampeggiare
      // la home prima del pagamento -- la decisione veniva presa dal browser
      // a pagina già disegnata.
      const risposta = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ piano }),
      });
      const corpo = await risposta.json();
      if (risposta.ok && corpo.url) {
        window.location.href = corpo.url;
        return;
      }
      setErroreGenerale(
        corpo.errore ?? "Dati salvati, ma il pagamento non è partito. Riprova fra un momento."
      );
    });
  }

  return (
    <form onSubmit={invia} className="flex max-w-xl flex-col gap-4">
      <Campo etichetta="Ragione sociale" errore={errori.denominazione}>
        <input
          {...campo("denominazione")}
          placeholder="Il nome con cui sei registrato, non l'insegna"
          className="w-full rounded border border-zinc-300 px-2 py-1.5"
        />
      </Campo>

      <Campo etichetta="Partita IVA" errore={errori.partitaIva}>
        <input
          {...campo("partitaIva")}
          placeholder="11 cifre, senza IT davanti"
          inputMode="numeric"
          className="w-full rounded border border-zinc-300 px-2 py-1.5"
        />
      </Campo>

      <Campo etichetta="Indirizzo della sede, via e numero civico" errore={errori.via}>
        <input {...campo("via")} className="w-full rounded border border-zinc-300 px-2 py-1.5" />
      </Campo>

      <div className="grid grid-cols-[100px_1fr_80px] gap-2">
        <Campo etichetta="CAP" errore={errori.cap}>
          <input
            {...campo("cap")}
            inputMode="numeric"
            maxLength={5}
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </Campo>
        <Campo etichetta="Comune" errore={errori.comune}>
          <input {...campo("comune")} className="w-full rounded border border-zinc-300 px-2 py-1.5" />
        </Campo>
        <Campo etichetta="Provincia" errore={errori.provincia}>
          <input
            {...campo("provincia")}
            maxLength={2}
            placeholder="BG"
            className="w-full rounded border border-zinc-300 px-2 py-1.5 uppercase"
          />
        </Campo>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-sm font-medium text-zinc-700">Dove vuoi ricevere la fattura</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Basta compilarne uno dei due: sono i recapiti che il tuo gestionale o il tuo
          commercialista usano per farsi arrivare le fatture elettroniche. Se non sai quali sono,
          chiediglieli — oppure scrivi <strong>0000000</strong> nel codice: la fattura finirà nel
          tuo cassetto fiscale sul sito dell&apos;Agenzia delle Entrate, dove puoi scaricarla, ed è
          valida allo stesso modo.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <Campo etichetta="Codice destinatario" errore={errori.codiceDestinatario}>
            <input
              {...campo("codiceDestinatario")}
              maxLength={7}
              placeholder="7 caratteri, lettere e numeri"
              className="w-full rounded border border-zinc-300 px-2 py-1.5 uppercase"
            />
          </Campo>
          <Campo etichetta="Oppure la PEC" errore={errori.pec}>
            <input
              {...campo("pec")}
              type="email"
              placeholder="nome@pec.esempio.it"
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
            />
          </Campo>
        </div>
      </div>

      {erroreGenerale && <p className="text-sm text-red-600">{erroreGenerale}</p>}
      {salvato && !piano && <p className="text-sm text-emerald-700">Salvato.</p>}

      <button
        type="submit"
        disabled={inCorso}
        className="self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {inCorso
          ? piano
            ? "Un momento..."
            : "Salvo..."
          : (etichettaBottone ?? (piano ? "Salva e vai al pagamento" : "Salva"))}
      </button>
    </form>
  );
}

function Campo({
  etichetta,
  errore,
  children,
}: {
  etichetta: string;
  errore?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-zinc-700">{etichetta}</span>
      {children}
      {errore && <span className="text-xs text-red-600">{errore}</span>}
    </label>
  );
}
