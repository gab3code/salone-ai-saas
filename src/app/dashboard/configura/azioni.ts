"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";
import { limiteOperatori } from "@/lib/piani";
import { sincronizzaQuantitaOperatoriStripe } from "@/lib/stripe/operatori.server";
import {
  valutaEliminazioneOperatore,
  valutaEliminazioneServizio,
} from "@/lib/configura-sicurezza";
import { giorniDelPeriodo, leggiFascia } from "@/lib/periodi-chiusura";

const GIORNI = [0, 1, 2, 3, 4, 5, 6] as const;

// Solo per i messaggi d'errore: "Lunedi': l'orario di fine..." e' leggibile,
// "giorno 1" no.
const NOMI_GIORNI = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
] as const;

/**
 * Onboarding minimo (punto 1 del funnel self-service, Fase 1): senza orari,
 * operatori e servizi veri non c'è nulla su cui il booking engine possa
 * lavorare -- questa è la schermata che rende il resto reale, non solo
 * teorico.
 */

export async function salvaOrari(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  // VALIDAZIONE (19/09/2026). Prima qui non c'era nulla, e si e' visto.
  //
  // Il caso vero: la bozza AI ha salvato il sabato come "aperto dalle 00:00
  // alle 19:00", e il calendario ha cominciato a proporre appuntamenti alle
  // 00:15 di notte. Nessun controllo ha protestato, perche' "00:00" e' un
  // orario formalmente valido -- il difetto non era il formato, era che
  // nessuno chiedeva se avesse senso.
  //
  // Le due regole qui sotto valgono per il salone come gia' valevano per il
  // singolo operatore (vedi `salvaOrariOperatore` piu' sotto, che le aveva
  // dal primo giorno). Che due funzioni sorelle avessero regole diverse era
  // il vero difetto: una delle due era rimasta indietro e nessuno se n'era
  // accorto perche' i controlli guardavano il formato, non la coerenza.
  const righe: {
    tenant_id: string;
    giorno_settimana: number;
    chiuso: boolean;
    apertura: string | null;
    chiusura: string | null;
    pausa_inizio: string | null;
    pausa_fine: string | null;
  }[] = [];

  for (const giorno of GIORNI) {
    const chiuso = formData.get(`chiuso_${giorno}`) === "on";
    const apertura = String(formData.get(`apertura_${giorno}`) || "");
    const chiusura = String(formData.get(`chiusura_${giorno}`) || "");
    const pausaInizio = String(formData.get(`pausa_inizio_${giorno}`) || "");
    const pausaFine = String(formData.get(`pausa_fine_${giorno}`) || "");

    if (!chiuso) {
      // "Aperto" senza orari non e' uno stato: il motore lo tratta come
      // chiuso (vedi `intervalliApertura`), quindi la schermata direbbe
      // aperto e il prodotto si comporterebbe da chiuso. Una mezza
      // funzionalita' e' peggio di una mancante, perche' sembra a posto.
      if (!apertura || !chiusura) {
        return {
          errore: `${NOMI_GIORNI[giorno]}: se il giorno e' aperto servono sia l'orario di apertura sia quello di chiusura. Se invece siete chiusi, spunta "Chiuso".`,
        };
      }
      if (chiusura <= apertura) {
        return { errore: `${NOMI_GIORNI[giorno]}: la chiusura deve venire dopo l'apertura.` };
      }
      if (pausaInizio && pausaFine && pausaFine <= pausaInizio) {
        return { errore: `${NOMI_GIORNI[giorno]}: la pausa deve finire dopo il suo inizio.` };
      }
    }

    righe.push({
      tenant_id: tenantId,
      giorno_settimana: giorno,
      chiuso,
      apertura: chiuso ? null : apertura,
      chiusura: chiuso ? null : chiusura,
      pausa_inizio: chiuso || !pausaInizio ? null : pausaInizio,
      pausa_fine: chiuso || !pausaFine ? null : pausaFine,
    });
  }

  const { error } = await supabase
    .from("orari_apertura")
    .upsert(righe, { onConflict: "tenant_id,giorno_settimana" });

  if (error) return { errore: `Errore salvando gli orari: ${error.message}` };

  revalidatePath("/dashboard/configura");
  return { ok: true };
}

