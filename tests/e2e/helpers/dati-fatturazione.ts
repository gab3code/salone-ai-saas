import { creaClientAdminTest } from "./supabase-admin";

/**
 * Riempie i dati di fatturazione di un tenant di prova.
 *
 * Dal 17/09/2026 il checkout li pretende: senza, risponde 409 e manda al
 * modulo. È la regola giusta -- per un servizio digitale venduto a un cliente
 * italiano la fattura è sempre obbligatoria, e senza questi dati non si
 * compone -- ma gli scenari che vogliono verificare ALTRO (che il checkout
 * generi un URL Stripe, che il webhook aggiorni il piano) non devono
 * ricompilare un modulo ogni volta.
 *
 * La partita IVA è formalmente valida: passa il controllo del carattere di
 * controllo, che è lo stesso che applica il modulo vero.
 */
export async function impostaDatiFatturazione(tenantId: string): Promise<void> {
  const supabase = creaClientAdminTest();
  const { error } = await supabase
    .from("tenants")
    .update({
      denominazione: "Salone Di Prova E2E",
      partita_iva: "00743110157",
      indirizzo_via: "Via di Prova 1",
      indirizzo_cap: "24064",
      indirizzo_comune: "Grumello del Monte",
      indirizzo_provincia: "BG",
      indirizzo_nazione: "IT",
      codice_destinatario: "0000000",
      pec_fatturazione: null,
    })
    .eq("id", tenantId);
  if (error) throw new Error(`Impossibile impostare i dati di fatturazione: ${error.message}`);
}
