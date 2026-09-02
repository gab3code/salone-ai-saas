"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creaClientBrowser } from "@/lib/supabase/client";

export default function PaginaAccesso() {
  const router = useRouter();
  const supabase = creaClientBrowser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function accedi(evento: React.FormEvent) {
    evento.preventDefault();
    setErrore(null);
    setCaricamento(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setCaricamento(false);
    if (error) {
      setErrore(error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <form onSubmit={accedi} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Accedi</h1>

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
          {caricamento ? "Accesso in corso..." : "Accedi"}
        </button>

        <p className="text-center text-sm text-zinc-600">
          Non hai un account?{" "}
          <a className="underline" href="/registrati">
            Registrati
          </a>
        </p>
      </form>
    </div>
  );
}
