import { notFound, redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { eAdminPiattaforma } from "@/lib/ruoli";

/**
 * Pannello di piattaforma (Fase 5): riservato a chi ha
 * `profiles.ruolo = 'admin_piattaforma'`, cioè oggi il solo Gabriel. Il
 * ruolo esiste nello schema dalla migrazione 0001 ma non era mai stato
 * controllato da nessuna parte -- questo è il primo posto che lo usa.
 *
 * `notFound()` invece di una pagina "non autorizzato": a un titolare
 * qualsiasi che finisce qui per caso non serve sapere che esiste un pannello
 * di amministrazione, e un 404 non conferma nemmeno l'esistenza dell'URL a
 * chi lo sta cercando.
 *
 * Questo layout è la prima barriera, non l'unica: ogni azione in azioni.ts
 * ricontrolla il ruolo, perché una server action si può chiamare senza mai
 * aprire la pagina.
 */
export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const supabase = await creaClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/accedi");

  // Letto direttamente da `profiles`, non da `ottieniSessioneTenant`: il
  // ruolo di piattaforma non dipende dall'avere un'attività attiva.
  const { data: profilo } = await supabase
    .from("profiles")
    .select("ruolo")
    .eq("id", user.id)
    .single();

  if (!eAdminPiattaforma(profilo?.ruolo)) notFound();

  return <>{children}</>;
}
