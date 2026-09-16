import type { Metadata } from "next";
import { caricaContestoRecensione } from "@/lib/recensioni.server";
import { ModuloRecensione } from "./ModuloRecensione";

/**
 * Pagina pubblica "lascia una recensione" (Fase 3, link mandato via email 2
 * ore dopo l'appuntamento -- vedi elaboraRichiestaRecensione in
 * recensioni.server.ts). Come `/gestisci/[id]`, pensata per un visitatore
 * anonimo: nessuna autenticazione, il possesso dell'id nel link è la
 * verifica (verifica-visita: solo chi ha davvero avuto l'appuntamento ha
 * ricevuto questo link).
 */
export const metadata: Metadata = { title: "Lascia una recensione" };

export default async function PaginaRecensisci({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contesto = await caricaContestoRecensione(id);

  if (!contesto) {
    return (
      <Cornice>
        <p className="text-zinc-600">
          Prenotazione non trovata. Controlla di aver aperto il link corretto dall&apos;email ricevuta.
        </p>
      </Cornice>
    );
  }

  return (
    <Cornice>
      <h1 className="text-lg font-semibold text-zinc-900">Com&apos;è andata da {contesto.tenantNome}?</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {contesto.servizioNome ? `${contesto.servizioNome} -- ` : ""}
        {contesto.quando}
      </p>

      <div className="mt-6">
        {contesto.appuntamentoCancellato ? (
          <p className="text-sm text-zinc-600">Questa prenotazione è stata cancellata: non è possibile lasciare una recensione.</p>
        ) : contesto.giaRecensito ? (
          <p className="text-sm text-zinc-600">Hai già lasciato una recensione per questo appuntamento, grazie!</p>
        ) : (
          <ModuloRecensione appuntamentoId={id} />
        )}
      </div>
    </Cornice>
  );
}

function Cornice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}
