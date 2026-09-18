/**
 * Lo scheletro che si vede mentre il server prepara una pagina.
 *
 * Prima non c'era niente: cliccando un link il browser restava fermo sulla
 * pagina vecchia finche' il server non aveva finito -- niente titolo, niente
 * struttura, nessun segno che stesse succedendo qualcosa. Con un server
 * lontano dal database faceva mezzo secondo di immobilita' a ogni clic, e
 * mezzo secondo di immobilita' si legge come "non ha registrato il clic",
 * non come "sta caricando". Da li' il secondo clic, e la sensazione che il
 * prodotto sia lento anche quando non lo e'.
 *
 * Non e' un giro di rotella: si disegna la FORMA della pagina che sta per
 * arrivare, cosi' quando arriva non salta niente. Per questo ogni sezione ha
 * il suo scheletro invece di uno generico.
 *
 * `motion-safe:` e non `animate-pulse` secco: chi ha chiesto al sistema
 * operativo meno animazioni vede lo scheletro fermo, che va benissimo lo
 * stesso.
 */
export function ScheletroCaricamento({
  titolo,
  righe = 4,
  children,
}: {
  /** Il titolo vero della pagina: e' gia' noto, non c'e' motivo di nasconderlo. */
  titolo: string;
  righe?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col p-8" aria-busy="true" aria-live="polite">
      <span className="text-sm text-transparent select-none">← Dashboard</span>
      <h1 className="mt-2 text-xl font-semibold">{titolo}</h1>

      <div className="mt-6 flex flex-col gap-3 motion-safe:animate-pulse">
        {children ?? (
          <>
            {Array.from({ length: righe }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-zinc-100" />
            ))}
          </>
        )}
      </div>

      <span className="sr-only">Caricamento in corso</span>
    </div>
  );
}

/** Barre di altezza diversa: una tabella non e' fatta di righe tutte uguali. */
export function BarraScheletro({ classe = "h-10 w-full" }: { classe?: string }) {
  return <div className={`rounded bg-zinc-100 ${classe}`} />;
}
