import { NextRequest, NextResponse } from "next/server";
import { completaCollegamentoWhatsapp } from "@/lib/whatsapp-embedded-signup";
import { creaClientServer } from "@/lib/supabase/server";
import { richiediPermesso, accessoNegato } from "@/lib/permessi.server";
import { puoConfigurareAttivita } from "@/lib/ruoli";

/**
 * Riceve dal browser i dati che Embedded Signup restituisce a fine flusso
 * (code, wabaId, phoneNumberId -- vedi il componente che chiama FB.login,
 * ancora da costruire in Fase 4 UI) e completa il collegamento lato server:
 * scambia il codice per un token, iscrive la nostra app alla WABA del
 * cliente, salva tutto su Supabase con il service_role (mai con la anon key,
 * il token è un segreto).
 *
 * NON ATTIVA finché NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_ENABLED non è "true"
 * (cioè finché l'app Meta della piattaforma non ha completato business
 * verification + App Review -- vedi docs/embedded-signup-whatsapp.md).
 *
 * AUTENTICAZIONE (aggiunta 17/09/2026, controllo notturno). Il TODO qui sotto
 * chiedeva di autenticare la richiesta "quando Supabase sarà collegato":
 * Supabase è collegato da settimane e il controllo non era mai arrivato.
 * L'unica difesa era `NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_ENABLED`, che è
 * una variabile destinata al bundle del browser e serve ad accendere una UI,
 * non a proteggere un endpoint: il giorno del primo test vero questa rotta
 * sarebbe diventata un proxy anonimo verso l'API Graph di Meta con le
 * credenziali della nostra app. Ora serve una sessione owner, come per ogni
 * altra configurazione dell'attività -- e il controllo sta PRIMA di leggere
 * il corpo della richiesta, così un anonimo non arriva nemmeno a farci
 * parsare il suo JSON.
 *
 * TODO rimasto, quando l'app Meta sarà approvata:
 * - upsert su whatsapp_credenziali (tenant_id, access_token, token_scade_il)
 * - update su tenants (whatsapp_business_id, whatsapp_waba_id,
 *   whatsapp_phone_number_id, whatsapp_stato = 'collegato')
 * - insert di riga/righe in whatsapp_collegamento_log per ogni step (utile
 *   per il pannello admin e per il debug se qualcosa fallisce a metà)
 */
export async function POST(request: NextRequest) {
  const supabase = await creaClientServer();
  const accesso = await richiediPermesso(supabase, puoConfigurareAttivita);
  if (accessoNegato(accesso)) {
    return NextResponse.json({ errore: accesso.errore }, { status: 403 });
  }

  if (process.env.NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_ENABLED !== "true") {
    return NextResponse.json(
      {
        errore:
          "Collegamento WhatsApp non ancora attivo su questa piattaforma " +
          "(business verification/App Review Meta non completati).",
      },
      { status: 503 }
    );
  }

  const corpo = await request.json();
  const { code, wabaId, phoneNumberId, numeroMigratoDaAppMobile } = corpo as {
    code?: string;
    wabaId?: string;
    phoneNumberId?: string;
    numeroMigratoDaAppMobile?: boolean;
  };

  if (!code || !wabaId || !phoneNumberId) {
    return NextResponse.json(
      { errore: "Parametri mancanti: servono code, wabaId, phoneNumberId." },
      { status: 400 }
    );
  }

  try {
    const token = await completaCollegamentoWhatsapp({
      code,
      wabaId,
      phoneNumberId,
      numeroMigratoDaAppMobile,
    });

    // TODO: sostituire con il salvataggio reale su Supabase (vedi TODO sopra)
    // appena il progetto e' collegato -- per ora solo conferma che la parte
    // "parlare con Meta" ha funzionato, senza persistere nulla.
    return NextResponse.json({
      collegato: true,
      scadeIl: token.scadeIl?.toISOString() ?? null,
    });
  } catch (errore) {
    console.error("Embedded Signup: collegamento fallito", errore);
    return NextResponse.json(
      { errore: errore instanceof Error ? errore.message : "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
