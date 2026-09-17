"use client";

import { useMemo, useState } from "react";
import { aggiornaFollowUpInattivi } from "./azioni";
import {
  comporreMessaggioFollowUp,
  GIORNI_INATTIVITA_MAX,
  GIORNI_INATTIVITA_MIN,
  GIORNI_RIPETIZIONE_PROMEMORIA_INATTIVITA,
  LUNGHEZZA_MASSIMA_MESSAGGIO_FOLLOW_UP,
  MESSAGGIO_FOLLOW_UP_PREDEFINITO,
  finestraRipetizioneGiorni,
} from "@/lib/promemoria";

/** Nome di esempio solo per l'anteprima -- mai inviato a nessuno. */
const NOME_ESEMPIO = "Giulia";

/**
 * Follow-up ai clienti spariti: l'altra metà di "Promemoria automatici".
 *
 * Fino al 17/09/2026 partiva da sola, ogni notte, a 60 giorni esatti e con
 * un testo scritto nel codice -- l'ultima notifica del prodotto che il
 * salone non poteva né spegnere né toccare. Era anche l'unica che parte di
 * nostra iniziativa verso una persona che non ha chiesto niente, quindi
 * proprio quella che il titolare deve poter governare.
 *
 * Due cose sono dette a schermo e non solo nel codice, perché cambiano cosa
 * ci si aspetta dal prodotto:
 *  - la soglia governa ANCHE la card della dashboard e il filtro della
 *    rubrica, non solo l'invio;
 *  - allo stesso cliente non si riscrive più di una volta ogni 60 giorni,
 *    anche abbassando la soglia.
 */
export function PannelloFollowUp({
  attivoIniziale,
  giorniIniziali,
  messaggioIniziale,
}: {
  attivoIniziale: boolean;
  giorniIniziali: number;
  messaggioIniziale: string;
}) {
  const [attivo, setAttivo] = useState(attivoIniziale);
  const [giorni, setGiorni] = useState(String(giorniIniziali));
  const [messaggio, setMessaggio] = useState(messaggioIniziale);
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  const anteprima = useMemo(
    () => comporreMessaggioFollowUp(messaggio || null, NOME_ESEMPIO),
    [messaggio]
  );

  const giorniNumero = Number(giorni);
  const giorniValidi =
    Number.isInteger(giorniNumero) &&
    giorniNumero >= GIORNI_INATTIVITA_MIN &&
    giorniNumero <= GIORNI_INATTIVITA_MAX;
  const finestra = giorniValidi
    ? finestraRipetizioneGiorni(giorniNumero)
    : GIORNI_RIPETIZIONE_PROMEMORIA_INATTIVITA;

  async function salva(formData: FormData) {
    setInCorso(true);
    setEsito(null);
    try {
      const risultato = await aggiornaFollowUpInattivi(formData);
      if (risultato?.errore) setEsito({ tipo: "errore", testo: risultato.errore });
      else setEsito({ tipo: "ok", testo: "Follow-up salvato." });
    } finally {
      setInCorso(false);
    }
  }

  return (
    <form action={salva} className="flex max-w-lg flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-medium text-zinc-900">Clienti da recuperare</h2>
        <p className="text-xs text-zinc-500">
          Un messaggio a chi non prenota da un po&apos;, per farlo tornare.
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
        <input
          type="checkbox"
          name="attivo"
          checked={attivo}
          onChange={(e) => setAttivo(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span className="flex flex-col text-sm">
          <span className="font-medium text-zinc-900">Manda il messaggio automaticamente</span>
          <span className="text-xs text-zinc-500">
            Spegnilo se preferisci ricontattarli tu: l&apos;elenco resta comunque in dashboard.
          </span>
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Dopo quanti giorni senza prenotare
        <input
          type="number"
          name="giorni"
          min={GIORNI_INATTIVITA_MIN}
          max={GIORNI_INATTIVITA_MAX}
          step={1}
          value={giorni}
          onChange={(e) => setGiorni(e.target.value)}
          className="w-32 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <span className="text-xs text-zinc-400">
          Da {GIORNI_INATTIVITA_MIN} a {GIORNI_INATTIVITA_MAX}. È anche il numero che vedi nella card
          &quot;non prenotano da...&quot; della dashboard e nel filtro della rubrica: sono la stessa cosa.
        </span>
      </label>

      <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        Allo stesso cliente non riscriviamo più di una volta ogni <strong>{finestra} giorni</strong>, anche
        se abbassi la soglia qui sopra.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Messaggio (facoltativo, max {LUNGHEZZA_MASSIMA_MESSAGGIO_FOLLOW_UP} caratteri)
        <textarea
          name="messaggio"
          value={messaggio}
          maxLength={LUNGHEZZA_MASSIMA_MESSAGGIO_FOLLOW_UP}
          onChange={(e) => setMessaggio(e.target.value)}
          rows={3}
          placeholder={MESSAGGIO_FOLLOW_UP_PREDEFINITO}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <span className="text-xs text-zinc-400">
          Usa <code className="rounded bg-zinc-100 px-1">{"{nome}"}</code> per il nome del cliente. Lascia
          vuoto per il testo predefinito.
        </span>
      </label>

      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2.5">
        <p className="text-xs font-medium text-zinc-500">Anteprima (a {NOME_ESEMPIO})</p>
        <p className="mt-1 text-sm text-zinc-800">{anteprima}</p>
        <p className="mt-2 text-xs text-zinc-400">
          Chi ha lasciato l&apos;email lo riceve per email, con il link per riprenotare. Agli altri arriva
          per SMS, sui piani che lo includono.
        </p>
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
