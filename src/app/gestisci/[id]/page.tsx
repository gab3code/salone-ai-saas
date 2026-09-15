import type { Metadata } from "next";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import { cancellazioneOnlineConsentita, messaggioCancellazioneBloccata } from "@/lib/finestra-cancellazione";
import { motivoBloccoSpostamento, messaggioSpostamentoBloccato } from "@/lib/finestra-spostamento";
import { ModuloCancellazione } from "./ModuloCancellazione";
import { ModuloSpostamento } from "./ModuloSpostamento";

/**
 * Pagina pubblica "gestisci la tua prenotazione" (PIANO.md Fase 4, link
 * inviato nell'email di conferma cliente -- vedi notifiche.server.ts e il
 * commento di sicurezza in azioni.ts). Come `/s/[slug]`, pensata per un
 * visitatore anonimo: client admin, mai un client autenticato.
 *
 * Cancellazione + spostamento ("sposta", Fase 4, richiesta di Gabriel il
 * 15/09/2026, aggiunto dopo aver verificato dal vivo che le fasi precedenti
 * fossero solide): stesso modello di sicurezza per entrambe (nessun login),
 * stessa finestra minima di ore, ma un tetto separato di massimo 1
 * spostamento per lo spostamento -- vedi src/lib/finestra-spostamento.ts.
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
    .select(
      "id, inizio, stato, tenant_id, spostamenti_effettuati, tenants(nome, telefono, ore_minime_cancellazione), servizi(nome), operatori(nome), clienti(nome)"
    )
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
  const tenant = uno<{ nome: string; telefono: string | null; ore_minime_cancellazione: number }>(appuntamento.tenants);
  const servizio = uno<{ nome: string }>(appuntamento.servizi);
  const operatore = uno<{ nome: string }>(appuntamento.operatori);
  const cliente = uno<{ nome: string | null }>(appuntamento.clienti);

  const fuso = await caricaFusoOrarioTenant(supabase, appuntamento.tenant_id);
  const inizioPseudo = realeAPseudoUtc(new Date(appuntamento.inizio), fuso);
  const quando = `${inizioPseudo.toLocaleDateString("it-IT", { timeZone: "UTC" })} alle ${inizioPseudo.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}`;

  // Finestra minima di cancellazione (richiesta di Gabriel il 14/09/2026):
  // qui solo per mostrare in anticipo il messaggio giusto invece del
  // bottone -- confronto su `appuntamento.inizio` grezzo (timestamptz reale),
  // MAI su `inizioPseudo`, perché qui serve la vera distanza nel tempo da
  // "adesso", non un valore pensato solo per la visualizzazione (vedi
  // fuso-orario.ts). Il controllo che conta davvero resta in azioni.ts.
  const cancellazioneBloccataDaFinestra =
    !!tenant &&
    appuntamento.stato !== "cancellato" &&
    !cancellazioneOnlineConsentita(new Date(appuntamento.inizio), tenant.ore_minime_cancellazione);
  const messaggioFinestraBloccata = tenant
    ? messaggioCancellazioneBloccata(tenant.ore_minime_cancellazione, tenant.nome, tenant.telefono)
    : null;

  // Stesso ragionamento per lo spostamento (finestra-spostamento.ts), con in
  // più il tetto di massimo 1 spostamento -- entrambi i motivi di blocco
  // condividono lo stesso messaggio, calcolato una sola volta qui.
  const motivoSpostamentoBloccato =
    tenant && appuntamento.stato !== "cancellato"
      ? motivoBloccoSpostamento(
          new Date(appuntamento.inizio),
          tenant.ore_minime_cancellazione,
          appuntamento.spostamenti_effettuati
        )
      : null;
  const messaggioSpostamentoBloccatoTesto =
    tenant && motivoSpostamentoBloccato
      ? messaggioSpostamentoBloccato(motivoSpostamentoBloccato, tenant.ore_minime_cancellazione, tenant.nome, tenant.telefono)
      : null;

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

      <div className="mt-6 flex flex-col gap-3">
        <ModuloSpostamento
          appuntamentoId={id}
          giaCancellata={appuntamento.stato === "cancellato"}
          messaggioBloccato={messaggioSpostamentoBloccatoTesto}
        />
        <ModuloCancellazione
          appuntamentoId={id}
          giaCancellata={appuntamento.stato === "cancellato"}
          messaggioBloccata={cancellazioneBloccataDaFinestra ? messaggioFinestraBloccata : null}
        />
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
