"use server";

import { revalidatePath } from "next/cache";
import { creaClientAdmin } from "@/lib/supabase/admin";
import {
  cancellaAppuntamentoTenant,
  modificaAppuntamentoTenant,
  trovaSlotEStatoGiornoTenant,
  parsaOrarioLocale,
} from "@/lib/booking-engine.server";
import { cancellazioneOnlineConsentita, messaggioCancellazioneBloccata } from "@/lib/finestra-cancellazione";
import { motivoBloccoSpostamento, messaggioSpostamentoBloccato } from "@/lib/finestra-spostamento";
import { realeAPseudoUtc } from "@/lib/fuso-orario";
import { caricaFusoOrarioTenant } from "@/lib/fuso-orario.server";
import type { RisultatoAzionePubblica } from "@/app/s/[slug]/azioni";

const FORMATO_DATA_YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Riga minima dell'appuntamento + tenant necessaria per controllare il
 * blocco anti-abuso di cancellazione/spostamento -- estratta qui perché
 * serve identica in tre punti (cancella, cerca slot per lo spostamento,
 * conferma lo spostamento), MAI duplicata a mano tre volte.
 */
async function caricaAppuntamentoConTenant(
  supabase: ReturnType<typeof creaClientAdmin>,
  appuntamentoId: string
) {
  const { data } = await supabase
    .from("appuntamenti")
    .select(
      "tenant_id, stato, inizio, operatore_id, servizio_id, spostamenti_effettuati, tenants(nome, telefono, ore_minime_cancellazione)"
    )
    .eq("id", appuntamentoId)
    .maybeSingle();
  if (!data) return null;

  // Stessa normalizzazione oggetto-o-array delle relazioni annidate già
  // usata in notifiche.server.ts e in page.tsx.
  const uno = <T,>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : (v as T | null));
  const tenant = uno<{ nome: string; telefono: string | null; ore_minime_cancellazione: number }>(data.tenants);
  return { ...data, tenant };
}

/**
 * Cancellazione della prenotazione lato CLIENTE (PIANO.md Fase 4: "il modo
 * più naturale è un link 'gestisci la tua prenotazione' nell'email di
 * conferma, non un login separato per il cliente finale"). Nessuna
 * autenticazione Supabase: come per `/s/[slug]/azioni.ts`, il chiamante è un
 * visitatore anonimo -- qui riconosciuto SOLO dal possesso dell'id
 * dell'appuntamento (UUID v4, 122 bit di entropia, mai indovinabile),
 * ricevuto esclusivamente via il link nell'email di conferma
 * (`notifiche.server.ts`). Stesso identico modello di sicurezza già usato da
 * ogni prodotto di prenotazione consumer (Calendly, Google Calendar: un link
 * "cancella" con un id lungo nell'URL, senza password) -- non un compromesso
 * fatto qui, uno standard di settore.
 *
 * Riusa `cancellaAppuntamentoTenant`, la STESSA funzione di scrittura di
 * dashboard/AI/pubblico (punto 9 di CLAUDE.md): la cancellazione lato
 * cliente attiva quindi GRATIS anche la lista d'attesa automatica già
 * costruita lì (il primo cliente in coda per quello slot viene avvisato),
 * nessuna logica duplicata.
 *
 * FINESTRA MINIMA (richiesta di Gabriel il 14/09/2026, migrazione 0016):
 * ogni titolare può impostare quante ore prima dell'appuntamento la
 * cancellazione online resta permessa (`tenants.ore_minime_cancellazione`,
 * default 24, configurabile da /dashboard/impostazioni/cancellazione). Sotto
 * quella soglia questa azione rifiuta e indica il numero del salone -- vedi
 * src/lib/finestra-cancellazione.ts (funzione pura, testata a parte). Stesso
 * controllo mostrato in anticipo in page.tsx per nascondere il bottone, ma
 * QUESTO è il punto autorevole: un link riaperto da una tab vecchia o una
 * pagina in cache non deve mai bypassare la regola.
 */
