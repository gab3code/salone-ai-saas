import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoConfigurareAttivita } from "@/lib/ruoli";

/**
 * Tutte le impostazioni dell'attività (configurazione + abbonamento) sono
 * riservate al titolare (Fase 5, migrazione 0027): un prezzo, una finestra
 * di cancellazione o una caparra cambiati per sbaglio si propagano subito su
 * pagina pubblica, agente AI e pagamenti.
 *
 * Una sola pagina per tutta la sezione, invece di un controllo ripetuto in
 * ognuna: un file dimenticato qui è una schermata che si apre per sbaglio,
 * non un buco di sicurezza -- quello lo chiudono i gate nelle server action
 * (`richiediPermesso` in src/lib/permessi.server.ts), che restano la difesa
 * vera perché una server action è un endpoint POST richiamabile anche senza
 * mai aprire la pagina.
 */
export default async function LayoutImpostazioni({ children }: { children: React.ReactNode }) {
  const supabase = await creaClientServer();
  const sessione = await ottieniSessioneTenant(supabase);

  if (!sessione) redirect("/accedi");
  if (!puoConfigurareAttivita(sessione.ruolo)) redirect("/dashboard");

  return <>{children}</>;
}
