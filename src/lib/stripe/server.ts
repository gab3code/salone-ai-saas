import "server-only";
import Stripe from "stripe";

let istanza: Stripe | null = null;

/**
 * Client Stripe lato server -- mai importato da un componente client, la
 * secret key non deve mai arrivare al browser. "server-only" fa fallire la
 * build se questo file finisse per sbaglio in un bundle client, stessa
 * protezione già usata per il client Supabase admin (src/lib/supabase/admin.ts).
 */
export function creaClientStripe(): Stripe {
  if (istanza) return istanza;
  const chiave = process.env.STRIPE_SECRET_KEY;
  if (!chiave) {
    throw new Error("STRIPE_SECRET_KEY mancante in .env.local");
  }
  istanza = new Stripe(chiave);
  return istanza;
}
