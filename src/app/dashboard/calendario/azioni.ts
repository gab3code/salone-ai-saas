"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { ottieniTenantCorrente } from "@/lib/supabase/tenant";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoGestireAgenda } from "@/lib/ruoli";
import {
  creaAppuntamentoTenant,
  modificaAppuntamentoTenant,
  cancellaAppuntamentoTenant,
  parsaOrarioLocale,
} from "@/lib/booking-engine.server";

/**
 * Creazione di un appuntamento manuale dalla dashboard -- wrapper sottile
 * attorno a `creaAppuntamentoTenant` in booking-engine.server.ts, la STESSA
 * funzione che useranno i tool dell'AI in Fase 2 (punto 9, "single source of
 * truth": AI e calendario devono usare lo stesso motore, non due sistemi
 * separati). Qui si occupa solo di leggere il form e il tenant loggato.
 */
export async function creaAppuntamento(formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const operatoreId = String(formData.get("operatore_id") || "");
  // Servizi consecutivi (punto 12): il form manda un campo hidden
  // "servizio_id" per ogni servizio della catena, nell'ordine scelto --
  // getAll li recupera tutti (un solo campo = comportamento di sempre).
  const servizioIds = formData.getAll("servizio_id").map(String).filter(Boolean);
  const inizioStr = String(formData.get("inizio") || "");
  const clienteNome = String(formData.get("cliente_nome") || "").trim();
  const clienteTelefono = String(formData.get("cliente_telefono") || "").trim();

  if (!operatoreId || servizioIds.length === 0 || !inizioStr) {
    return { errore: "Scegli operatore, almeno un servizio e l'orario." };
  }

  const inizio = new Date(inizioStr);
  if (Number.isNaN(inizio.getTime())) {
    return { errore: "Orario non valido." };
  }

  const risultato = await creaAppuntamentoTenant(supabase, tenantId, {
    operatoreId,
    servizioId: servizioIds,
    inizio,
    clienteNome: clienteNome || undefined,
    clienteTelefono: clienteTelefono || undefined,
    creatoDa: "manuale",
  });

  if (!risultato.ok) return { errore: risultato.errore };

  revalidatePath("/dashboard/calendario");
  return { ok: true };
}

/**
 * Oltre alla cancellazione vera, `cancellaAppuntamentoTenant` controlla da
 * sola la lista d'attesa (Fase 6) e -- se un cliente in coda per lo stesso
 * servizio/operatore/giorno viene trovato -- marca la sua riga "proposto":
 * `listaAttesaAvvisata` arriva qui già pronto per essere mostrato subito a
 * chi ha appena cancellato, senza dover ricaricare /dashboard/lista-attesa
 * per accorgersene.
 */
export async function cancellaAppuntamento(id: string) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const risultato = await cancellaAppuntamentoTenant(supabase, tenantId, id);
  if (!risultato.ok) return { errore: risultato.errore };

  revalidatePath("/dashboard/calendario");
  return { ok: true, listaAttesaAvvisata: risultato.listaAttesaAvvisata ?? null };
}

/**
 * Sposta un appuntamento esistente su un nuovo orario/operatore -- wrapper
 * sottile attorno a `modificaAppuntamentoTenant`, stessa logica anti-conflitto
 * (esclude l'appuntamento stesso dal calcolo).
 */
export async function modificaAppuntamento(id: string, formData: FormData) {
  const supabase = await creaClientServer();
  const tenantId = await ottieniTenantCorrente(supabase);
  if (!tenantId) return { errore: "Nessun salone associato a questo utente." };

  const operatoreId = String(formData.get("operatore_id") || "");
  const inizioStrGrezzo = String(formData.get("inizio") || "");
  if (!operatoreId || !inizioStrGrezzo) return { errore: "Scegli operatore e orario." };

  // <input type="datetime-local"> restituisce "YYYY-MM-DDTHH:MM" senza fuso --
  // trattato come UTC per coerenza con la semplificazione sul fuso orario
  // usata in tutto il resto del booking engine (vedi nota in
  // booking-engine.server.ts), altrimenti verrebbe interpretato nel fuso
  // orario del server invece che come "l'ora scritta" dal titolare.
  const inizio = parsaOrarioLocale(inizioStrGrezzo);
  if (!inizio) return { errore: "Orario non valido." };

  const risultato = await modificaAppuntamentoTenant(supabase, tenantId, id, {
    operatoreId,
    inizio,
  });

  if (!risultato.ok) return { errore: risultato.errore };

  revalidatePath("/dashboard/calendario");
  return { ok: true };
}

/**
 * Marca un appuntamento passato come "non si è presentato", o annulla la
 * marcatura.
 *
 * Perché esiste (17/09/2026): lo stato `no_show` era nello schema dalla
 * migrazione 0001, nel motore di prenotazione, nelle metriche e nei test --
 * ma NESSUNA schermata lo scriveva mai. Nessun bottone, da nessuna parte. Il
 * risultato è che il tasso di no-show era strutturalmente zero in ogni punto
 * del prodotto che lo mostra, incluso il pannello di piattaforma: un numero
 * che non poteva essere diverso da zero, con l'aria di essere un dato.
 * Peggio ancora: la protezione dai no-show è la promessa centrale del
 * prodotto, e non era misurabile.
 *
 * **Si marca solo l'eccezione, non la normalità.** Nessun pulsante
 * "completato": chiedere al salone di confermare a mano ogni appuntamento
 * andato bene significa che smetterebbe di farlo dopo tre giorni, e allora
 * il dato sarebbe peggio di non averlo -- sembrerebbe vero ed esprimerebbe
 * solo chi si è ricordato di cliccare. Il tasso di no-show si calcola sul
 * totale degli appuntamenti passati, che il database conosce già.
 *
 * **Solo appuntamenti finiti.** Marcare come assente qualcuno che deve
 * ancora arrivare non è un caso d'uso, è un errore di clic.
 *
 * Lo può fare anche uno staff (`puoGestireAgenda`): è chi sta alla cassa a
 * vedere che il cliente delle 15 non è arrivato.
 */
export async function segnaNoShow(id: string, assente: boolean) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoGestireAgenda);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const { data: appuntamento } = await supabase
    .from("appuntamenti")
    .select("id, fine, stato")
    .eq("tenant_id", accesso.tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!appuntamento) return { errore: "Appuntamento non trovato." };

  if (new Date(appuntamento.fine as string).getTime() > Date.now()) {
    return { errore: "Si può segnare un'assenza solo dopo l'orario dell'appuntamento." };
  }
  // Un appuntamento cancellato non è un no-show: il cliente aveva avvisato.
  // Sono due cose diverse e vanno contate diversamente.
  if (appuntamento.stato === "cancellato") {
    return { errore: "Questo appuntamento era stato cancellato, non è un'assenza." };
  }

  const { error } = await supabase
    .from("appuntamenti")
    .update({ stato: assente ? "no_show" : "confermato" })
    .eq("tenant_id", accesso.tenantId)
    .eq("id", id);
  if (error) return { errore: `Errore salvando l'esito: ${error.message}` };

  revalidatePath("/dashboard/calendario");
  return { ok: true as const };
}
