import "server-only";
import { Resend } from "resend";

let istanza: Resend | null = null;

/**
 * Client Resend lato server -- stesso pattern del client Stripe
 * (src/lib/stripe/server.ts): un'istanza cache, mai esposta al browser
 * ("server-only" fa fallire la build se questo file finisse in un bundle
 * client, prima linea di difesa).
 *
 * A differenza di creaClientStripe/creaClientAdmin -- che lanciano
 * rumorosamente se manca la configurazione, perché lì un fallimento
 * silenzioso nasconderebbe un bug -- qui la mancanza di RESEND_API_KEY
 * ritorna semplicemente `null`: le notifiche via email sono una funzione
 * accessoria (Gruppo B-bis #1 di PIANO.md), mai il cuore del prodotto. Una
 * prenotazione deve sempre riuscire anche se Gabriel non ha ancora creato
 * l'account Resend / impostato la chiave.
 */
function creaClientResend(): Resend | null {
  const chiave = process.env.RESEND_API_KEY;
  if (!chiave) return null;
  if (!istanza) istanza = new Resend(chiave);
  return istanza;
}

export interface ParametriEmail {
  a: string;
  oggetto: string;
  html: string;
}

/**
 * Invia un'email, fail-open per design: se manca RESEND_API_KEY, se Resend
 * risponde con un errore, o se succede qualunque eccezione inattesa, questa
 * funzione NON lancia mai -- logga e ritorna `false`. Chi la chiama (le
 * notifiche di prenotazione in notifiche.server.ts) è a sua volta invocato
 * dentro `creaAppuntamentoTenant`, l'unica funzione di scrittura degli
 * appuntamenti (punto 9 di CLAUDE.md): un problema di invio email non deve
 * MAI far sembrare fallita una prenotazione che sul database è già andata a
 * buon fine.
 */
export async function inviaEmail({ a, oggetto, html }: ParametriEmail): Promise<boolean> {
  const client = creaClientResend();
  if (!client) {
    console.warn(`[email] RESEND_API_KEY non configurata: email a ${a} non inviata.`);
    return false;
  }

  // Dominio di default di Resend, utilizzabile anche senza aver verificato
  // un dominio proprio -- funziona da subito per i test, ma Resend lo
  // limita nella pratica (invii solo verso l'indirizzo dell'account); per
  // inviare davvero ai clienti serve un dominio verificato + RESEND_FROM_EMAIL
  // impostata (vedi .env.example e il messaggio di consegna a Gabriel).
  const mittente = process.env.RESEND_FROM_EMAIL || "Salone AI <onboarding@resend.dev>";

  try {
    const { error } = await client.emails.send({ from: mittente, to: a, subject: oggetto, html });
    if (error) {
      console.error(`[email] Resend ha rifiutato l'invio a ${a}:`, error.message);
      return false;
    }
    return true;
  } catch (erroreInatteso) {
    console.error(`[email] Eccezione inattesa inviando l'email a ${a}:`, erroreInatteso);
    return false;
  }
}
