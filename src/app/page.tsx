/**
 * Placeholder minimo -- la landing page premium vera arriva in una fase
 * successiva (dopo aver studiato a fondo quella di Estetia). Per ora serve
 * solo a poter navigare verso registrazione/accesso e verificare il funnel.
 */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-2xl font-semibold">Salone AI SaaS</h1>
      <p className="max-w-md text-zinc-600">
        Landing page definitiva da costruire in una fase successiva. Per ora: prova il funnel di
        registrazione.
      </p>
      <div className="flex gap-3">
        <a href="/registrati" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
          Crea il tuo salone
        </a>
        <a href="/accedi" className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium">
          Accedi
        </a>
      </div>
    </div>
  );
}