/**
 * Regole con cui QUESTO salone riempie l'agenda (migrazione 0056).
 *
 * Non sono preferenze estetiche: il passo decide gli orari che il cliente si
 * vede proporre, il buffer decide se fra un cliente e l'altro resta il tempo
 * di pulire, la modalita' decide se si privilegia la poltrona piena o la
 * lista di orari leggibile. Prima erano gli stessi numeri per tutti.
 */
export async function salvaRegoleAgenda(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const passo = Number(formData.get("passo_slot_minuti"));
  const buffer = Number(formData.get("buffer_minuti"));
  const riempimento = String(formData.get("riempimento_agenda") || "griglia");

  // Gli stessi limiti dei vincoli della 0056, controllati anche qui: un
  // errore di database arriva all'utente come stringa incomprensibile.
  if (!Number.isInteger(passo) || passo < 5 || passo > 240) {
    return { errore: "Il passo degli orari deve stare fra 5 e 240 minuti." };
  }
  if (!Number.isInteger(buffer) || buffer < 0 || buffer > 240) {
    return { errore: "Lo stacco fra appuntamenti deve stare fra 0 e 240 minuti." };
  }
  if (riempimento !== "griglia" && riempimento !== "attaccato") {
    return { errore: "Modalita' di riempimento non valida." };
  }

  const { error } = await supabase
    .from("tenants")
    .update({
      passo_slot_minuti: passo,
      buffer_minuti: buffer,
      riempimento_agenda: riempimento,
    })
    .eq("id", accesso.tenantId);

  if (error) return { errore: `Errore salvando le regole dell'agenda: ${error.message}` };

  // Gli orari proposti cambiano ovunque, non solo qui: calendario interno,
  // pagina pubblica e link di gestione leggono tutti dallo stesso motore.
  revalidatePath("/dashboard/configura");
  revalidatePath("/dashboard/calendario");
  return { ok: true };
}

/**
 * Orari settimanali di UN operatore (migrazione 0057).
 *
 * "Segue gli orari del salone" non e' un valore speciale: e' l'assenza di
 * righe. Toglierle e' quindi un'operazione legittima e prevista, non una
 * cancellazione di dati da temere.
 */
export async function salvaOrariOperatore(operatoreId: string, formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  // L'operatore deve essere di QUESTO salone: RLS lo impedirebbe comunque,
  // ma un controllo esplicito produce un errore leggibile invece di un
  // silenzioso "zero righe aggiornate".
  const { data: operatore } = await supabase
    .from("operatori")
    .select("id")
    .eq("id", operatoreId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!operatore) return { errore: "Operatore non trovato." };

  const segueIlSalone = formData.get("segue_salone") === "on";

  const { error: erroreCancellazione } = await supabase
    .from("orari_operatore")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("operatore_id", operatoreId);
  if (erroreCancellazione) {
    return { errore: `Errore aggiornando gli orari: ${erroreCancellazione.message}` };
  }

  if (!segueIlSalone) {
    const righe = [];
    for (const giorno of GIORNI) {
      const apertura = String(formData.get(`op_apertura_${giorno}`) || "");
      const chiusura = String(formData.get(`op_chiusura_${giorno}`) || "");
      const pausaInizio = String(formData.get(`op_pausa_inizio_${giorno}`) || "");
      const pausaFine = String(formData.get(`op_pausa_fine_${giorno}`) || "");
      // Un giorno senza orari e' un giorno non lavorato: i vincoli della 0057
      // rifiuterebbero la riga a meta' con un errore tecnico illeggibile.
      const chiuso = formData.get(`op_chiuso_${giorno}`) === "on" || !apertura || !chiusura;

      if (!chiuso && chiusura <= apertura) {
        return { errore: `${NOMI_GIORNI[giorno]}: l'orario di fine deve venire dopo quello di inizio.` };
      }
      // Mezza pausa non e' un dato: o ci sono tutti e due gli estremi o non
      // ce n'e' nessuno.
      const conPausa = !chiuso && Boolean(pausaInizio) && Boolean(pausaFine);
      if (conPausa && pausaFine <= pausaInizio) {
        return { errore: `${NOMI_GIORNI[giorno]}: la pausa deve finire dopo il suo inizio.` };
      }

      righe.push({
        tenant_id: tenantId,
        operatore_id: operatoreId,
        giorno_settimana: giorno,
        chiuso,
        apertura: chiuso ? null : apertura,
        chiusura: chiuso ? null : chiusura,
        pausa_inizio: conPausa ? pausaInizio : null,
        pausa_fine: conPausa ? pausaFine : null,
      });
    }

    const { error } = await supabase.from("orari_operatore").insert(righe);
    if (error) return { errore: `Errore salvando gli orari: ${error.message}` };
  }

  revalidatePath("/dashboard/configura");
  revalidatePath("/dashboard/calendario");
  return { ok: true };
}

