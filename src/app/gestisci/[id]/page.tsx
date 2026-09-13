import type { Metadata } from "next";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { ModuloCancellazione } from "./ModuloCancellazione";

/**
 * Pagina pubblica "gestisci la tua prenotazione" (PIANO.md Fase 4, link
 * inviato nell'email di conferma cliente -- vedi notifiche.server.ts e il
 * commento di sicurezza in azioni.ts). Come `/s/[slug]`, pensata per un
 * visitatore anonimo: client admin, mai un client autenticato.
 *
 * Solo CANCELLAZIONE per ora, non "sposta": riprogrammare richiede un vero
 * selettore di slot liberi (la stessa UI del flusso di prenotazione
 * pubblica), lavoro a parte non incluso in questo giro -- onestamente
 * segnalato, non taciuto. Un cliente che vuole spostare l'appuntamento
 * cancella qui e ne crea uno nuovo da `/s/[slug]`, oppure contatta il
 * salone direttamente.
 */
export const metadata: Metadata = { title: "Gestisci la tua prenotazione" };

export default async function PaginaGestisciPrenotazione({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = creaClientAdmin();

  const { data: appuntamento } = await supabase
    .from("appuntamenti")
    .select("id, inizio, stato, tenant_id, tenants(nome), servizi(nome), operatori(nome), clienti(nome)")
    .eq("id", id)
    .maybeSingle();

  if (!appuntamento) {
    return (
      <Cornice>
        <p className="text-zinc-600">
          Prenotazione non trovata. Controlla di aver aperto il link corretto dall&apos;email di conferma.
        </p>
      </Cornice>
    );
  }

  // Le relazioni annidate di Supabase tornano come oggetto singolo o array a
  // seconda della cardinalità dedotta -- stesso pattern di normalizzazione
  // già usato in notifiche.server.ts.
  const uno = <T,>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : (v as T | null));
  const tenant = uno<{ nome: string }>(appuntamento.tenants);
  const servizio = uno<{ nome: string }>(appuntamento.servizi);
  const operatore = uno<{ nome: string }>(appuntamento.operatori);
  const cliente = uno<{ nome: string | null }>(appuntamento.clienti);

  const fuso = await caricaFusoOrarioTenant(supabase, appuntamento.tenant_id);
  const inizioPseudo = realeAPseudoUtc(new Date(appuntamento.inizio), fuso);
  const quando = `${inizioPseudo.toLocaleDateString("it-IT", { timeZone: "UTC" })} alle ${inizioPseudo.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`;

  return (
    <Cornice>
      <h1 className="text-lg font-semibold text-zinc-900">La tua prenotazione</h1>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Attività</dt>
        <dd>{tenant?.nome ?? "—"}</dd>
        <dt className="text-zinc-500">Servizio</dt>
        <dd>{servizio?.nome ?? "—"}</dd>
        {operatore && (
          <>
            <dt className="text-zinc-500">Operatore</dt>
            <dd>{operatore.nome}</dd>
          </>
        )}
        <dt className="text-zinc-500">Quando</dt>
        <dd>{quando}</dd>
        <dt className="text-zinc-500">Cliente</dt>
        <dd>{cliente?.nome || "—"}</dd>
        <dt className="text-zinc-500">Stato</dt>
        <dd>{appuntamento.stato === "cancellato" ? "Cancellata" : "Confermata"}</dd>
      </dl>

      <div className="mt-6">
        <ModuloCancellazione appuntamentoId={id} giaCancellata={appuntamento.stato === "cancellato"} />
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
