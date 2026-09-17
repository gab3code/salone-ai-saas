"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { creaClientBrowser } from "@/lib/supabase/client";
import { pianoEPagante, ETICHETTA_PIANO, giorniDiProva } from "@/lib/stripe/piani";
import { Grana } from "@/components/landing/Grana";
import { AuthHeader } from "@/components/landing/AuthHeader";
import { useSpotlightScuro } from "@/components/landing/SpotlightScuro";

/**
 * Registrazione self-service (punto 5/6 della spec): email + password +
 * nome del salone. Alla conferma, il trigger "al_nuovo_utente" (migrazione
 * 0004) crea automaticamente il tenant e il profilo owner -- questa pagina
 * non fa nessun provisioning manuale, chiama solo supabase.auth.signUp.
 *
 * Fase 5 (11/09/2026): se si arriva da un piano a pagamento su Prezzi.tsx
 * (`?piano=growth` ecc.), dopo la registrazione si apre subito il checkout
 * Stripe invece di andare dritti in dashboard -- vedi più sotto per i due
 * percorsi possibili (conferma email disattivata/attiva).
 *
 * Il default export resta un guscio sottile: `useSearchParams` (usato dal
 * form per leggere `?piano=`) richiede un Suspense boundary attorno a sé in
 * una pagina App Router, altrimenti il build fallisce ("should be wrapped
 * in a suspense boundary") -- il form vero e proprio vive in
 * FormRegistrazione qui sotto.
 *
 * Ristilizzata (controllo approfondito pre-pubblicazione, 12/09/2026): prima
 * era un form HTML puro su sfondo bianco, senza un solo elemento di brand --
 * la pagina dove nasce ogni cliente pagante, subito dopo una landing curata
 * al dettaglio. Qui sotto solo classi/markup: zero cambi alla logica
 * (`registrati()`, gestione piano/sessione/email di conferma restano
 * identici).
 *
 * Header sostituito (terzo giro, richiesta di Gabriel: "devo comunque avere
 * il titolo del mio sito sopra, esteticamente bello, che se clicco mi fa
 * tornare alla landing page") -- AuthHeader (barra fissa in cima, condivisa
 * con /accedi) sostituisce i due link di testo che c'erano prima, uno per
 * ciascuno dei due stati della pagina (form / "email inviata").
 */
export default function PaginaRegistrazione() {
  return (
    <Suspense fallback={null}>
      <FormRegistrazione />
    </Suspense>
  );
}

/** Sfondo/brand condiviso dalla pagina di registrazione e da quella di
 * accesso (stessa identità della landing: bg-noir, grana, bagliore) --
 * senza gli shader/le animazioni pesanti dell'Hero, che lì hanno senso come
 * "primo contatto" e qui distrarrebbero da un form che l'utente deve solo
 * poter compilare in fretta.
 *
 * Bagliore passato allo "Spotlight scuro" di CTAFinale.tsx (quinto giro,
 * seconda parte -- richiesta di Gabriel: "card in fondo bellissima, rendi
 * cosi anche lo sfondo di accedi e di registrati, se pensi possa
 * migliorare, fallo"). Prima era un alone viola fisso, senza interazione;
 * `sfondo` arriva da `useSpotlightScuro()` chiamato nel componente
 * chiamante (serve un solo hook per pagina, non uno per stato/ramo), il
 * gestore `alMuovimento` va agganciato al contenitore esterno da lì. */
function SfondoAuth({ sfondo }: { sfondo: ReturnType<typeof useSpotlightScuro>["sfondo"] }) {
  return (
    <>
      <motion.div className="pointer-events-none fixed inset-0" style={{ background: sfondo, filter: "blur(30px)" }} />
      <Grana opacita={0.04} />
    </>
  );
}