export async function creaOperatore(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { errore: "Il nome dell'operatore è obbligatorio." };

  // Bio/specializzazione opzionale (Fase 2, migrazione 0021): letta anche
  // dallo strumento AI `elenca_operatori` (src/lib/ai/tools.ts).
  const descrizione = String(formData.get("descrizione") || "").trim().slice(0, 500) || null;

  // "1 operatore" sul piano Free (Fase 5 di PIANO.md, trovato 13/09/2026):
  // pubblicizzato in Prezzi.tsx ma mai applicato tecnicamente finché
  // limiteOperatori non esisteva -- stesso principio del tetto mensile di
  // prenotazioni in booking-engine.server.ts (punto 20 di CLAUDE.md, "il
  // sistema deve tecnicamente applicare i limiti"). Fail-open sull'errore di
  // lettura del piano: non riuscire a leggerlo non deve mai bloccare la
  // creazione di un operatore vero.
  const { data: tenant } = await supabase.from("tenants").select("piano").eq("id", tenantId).single();
  const limite = limiteOperatori(tenant?.piano ?? "");
  if (limite !== Infinity) {
    const { count } = await supabase
      .from("operatori")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    if ((count ?? 0) >= limite) {
      return {
        errore: `Il piano Free è limitato a ${limite} ${limite === 1 ? "operatore" : "operatori"}. Passa a un piano superiore per aggiungerne altri.`,
      };
    }
  }

  // .select("id").single() aggiunto 15/09/2026 per Fase 3 (onboarding
  // AI-assisted, applicaBozzaOnboarding in questo stesso file): serve l'id
  // appena creato per risolvere le associazioni operatore/servizio della
  // bozza. Nessun chiamante esistente legge il valore restituito (i form di
  // page.tsx lo scartano), quindi è un'estensione innocua.
  const { data: operatoreCreato, error } = await supabase
    .from("operatori")
    .insert({ tenant_id: tenantId, nome, descrizione })
    .select("id")
    .single();
  if (error) return { errore: `Errore creando l'operatore: ${error.message}` };

  // Su Pro il prezzo scala con gli operatori (il prezzo base include il
  // primo, poi 10/15/20€ ciascuno a seconda del piano, vedi priceIdOperatoreExtra in
  // stripe/piani.ts) --
  // DOPO che la scrittura sopra è già andata a buon fine, mai prima (fail-open,
  // vedi il docblock della funzione).
  await sincronizzaQuantitaOperatoriStripe(supabase, tenantId);

  revalidatePath("/dashboard/configura");
  return { ok: true as const, id: operatoreCreato.id as string };
}

/**
 * Modifica un operatore gia' esistente. Fino al 18/09/2026 non esisteva:
 * per correggere un nome scritto male l'unica strada era cancellare e
 * ricreare, che azzera l'operatore su tutti gli appuntamenti storici (vedi
 * il docblock di @/lib/configura-sicurezza). Un refuso costava lo storico.
 */
