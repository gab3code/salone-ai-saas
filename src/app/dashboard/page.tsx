import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { esci } from "./azioni";

/**
 * Prima pagina protetta: prova che l'intera catena funziona davvero, non
 * solo "sulla carta" -- login riuscito, RLS che restituisce ESATTAMENTE il
 * tenant di questo utente (mai quello di un altro), profilo creato dal
 * trigger di provisioning automatico alla registrazione (migrazione 0004).
 */
export default async function PaginaDashboard() {
  const supabase = await creaClientServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/accedi");
  }

  const { data: profilo } = await supabase
    .from("profiles")
    .select("nome, ruolo, tenant_id")
    .eq("id", user.id)
    .single();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nome, slug, piano, stato_abbonamento, created_at")
    .single();

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <form action={esci}>
          <button type="submit" className="text-sm underline">
            Esci
          </button>
        </form>
      </div>

      {!tenant ? (
        <p className="mt-4 text-sm text-red-600">
          Nessun salone trovato per questo utente -- il provisioning automatico non è andato a
          buon fine (controlla i log del trigger al_nuovo_utente su Supabase).
        </p>
      ) : (
        <dl className="mt-6 grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-zinc-500">Salone</dt>
          <dd>{tenant.nome}</dd>
          <dt className="text-zinc-500">Slug pagina pubblica</dt>
          <dd>{tenant.slug}</dd>
          <dt className="text-zinc-500">Piano</dt>
          <dd>{tenant.piano}</dd>
          <dt className="text-zinc-500">Stato abbonamento</dt>
          <dd>{tenant.stato_abbonamento}</dd>
          <dt className="text-zinc-500">Tu</dt>
          <dd>
            {profilo?.nome || user.email} ({profilo?.ruolo})
          </dd>
        </dl>
      )}
    </div>
  );
}