export async function cancellaPrenotazionePubblica(appuntamentoId: string): Promise<RisultatoAzionePubblica> {
  const supabase = creaClientAdmin();

  const appuntamento = await caricaAppuntamentoConTenant(supabase, appuntamentoId);
  if (!appuntamento) return { ok: false, errore: "Prenotazione non trovata." };
  if (appuntamento.stato === "cancellato") {
    return { ok: false, errore: "Questa prenotazione è già stata cancellata." };
  }

  if (
    appuntamento.tenant &&
    !cancellazioneOnlineConsentita(new Date(appuntamento.inizio), appuntamento.tenant.ore_minime_cancellazione)
  ) {
    return {
      ok: false,
      errore: messaggioCancellazioneBloccata(
        appuntamento.tenant.ore_minime_cancellazione,
        appuntamento.tenant.nome,
        appuntamento.tenant.telefono
      ),
    };
  }

  const risultato = await cancellaAppuntamentoTenant(supabase, appuntamento.tenant_id, appuntamentoId);
  if (!risultato.ok) return { ok: false, errore: risultato.errore };

  revalidatePath(`/gestisci/${appuntamentoId}`);
  return { ok: true };
}

export interface SlotSpostamento {
  inizioIso: string; // ISO "pseudo-UTC" (vedi src/lib/fuso-orario.ts), invariato da mostrare/rimandare
}

/**
 * Spostamento self-service dell'appuntamento (Fase 4, richiesta di Gabriel
 * il 15/09/2026): STESSO modello di sicurezza della cancellazione qui sopra
 * (nessun login, solo il possesso dell'id nel link), stesso operatore e
 * servizio dell'appuntamento originale -- il cliente sceglie solo un nuovo
 * giorno/orario, non un nuovo trattamento (per cambiare servizio deve
 * cancellare e riprenotare, o contattare il salone). Riusa
 * `trovaSlotEStatoGiornoTenant`, LA STESSA ricerca slot di dashboard/AI/
 * pubblico (punto 9 di CLAUDE.md).
 *
 * Il blocco anti-abuso (finestra oraria + massimo 1 spostamento, vedi
 * finestra-spostamento.ts) è controllato ANCHE qui, non solo alla conferma:
 * a un cliente già bloccato non ha senso far scegliere un orario che non
 * potrà mai confermare. Il controllo che conta davvero resta comunque quello
 * in `spostaPrenotazionePubblica`, per lo stesso motivo per cui la finestra
 * di cancellazione è ricontrollata lì e non solo in page.tsx.
 */