export async function aggiornaOperatore(id: string, formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { errore: "Il nome dell'operatore è obbligatorio." };
  const descrizione = String(formData.get("descrizione") || "").trim().slice(0, 500) || null;

  // `.eq("tenant_id")` oltre a RLS: la rete di sicurezza del database resta,
  // ma un filtro esplicito rende l'intenzione leggibile qui.
  const { error } = await supabase
    .from("operatori")
    .update({ nome, descrizione })
    .eq("id", id)
    .eq("tenant_id", accesso.tenantId);
  if (error) return { errore: `Errore aggiornando l'operatore: ${error.message}` };

  revalidatePath("/dashboard/configura");
  return { ok: true as const };
}

/**
 * Disattiva (o riattiva) un operatore. La colonna `attivo` esiste dalla
 * 0001 ed e' sempre stata letta dal motore -- un operatore non attivo non
 * riceve slot -- ma non la scriveva nessuno: la mezza funzionalita' piu'
 * vecchia del progetto. E' la risposta giusta a "togli Marco": Marco
 * sparisce da quello che si puo' prenotare, i suoi appuntamenti restano suoi.
 */
export async function impostaAttivoOperatore(id: string, attivo: boolean) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const { error } = await supabase
    .from("operatori")
    .update({ attivo })
    .eq("id", id)
    .eq("tenant_id", accesso.tenantId);
  if (error) return { errore: `Errore aggiornando l'operatore: ${error.message}` };

  revalidatePath("/dashboard/configura");
  revalidatePath("/dashboard/calendario");
  return { ok: true as const };
}

export async function eliminaOperatore(id: string) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  // Prima di cancellare: contare cosa si porterebbe dietro. Il vincolo nel
  // database e' `on delete set null`, quindi la cancellazione NON fallisce
  // mai da sola -- svuota in silenzio l'operatore su ogni appuntamento.
  const { count: appuntamenti } = await supabase
    .from("appuntamenti")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("operatore_id", id);

  const esito = valutaEliminazioneOperatore({ appuntamenti: appuntamenti ?? 0 });
  if (!esito.consentita) return { errore: esito.motivo };

  const { error } = await supabase.from("operatori").delete().eq("id", id).eq("tenant_id", tenantId);
  if (error) return { errore: `Errore eliminando l'operatore: ${error.message}` };

  await sincronizzaQuantitaOperatoriStripe(supabase, tenantId);

  revalidatePath("/dashboard/configura");
  return { ok: true };
}

export async function creaServizio(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const nome = String(formData.get("nome") || "").trim();
  const durataMinuti = Number(formData.get("durata_minuti") || 0);
  const prezzoEuro = Number(formData.get("prezzo_euro") || 0);

  if (!nome) return { errore: "Il nome del servizio è obbligatorio." };
  if (!Number.isFinite(durataMinuti) || durataMinuti <= 0) {
    return { errore: "La durata deve essere un numero di minuti maggiore di zero." };
  }
  if (!Number.isFinite(prezzoEuro) || prezzoEuro < 0) {
    return { errore: "Il prezzo non può essere negativo." };
  }

  // .select("id").single(): stesso motivo di creaOperatore sopra.
  const { data: servizioCreato, error } = await supabase
    .from("servizi")
    .insert({
      tenant_id: tenantId,
      nome,
      durata_minuti: Math.round(durataMinuti),
      prezzo_centesimi: Math.round(prezzoEuro * 100),
    })
    .select("id")
    .single();
  if (error) return { errore: `Errore creando il servizio: ${error.message}` };

  revalidatePath("/dashboard/configura");
  return { ok: true as const, id: servizioCreato.id as string };
}

