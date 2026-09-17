import Link from "next/link";
import { caricaPannelloPiattaforma, elencaInterventi } from "@/lib/admin.server";
import { calcolaRicavi, formatoEuroDaCentesimi, segnaliAttivita } from "@/lib/admin";
import { Analitiche } from "./analitiche";
import { PannelloAdmin } from "./pannello-admin";

export const dynamic = "force-dynamic";

/**
 * Pannello di piattaforma (Fase 5): tutte le attività registrate, con piano,
 * stato abbonamento, utilizzo reale, segnali che meritano uno sguardo e gli
 * interventi manuali possibili.
 *
 * Cosa NON c'è, e non ci sarà: nessun "entra come questo salone"
 * (impersonificazione) e nessun dato personale dei clienti finali -- né
 * nomi, né contatti, né trascrizioni delle conversazioni con l'AI. Su quei
 * dati Salone AI è responsabile del trattamento per conto del salone, non
 * titolare: contarli serve (i tetti dei piani e la fatturazione per
 * operatore si applicano su quei numeri), leggerli uno per uno no. È la
 * stessa linea decisa da Gabriel quando ha escluso le trascrizioni, e vale
 * per ogni funzione che verrà aggiunta qui dentro.
 */
export default async function PaginaAdmin() {
  const [{ righe, metriche }, interventi] = await Promise.all([
    caricaPannelloPiattaforma(),
    elencaInterventi(30),
  ]);

  const ricavi = calcolaRicavi(righe);
  const daGuardare = righe.filter((r) => segnaliAttivita(r).length > 0).length;
  const appuntamenti30 = righe.reduce((n, r) => n + r.appuntamenti30Giorni, 0);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Piattaforma</h1>
        <p className="text-sm text-zinc-500">Tutte le attività registrate su Salone AI.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Riepilogo
          etichetta="Attività"
          valore={String(righe.length)}
          nota={ricavi.inProva > 0 ? `${ricavi.inProva} in prova` : undefined}
        />
        <Riepilogo
          etichetta="Da guardare"
          valore={String(daGuardare)}
          nota={daGuardare > 0 ? "hanno almeno un segnale" : "nessun segnale"}
        />
        <Riepilogo etichetta="Appuntamenti (30gg)" valore={String(appuntamenti30)} />
      </div>

      <Analitiche ricavi={ricavi} metriche={metriche} />

      <PannelloAdmin righe={righe} />

      <section>
        <h2 className="text-sm font-medium text-zinc-500">Registro degli interventi</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Ogni modifica fatta da questo pannello, con chi l&apos;ha fatta e quando. Le righe restano
          anche quando l&apos;attività a cui si riferiscono non esiste più.
        </p>
        {interventi.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Nessun intervento registrato.</p>
        ) : (
          <ul data-testid="registro-interventi" className="mt-3 flex flex-col gap-2">
            {interventi.map((i) => (
              <li key={i.id} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-zinc-800">
                    {etichettaAzione(i.azione)} · {i.tenantNome ?? "attività cancellata"}
                  </span>
                  <span className="text-zinc-400">
                    {new Date(i.quando).toLocaleString("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-0.5 text-zinc-500">
                  {i.adminEmail ?? "autore sconosciuto"}
                  {descriviDettaglio(i.azione, i.dettaglio) && ` · ${descriviDettaglio(i.azione, i.dettaglio)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/dashboard" className="text-sm underline">
        Torna alla dashboard
      </Link>
    </main>
  );
}

function etichettaAzione(azione: string): string {
  switch (azione) {
    case "piano_manuale":
      return "Piano cambiato a mano";
    case "piano_con_stripe":
      return "Piano cambiato anche su Stripe";
    case "ripristino_stripe":
      return "Controllo restituito a Stripe";
    case "sospensione":
      return "Sospesa";
    case "riattivazione":
      return "Riattivata";
    case "cancellazione_attivita":
      return "Cancellata";
    default:
      return azione;
  }
}

function descriviDettaglio(azione: string, dettaglio: Record<string, unknown>): string | null {
  if (azione === "piano_manuale") {
    return `da ${dettaglio.piano_prima} (${dettaglio.stato_prima}) a ${dettaglio.piano_dopo} (${dettaglio.stato_dopo})`;
  }
  if (azione === "piano_con_stripe") {
    const prima = Number(dettaglio.totale_prima_centesimi ?? 0);
    const dopo = Number(dettaglio.totale_dopo_centesimi ?? 0);
    const soldi = `${formatoEuroDaCentesimi(prima)} -> ${formatoEuroDaCentesimi(dopo)}`;
    return `da ${dettaglio.piano_prima} a ${dettaglio.piano_dopo} · ${soldi}${
      dettaglio.chiuso_a_fine_periodo ? " · chiuso a fine periodo" : ""
    }`;
  }
  if (azione === "sospensione" && typeof dettaglio.motivo === "string") {
    return dettaglio.motivo;
  }
  if (azione === "cancellazione_attivita") {
    const account = Array.isArray(dettaglio.account_cancellati) ? dettaglio.account_cancellati.length : 0;
    return `${dettaglio.clienti} clienti, ${dettaglio.appuntamenti} appuntamenti, ${account} account`;
  }
  return null;
}

function Riepilogo({ etichetta, valore, nota }: { etichetta: string; valore: string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{etichetta}</p>
      <p className="mt-1 text-lg font-semibold">{valore}</p>
      {nota && <p className="mt-0.5 text-xs text-zinc-400">{nota}</p>}
    </div>
  );
}
