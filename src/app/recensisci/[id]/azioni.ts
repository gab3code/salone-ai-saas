"use server";

import { revalidatePath } from "next/cache";
import { campoTrappolaCompilato, formPubblicoCompilatoTroppoVeloce } from "@/lib/anti-bot";
import { inserisciRecensionePubblica } from "@/lib/recensioni.server";
import type { RisultatoAzionePubblica } from "@/app/s/[slug]/azioni";

export interface DatiRecensionePubblica {
  valutazione: number;
  commento: string;
  // Anti-bot silenzioso (vedi src/lib/anti-bot.ts), stesso identico pattern
  // di FlussoPrenotazione.tsx: entrambi opzionali e mai popolati da un
  // cliente reale, solo dal componente client.
  trappola?: string;
  iniziatoAlleMs?: number;
}

/**
 * Invia la recensione lasciata dal cliente sul link ricevuto via email
 * (vedi elaboraRichiestaRecensione in recensioni.server.ts). Nessuna
 * autenticazione: stesso modello di sicurezza di
 * `cancellaPrenotazionePubblica` (gestisci/[id]/azioni.ts) -- il possesso
 * dell'id dell'appuntamento (UUID v4, mai indovinabile, ricevuto SOLO via
 * quel link) è la verifica.
 */
export async function inviaRecensionePubblica(
  appuntamentoId: string,
  dati: DatiRecensionePubblica
): Promise<RisultatoAzionePubblica> {
  // Anti-bot silenzioso, controllato per primo (stesso ordine di
  // prenotaPubblico): un bot beccato dal campo trappola riceve una finta
  // conferma, senza scrivere nulla.
  if (campoTrappolaCompilato(dati.trappola)) return { ok: true };
  if (formPubblicoCompilatoTroppoVeloce(dati.iniziatoAlleMs)) {
    return { ok: false, errore: "Richiesta non valida, riprova." };
  }

  const risultato = await inserisciRecensionePubblica(appuntamentoId, dati.valutazione, dati.commento);
  if (!risultato.ok) return risultato;

  revalidatePath(`/recensisci/${appuntamentoId}`);
  return { ok: true };
}