/** Modifica un servizio esistente: stesso motivo di `aggiornaOperatore`. */
export async function aggiornaServizio(id: string, formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const nome = String(formData.get("nome") || "").trim();
  const durataMinuti = Number(formData.get("durata_minuti") || 0);
  const prezzoEuro = Number(formData.get("prezzo_euro") || 0);

  if (!nome) return { errore: "Il nome del servizio è obbligatorio." };
  if (!Number.isFinite(durataMinuti) || durataMinuti <= 0) {
    return { errore: "La durata deve essere un numero di minuti maggiore di zero." };
  }
  if (!Number.isFinite(prezzoEuro) || prezzoEuro < 0) {
    return { errore: "Il prezzo non può essere negativo." };
  }

  const { error } = await supabase
    .from("servizi")
    .update({
      nome,
      durata_minuti: Math.round(durataMinuti),
      prezzo_centesimi: Math.round(prezzoEuro * 100),
    })
    .eq("id", id)
    .eq("tenant_id", accesso.tenantId);
  if (error) return { errore: `Errore aggiornando il servizio: ${error.message}` };

  revalidatePath("/dashboard/configura");
  return { ok: true as const };
}

/** Disattiva (o riattiva) un servizio: non piu' prenotabile, storico intero. */
export async function impostaAttivoServizio(id: string, attivo: boolean) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  const { error } = await supabase
    .from("servizi")
    .update({ attivo })
    .eq("id", id)
    .eq("tenant_id", accesso.tenantId);
  if (error) return { errore: `Errore aggiornando il servizio: ${error.message}` };

  revalidatePath("/dashboard/configura");
  revalidatePath("/dashboard/calendario");
  return { ok: true as const };
}

export async function eliminaServizio(id: string) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  // Per un servizio il danno e' doppio: `set null` sugli appuntamenti e
  // `cascade` sulle richieste di caparra, cioe' righe che parlano di soldi.
  const [{ count: appuntamenti }, { count: richiesteCaparra }] = await Promise.all([
    supabase
      .from("appuntamenti")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", accesso.tenantId)
      .eq("servizio_id", id),
    supabase
      .from("richieste_caparra")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", accesso.tenantId)
      .eq("servizio_id", id),
  ]);

  const esito = valutaEliminazioneServizio({
    appuntamenti: appuntamenti ?? 0,
    richiesteCaparra: richiesteCaparra ?? 0,
  });
  if (!esito.consentita) return { errore: esito.motivo };

  const { error } = await supabase
    .from("servizi")
    .delete()
    .eq("id", id)
    .eq("tenant_id", accesso.tenantId);
  if (error) return { errore: `Errore eliminando il servizio: ${error.message}` };
  revalidatePath("/dashboard/configura");
  return { ok: true };
}

/**
 * Un operatore eroga un servizio solo se esplicitamente associato -- senza
 * questo passaggio calcolaSlotDisponibili non troverebbe mai nessuno
 * disponibile per quel servizio (comportamento corretto: meglio "nessuno
 * slot" che proporre un operatore non qualificato).
 */
export async function impostaAssociazioneOperatoreServizio(
  operatoreId: string,
  servizioId: string,
  associato: boolean
) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };

  // Entrambi devono essere di QUESTO salone. La policy della 0030 guardava
  // solo l'operatore (corretta dalla 0058): con l'UUID di un servizio altrui
  // si poteva scrivere un'associazione fra due saloni diversi. Il controllo
  // sta in tutti e due i posti, come sempre in questo progetto.
  if (associato) {
    const [{ data: operatore }, { data: servizio }] = await Promise.all([
      supabase.from("operatori").select("id").eq("id", operatoreId).eq("tenant_id", accesso.tenantId).maybeSingle(),
      supabase.from("servizi").select("id").eq("id", servizioId).eq("tenant_id", accesso.tenantId).maybeSingle(),
    ]);
    if (!operatore || !servizio) return { errore: "Operatore o servizio non trovato." };
  }

  if (associato) {
    const { error } = await supabase
      .from("operatori_servizi")
      .insert({ operatore_id: operatoreId, servizio_id: servizioId });
    if (error) return { errore: `Errore associando il servizio: ${error.message}` };
  } else {
    const { error } = await supabase
      .from("operatori_servizi")
      .delete()
      .eq("operatore_id", operatoreId)
      .eq("servizio_id", servizioId);
    if (error) return { errore: `Errore rimuovendo l'associazione: ${error.message}` };
  }

  revalidatePath("/dashboard/configura");
  return { ok: true };
}

