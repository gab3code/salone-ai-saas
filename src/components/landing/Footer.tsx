export function Footer() {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-white/40 sm:flex-row sm:px-8">
        <span>© {new Date().getFullYear()} Salone AI</span>
        <div className="flex items-center gap-5">
          <a href="/accedi" className="transition-colors hover:text-white">
            Accedi
          </a>
          <a href="/registrati" className="transition-colors hover:text-white">
            Registrati
          </a>
        </div>
      </div>
    </footer>
  );
}
