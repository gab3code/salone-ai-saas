"use client";

import { useRef, useState } from "react";
import { useAllineamentoAlServer } from "@/lib/react/allineamento-al-server";
import { caricaMediaTenant, rimuoviMediaTenant } from "./azioni";
import { etichettaTipoMedia, validaFileMedia, type TipoMediaTenant } from "@/lib/storage/media-tenant";

interface PannelloMediaProps {
  tipo: TipoMediaTenant;
  urlIniziale: string | null;
  descrizione: string;
}

/** Un riquadro upload per logo/copertina. Stesso riquadro riusato due volte con `tipo` diverso
 * (vedi page.tsx): logica identica, cambia solo l'etichetta/colonna, non serve duplicare il
 * componente. */
export function PannelloMedia({ tipo, urlIniziale, descrizione }: PannelloMediaProps) {
  const [url, setUrl] = useState(urlIniziale);
  const [inCorso, setInCorso] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Allinearsi ai valori del server senza rimontarsi: `useState(prop)` legge la
   * prop solo al montaggio, quindi dopo un salvataggio il form mostrava ancora
   * il valore vecchio (difetto trovato su caparra e tono dell'AI il
   * 19/09/2026, poi cercato in tutti i pannelli). Vedi
   * `useAllineamentoAlServer`.
   */
  useAllineamentoAlServer({ url: urlIniziale }, () => {
    setUrl(urlIniziale);
  });

  async function alSelezionareFile(evento: React.ChangeEvent<HTMLInputElement>) {
    const file = evento.target.files?.[0];
    if (!file) return;

    const erroreValidazione = validaFileMedia(file);
    if (erroreValidazione) {
      setMessaggio({ tipo: "errore", testo: erroreValidazione });
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setInCorso(true);
    setMessaggio(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const risultato = await caricaMediaTenant(tipo, formData);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else if (risultato?.url) {
        setUrl(risultato.url);
        setMessaggio({ tipo: "ok", testo: `${etichettaTipoMedia(tipo)} aggiornato.` });
      }
    } finally {
      setInCorso(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function rimuovi() {
    setInCorso(true);
    setMessaggio(null);
    try {
      const risultato = await rimuoviMediaTenant(tipo);
      if (risultato?.errore) {
        setMessaggio({ tipo: "errore", testo: risultato.errore });
      } else {
        setUrl(null);
        setMessaggio({ tipo: "ok", testo: `${etichettaTipoMedia(tipo)} rimosso.` });
      }
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-medium">{etichettaTipoMedia(tipo)}</h2>
        <p className="mt-1 text-xs text-zinc-500">{descrizione}</p>
      </div>

      {url ? (
        // Immagine caricata su Supabase Storage (URL arbitrario, non whitelistabile in anticipo
        // per next/image) -- stesso pattern già usato in /s/[slug]/page.tsx.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${etichettaTipoMedia(tipo)} attuale`}
          className={
            tipo === "logo"
              ? "size-20 rounded-xl border border-zinc-200 object-cover"
              : "h-32 w-full rounded-xl border border-zinc-200 object-cover"
          }
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-zinc-300 text-xs text-zinc-400">
          Nessuna
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50">
          {inCorso ? "Carico..." : url ? "Sostituisci" : "Carica immagine"}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={alSelezionareFile}
            disabled={inCorso}
            className="hidden"
          />
        </label>
        {url && (
          <button
            type="button"
            onClick={rimuovi}
            disabled={inCorso}
            className="text-sm text-red-700 underline disabled:opacity-50"
          >
            Rimuovi
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-400">JPG, PNG o WebP, max 4MB.</p>

      {messaggio && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            messaggio.tipo === "ok"
              ? "border border-green-300 bg-green-50 text-green-800"
              : "border border-red-300 bg-red-50 text-red-800"
          }`}
        >
          {messaggio.testo}
        </p>
      )}
    </div>
  );
}
