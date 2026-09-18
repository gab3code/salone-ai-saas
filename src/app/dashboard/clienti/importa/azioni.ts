"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoImportareClienti } from "@/lib/ruoli";
import { creaClientiInBlocco, elencaClienti } from "@/lib/clienti.server";
import {
  calcolaDiffImport,
  leggiIncolla,
  telefonoUtilizzabile,
  type DiffImport,
  type RigaImport,
  MAX_RIGHE_IMPORT,
} from "@/lib/importa-clienti";

/**
 * Import della rubrica: le due azioni server.
 *
 * Stessa architettura dell'onboarding AI, e per la stessa ragione: prima si
 * ANALIZZA e si mostra cosa succederebbe, poi si scrive solo quello che il
 * titolare ha confermato. Qui e' anche piu' importante che altrove -- una
 * rubrica importata male non si "corregge dopo", si ripulisce a mano riga
 * per riga, ed e' esattamente la serata di lavoro che questa funzione esiste
 * per evitare.
 */

export type RisultatoAnalisi =
  | { ok: true; diff: DiffImport }
  | { ok: false; errore: string };

export async function analizzaImportAzione(testo: string): Promise<RisultatoAnalisi> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoImportareClienti);
  if (accessoNegato(accesso)) return { ok: false, errore: accesso.errore };

  if (typeof testo !== "string" || testo.trim() === "") {
    return { ok: false, errore: "Incolla l'elenco dei clienti, o carica un file CSV." };
  }

  const esito = leggiIncolla(testo);
  if (esito.clienti.length === 0) {
    return {
      ok: false,
      errore:
        "Non ho riconosciuto nessun cliente. Serve almeno un numero di telefono per riga: puoi incollare un CSV, un foglio Excel o un elenco 'nome, numero'.",
    };
  }

  // La rubrica attuale serve a non creare doppioni: va letta TUTTA, non una
  // pagina. `perExport` e' esattamente la lettura completa che serve qui.
  const esistenti = await elencaClienti(accesso.tenantId, { perExport: true });
  if (esistenti.errore) {
    return { ok: false, errore: `Non riesco a leggere la rubrica attuale: ${esistenti.errore}` };
  }

  return {
    ok: true,
    diff: calcolaDiffImport(
      esistenti.clienti.map((c) => ({ id: c.id, nome: c.nome, telefono: c.telefono })),
      esito
    ),
  };
}

export type RisultatoImport =
  | { ok: true; creati: number }
  | { ok: false; errore: string };

/**
 * Scrive SOLO le righe confermate. Non aggiorna i clienti gia' presenti
 * nemmeno quando l'incolla porta un nome diverso: sovrascrivere un nome che
 * il salone puo' aver corretto a mano, con uno preso da un file vecchio,
 * sarebbe un danno silenzioso. Chi vuole cambiarli lo fa dalla scheda.
 */
export async function applicaImportAzione(righe: RigaImport[]): Promise<RisultatoImport> {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoImportareClienti);
  if (accessoNegato(accesso)) return { ok: false, errore: accesso.errore };

  if (!Array.isArray(righe) || righe.length === 0) {
    return { ok: false, errore: "Nessun cliente selezionato." };
  }
  if (righe.length > MAX_RIGHE_IMPORT) {
    return { ok: false, errore: `Troppi clienti in una volta: il massimo e' ${MAX_RIGHE_IMPORT}.` };
  }

  // Non ci si fida di quello che torna dal browser: si ricontrolla che ogni
  // riga abbia un numero utilizzabile e si scartano quelle che dicono di
  // corrispondere a un cliente gia' esistente.
  const daCreare = righe
    .filter((r) => !r.esistenteId && telefonoUtilizzabile(r.telefono))
    .map((r) => ({
      nome: r.nome?.trim() || null,
      telefono: r.telefono.trim(),
      email: r.email?.trim() || null,
      note: r.note?.trim() || null,
    }));

  if (daCreare.length === 0) {
    return { ok: false, errore: "Nessun cliente nuovo da importare fra quelli selezionati." };
  }

  const esito = await creaClientiInBlocco(accesso.tenantId, daCreare);
  if (esito.errore) return { ok: false, errore: esito.errore };

  revalidatePath("/dashboard/clienti");
  return { ok: true, creati: esito.creati };
}
