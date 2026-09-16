import Link from "next/link";
import { caricaAttivitaPiattaforma } from "@/lib/admin.server";
import { PannelloAdmin } from "./pannello-admin";

export const dynamic = "force-dynamic";

/**
 * Pannello di piattaforma (Fase 5, punto "pannello admin per te" di
 * PIANO.md): tutte le attività registrate, con piano, stato abbonamento,
 * utilizzo reale e la possibilità di intervenire a mano sul piano.
 *
 * Cosa NON c'è, di proposito: nessun "entra come questo salone"
 * (impersonificazione). È la funzione più comoda di un pannello del genere
 * ed è anche la più pericolosa -- un bug lì dentro vale l'accesso completo a
 * qualunque attività, e per l'assistenza al primo cliente basta guardare i
 * dati da qui e farsi raccontare il problema. Da rivalutare quando i clienti
 * saranno abbastanza da rendere il supporto un lavoro vero.
 */
export default async function PaginaAdmin() {
  const righe = await caricaAttivitaPiattaforma();

  const totali = righe.reduce(
    (acc, riga) => ({
      attivita: acc.attivita + 1,
      paganti: acc.paganti + (riga.piano !== "free" ? 1 : 0),
      appuntamenti30: acc.appuntamenti30 + riga.appuntamenti30Giorni,
      clienti: acc.clienti + riga.clienti,
    }),
    { attivita: 0, paganti: 0, appuntamenti30: 0, clienti: 0 }
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Piattaforma</h1>
        <p className="text-sm text-zinc-500">
          Tutte le attività registrate su Salone AI.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Riepilogo etichetta="Attività" valore={String(totali.attivita)} />
        <Riepilogo etichetta="Su un piano a pagamento" valore={String(totali.paganti)} />
        <Riepilogo etichetta="Appuntamenti (30gg)" valore={String(totali.appuntamenti30)} />
        <Riepilogo etichetta="Clienti totali" valore={String(totali.clienti)} />
      </div>

      <PannelloAdmin righe={righe} />

      <Link href="/dashboard" className="text-sm underline">
        Torna alla dashboard
      </Link>
    </main>
  );
}

function Riepilogo({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{etichetta}</p>
      <p className="mt-1 text-lg font-semibold">{valore}</p>
    </div>
  );
}