export async function cercaSlotSpostamentoPubblico(
  appuntamentoId: string,
  dataYMD: string
): Promise<RisultatoAzionePubblica<{ slot: SlotSpostamento[]; giornoChiuso: boolean }>> {
  if (!FORMATO_DATA_YMD.test(dataYMD)) return { ok: false, errore: "Data non valida." };

  const supabase = creaClientAdmin();
  const appuntamento = await caricaAppuntamentoConTenant(supabase, appuntamentoId);
  if (!appuntamento) return { ok: false, errore: "Prenotazione non trovata." };
  if (appuntamento.stato === "cancellato") {
    return { ok: false, errore: "Questa prenotazione è stata cancellata." };
  }
  // Difensivo: lo schema permette entrambe le colonne nullable (per
  // appuntamenti creati fuori dal normale flusso di scrittura), ma senza
  // operatore e servizio il motore di disponibilità non ha nulla su cui
  // cercare -- niente crash, un messaggio chiaro invece.
  if (!appuntamento.operatore_id || !appuntamento.servizio_id) {
    return { ok: false, errore: "Questo appuntamento non può essere spostato online, contatta l'attività." };
  }

  if (appuntamento.tenant) {
    const motivo = motivoBloccoSpostamento(
      new Date(appuntamento.inizio),
      appuntamento.tenant.ore_minime_cancellazione,
      appuntamento.spostamenti_effettuati
    );
    if (motivo) {
      return {
        ok: false,
        errore: messaggioSpostamentoBloccato(
          motivo,
          appuntamento.tenant.ore_minime_cancellazione,
          appuntamento.tenant.nome,
          appuntamento.tenant.telefono
        ),
      };
    }
  }

  const fusoOrario = await caricaFusoOrarioTenant(supabase, appuntamento.tenant_id);
  const { slot: slotGrezzi, giornoChiuso } = await trovaSlotEStatoGiornoTenant(supabase, appuntamento.tenant_id, {
    data: new Date(`${dataYMD}T00:00:00Z`),
    servizioIds: [appuntamento.servizio_id],
    operatoreId: appuntamento.operatore_id,
  });

  // Stesso filtro "mai uno slot già passato" di cercaSlotPubblici
  // (src/app/s/[slug]/azioni.ts) -- un cliente che sposta da solo non deve
  // mai poter scegliere un orario di oggi già trascorso.
  const adessoPseudo = realeAPseudoUtc(new Date(), fusoOrario);
  const slot = slotGrezzi
    .filter((s) => s.inizio.getTime() > adessoPseudo.getTime())
    .map((s) => ({ inizioIso: s.inizio.toISOString() }));

  return { ok: true, slot, giornoChiuso };
}

/**
 * Conferma lo spostamento: punto AUTOREVOLE (rifà da capo ogni controllo,
 * mai fidandosi che il client abbia già passato da `cercaSlotSpostamentoPubblico`
 * poco prima -- un link riaperto da una tab vecchia non deve mai bypassare
 * né la finestra oraria né il tetto di 1 spostamento). Riusa
 * `modificaAppuntamentoTenant` con `incrementaSpostamentiEffettuati: true`,
 * quindi eredita gratis il controllo di conflitto sull'operatore (stesso
 * identico rischio di due clienti che scelgono lo stesso slot in
 * contemporanea già gestito lì).
 */
export async function spostaPrenotazionePubblica(
  appuntamentoId: string,
  nuovoInizioIso: string
): Promise<RisultatoAzionePubblica> {
  const supabase = creaClientAdmin();
  const appuntamento = await caricaAppuntamentoConTenant(supabase, appuntamentoId);
  if (!appuntamento) return { ok: false, errore: "Prenotazione non trovata." };
  if (appuntamento.stato === "cancellato") {
    return { ok: false, errore: "Questa prenotazione è stata cancellata." };
  }
  if (!appuntamento.operatore_id) {
    return { ok: false, errore: "Questo appuntamento non può essere spostato online, contatta l'attività." };
  }

  if (appuntamento.tenant) {
    const motivo = motivoBloccoSpostamento(
      new Date(appuntamento.inizio),
      appuntamento.tenant.ore_minime_cancellazione,
      appuntamento.spostamenti_effettuati
    );
    if (motivo) {
      return {
        ok: false,
        errore: messaggioSpostamentoBloccato(
          motivo,
          appuntamento.tenant.ore_minime_cancellazione,
          appuntamento.tenant.nome,
          appuntamento.tenant.telefono
        ),
      };
    }
  }

  const nuovoInizio = parsaOrarioLocale(nuovoInizioIso);
  if (!nuovoInizio) return { ok: false, errore: "Orario non valido, riprova la ricerca." };

  const risultato = await modificaAppuntamentoTenant(supabase, appuntamento.tenant_id, appuntamentoId, {
    operatoreId: appuntamento.operatore_id,
    inizio: nuovoInizio,
    incrementaSpostamentiEffettuati: true,
  });
  if (!risultato.ok) return { ok: false, errore: risultato.errore };

  revalidatePath(`/gestisci/${appuntamentoId}`);
  return { ok: true };
}
