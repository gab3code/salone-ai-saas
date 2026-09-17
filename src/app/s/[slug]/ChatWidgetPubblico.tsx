"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { linkWhatsapp } from "@/lib/contatti";

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

// Un URL grezzo (es. il link di pagamento Stripe della caparra, 150+
// caratteri col fingerprint della sessione) è illeggibile se mostrato per
// intero -- richiesta di Gabriel dal vivo 15/09/2026, dopo aver visto
// esattamente questo caso in chat: "non dare il link intero, dallo blu
// cliccabile". Il testo dell'AI resta comunque testo semplice (mai markdown,
// regola 9 del system prompt in agente.ts): qui si riconosce un URL "a
// occhio nudo" con una regex e lo si sostituisce SOLO nella resa a schermo
// con un link vero (breve, blu, cliccabile) che punta all'URL reale --
// l'AI continua a scrivere l'URL per esteso, la trasformazione è solo
// visiva.
const REGEX_URL = /(https?:\/\/[^\s]+)/g;
// Punteggiatura finale che può restare "attaccata" a un URL scritto a fine
// frase (es. "...paga qui: https://esempio.it."): va staccata dal link vero
// e mostrata come testo normale subito dopo, altrimenti il punto finirebbe
// dentro l'href e/o dentro l'etichetta cliccabile.
const REGEX_PUNTEGGIATURA_FINALE = /[.,;:!?)\]}'"]+$/;

// Numeri di telefono italiani (richiesta di Gabriel 15/09/2026, stesso giro
// del fix "chiama il negozio": ora che l'AI invita sempre a chiamare, il
// numero scritto in chiaro dev'essere cliccabile e blu come un link, non
// testo semplice da ricopiare a mano su un altro telefono). Riconosce solo
// i due prefissi reali dei numeri italiani -- fisso (0xx...) o cellulare
// (3xx...), con o senza prefisso internazionale +39 -- apposta invece di
// "qualunque sequenza di cifre", altrimenti si rischia di trasformare in
// link anche date (15/09/2026) o prezzi (150.00 - 200.00) che condividono
// gli stessi separatori. `(?<!\d)`/`(?!\d)` evitano di agganciare solo un
// pezzo di un numero più lungo (o di due numeri scritti vicini).
const REGEX_TELEFONO =
  /(?<!\d)((?:\+39[\s]?)?(?:0\d{1,3}[\s./-]?\d{5,8}|3\d{2}[\s./-]?\d{6,7}))(?!\d)/g;

/**
 * Quanto testo guardare, prima di un numero, per capire se è un WhatsApp.
 * Trenta caratteri coprono "scrivere su WhatsApp al " con margine e non
 * arrivano alla frase precedente -- che è il punto: in "chiamare il
 * 02 1234567 oppure scrivere su WhatsApp al 333 1234567" il PRIMO numero non
 * deve diventare un link WhatsApp solo perché la parola compare più avanti.
 */
const FINESTRA_INDIZIO_WHATSAPP = 30;

function precedutoDaWhatsapp(testoPrima: string): boolean {
  return /whatsapp/i.test(testoPrima.slice(-FINESTRA_INDIZIO_WHATSAPP));
}

/**
 * Applica REGEX_TELEFONO a un pezzo di testo che NON è già un URL (vedi
 * formattaTestoConLink) e trasforma ogni numero trovato in un link toccabile,
 * blu e sottolineato come il link generico.
 *
 * DOVE PORTA (17/09/2026): `tel:` normalmente, `wa.me` quando il numero è
 * introdotto dalla parola WhatsApp. Da oggi l'assistente, quando non sa
 * risolvere qualcosa, dice di chiamare o di scrivere su WhatsApp (REGOLA
 * ASSOLUTA 8 in ai/agente.ts, recapiti dalla pagina impostazioni
 * "Contatti"): se il numero WhatsApp aprisse il tastierino del telefono,
 * metà della funzione non servirebbe a niente -- chi scrive alle 23 vuole
 * scrivere, non telefonare.
 *
 * L'href `tel:` porta solo cifre e "+"; quello WhatsApp passa da
 * `linkWhatsapp`, che aggiunge il prefisso italiano quando manca -- la
 * stessa funzione dell'anteprima nelle impostazioni, mai una seconda copia
 * della regola.
 */
