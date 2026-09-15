"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Widget chat AI riutilizzabile per la pagina pubblica del salone (Fase 4,
 * punto 15) -- stessa logica di `src/app/prova-chat/[slug]/page.tsx` (Task
 * #66, banco di prova), qui estratta in un componente flottante vero e
 * proprio: bottone in basso a destra che apre/chiude il pannello, invece di
 * occupare una pagina intera.
 *
 * Renderizzato dalla pagina pubblica SOLO se `chatAiAttiva` (gate di piano,
 * vedi src/lib/pagina-pubblica.server.ts / src/lib/ai/limiti.ts) -- lo stesso
 * gate che l'endpoint `/api/chat/[slug]` applica comunque server-side, così
 * un tenant senza AI non mostra nemmeno il bottone invece di mostrarlo e
 * fallire al primo messaggio.
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
    // localStorage non disponibile (es. modalità privata): una sessione usa e getta va bene.
    return crypto.randomUUID();
  }
}

/**
 * Suggerimento iniziale (richiesta di Gabriel 15/09/2026): un visitatore che
 * non ha mai usato un sito con AI in chat non ha motivo di sapere, guardando
 * la sola icona, che può prenotare da lì E chiedere qualsiasi cosa
 * sull'attività -- non solo scrivere per un aiuto generico. Mostrato una
 * volta sola per browser (stessa logica "visto/non visto" già usata per
 * l'id di sessione qui sopra), non ad ogni caricamento della pagina.
 */
function suggerimentoGiaVisto(slug: string): boolean {
  try {
    return localStorage.getItem(`chat-suggerimento-visto-${slug}`) === "1";
  } catch {
    return true; // niente localStorage: meglio non insistere con qualcosa che non possiamo ricordare di aver già mostrato
  }
}

function segnaSuggerimentoVisto(slug: string) {
  try {
    localStorage.setItem(`chat-suggerimento-visto-${slug}`, "1");
  } catch {
    // ignorato: al massimo il suggerimento ricompare una volta di troppo, nessun impatto funzionale
  }
}

export default function ChatWidgetPubblico({
  slug,
  nomeAttivita,
  haInformazioniAttivita = false,
}: {
  slug: string;
  nomeAttivita: string;
  haInformazioniAttivita?: boolean;
}) {
  const [aperto, setAperto] = useState(false);
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [bozza, setBozza] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [trasferito, setTrasferito] = useState(false);
  const [suggerimentoAttivo, setSuggerimentoAttivo] = useState(false); // pallino sul pulsante
  const [suggerimentoVisibile, setSuggerimentoVisibile] = useState(false); // il fumetto vero e proprio
  const idSessioneRef = useRef<string>("");
  const fineListaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    idSessioneRef.current = ottieniIdentificatoreSessione(slug);
  }, [slug]);

  useEffect(() => {
    if (aperto) fineListaRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi, aperto]);

  useEffect(() => {
    if (suggerimentoGiaVisto(slug)) return;
    // setState solo dentro ai timeout, mai in modo sincrono nel corpo
    // dell'effect (regola react-hooks/set-state-in-effect) -- 0ms per il
    // pallino è comunque istantaneo per chi guarda la pagina.
    const attiva = setTimeout(() => setSuggerimentoAttivo(true), 0);
    const mostra = setTimeout(() => setSuggerimentoVisibile(true), 1500);
    const nascondi = setTimeout(() => setSuggerimentoVisibile(false), 11500); // auto-nascosto se ignorato, ma il pallino resta
    return () => {
      clearTimeout(attiva);
      clearTimeout(mostra);
      clearTimeout(nascondi);
    };
  }, [slug]);

  function chiudiSuggerimentoPerSempre() {
    segnaSuggerimentoVisto(slug);
    setSuggerimentoVisibile(false);
    setSuggerimentoAttivo(false);
  }

  function apriChat() {
    setAperto(true);
    if (suggerimentoAttivo) chiudiSuggerimentoPerSempre();
  }

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
      setErrore("Impossibile contattare il server, riprova tra poco.");
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {aperto && (
        <div className="flex h-[28rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">Chiedi a {nomeAttivita}</p>
              <p className="text-xs text-zinc-400">Risposta immediata, prenota anche da qui</p>
            </div>
            <button
              type="button"
              aria-label="Chiudi chat"
              onClick={() => setAperto(false)}
              className="flex size-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messaggi.length === 0 && (
              <p className="text-sm text-zinc-400">
                Scrivi qui per chiedere orari, prezzi o prenotare -- ti rispondo subito.
              </p>
            )}
            {messaggi.map((m, i) => (
              <div key={i} className={`flex ${m.ruolo === "cliente" ? "justify-end" : "justify-start"}`}>
                {/* whitespace-pre-wrap: senza questa classe il browser collassa gli
                   a capo reali del modello in un'unica riga -- trovato dal vivo
                   15/09/2026, vedi DECISIONS.md ("Che servizi offrite?" diventava
                   un unico paragrafo illeggibile anche se il testo dell'AI aveva
                   già gli a capo giusti). */}
                <p
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.ruolo === "cliente" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
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
            <p className="mx-3 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              La conversazione è stata passata a un operatore umano.
            </p>
          )}
          {errore && <p className="mx-3 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{errore}</p>}

          <form
            className="flex gap-2 border-t border-zinc-100 p-2.5"
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
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              disabled={inCorso}
            />
            <button
              type="submit"
              disabled={inCorso || !bozza.trim()}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Invia
            </button>
          </form>
        </div>
      )}

      {!aperto && suggerimentoVisibile && (
        <div className="relative max-w-[15rem] rounded-2xl border border-zinc-200 bg-white px-4 py-3 pr-8 text-sm text-zinc-700 shadow-xl">
          <button
            type="button"
            aria-label="Chiudi suggerimento"
            onClick={chiudiSuggerimentoPerSempre}
            className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <button type="button" onClick={apriChat} className="text-left">
            👋 Puoi prenotare subito qui, oppure chiedimi{" "}
            {haInformazioniAttivita ? `quello che vuoi su ${nomeAttivita}: orari, prezzi, parcheggio e altro.` : "orari, prezzi e disponibilità dei nostri servizi."}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => (aperto ? setAperto(false) : apriChat())}
        aria-label={aperto ? "Chiudi chat" : "Apri chat"}
        className="relative flex size-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform hover:scale-105"
      >
        {suggerimentoAttivo && !aperto && (
          <span className="absolute right-0.5 top-0.5 flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
          </span>
        )}
        {aperto ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}
      </button>
    </div>
  );
}