function FormRegistrazione() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = creaClientBrowser();
  // `false`: niente deriva automatica in loop, stesso motivo di /accedi.
  const { sfondo, alMuovimento } = useSpotlightScuro(false);
  const pianoRichiesto = searchParams.get("piano");
  const pianoValido = pianoEPagante(pianoRichiesto) ? pianoRichiesto : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomeSalone, setNomeSalone] = useState("");
  const [nomePersona, setNomePersona] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [inviata, setInviata] = useState(false);

  async function registrati(evento: React.FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setCaricamento(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nome_salone: nomeSalone, nome_persona: nomePersona },
        // Se la conferma email è attiva, questo è il link su cui Supabase
        // riporta l'utente dopo aver cliccato quello ricevuto via email --
        // porta con sé il piano scelto, così il checkout parte comunque
        // (vedi AvviaCheckoutSeNecessario nella dashboard) invece di
        // perdersi tra un tab e l'altro.
        emailRedirectTo: pianoValido ? `${window.location.origin}/dashboard?piano=${pianoValido}` : undefined,
      },
    });

    setCaricamento(false);

    if (error) {
      setErrore(error.message);
      return;
    }

    // Con la conferma email disattivata, Supabase restituisce già una
    // sessione attiva -- si può andare dritti in dashboard (o al checkout,
    // se veniva da un piano a pagamento). Con la conferma email attiva
    // (default Supabase), serve prima cliccare il link ricevuto: ci pensa
    // `emailRedirectTo` sopra a riportare il piano scelto.
    if (data.session) {
      // Dritti alla pagina dell'abbonamento, non alla dashboard: chi ha
      // appena scelto un piano deve trovarsi davanti quello che serve per
      // attivarlo, non la home con un redirect che scatta dopo.
      router.push(pianoValido ? `/dashboard/abbonamento?piano=${pianoValido}` : "/dashboard");
      router.refresh();
    } else {
      setInviata(true);
    }
  }

  const classeCampo =
    "w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-violet-400/60 focus:bg-white/[0.07]";
  const classeEtichetta = "text-sm font-medium text-white/70";

  if (inviata) {
    return (
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-noir p-8 py-24 sm:py-28"
        onPointerMove={alMuovimento}
      >
        <AuthHeader />
        <SfondoAuth sfondo={sfondo} />
        <div className="relative max-w-sm text-center">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              ✓
            </span>
            <h1 className="mt-4 text-xl font-semibold text-white">Controlla la tua email</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              Ti abbiamo mandato un link di conferma a <strong className="text-white">{email}</strong>. Aprilo per
              attivare l&apos;account e la tua attività
              {pianoValido ? ` e completare l'attivazione del piano ${ETICHETTA_PIANO[pianoValido]}` : ""}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-noir p-6 py-24 sm:p-8 sm:py-28"
      onPointerMove={alMuovimento}
    >
      <AuthHeader />
      <SfondoAuth sfondo={sfondo} />
      <div className="relative w-full max-w-sm">
        <form onSubmit={registrati} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl sm:p-8">
          <div className="mb-2 text-center">
            <h1 className="text-xl font-semibold text-white">Crea la tua attività</h1>
            <p className="mt-1 text-sm text-white/50">Pronto in 5 minuti, nessun tecnico necessario.</p>
          </div>

          {pianoValido && (
            <p className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-3 py-2.5 text-sm text-violet-200">
              Stai per attivare il piano <strong className="text-white">{ETICHETTA_PIANO[pianoValido]}</strong>
              {/* Bug reale trovato nel controllo generale del quinto giro
                  (segnalazione di Gabriel sulla FAQ non aggiornata, stesso
                  problema qui): il trial era stato ristretto al solo Growth
                  nel secondo giro (vedi giorniDiProva in piani.ts), ma questo
                  controllo hardcoded "growth" || "pro" non era stato
                  aggiornato -- prometteva 10 giorni di prova anche su Pro,
                  che invece viene addebitato subito (vedi
                  /api/stripe/checkout/route.ts, che usa correttamente
                  giorniDiProva). Sostituito con la stessa funzione, unica
                  fonte di verità, invece di un secondo elenco di piani da
                  tenere allineato a mano. */}
              {giorniDiProva(pianoValido) !== undefined && ` (${giorniDiProva(pianoValido)} giorni di prova prima del primo addebito)`}.
              Dopo la registrazione ti portiamo al pagamento sicuro su Stripe.
            </p>
          )}

          <div className="space-y-1.5">
            <label className={classeEtichetta} htmlFor="nomeSalone">
              Nome dell&apos;attività
            </label>
            <input
              id="nomeSalone"
              className={classeCampo}
              value={nomeSalone}
              onChange={(e) => setNomeSalone(e.target.value)}
              placeholder="Es. Estetica Da Marta"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className={classeEtichetta} htmlFor="nomePersona">
              Il tuo nome
            </label>
            <input id="nomePersona" className={classeCampo} value={nomePersona} onChange={(e) => setNomePersona(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className={classeEtichetta} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={classeCampo}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className={classeEtichetta} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              minLength={6}
              className={classeCampo}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errore && <p className="text-sm text-red-400">{errore}</p>}

          <button
            type="submit"
            disabled={caricamento}
            className="w-full rounded-full bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            {caricamento ? "Creazione in corso..." : "Crea account"}
          </button>

          {/* Solo un link informativo, non una checkbox obbligatoria (PIANO.md
              Gruppo D punto 2, 14/09/2026): un vincolo esplicito di accettazione
              prima di poter registrarsi è un possibile passo successivo più
              solido, non fatto qui per non aggiungere attrito/scope creep alla
              sola creazione delle pagine mancanti. */}
          <p className="text-center text-xs text-white/40">
            Registrandoti accetti i{" "}
            <Link className="underline decoration-white/40 hover:text-white/70" href="/termini">
              Termini di Servizio
            </Link>{" "}
            e l&apos;
            <Link className="underline decoration-white/40 hover:text-white/70" href="/privacy">
              Informativa Privacy
            </Link>
            .
          </p>

          <p className="text-center text-sm text-white/50">
            Hai già un account?{" "}
            <Link className="text-white underline underline-offset-2" href="/accedi">
              Accedi
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
