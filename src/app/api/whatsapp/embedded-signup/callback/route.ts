import { NextRequest, NextResponse } from "next/server";
import { completaCollegamentoWhatsapp } from "@/lib/whatsapp-embedded-signup";

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
 * TODO quando Supabase è collegato (Fase 0 sbloccata):
 * - autenticare la richiesta (deve arrivare da un owner loggato per il proprio tenant)
 * - creare il client Supabase con SUPABASE_SERVICE_ROLE_KEY (mai la anon key qui)
 * - upsert su whatsapp_credenziali (tenant_id, access_token, token_scade_il)
 * - update su tenants (whatsapp_business_id, whatsapp_waba_id,
 *   whatsapp_phone_number_id, whatsapp_stato = 'collegato')
 * - insert di riga/righe in whatsapp_collegamento_log per ogni step (utile
 *   per il pannello admin e per il debug se qualcosa fallisce a metà)
 */
export async function POST(request: NextRequest) {
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
