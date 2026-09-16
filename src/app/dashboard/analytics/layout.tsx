import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniSessioneTenant } from "@/lib/supabase/tenant";
import { puoVedereAnalytics } from "@/lib/ruoli";

/**
 * Analytics riservate al titolare (Fase 5, migrazione 0027). Scelta di
 * Gabriel del 16/09/2026: è il motivo più citato dai titolari per cui NON
 * danno un accesso ai dipendenti sugli altri gestionali -- preferiscono non
 * darlo affatto piuttosto che far vedere gli incassi.
 *
 * Questo layout protegge quello che si VEDE. La sicurezza vera sta nei gate
 * delle server action e delle route (src/lib/permessi.server.ts): una
 * pagina si può solo guardare, un endpoint si può chiamare.
 */
export default async function LayoutAnalytics({ children }: { children: React.ReactNode }) {
  const supabase = await creaClientServer();
  const sessione = await ottieniSessioneTenant(supabase);

  if (!sessione) redirect("/accedi");
  if (!puoVedereAnalytics(sessione.ruolo)) redirect("/dashboard");

  return <>{children}</>;
}
