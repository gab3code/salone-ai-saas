export function Footer() {
  return (
    <footer className="border-t border-zinc-200 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-zinc-400 sm:flex-row sm:px-8">
        <span>© {new Date().getFullYear()} Salone AI</span>
        <div className="flex items-center gap-5">
          <a href="/accedi" className="transition-colors hover:text-zinc-600">
            Accedi
          </a>
          <a href="/registrati" className="transition-colors hover:text-zinc-600">
            Registrati
          </a>
        </div>
      </div>
    </footer>
  );
}
