"use server";

import { revalidatePath } from "next/cache";
import { creaClientServer } from "@/lib/supabase/server";
import { eAdminPiattaforma, ERRORE_PERMESSO_NEGATO } from "@/lib/ruoli";
import {
  anteprimaCambioPianoAdmin,
  cambiaPianoAttivita,
  cancellaAttivita,
  riattivaAttivita,
  riepilogoCancellazione,
  riportaPianoSuStripe,
  sospendiAttivita,
  type AutoreIntervento,
} from "@/lib/admin.server";
import { azioneStripeValida } from "@/lib/stripe/cambio-piano.server";
import * as Sentry from "@sentry/nextjs";

/**
 * Azioni del pannello di piattaforma. Il layout di /admin blocca già chi non
 * è admin, ma una server action è un endpoint POST richiamabile da chiunque
 * abbia una sessione valida senza mai aprire la pagina: il controllo va
 * rifatto qui, ogni volta.
 *
 * `autoreSeAdmin` restituisce anche CHI sta agendo, non solo un sì/no: ogni
 * intervento finisce nel registro (migrazione 0029) con il suo nome, e un
 * registro senza autore non dimostra niente.
 */
async function autoreSeAdmin(): Promise<AutoreIntervento | null> {
  const supabase = await creaClientServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profilo } = await supabase
    .from("profiles")
    .select("ruolo")
    .eq("id", user.id)
    .single();

  if (!eAdminPiattaforma(profilo?.ruolo)) return null;
  return { userId: user.id, email: user.email ?? null };
}

/**
 * Sola lettura: cosa cambierebbe sull'abbonamento Stripe. Si mostra PRIMA di
 * qualunque scrittura -- è l'unica cosa che sta fra un cambio piano voluto e
 * un cliente che scopre una cifra diversa sull'estratto conto.
 */
export async function anteprimaCambioPianoAction(tenantId: string, piano: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };
  return anteprimaCambioPianoAdmin(tenantId, piano);
}

export async function cambiaPianoAction(
  tenantId: string,
  piano: string,
  statoAbbonamento: string,
  azioneStripe: string
) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };
  if (!azioneStripeValida(azioneStripe)) return { errore: "Modalità di aggiornamento non valida." };

  const esito = await cambiaPianoAttivita(autore, tenantId, piano, statoAbbonamento, azioneStripe);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true, messaggio: esito.messaggio };
}

export async function riportaPianoSuStripeAction(tenantId: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await riportaPianoSuStripe(autore, tenantId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true };
}

export async function sospendiAttivitaAction(tenantId: string, motivo: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await sospendiAttivita(autore, tenantId, motivo);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true };
}

export async function riattivaAttivitaAction(tenantId: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  const esito = await riattivaAttivita(autore, tenantId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return { ok: true };
}

/** Solo lettura: cosa sparirebbe. Mostrato prima di chiedere conferma. */
export async function riepilogoCancellazioneAction(tenantId: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };
  return riepilogoCancellazione(tenantId);
}

/**
 * La conferma non è un `confirm()` ma il nome esatto dell'attività digitato
 * a mano, verificato di nuovo QUI e non solo nel browser: è l'ultima
 * differenza fra "ho cancellato l'attività sbagliata" e "non è successo
 * niente", e un controllo che vive solo lato client non è un controllo.
 */
export async function cancellaAttivitaAction(tenantId: string, nomeDigitato: string) {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  const riepilogo = await riepilogoCancellazione(tenantId);
  if ("errore" in riepilogo) return { errore: riepilogo.errore };

  if (nomeDigitato.trim() !== riepilogo.nome) {
    return { errore: `Per confermare devi scrivere esattamente: ${riepilogo.nome}` };
  }

  const esito = await cancellaAttivita(autore, tenantId);
  if ("errore" in esito) return { errore: esito.errore };

  revalidatePath("/admin");
  return {
    ok: true,
    messaggio:
      esito.accountCancellati > 0
        ? `Attività cancellata, insieme a ${esito.accountCancellati} account che non facevano parte di nient'altro.`
        : "Attività cancellata.",
  };
}

/**
 * Manda una segnalazione di prova a Sentry, e dice se e' partita.
 *
 * Non e' un gadget: la diagnostica degli errori e' l'unico strumento che, se
 * smette di funzionare, non da' nessun segno -- il silenzio e' esattamente il
 * risultato che ci si aspetta di vedere quando tutto va bene. Una chiave
 * scaduta, una variabile persa in un deploy, una regione sbagliata: tutte
 * cose che si scoprirebbero il giorno in cui serve, cioe' il giorno peggiore.
 *
 * Da qui si verifica in due secondi, e senza rompere niente apposta in
 * produzione.
 *
 * Solo admin di piattaforma: chiunque potrebbe altrimenti riempire la quota
 * mensile di segnalazioni finte.
 */
export async function provaSentryAction() {
  const autore = await autoreSeAdmin();
  if (!autore) return { errore: ERRORE_PERMESSO_NEGATO };

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return { errore: "NEXT_PUBLIC_SENTRY_DSN non configurata: Sentry non e' acceso in questo ambiente." };
  }

  const id = Sentry.captureMessage(
    `Prova di diagnostica dal pannello admin (${process.env.VERCEL_ENV ?? "locale"})`,
    "info"
  );
  // Senza questo la segnalazione resta in coda: la funzione serverless finisce
  // e la coda muore con lei, quindi "partita" sarebbe una bugia.
  await Sentry.flush(2000);

  return { ok: true, id };
}