function formattaTelefoni(testo: string, chiavePrefisso: string): ReactNode[] {
  const pezzi = testo.split(REGEX_TELEFONO);
  const risultato: ReactNode[] = [];
  pezzi.forEach((pezzo, j) => {
    if (j % 2 === 0) {
      if (pezzo) risultato.push(pezzo);
      return;
    }
    const linkWa = precedutoDaWhatsapp(pezzi[j - 1] ?? "") ? linkWhatsapp(pezzo) : null;
    risultato.push(
      <a
        key={`${chiavePrefisso}-tel-${j}`}
        href={linkWa ?? `tel:${pezzo.replace(/[^\d+]/g, "")}`}
        {...(linkWa ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="font-medium text-blue-600 underline underline-offset-2"
      >
        {pezzo}
      </a>
    );
  });
  return risultato;
}

// Esportata solo per il test unitario (formattaTestoConLink.test.tsx) --
// resta comunque un dettaglio interno del widget, non è usata altrove.
export function formattaTestoConLink(testo: string): ReactNode[] {
  const pezzi = testo.split(REGEX_URL);
  const risultato: ReactNode[] = [];
  pezzi.forEach((pezzo, i) => {
    // Le catture di `split` con un gruppo finiscono sempre agli indici
    // dispari -- questo pezzo è quindi sempre un URL, mai testo normale.
    if (i % 2 === 0) {
      if (pezzo) risultato.push(...formattaTelefoni(pezzo, `${i}`));
      return;
    }
    const coda = pezzo.match(REGEX_PUNTEGGIATURA_FINALE)?.[0] ?? "";
    const url = coda ? pezzo.slice(0, -coda.length) : pezzo;
    risultato.push(
      <a
        key={i}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-blue-600 underline underline-offset-2"
      >
        Apri il link
      </a>
    );
    if (coda) risultato.push(coda);
  });
  return risultato;
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
 *
 * Versione rivista lo stesso giorno dopo il primo giro dal vivo di Gabriel:
 * niente pallino animato né una X da chiudere -- deve far scoprire che l'AI
 * c'è, non spingere a usarla (ogni prenotazione fatta in chat ha un costo
 * AI in più per il titolare rispetto a una prenotazione manuale). Resta un
 * fumetto con emoji/colore, ma compare e sparisce da solo: nessuna azione
 * richiesta al cliente per farlo andare via.
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
  const [suggerimentoMontato, setSuggerimentoMontato] = useState(false); // il fumetto è nel DOM
  const [suggerimentoVisibile, setSuggerimentoVisibile] = useState(false); // classe per la dissolvenza in entrata/uscita
  const idSessioneRef = useRef<string>("");
  const fineListaRef = useRef<HTMLDivElement>(null);
  const timerSuggerimentoRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function pulisciTimerSuggerimento() {
    timerSuggerimentoRef.current.forEach(clearTimeout);
    timerSuggerimentoRef.current = [];
  }

  useEffect(() => {
    idSessioneRef.current = ottieniIdentificatoreSessione(slug);
  }, [slug]);

  useEffect(() => {
    if (aperto) fineListaRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messaggi, aperto]);

  useEffect(() => {
    if (suggerimentoGiaVisto(slug)) return;
    const RITARDO_COMPARSA = 1500;
    const DURATA_VISIBILE = 7000;
    const DURATA_DISSOLVENZA = 300;
    timerSuggerimentoRef.current.push(
      setTimeout(() => {
        setSuggerimentoMontato(true);
        // un frame dopo il mount, per far partire davvero la transizione
        // CSS invece di comparire di scatto già all'opacità finale.
        requestAnimationFrame(() => setSuggerimentoVisibile(true));
      }, RITARDO_COMPARSA)
    );
    timerSuggerimentoRef.current.push(setTimeout(() => setSuggerimentoVisibile(false), RITARDO_COMPARSA + DURATA_VISIBILE));
    timerSuggerimentoRef.current.push(
      setTimeout(() => {
        setSuggerimentoMontato(false);
        segnaSuggerimentoVisto(slug); // sparito da solo: non deve ricomparire in questo browser
      }, RITARDO_COMPARSA + DURATA_VISIBILE + DURATA_DISSOLVENZA)
    );
    return pulisciTimerSuggerimento;
  }, [slug]);

  /**
   * Un click sul fumetto lo chiude e basta -- NON apre la chat (richiesta di
   * Gabriel 15/09/2026: il fumetto deve solo far scoprire che l'AI c'è, chi
   * vuole usarla deve comunque schiacciare il pulsante vero, altrimenti un
   * click "distratto" per liberarsi del fumetto aprirebbe la chat per
   * sbaglio).
   */
  function chiudiSuggerimento() {
    pulisciTimerSuggerimento();
    setSuggerimentoVisibile(false);
    segnaSuggerimentoVisto(slug);
    timerSuggerimentoRef.current.push(setTimeout(() => setSuggerimentoMontato(false), 300));
  }

  function apriChat() {
    setAperto(true);
    if (suggerimentoMontato) {
      pulisciTimerSuggerimento();
      setSuggerimentoVisibile(false);
      setSuggerimentoMontato(false);
      segnaSuggerimentoVisto(slug);
    }
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
    <>
      {/* Sfondo leggermente sfocato dietro il pannello quando la chat è
         aperta (richiesta di Gabriel 15/09/2026, "per apparire più carino") --
         z-40, sotto il widget (z-50) ma sopra il resto della pagina. Un tap
         fuori dal pannello chiude la chat, comportamento standard per un
         overlay di questo tipo. */}
      {aperto && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm"
          aria-hidden="true"
          onClick={() => setAperto(false)}
        />
      )}
      <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
        {aperto && (
          // Larghezza: su mobile riempie lo spazio fino a un margine di 1rem per
          // lato (calc(100vw-2rem)) invece di un min() con un tetto fisso in
          // rem -- con il tetto fisso, su quasi ogni telefono reale (>368px di
          // larghezza) il pannello smette di seguire la viewport e i margini
          // sinistro/destro si sbilanciano, perché il contenitore è ancorato
          // solo a destra (right-4/right-6) e la larghezza non "consuma" più
          // tutto lo spazio disponibile in modo simmetrico. Trovato dal vivo da
          // Gabriel 15/09/2026 (pannello non centrato su telefono), vedi
          // DECISIONS.md. Dal breakpoint sm in su resta la larghezza fissa di
          // prima (22rem), dove il margine asimmetrico è trascurabile e un
          // pannello troppo largo su schermi grandi non serve.
          <div className="flex h-[28rem] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl sm:w-[22rem]">
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
                     già gli a capo giusti).
                     break-words: rete di sicurezza residua per qualunque altra parola
                     senza spazi più larga del fumetto -- non dovrebbe più capitare per
                     un link (ora sostituito da formattaTestoConLink, vedi sotto), ma
                     costa zero tenerla anche per il resto del testo. */}
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                      m.ruolo === "cliente" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"
                    }`}
                  >
                    {formattaTestoConLink(m.contenuto)}
                  </p>
                </div>
              ))}
              {inCorso && <p className="text-sm text-zinc-400">Sta scrivendo...</p>}
              <div ref={fineListaRef} />
            </div>

            {/* 17/09/2026: diceva "La conversazione è stata passata a un
                operatore umano", e lasciava aspettare una risposta che non
                arriva -- da questa chat non parte nessuna notifica. Ora dice
                la verità, e il recapito da usare è nella risposta qui sopra,
                già toccabile. */}
            {trasferito && (
              <p className="mx-3 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Su questo non posso aiutarti io: contatta direttamente l&apos;attività con i recapiti qui sopra.
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
              {/* text-base (16px), non text-sm (14px): sotto i 16px Safari su
                 iOS ingrandisce automaticamente la pagina quando l'input
                 riceve il focus da tastiera -- l'effetto "zoom e si bugga"
                 segnalato da Gabriel dal vivo 15/09/2026, vedi DECISIONS.md. */}
              <input
                type="text"
                value={bozza}
                onChange={(e) => setBozza(e.target.value)}
                placeholder="Scrivi un messaggio..."
                className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-base"
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

        {!aperto && suggerimentoMontato && (
          // Compare e sparisce da solo (nessuna X, nessun pallino): deve far
          // scoprire che l'AI risponde anche a domande, non insistere per
          // farla usare -- vedi il commento sopra suggerimentoGiaVisto. Un
          // click lo chiude e basta (non apre la chat): chi vuole usarla deve
          // comunque schiacciare il pulsante vero, vedi chiudiSuggerimento.
          <button
            type="button"
            onClick={chiudiSuggerimento}
            className={`relative max-w-[16rem] rounded-2xl border border-amber-200 bg-amber-50 px-4 pt-4 pb-3 pl-5 text-left text-sm leading-relaxed text-amber-900 shadow-xl transition-all duration-300 ${
              suggerimentoVisibile ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            {/* saluto come etichetta nell'angolo, non più inline nel testo */}
            <span className="absolute -top-3 -left-3 flex size-7 items-center justify-center rounded-full bg-white text-base shadow-md ring-1 ring-amber-200">
              👋
            </span>
            {/* piccola "coda" che punta verso il pulsante, per farlo leggere come un fumetto invece di una card che galleggia lì per caso */}
            <span className="pointer-events-none absolute -bottom-1.5 right-6 size-3 rotate-45 border-b border-r border-amber-200 bg-amber-50" />
            Qui puoi chiedermi{" "}
            {haInformazioniAttivita ? "qualcosa sull'attività" : "orari e prezzi"}, o prenotare direttamente in chat.
          </button>
        )}

        <button
          type="button"
          onClick={() => (aperto ? setAperto(false) : apriChat())}
          aria-label={aperto ? "Chiudi chat" : "Apri chat"}
          className="flex size-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition-transform hover:scale-105"
        >
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
    </>
  );
}
