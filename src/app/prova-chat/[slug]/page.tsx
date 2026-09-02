"use client";

import { use, useEffect, useRef, useState } from "react";

/**
 * Pagina di TEST manuale per la chat AI (Task #66) -- non è la pagina
 * pubblica del salone (Fase 4, punto 15, con branding/galleria/ecc.), solo
 * un banco di prova essenziale per verificare dal vivo che il loop
 * MESSAGGIO -> AI -> strumenti -> database -> risposta funzioni davvero
 * prima di vestirlo con l'interfaccia definitiva.
 */
interface Messaggio {
  ruolo: "cliente" | "assistente";
  contenuto: string;
}

function ottieniIdentificatoreSessione(slug: string): string {
  const chiave = `chat-sessione-${slug}`;
  try {
    const esistente = localStorage.getItem(chiave);
    if (esistente) return esistente;
    const nuovo = crypto.randomUUID();
    localStorage.setItem(chiave, nuovo);
    return nuovo;
  } catch {
    // localStorage non disponibile (es. modalità privata): una sessione usa e getta va bene per un test manuale.
    return crypto.randomUUID();
  }
}

export default function PaginaProvaChat({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [bozza, setBozza] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [trasferito, setTrasferito] = useState(false);
  const idSessioneRef = useRef<string>("");
  const fineListaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    idSessioneRef.current = ottieniIdentificatoreSessione(slug);
  }, [slug]);

  useEffect(() => {
    fineListaRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi]);

  async function inviaMessaggio() {
    const testo = bozza.trim();
    if (!testo || inCorso) return;
    setErrore(null);
    setBozza("");
    setMessaggi((prev) => [...prev, { ruolo: "cliente", contenuto: testo }]);
    setInCorso(true);

    try {
      const risposta = await fetch(`/api/chat/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messaggio: testo, identificatoreSessione: idSessioneRef.current }),
      });
      const corpo = await risposta.json();
      if (!risposta.ok) {
        setErrore(corpo.errore ?? "Errore sconosciuto.");
        return;
      }
      setMessaggi((prev) => [...prev, { ruolo: "assistente", contenuto: corpo.risposta }]);
      if (corpo.trasferitoAUmano) setTrasferito(true);
    } catch {
      setErrore("Impossibile contattare il server.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col p-6">
      <h1 className="text-lg font-semibold">Prova chat AI -- {slug}</h1>
      <p className="mb-4 text-xs text-zinc-500">
        Pagina di test manuale (non la pagina pubblica definitiva). La conversazione è persistita
        nel database con l&apos;identificatore di sessione salvato in questo browser.
      </p>

      <div className="flex-1 space-y-2 overflow-y-auto rounded border border-zinc-200 p-3">
        {messaggi.length === 0 && <p className="text-sm text-zinc-400">Scrivi un messaggio per iniziare.</p>}
        {messaggi.map((m, i) => (
          <div key={i} className={`flex ${m.ruolo === "cliente" ? "justify-end" : "justify-start"}`}>
            <p
              className={`max-w-[80%] rounded px-3 py-2 text-sm ${
                m.ruolo === "cliente" ? "bg-zinc-900 text-white" : "border border-zinc-200"
              }`}
            >
              {m.contenuto}
            </p>
          </div>
        ))}
        {inCorso && <p className="text-sm text-zinc-400">Sta scrivendo...</p>}
        <div ref={fineListaRef} />
      </div>

      {trasferito && (
        <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          La conversazione è stata passata a un operatore umano.
        </p>
      )}
      {errore && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{errore}</p>}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          inviaMessaggio();
        }}
      >
        <input
          type="text"
          value={bozza}
          onChange={(e) => setBozza(e.target.value)}
          placeholder="Scrivi un messaggio..."
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          disabled={inCorso}
        />
        <button
          type="submit"
          disabled={inCorso || !bozza.trim()}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Invia
        </button>
      </form>
    </div>
  );
}