// ---------------------------------------------------------------------
// Ferie e chiusure straordinarie
// ---------------------------------------------------------------------
// La tabella `chiusure` esiste dalla 0002 ed e' sempre stata letta dal motore
// di disponibilita'. Non la scriveva nessuna schermata: fino al 18/09/2026 un
// salone non poteva dire "chiudiamo dal 10 al 20 agosto" da nessuna parte del
// prodotto. Il motore era pronto, il prodotto no.

/**
 * Un periodo diventa una riga per giorno, perche' e' cosi' che il motore lo
 * sa leggere. Il raggruppamento inverso (undici righe -> "10-20 agosto") lo
 * fa la schermata, con `raggruppaInPeriodi`.
 */
export async function aggiungiChiusura(formData: FormData) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  const tenantId = accesso.tenantId;

  const inizio = String(formData.get("data_inizio") || "").trim();
  const fine = String(formData.get("data_fine") || "").trim();
  const motivo = String(formData.get("motivo") || "").trim().slice(0, 200) || null;
  const giornoIntero = formData.get("giorno_intero") !== "no";
  const operatoreIdGrezzo = String(formData.get("operatore_id") || "").trim();

  const periodo = giorniDelPeriodo(inizio, fine);
  if (!periodo.ok) return { errore: periodo.errore };

  const fascia = leggiFascia(
    giornoIntero,
    String(formData.get("ora_inizio") || "").trim(),
    String(formData.get("ora_fine") || "").trim()
  );
  if (!fascia.ok) return { errore: fascia.errore };

  // "tutto il salone" e' l'assenza di operatore, non un valore speciale.
  let operatoreId: string | null = null;
  if (operatoreIdGrezzo && operatoreIdGrezzo !== "tutti") {
    const { data: operatore } = await supabase
      .from("operatori")
      .select("id")
      .eq("id", operatoreIdGrezzo)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!operatore) return { errore: "Operatore non trovato." };
    operatoreId = operatoreIdGrezzo;
  }

  const righe = periodo.giorni.map((data) => ({
    tenant_id: tenantId,
    operatore_id: operatoreId,
    data,
    giorno_intero: fascia.fascia.giornoIntero,
    ora_inizio: fascia.fascia.oraInizio,
    ora_fine: fascia.fascia.oraFine,
    motivo,
  }));

  const { error } = await supabase.from("chiusure").insert(righe);
  if (error) return { errore: `Errore salvando la chiusura: ${error.message}` };

  // Gli slot liberi cambiano ovunque, non solo qui.
  revalidatePath("/dashboard/configura");
  revalidatePath("/dashboard/calendario");
  return { ok: true as const, giorni: periodo.giorni.length };
}

/**
 * Toglie una chiusura. Riceve TUTTI gli id del periodo, perche' un periodo
 * e' un gruppo di righe: cancellarne una sola lascerebbe un buco in mezzo
 * alle ferie, che e' esattamente il genere di errore che poi nessuno nota.
 *
 * Cancellare una chiusura non distrugge niente di storico: riapre soltanto
 * degli orari. Per questo, a differenza di operatori e servizi, qui non c'e'
 * nessuna guardia da superare.
 */
export async function eliminaChiusura(ids: string[]) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) return { errore: accesso.errore };
  if (ids.length === 0) return { ok: true as const };

  const { error } = await supabase
    .from("chiusure")
    .delete()
    .in("id", ids)
    .eq("tenant_id", accesso.tenantId);
  if (error) return { errore: `Errore togliendo la chiusura: ${error.message}` };

  revalidatePath("/dashboard/configura");
  revalidatePath("/dashboard/calendario");
  return { ok: true as const };
}
