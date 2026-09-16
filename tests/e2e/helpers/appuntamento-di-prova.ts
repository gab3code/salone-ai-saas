import type { TenantDiProva } from "./tenant-di-prova";
import { pseudoUtcAReale, FUSO_ORARIO_PREDEFINITO } from "@/lib/fuso-orario";

/**
 * Crea direttamente (via service_role, bypassando l'AI e il form dashboard)
 * un cliente + un appuntamento CONFERMATO per un giorno/ora scelti --
 * utile per gli scenari che partono da "il cliente ha già una prenotazione"
 * (modifica, cancellazione, no-show, slot occupato) invece di doverla
 * ricreare ogni volta con un giro di chat AI, più lento e non deterministico
 * quando quello che serve al test è solo un dato di partenza noto.
 *
 * `giornoYMD`/`oraHHMM` sono nella stessa convenzione "pseudo-UTC" di tutto
 * il booking engine (ora CIVILE del salone, vedi src/lib/fuso-orario.ts) --
 * la conversione a istante reale usa lo stesso `pseudoUtcAReale` che usa
 * `creaAppuntamentoTenant`, per restare coerenti con ciò che l'app scrive
 * davvero. `creaTenantDiProva` non imposta mai `fuso_orario` esplicitamente,
 * quindi il tenant di prova resta sempre sul default `Europe/Rome` -- stesso
 * fuso usato qui.
 */
export async function creaAppuntamentoConfermato(
  tenant: TenantDiProva,
  opzioni: {
    servizioIndice?: number;
    operatoreIndice?: number;
    giornoYMD: string; // "YYYY-MM-DD"
    oraHHMM: string; // "HH:MM"
    clienteNome?: string;
    clienteTelefono: string;
    creatoDa?: "manuale" | "ai";
    stato?: "confermato" | "cancellato" | "completato" | "no_show";
  }
): Promise<{ id: string; clienteId: string; inizio: Date; fine: Date }> {
  const servizio = tenant.servizi[opzioni.servizioIndice ?? 0];
  const operatore = tenant.operatori[opzioni.operatoreIndice ?? 0];
  if (!servizio || !operatore) {
    throw new Error(
      "creaAppuntamentoConfermato: servizio/operatore all'indice richiesto non esiste in questo tenant di prova."
    );
  }

  const { data: cliente, error: erroreCliente } = await tenant.supabase
    .from("clienti")
    .insert({ tenant_id: tenant.id, nome: opzioni.clienteNome ?? null, telefono: opzioni.clienteTelefono })
    .select("id")
    .single();
  if (erroreCliente || !cliente) {
    throw new Error(`Impossibile creare il cliente di prova: ${erroreCliente?.message}`);
  }

  const [anno, mese, giorno] = opzioni.giornoYMD.split("-").map(Number);
  const [ore, minuti] = opzioni.oraHHMM.split(":").map(Number);
  const inizioPseudo = new Date(Date.UTC(anno, mese - 1, giorno, ore, minuti));
  const finePseudo = new Date(inizioPseudo.getTime() + servizio.durataMinuti * 60_000);
  const inizioReale = pseudoUtcAReale(inizioPseudo, FUSO_ORARIO_PREDEFINITO);
  const fineReale = pseudoUtcAReale(finePseudo, FUSO_ORARIO_PREDEFINITO);

  const { data: appuntamento, error: erroreAppuntamento } = await tenant.supabase
    .from("appuntamenti")
    .insert({
      tenant_id: tenant.id,
      cliente_id: cliente.id,
      operatore_id: operatore.id,
      servizio_id: servizio.id,
      inizio: inizioReale.toISOString(),
      fine: fineReale.toISOString(),
      stato: opzioni.stato ?? "confermato",
      creato_da: opzioni.creatoDa ?? "manuale",
    })
    .select("id")
    .single();
  if (erroreAppuntamento || !appuntamento) {
    throw new Error(`Impossibile creare l'appuntamento di prova: ${erroreAppuntamento?.message}`);
  }

  return { id: appuntamento.id, clienteId: cliente.id, inizio: inizioReale, fine: fineReale };
}
