"use client";

import { useState } from "react";

/**
 * Riquadro "condividi la tua pagina" (Fase 4 di PIANO.md, richiesta di
 * Gabriel 15/09/2026): prima di oggi lo slug della pagina pubblica era solo
 * testo grezzo nella scheda riepilogo ("Slug pagina pubblica: xyz"), niente
 * link cliccabile, niente modo di copiarlo o di ottenerne un QR code --
 * inutilizzabile per incollarlo nel campo "sito web" di un profilo Google
 * Business o nella bio Instagram, o per condividerlo come immagine in una
 * storia/post.
 *
 * QR generato SERVER-SIDE (vedi `src/lib/qrcode.server.ts`) e passato già
 * pronto come data URL: questo componente client si occupa solo delle due
 * interazioni che richiedono davvero il browser (clipboard, download),
 * niente libreria QR nel bundle client.
 */
export function CondividiLink({ url, qrDataUrl, nomeFile }: { url: string; qrDataUrl: string; nomeFile: string }) {
  const [copiato, setCopiato] = useState(false);

  async function copiaLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      // Clipboard non disponibile (permesso negato, contesto non sicuro): il
      // link resta comunque selezionabile a mano nel campo qui sotto, nessun
      // errore da mostrare per qualcosa che non blocca l'uso del riquadro.
    }
  }

  return (
    <div className="mt-8 max-w-md rounded-lg border border-zinc-200 p-4">
      <h2 className="text-sm font-medium text-zinc-900">Condividi la tua pagina</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Incolla il link sul tuo profilo Google Business o nella bio Instagram, oppure condividi il
        QR code come storia, post o stampato in negozio.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-700"
        />
        <button
          type="button"
          onClick={copiaLink}
          className="shrink-0 rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
        >
          {copiato ? "Copiato!" : "Copia"}
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL generato al volo lato server, non un asset statico ottimizzabile da next/image */}
        <img src={qrDataUrl} alt={`QR code per ${url}`} width={96} height={96} className="rounded border border-zinc-200" />
        <a
          href={qrDataUrl}
          download={`${nomeFile}.png`}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
        >
          Scarica QR code
        </a>
      </div>
    </div>
  );
}
