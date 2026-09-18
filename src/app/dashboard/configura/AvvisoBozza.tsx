"use client";

/**
 * Il messaggio quando la generazione di una bozza non va a buon fine.
 *
 * Esiste separato perche' un caso non e' un errore: le configurazioni
 * assistite finite. Li' la persona non ha sbagliato niente, sta decidendo --
 * e un messaggio rosso che dice solo "no" e' la risposta peggiore possibile
 * in quel momento. Quindi si dice cosa puo' fare adesso senza pagare
 * (configurare a mano, provare l'assistente nella demo) e cosa cambia se
 * passa a un piano superiore.
 */
export function AvvisoBozza({ messaggio, esaurite }: { messaggio: string; esaurite?: boolean }) {
  if (!esaurite) {
    return (
      <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{messaggio}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p>{messaggio}</p>
      <p className="text-xs">
        Puoi comunque{" "}
        <a href="/demo" target="_blank" rel="noopener" className="underline">
          provare l&apos;assistente nella demo
        </a>{" "}
        per vedere come risponde ai clienti, oppure{" "}
        <a href="/dashboard/abbonamento" className="underline">
          guardare i piani
        </a>
        .
      </p>
    </div>
  );
}

/** Quante configurazioni assistite restano, detto prima di usarle. */
export function ContatoreBozze({ rimaste }: { rimaste: number | null }) {
  if (rimaste === null) return null;
  return (
    <p className="text-xs text-zinc-500">
      {rimaste === 0
        ? "Hai usato tutte le configurazioni assistite comprese nel tuo piano."
        : rimaste === 1
          ? "Ti resta un'ultima configurazione assistita: sono un totale, non un tetto mensile."
          : `Ti restano ${rimaste} configurazioni assistite: sono un totale, non un tetto mensile.`}
    </p>
  );
}
