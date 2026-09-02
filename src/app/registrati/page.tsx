"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creaClientBrowser } from "@/lib/supabase/client";

/**
 * Registrazione self-service (punto 5/6 della spec): email + password +
 * nome del salone. Alla conferma, il trigger "al_nuovo_utente" (migrazione
 * 0004) crea automaticamente il tenant e il profilo owner -- questa pagina
 * non fa nessun provisioning manuale, chiama solo supabase.auth.signUp.
 */
export default function PaginaRegistrazione() {
  const router = useRouter();
  const supabase = creaClientBrowser();

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
      },
    });

    setCaricamento(false);

    if (error) {
      setErrore(error.message);
      return;
    }

    // Con la conferma email disattivata, Supabase restituisce già una
    // sessione attiva -- si può andare dritti in dashboard. Con la conferma
    // email attiva (default Supabase), serve prima cliccare il link ricevuto.
    if (data.session) {
      router.push("/dashboard");
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
            l&apos;account e il tuo salone.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <form onSubmit={registrati} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Crea il tuo salone</h1>

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
