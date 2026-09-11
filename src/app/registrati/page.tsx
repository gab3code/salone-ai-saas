"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { creaClientBrowser } from "@/lib/supabase/client";
import { pianoEPagante, ETICHETTA_PIANO } from "@/lib/stripe/piani";

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
 */
export default function PaginaRegistrazione() {
  return (
    <Suspense fallback={null}>
      <FormRegistrazione />
    </Suspense>
  );
}

function FormRegistrazione() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = creaClientBrowser();
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
      router.push(pianoValido ? `/dashboard?piano=${pianoValido}` : "/dashboard");
      router.refresh();
    } else {
      setInviata(true);
    }
  }

  if (inviata) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">Controlla la tua email</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Ti abbiamo mandato un link di conferma a <strong>{email}</strong>. Aprilo per attivare
            l&apos;account e il tuo salone{pianoValido ? ` e completare l'attivazione del piano ${ETICHETTA_PIANO[pianoValido]}` : ""}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <form onSubmit={registrati} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Crea il tuo salone</h1>

        {pianoValido && (
          <p className="rounded bg-violet-50 px-3 py-2 text-sm text-violet-900">
            Stai per attivare il piano <strong>{ETICHETTA_PIANO[pianoValido]}</strong>
            {(pianoValido === "growth" || pianoValido === "pro") && " (10 giorni di prova prima del primo addebito)"}.
            Dopo la registrazione ti portiamo al pagamento sicuro su Stripe.
          </p>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="nomeSalone">
            Nome del salone
          </label>
          <input
            id="nomeSalone"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={nomeSalone}
            onChange={(e) => setNomeSalone(e.target.value)}
            placeholder="Es. Estetica Da Marta"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="nomePersona">
            Il tuo nome
          </label>
          <input
            id="nomePersona"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={nomePersona}
            onChange={(e) => setNomePersona(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            minLength={6}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {errore && <p className="text-sm text-red-600">{errore}</p>}

        <button
          type="submit"
          disabled={caricamento}
          className="w-full rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {caricamento ? "Creazione in corso..." : "Crea account"}
        </button>

        <p className="text-center text-sm text-zinc-600">
          Hai già un account?{" "}
          <a className="underline" href="/accedi">
            Accedi
          </a>
        </p>
      </form>
    </div>
  );
}
